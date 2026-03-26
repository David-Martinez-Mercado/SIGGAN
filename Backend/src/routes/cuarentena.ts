import { Router, Response } from 'express';
import { authMiddleware, requireRol, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';

const router = Router();
router.use(authMiddleware);

// ─── HELPER: obtener movimientos de una UPP ──────────────────────────────────
async function getMovimientosUPP(uppId: string) {
  const upp = await prisma.uPP.findUnique({
    where: { id: uppId },
    include: { propietario: true },
  });
  if (!upp) return null;

  // Todos los contratos de compraventa APROBADOS
  const contratos = await prisma.formulario.findMany({
    where: { tipo: 'CONTRATO_COMPRAVENTA' as any, estatus: 'APROBADO' },
    orderBy: { updatedAt: 'desc' },
  });

  // Dirección 1: esta UPP VENDIÓ animales → compradores potencialmente en riesgo
  const vendidos = contratos
    .filter((f: any) => f.datos?.vendedorClaveUPP === upp.claveUPP)
    .map((f: any) => ({
      formularioId: f.id,
      folio:             f.datos.folio ?? f.folio,
      animalId:          f.datos.animalId,
      areteAnimal:       f.datos.areteAnimal,
      razaAnimal:        f.datos.razaAnimal,
      fechaContrato:     f.datos.fechaCelebracion ?? f.updatedAt,
      compradorNombre:   f.datos.compradorNombre,
      compradorEmail:    f.datos.compradorEmail,
      compradorUsuarioId:f.datos.compradorUsuarioId,
      compradorRancho:   f.datos.compradorRancho,
      compradorUPPId:    f.datos.compradorUPPId,
      compradorClaveUPP: f.datos.compradorClaveUPP,
      diasTranscurridos: Math.floor((Date.now() - new Date(f.datos.fechaCelebracion ?? f.updatedAt).getTime()) / 86400000),
    }));

  // Dirección 2: esta UPP COMPRÓ animales (animales introducidos desde afuera)
  const comprados = contratos
    .filter((f: any) => f.datos?.compradorUPPId === uppId)
    .map((f: any) => ({
      formularioId:    f.id,
      folio:           f.datos.folio ?? f.folio,
      animalId:        f.datos.animalId,
      areteAnimal:     f.datos.areteAnimal,
      razaAnimal:      f.datos.razaAnimal,
      fechaContrato:   f.datos.fechaCelebracion ?? f.updatedAt,
      vendedorNombre:  f.datos.vendedorNombre,
      vendedorEmail:   f.datos.vendedorEmail,
      vendedorRancho:  f.datos.vendedorRancho,
      vendedorClaveUPP:f.datos.vendedorClaveUPP,
      diasTranscurridos: Math.floor((Date.now() - new Date(f.datos.fechaCelebracion ?? f.updatedAt).getTime()) / 86400000),
    }));

  return { upp, vendidos, comprados };
}

// ─── GET /api/cuarentena/investigar/:uppId ────────────────────────────────────
// Admin: ver movimientos de animales de/hacia una UPP
router.get('/investigar/:uppId', requireRol('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const data = await getMovimientosUPP(req.params.uppId);
    if (!data) { res.status(404).json({ error: 'UPP no encontrada' }); return; }
    res.json(data);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// ─── POST /api/cuarentena/activar/:uppId ─────────────────────────────────────
// Admin: poner UPP en cuarentena y obtener datos de investigación inmediatamente
router.post('/activar/:uppId', requireRol('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { motivo } = req.body;
    const upp = await prisma.uPP.findUnique({ where: { id: req.params.uppId } });
    if (!upp) { res.status(404).json({ error: 'UPP no encontrada' }); return; }

    // Marcar la UPP en cuarentena
    await prisma.uPP.update({
      where: { id: upp.id },
      data: { estatusSanitario: 'EN_CUARENTENA' },
    });

    // Marcar todos los animales activos de esa UPP como CUARENTENADO
    await prisma.animal.updateMany({
      where: { uppId: upp.id, activo: true },
      data: { estatusSanitario: 'CUARENTENADO' },
    });

    // Alerta global en el sistema para los animales de ese rancho
    const animales = await prisma.animal.findMany({
      where: { uppId: upp.id, activo: true }, select: { id: true },
    });
    await prisma.alertaIoT.createMany({
      data: animales.map(a => ({
        tipo: 'CUARENTENA_UPP',
        mensaje: `El rancho "${upp.nombre}" (${upp.claveUPP}) fue puesto en CUARENTENA${motivo ? ': ' + motivo : ''}. Este animal pertenece a dicho rancho.`,
        severidad: 'ALTA',
        animalId: a.id,
        leida: false,
      })),
      skipDuplicates: true,
    });

    const data = await getMovimientosUPP(upp.id);
    res.json({ message: `UPP ${upp.nombre} puesta en cuarentena`, ...data });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al activar cuarentena' }); }
});

// ─── POST /api/cuarentena/levantar/:uppId ────────────────────────────────────
// Admin: levantar cuarentena de una UPP
router.post('/levantar/:uppId', requireRol('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const upp = await prisma.uPP.findUnique({ where: { id: req.params.uppId } });
    if (!upp) { res.status(404).json({ error: 'UPP no encontrada' }); return; }
    await prisma.uPP.update({ where: { id: upp.id }, data: { estatusSanitario: 'LIBRE' } });
    await prisma.animal.updateMany({
      where: { uppId: upp.id, activo: true, estatusSanitario: 'CUARENTENADO' },
      data: { estatusSanitario: 'SANO' },
    });
    res.json({ message: `Cuarentena levantada en ${upp.nombre}` });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// ─── POST /api/cuarentena/accion ─────────────────────────────────────────────
// Admin toma una acción sobre UPPs relacionadas
// Body: { uppOrigenId, uppAfectadaId, accion, mvzUsuarioId?, notas? }
router.post('/accion', requireRol('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { uppOrigenId, uppAfectadaId, accion, mvzUsuarioId, notas } = req.body;
    if (!uppAfectadaId || !accion) {
      res.status(400).json({ error: 'Se requieren uppAfectadaId y accion' }); return;
    }

    const uppAfectada = await prisma.uPP.findUnique({
      where: { id: uppAfectadaId },
      include: { propietario: true },
    });
    if (!uppAfectada) { res.status(404).json({ error: 'UPP afectada no encontrada' }); return; }

    if (accion === 'poner_cuarentena') {
      // Cuarentenar la UPP afectada
      await prisma.uPP.update({
        where: { id: uppAfectadaId },
        data: { estatusSanitario: 'EN_CUARENTENA' },
      });
      await prisma.animal.updateMany({
        where: { uppId: uppAfectadaId, activo: true },
        data: { estatusSanitario: 'CUARENTENADO' },
      });
      // Alerta en sistema para los animales de ese rancho
      const animales = await prisma.animal.findMany({
        where: { uppId: uppAfectadaId, activo: true }, select: { id: true },
      });
      await prisma.alertaIoT.createMany({
        data: animales.map(a => ({
          tipo: 'CUARENTENA_RELACIONADA',
          mensaje: `Tu rancho "${uppAfectada.nombre}" fue puesto en CUARENTENA por relación con otra UPP bajo cuarentena${notas ? '. ' + notas : ''}. Espera instrucciones del veterinario.`,
          severidad: 'ALTA',
          animalId: a.id,
          leida: false,
        })),
        skipDuplicates: true,
      });
      res.json({ message: `UPP ${uppAfectada.nombre} puesta en cuarentena` });

    } else if (accion === 'enviar_mvz') {
      // Notificar al propietario que se enviará un MVZ
      const animales = await prisma.animal.findMany({
        where: { uppId: uppAfectadaId, activo: true }, select: { id: true },
      });
      const mvz = mvzUsuarioId
        ? await prisma.usuario.findUnique({ where: { id: mvzUsuarioId }, select: { nombre: true, apellidos: true } })
        : null;
      await prisma.alertaIoT.createMany({
        data: animales.map(a => ({
          tipo: 'ENVIO_MVZ',
          mensaje: `Se enviará a un Médico Veterinario${mvz ? ` (${mvz.nombre} ${mvz.apellidos})` : ''} a realizar estudios en tu rancho "${uppAfectada.nombre}" como medida preventiva por cuarentena en rancho relacionado${notas ? '. ' + notas : ''}.`,
          severidad: 'MEDIA',
          animalId: a.id,
          leida: false,
        })),
        skipDuplicates: true,
      });
      res.json({ message: `Notificación de envío de MVZ creada para ${uppAfectada.nombre}` });

    } else if (accion === 'nada') {
      // Solo notificar que se revisó y no se toma acción
      const animales = await prisma.animal.findMany({
        where: { uppId: uppAfectadaId, activo: true }, select: { id: true },
      });
      if (animales.length > 0) {
        await prisma.alertaIoT.createMany({
          data: animales.map(a => ({
            tipo: 'INFO_CUARENTENA',
            mensaje: `Tu rancho "${uppAfectada.nombre}" fue revisado por relación con una UPP en cuarentena. Las autoridades determinaron que no se requiere acción adicional${notas ? '. ' + notas : ''}.`,
            severidad: 'BAJA',
            animalId: a.id,
            leida: false,
          })),
          skipDuplicates: true,
        });
      }
      res.json({ message: `Registrado: sin acción para ${uppAfectada.nombre}` });
    } else {
      res.status(400).json({ error: 'Acción no válida. Use: poner_cuarentena, enviar_mvz, nada' });
    }
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al ejecutar acción' }); }
});

// ─── GET /api/cuarentena/mis-alertas ─────────────────────────────────────────
// Propietario: ver alertas de cuarentena de sus animales
router.get('/mis-alertas', async (req: AuthRequest, res: Response) => {
  try {
    const prop = await prisma.propietario.findFirst({
      where: { usuarioId: req.userId! },
      include: { animales: { select: { id: true, areteNacional: true, nombre: true, upp: { select: { nombre: true } } } } },
    });
    if (!prop) { res.json([]); return; }

    const animalIds = prop.animales.map((a: any) => a.id);
    const alertas = await prisma.alertaIoT.findMany({
      where: {
        animalId: { in: animalIds },
        tipo: { in: ['CUARENTENA_UPP', 'CUARENTENA_RELACIONADA', 'ENVIO_MVZ', 'INFO_CUARENTENA'] },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Enriquecer con info del animal
    const animalMap = Object.fromEntries(prop.animales.map((a: any) => [a.id, a]));
    const alertasEnriquecidas = alertas.map((al: any) => ({
      ...al,
      animal: animalMap[al.animalId],
    }));
    res.json(alertasEnriquecidas);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

export default router;
