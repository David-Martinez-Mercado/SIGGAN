import { Router, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { registrarPorId } from '../services/blockchain.service';

const router = Router();
router.use(authMiddleware);

async function getMiPropietarioId(userId: string): Promise<string | null> {
  const prop = await prisma.propietario.findFirst({ where: { usuarioId: userId }, select: { id: true } });
  return prop?.id || null;
}

// GET /api/marketplace - Ofertas publicadas (todos)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { estatus = 'PUBLICADO' } = req.query;
    const ofertas = await prisma.ofertaMarketplace.findMany({
      where: { estatus: estatus as string },
      include: {
        animal: {
          select: {
            id: true, areteNacional: true, nombre: true, raza: true, sexo: true,
            color: true, peso: true, fechaNacimiento: true, estatusSanitario: true, proposito: true,
            upp: { select: { municipio: true } },
          },
        },
        vendedor: { select: { nombre: true, apellidos: true, municipio: true } },
      },
      orderBy: { fechaPublicacion: 'desc' },
    });
    res.json(ofertas);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al obtener ofertas' }); }
});

// GET /api/marketplace/mis-ofertas
router.get('/mis-ofertas', async (req: AuthRequest, res: Response) => {
  try {
    const miId = await getMiPropietarioId(req.userId!);
    if (!miId) { res.json([]); return; }
    const ofertas = await prisma.ofertaMarketplace.findMany({
      where: { OR: [{ vendedorId: miId }, { compradorId: miId }] },
      include: {
        animal: { select: { id: true, areteNacional: true, nombre: true, raza: true } },
        vendedor: { select: { nombre: true, apellidos: true } },
        comprador: { select: { nombre: true, apellidos: true } },
      },
      orderBy: { fechaPublicacion: 'desc' },
    });
    res.json(ofertas);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

// POST /api/marketplace - Poner a la venta (SOLO PRODUCTOR dueño)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRol !== 'PRODUCTOR') {
      res.status(403).json({ error: 'Solo los productores pueden poner animales a la venta' }); return;
    }

    const { animalId, precioSolicitado, descripcion, motivoVenta } = req.body;
    if (!animalId || !precioSolicitado) { res.status(400).json({ error: 'animalId y precioSolicitado requeridos' }); return; }

    const animal = await prisma.animal.findUnique({ where: { id: animalId } });
    if (!animal) { res.status(404).json({ error: 'Animal no encontrado' }); return; }

    const miId = await getMiPropietarioId(req.userId!);
    if (animal.propietarioId !== miId) {
      res.status(403).json({ error: 'Solo puedes vender tus propios animales' }); return;
    }

    const existe = await prisma.ofertaMarketplace.findFirst({
      where: { animalId, estatus: { in: ['PUBLICADO', 'CON_OFERTA'] } },
    });
    if (existe) { res.status(409).json({ error: 'Este animal ya tiene una oferta activa' }); return; }

    const oferta = await prisma.ofertaMarketplace.create({
      data: { animalId, vendedorId: animal.propietarioId, precioSolicitado: parseFloat(precioSolicitado), descripcion, motivoVenta, estatus: 'PUBLICADO' },
      include: { animal: { select: { areteNacional: true, nombre: true, raza: true } } },
    });
    res.status(201).json(oferta);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al publicar' }); }
});

// PUT /api/marketplace/:id/ofertar - Comprador acepta al precio publicado
router.put('/:id/ofertar', async (req: AuthRequest, res: Response) => {
  try {
    const miId = await getMiPropietarioId(req.userId!);
    if (!miId) { res.status(400).json({ error: 'No tienes perfil de propietario' }); return; }

    const oferta = await prisma.ofertaMarketplace.findUnique({ where: { id: req.params.id } });
    if (!oferta) { res.status(404).json({ error: 'Oferta no encontrada' }); return; }
    if (oferta.estatus !== 'PUBLICADO') { res.status(400).json({ error: 'Oferta ya no disponible' }); return; }
    if (oferta.vendedorId === miId) { res.status(400).json({ error: 'No puedes comprar tu propio animal' }); return; }

    const actualizada = await prisma.ofertaMarketplace.update({
      where: { id: req.params.id },
      data: { compradorId: miId, precioOfertado: oferta.precioSolicitado, estatus: 'CON_OFERTA' },
    });
    res.json({ message: 'Oferta enviada al vendedor', oferta: actualizada });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al ofertar' }); }
});

// PUT /api/marketplace/:id/aceptar - Vendedor acepta y transfiere
router.put('/:id/aceptar', async (req: AuthRequest, res: Response) => {
  try {
    const oferta = await prisma.ofertaMarketplace.findUnique({
      where: { id: req.params.id },
      include: { animal: true, comprador: { include: { upps: { take: 1 } } } },
    });
    if (!oferta) { res.status(404).json({ error: 'Oferta no encontrada' }); return; }
    if (oferta.estatus !== 'CON_OFERTA') { res.status(400).json({ error: 'No hay oferta pendiente' }); return; }

    const miId = await getMiPropietarioId(req.userId!);
    if (req.userRol === 'PRODUCTOR' && oferta.vendedorId !== miId) {
      res.status(403).json({ error: 'Solo el vendedor puede aceptar' }); return;
    }
    if (!oferta.comprador?.upps?.[0]) { res.status(400).json({ error: 'Comprador no tiene UPP' }); return; }

    await prisma.$transaction([
      prisma.ofertaMarketplace.update({ where: { id: req.params.id }, data: { estatus: 'TRANSFERIDA' } }),
      prisma.historialArete.create({
        data: {
          animalId: oferta.animalId, tipoArete: 'NACIONAL', numeroArete: oferta.animal.areteNacional,
          accion: 'TRANSFERIDO', motivo: `Venta marketplace $${oferta.precioOfertado || oferta.precioSolicitado}`,
        },
      }),
      prisma.animal.update({
        where: { id: oferta.animalId },
        data: { propietarioId: oferta.compradorId!, uppId: oferta.comprador!.upps[0].id },
      }),
    ]);

    // Registrar venta cerrada en blockchain automáticamente
    registrarPorId('venta', req.params.id as string).catch(e => console.error('[blockchain] error registrar venta:', e));
    // Re-registrar el animal con su nuevo propietario
    registrarPorId('animal', oferta.animalId).catch(e => console.error('[blockchain] error re-registrar animal tras venta:', e));

    res.json({ message: 'Venta completada. Animal transferido al comprador.' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al aceptar' }); }
});

// PUT /api/marketplace/:id/cancelar
router.put('/:id/cancelar', async (req: AuthRequest, res: Response) => {
  try {
    const oferta = await prisma.ofertaMarketplace.findUnique({ where: { id: req.params.id } });
    if (!oferta) { res.status(404).json({ error: 'No encontrada' }); return; }
    const miId = await getMiPropietarioId(req.userId!);
    if (req.userRol === 'PRODUCTOR' && oferta.vendedorId !== miId) {
      res.status(403).json({ error: 'Solo el vendedor puede cancelar' }); return;
    }
    await prisma.ofertaMarketplace.update({ where: { id: req.params.id }, data: { estatus: 'CANCELADA' } });
    res.json({ message: 'Oferta cancelada' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

export default router;
