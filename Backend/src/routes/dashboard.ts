import { Router, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

async function getMiPropietarioId(userId: string): Promise<string | null> {
  const prop = await prisma.propietario.findFirst({ where: { usuarioId: userId }, select: { id: true } });
  return prop?.id || null;
}

// GET /api/dashboard/stats - KPIs principales
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const animalWhere: any = { activo: true };
    const uppWhere: any = { activa: true };
    let miId: string | null = null;

    if (req.userRol === 'PRODUCTOR') {
      miId = await getMiPropietarioId(req.userId!);
      if (!miId) { res.json({ totales: {}, animalesPorSexo: [], animalesPorEstatus: [], ultimosRegistros: [] }); return; }
      animalWhere.propietarioId = miId;
      uppWhere.propietarioId = miId;
    }

    const [
      totalAnimales, totalPropietarios, totalUPPs, totalEventos,
      animalesPorSexo, animalesPorEstatus,
      pesoStats, ultimosRegistros,
      eventosRecientes, ofertasActivas,
    ] = await Promise.all([
      prisma.animal.count({ where: animalWhere }),
      req.userRol === 'PRODUCTOR' ? Promise.resolve(1) : prisma.propietario.count(),
      prisma.uPP.count({ where: uppWhere }),
      prisma.eventoSanitario.count({ where: miId ? { animal: { propietarioId: miId } } : {} }),
      prisma.animal.groupBy({ by: ['sexo'], where: animalWhere, _count: true }),
      prisma.animal.groupBy({ by: ['estatusSanitario'], where: animalWhere, _count: true }),
      prisma.animal.aggregate({ where: { ...animalWhere, peso: { not: null } }, _avg: { peso: true }, _max: { peso: true }, _min: { peso: true } }),
      prisma.animal.findMany({
        where: animalWhere, orderBy: { createdAt: 'desc' }, take: 5,
        select: { id: true, areteNacional: true, nombre: true, raza: true, sexo: true, createdAt: true, propietario: { select: { nombre: true, apellidos: true } } },
      }),
      prisma.eventoSanitario.findMany({
        where: miId ? { animal: { propietarioId: miId } } : {},
        orderBy: { fecha: 'desc' }, take: 5,
        select: { id: true, tipo: true, descripcion: true, resultado: true, fecha: true, animal: { select: { areteNacional: true, nombre: true } } },
      }),
      prisma.ofertaMarketplace.count({ where: { estatus: 'PUBLICADO' } }),
    ]);

    // Animales por propósito
    const animalesPorProposito = await prisma.animal.groupBy({
      by: ['proposito'], where: animalWhere, _count: true,
    });

    // Registros por mes (últimos 6 meses)
    const haceSeismeses = new Date();
    haceSeismeses.setMonth(haceSeismeses.getMonth() - 6);
    const registrosPorMes = await prisma.animal.findMany({
      where: { ...animalWhere, createdAt: { gte: haceSeismeses } },
      select: { createdAt: true },
    });
    const mesesMap: Record<string, number> = {};
    registrosPorMes.forEach(r => {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`;
      mesesMap[key] = (mesesMap[key] || 0) + 1;
    });
    const tendenciaRegistros = Object.entries(mesesMap).sort().map(([mes, total]) => ({ mes, total }));

    // Eventos por tipo
    const eventosPorTipo = await prisma.eventoSanitario.groupBy({
      by: ['tipo'],
      where: miId ? { animal: { propietarioId: miId } } : {},
      _count: true,
    });

    res.json({
      totales: { animales: totalAnimales, propietarios: totalPropietarios, upps: totalUPPs, eventos: totalEventos, ofertasActivas },
      animalesPorSexo, animalesPorEstatus,
      animalesPorProposito: animalesPorProposito.map(p => ({ proposito: p.proposito || 'Sin definir', total: p._count })),
      peso: { promedio: pesoStats._avg.peso, max: pesoStats._max.peso, min: pesoStats._min.peso },
      tendenciaRegistros,
      eventosPorTipo: eventosPorTipo.map(e => ({ tipo: e.tipo, total: e._count })),
      eventosRecientes,
      ultimosRegistros,
    });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al obtener estadísticas' }); }
});

// GET /api/dashboard/notificaciones - Centro de notificaciones
router.get('/notificaciones', async (req: AuthRequest, res: Response) => {
  try {
    const miId = await getMiPropietarioId(req.userId!);
    const notificaciones: any[] = [];

    // 1. Alertas IoT no leídas
    try {
      const alertasIoT = await prisma.alertaIoT.findMany({
        where: { leida: false }, orderBy: { timestamp: 'desc' }, take: 10,
      });
      alertasIoT.forEach(a => notificaciones.push({
        id: a.id, tipo: 'IOT', icono: '📡', titulo: a.tipo.replace(/_/g, ' '),
        mensaje: a.mensaje, severidad: a.severidad,
        fecha: a.timestamp, leida: false, accion: '/iot',
      }));
    } catch (e) { /* tabla puede no existir */ }

    // 2. Ofertas de marketplace (si soy vendedor y tengo ofertas pendientes)
    if (miId) {
      const ofertasPendientes = await prisma.ofertaMarketplace.findMany({
        where: { vendedorId: miId, estatus: 'CON_OFERTA' },
        include: { animal: { select: { areteNacional: true, nombre: true } }, comprador: { select: { nombre: true, apellidos: true } } },
      });
      ofertasPendientes.forEach(o => notificaciones.push({
        id: o.id, tipo: 'MARKETPLACE', icono: '🛒', titulo: 'Oferta de compra',
        mensaje: `${o.comprador?.nombre} ${o.comprador?.apellidos} quiere comprar ${o.animal.areteNacional} (${o.animal.nombre || ''})`,
        severidad: 'MEDIA', fecha: o.fechaPublicacion, leida: false, accion: '/marketplace',
      }));

      // Ofertas que compré y fueron aceptadas
      const comprasAceptadas = await prisma.ofertaMarketplace.findMany({
        where: { compradorId: miId, estatus: 'TRANSFERIDA' },
        include: { animal: { select: { areteNacional: true, nombre: true } } },
        orderBy: { fechaPublicacion: 'desc' }, take: 5,
      });
      comprasAceptadas.forEach(o => notificaciones.push({
        id: o.id + '-compra', tipo: 'MARKETPLACE', icono: '✅', titulo: 'Compra exitosa',
        mensaje: `Tu compra de ${o.animal.areteNacional} fue aceptada y transferida`,
        severidad: 'BAJA', fecha: o.fechaPublicacion, leida: true, accion: '/marketplace',
      }));
    }

    // 3. Formularios: pendientes de aprobación (para admin)
    if (req.userRol === 'ADMIN') {
      const formsPendientes = await prisma.formulario.findMany({
        where: { estatus: 'ENVIADO' }, orderBy: { createdAt: 'desc' }, take: 10,
        include: { usuario: { select: { nombre: true, apellidos: true } } },
      });
      formsPendientes.forEach(f => notificaciones.push({
        id: f.id, tipo: 'SENASICA', icono: '📋', titulo: `${f.tipo.replace(/_/g, ' ')} pendiente`,
        mensaje: `${f.folio} — enviado por ${f.usuario.nombre} ${f.usuario.apellidos}`,
        severidad: 'MEDIA', fecha: f.createdAt, leida: false, accion: '/formularios',
      }));
    }

    // 4. Formularios: rechazados (para el creador)
    const formsRechazados = await prisma.formulario.findMany({
      where: { estatus: 'RECHAZADO', usuarioId: req.userId },
      orderBy: { updatedAt: 'desc' }, take: 5,
    });
    formsRechazados.forEach(f => notificaciones.push({
      id: f.id + '-rej', tipo: 'SENASICA', icono: '❌', titulo: 'Formulario rechazado',
      mensaje: `${f.folio} fue rechazado`,
      severidad: 'ALTA', fecha: f.updatedAt, leida: false, accion: '/formularios',
    }));

    // 5. Formularios aprobados (para el creador)
    const formsAprobados = await prisma.formulario.findMany({
      where: { estatus: 'APROBADO', usuarioId: req.userId },
      orderBy: { updatedAt: 'desc' }, take: 5,
    });
    formsAprobados.forEach(f => notificaciones.push({
      id: f.id + '-apr', tipo: 'SENASICA', icono: '✅', titulo: 'Formulario aprobado',
      mensaje: `${f.folio} fue aprobado`,
      severidad: 'BAJA', fecha: f.updatedAt, leida: true, accion: '/formularios',
    }));

    // 6. Animales con estatus preocupante
    if (miId) {
      const reactores = await prisma.animal.findMany({
        where: { propietarioId: miId, estatusSanitario: { in: ['REACTOR', 'CUARENTENADO'] } },
        select: { id: true, areteNacional: true, nombre: true, estatusSanitario: true },
      });
      reactores.forEach(a => notificaciones.push({
        id: a.id + '-reactor', tipo: 'SANITARIO', icono: '⚠️', titulo: `Animal ${a.estatusSanitario}`,
        mensaje: `${a.areteNacional} (${a.nombre || 'Sin nombre'}) requiere atención`,
        severidad: 'ALTA', fecha: new Date(), leida: false, accion: `/animales/${a.id}`,
      }));
    }

    // Ordenar por fecha desc y no leídas primero
    notificaciones.sort((a, b) => {
      if (a.leida !== b.leida) return a.leida ? 1 : -1;
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });

    const noLeidas = notificaciones.filter(n => !n.leida).length;
    res.json({ total: notificaciones.length, noLeidas, notificaciones });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al obtener notificaciones' }); }
});

export default router;
