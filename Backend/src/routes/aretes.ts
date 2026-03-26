import { Router, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, requireRol, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

async function getMiPropietarioId(userId: string): Promise<string | null> {
  const prop = await prisma.propietario.findFirst({ where: { usuarioId: userId }, select: { id: true } });
  return prop?.id || null;
}

// GET /api/aretes/animal/:animalId
router.get('/animal/:animalId', async (req: AuthRequest, res: Response) => {
  try {
    const historial = await prisma.historialArete.findMany({
      where: { animalId: req.params.animalId },
      orderBy: { fecha: 'desc' },
    });
    res.json(historial);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// GET /api/aretes/buscar/:numero
router.get('/buscar/:numero', async (req: AuthRequest, res: Response) => {
  try {
    const registros = await prisma.historialArete.findMany({
      where: { numeroArete: { contains: req.params.numero, mode: 'insensitive' } },
      include: {
        animal: {
          select: {
            id: true, areteNacional: true, nombre: true, raza: true, activo: true,
            propietario: { select: { nombre: true, apellidos: true } },
            upp: { select: { claveUPP: true, nombre: true } },
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });
    res.json(registros);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al buscar arete' });
  }
});

// POST /api/aretes/transferir - Solo el dueño puede transferir
router.post('/transferir', async (req: AuthRequest, res: Response) => {
  try {
    const { animalId, nuevoPropietarioId, nuevaUppId, motivo } = req.body;
    if (!animalId || !nuevoPropietarioId || !nuevaUppId) {
      res.status(400).json({ error: 'Se requiere animalId, nuevoPropietarioId y nuevaUppId' });
      return;
    }

    const animal = await prisma.animal.findUnique({ where: { id: animalId } });
    if (!animal) { res.status(404).json({ error: 'Animal no encontrado' }); return; }

    // Verificar que el usuario es dueño del animal (o admin)
    if (req.userRol === 'PRODUCTOR') {
      const miId = await getMiPropietarioId(req.userId!);
      if (animal.propietarioId !== miId) {
        res.status(403).json({ error: 'Solo puedes transferir tus propios animales' });
        return;
      }
    }

    const [propietario, upp] = await Promise.all([
      prisma.propietario.findUnique({ where: { id: nuevoPropietarioId } }),
      prisma.uPP.findUnique({ where: { id: nuevaUppId } }),
    ]);
    if (!propietario) { res.status(404).json({ error: 'Nuevo propietario no encontrado' }); return; }
    if (!upp) { res.status(404).json({ error: 'Nueva UPP no encontrada' }); return; }

    const resultado = await prisma.$transaction([
      prisma.historialArete.create({
        data: {
          animalId, tipoArete: 'NACIONAL', numeroArete: animal.areteNacional,
          accion: 'TRANSFERIDO', motivo: motivo || `Transferido a ${propietario.nombre} ${propietario.apellidos}`,
        },
      }),
      prisma.animal.update({
        where: { id: animalId },
        data: { propietarioId: nuevoPropietarioId, uppId: nuevaUppId },
        include: {
          propietario: { select: { nombre: true, apellidos: true } },
          upp: { select: { claveUPP: true, nombre: true } },
        },
      }),
    ]);

    res.json({ message: 'Transferencia realizada exitosamente', animal: resultado[1] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al transferir animal' });
  }
});

// ─── POOL DE ARETES ───────────────────────────────────────────────────────────

// GET /api/aretes/pool — Lista aretes disponibles
router.get('/pool', requireRol('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { tipo, soloDisponibles } = req.query;
    const where: any = {};
    if (tipo) where.tipo = tipo;
    if (soloDisponibles === 'true') where.asignado = false;
    const aretes = await prisma.areteDisponible.findMany({ where, orderBy: { numero: 'asc' } });
    res.json(aretes);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// POST /api/aretes/pool — Agregar uno o varios aretes al pool (admin)
// Body: { numeros: string[], tipo: 'NACIONAL'|'EXPORTACION' }
//   o { desde: string, hasta: string, tipo } para rango numérico
router.post('/pool', requireRol('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { numeros, tipo, prefijo, desde, hasta } = req.body;
    if (!tipo || !['NACIONAL', 'EXPORTACION'].includes(tipo)) {
      res.status(400).json({ error: 'tipo debe ser NACIONAL o EXPORTACION' }); return;
    }

    let lista: string[] = [];
    if (numeros && Array.isArray(numeros)) {
      lista = numeros.map((n: string) => String(n).trim()).filter(Boolean);
    } else if (desde && hasta) {
      const d = parseInt(desde); const h = parseInt(hasta);
      if (isNaN(d) || isNaN(h) || d > h) { res.status(400).json({ error: 'Rango inválido' }); return; }
      const pref = prefijo || (tipo === 'NACIONAL' ? 'MX10-' : 'EXP-MX-');
      const pad  = tipo === 'NACIONAL' ? 7 : 7;
      for (let i = d; i <= h; i++) lista.push(`${pref}${String(i).padStart(pad, '0')}`);
    }
    if (!lista.length) { res.status(400).json({ error: 'Proporciona numeros[] o rango desde/hasta' }); return; }

    const creados = await prisma.areteDisponible.createMany({
      data: lista.map(n => ({ numero: n, tipo, asignado: false })),
      skipDuplicates: true,
    });
    res.json({ message: `${creados.count} aretes agregados al pool`, tipo, total: lista.length });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al agregar aretes' }); }
});

// DELETE /api/aretes/pool/:id — Eliminar arete no asignado del pool
router.delete('/pool/:id', requireRol('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const a = await prisma.areteDisponible.findUnique({ where: { id: req.params.id } });
    if (!a) { res.status(404).json({ error: 'No encontrado' }); return; }
    if (a.asignado) { res.status(400).json({ error: 'No se puede eliminar un arete ya asignado' }); return; }
    await prisma.areteDisponible.delete({ where: { id: req.params.id } });
    res.json({ message: 'Eliminado' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// ─── SOLICITUDES DE EXPORTACIÓN ───────────────────────────────────────────────

// GET /api/aretes/exportacion/pendientes — Admin: solicitudes pendientes de asignar arete
router.get('/exportacion/pendientes', requireRol('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const solicitudes = await prisma.formulario.findMany({
      where: { tipo: 'SOLICITUD_ARETES_EXPORTACION' as any, estatus: { in: ['ENVIADO', 'BORRADOR'] } },
      orderBy: { createdAt: 'asc' },
      include: { usuario: { select: { nombre: true, apellidos: true, email: true } } },
    });
    res.json(solicitudes);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// POST /api/aretes/exportacion/:formularioId/aprobar — Admin asigna arete y aprueba
// Body: { areteNumero?: string } — si no se envía, toma uno del pool aleatoriamente
router.post('/exportacion/:formularioId/aprobar', requireRol('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const formulario = await prisma.formulario.findUnique({ where: { id: req.params.formularioId } });
    if (!formulario || formulario.tipo !== 'SOLICITUD_ARETES_EXPORTACION' as any) {
      res.status(404).json({ error: 'Solicitud no encontrada' }); return;
    }
    if (!['ENVIADO', 'BORRADOR'].includes(formulario.estatus)) {
      res.status(400).json({ error: 'Solicitud ya procesada' }); return;
    }

    const d = formulario.datos as any;
    const { areteNumero } = req.body;

    let areteObj: any;
    if (areteNumero) {
      areteObj = await prisma.areteDisponible.findUnique({ where: { numero: areteNumero } });
      if (!areteObj) { res.status(404).json({ error: `Arete ${areteNumero} no está en el pool` }); return; }
      if (areteObj.asignado) { res.status(400).json({ error: `Arete ${areteNumero} ya está asignado` }); return; }
    } else {
      areteObj = await prisma.areteDisponible.findFirst({ where: { tipo: 'EXPORTACION', asignado: false }, orderBy: { numero: 'asc' } });
      if (!areteObj) { res.status(400).json({ error: 'No hay aretes de exportación disponibles en el pool' }); return; }
    }

    // Asignar arete al animal + marcar en pool + aprobar formulario
    await prisma.$transaction([
      prisma.animal.update({
        where: { id: d.animalId },
        data: { areteExportacion: areteObj.numero, proposito: 'Exportación' },
      }),
      prisma.areteDisponible.update({
        where: { id: areteObj.id },
        data: { asignado: true, animalId: d.animalId },
      }),
      prisma.formulario.update({
        where: { id: formulario.id },
        data: { estatus: 'APROBADO', datos: { ...d, areteAsignado: areteObj.numero, aprobadoPor: req.userId, aprobadoEn: new Date().toISOString() } },
      }),
      prisma.historialArete.create({
        data: { animalId: d.animalId, tipoArete: 'EXPORTACION', numeroArete: areteObj.numero, accion: 'ASIGNADO', motivo: `Solicitud aprobada por admin. Folio: ${formulario.folio}` },
      }),
    ]);

    // Alerta al productor
    await prisma.alertaIoT.create({
      data: {
        tipo: 'EXPORTACION_APROBADA',
        mensaje: `Tu solicitud de exportación para el animal ${d.areteAnimal} fue APROBADA. Arete de exportación asignado: ${areteObj.numero}`,
        severidad: 'MEDIA', animalId: d.animalId, leida: false,
      },
    });

    res.json({ message: 'Solicitud aprobada', areteAsignado: areteObj.numero });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al aprobar' }); }
});

// POST /api/aretes/exportacion/:formularioId/rechazar — Admin rechaza solicitud
router.post('/exportacion/:formularioId/rechazar', requireRol('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const formulario = await prisma.formulario.findUnique({ where: { id: req.params.formularioId } });
    if (!formulario || formulario.tipo !== 'SOLICITUD_ARETES_EXPORTACION' as any) {
      res.status(404).json({ error: 'Solicitud no encontrada' }); return;
    }
    const d = formulario.datos as any;
    const { motivo } = req.body;

    await prisma.$transaction([
      // Revertir proposito del animal a vacío si todavía no tenía arete
      prisma.animal.update({
        where: { id: d.animalId },
        data: { proposito: d.propositoAnterior || null },
      }),
      prisma.formulario.update({
        where: { id: formulario.id },
        data: { estatus: 'RECHAZADO', datos: { ...d, motivoRechazo: motivo || '', rechazadoEn: new Date().toISOString() } },
      }),
    ]);

    await prisma.alertaIoT.create({
      data: {
        tipo: 'EXPORTACION_RECHAZADA',
        mensaje: `Tu solicitud de exportación para el animal ${d.areteAnimal} fue RECHAZADA${motivo ? ': ' + motivo : ''}. El animal vuelve a su propósito anterior.`,
        severidad: 'MEDIA', animalId: d.animalId, leida: false,
      },
    });

    res.json({ message: 'Solicitud rechazada' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al rechazar' }); }
});

export default router;
