import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { registrarPorId } from '../services/blockchain.service';

const router = Router();
router.use(authMiddleware);

const createEventoSchema = z.object({
  animalId: z.string().uuid(),
  tipo: z.enum(['VACUNACION', 'PRUEBA_TB', 'PRUEBA_BR', 'DESPARASITACION', 'TRATAMIENTO', 'PESAJE', 'INSPECCION', 'OTRO']),
  descripcion: z.string().optional(),
  fecha: z.string().transform(s => new Date(s)),
  resultado: z.string().optional(),
  mvzResponsable: z.string().optional(),
  cedulaMvz: z.string().optional(),
  observaciones: z.string().optional(),
  lote: z.string().optional(),
  proximaFecha: z.string().transform(s => new Date(s)).optional(),
});

async function getMiPropietarioId(userId: string): Promise<string | null> {
  const prop = await prisma.propietario.findFirst({ where: { usuarioId: userId }, select: { id: true } });
  return prop?.id || null;
}

// GET /api/eventos
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { animalId, tipo, resultado, fechaDesde, fechaHasta, page = '1', limit = '50' } = req.query;
    const where: any = {};

    // PRODUCTOR solo ve eventos de sus animales
    if (req.userRol === 'PRODUCTOR') {
      const miId = await getMiPropietarioId(req.userId!);
      if (!miId) { res.json({ data: [], total: 0 }); return; }
      where.animal = { propietarioId: miId };
    }

    if (animalId) where.animalId = animalId as string;
    if (tipo) where.tipo = tipo as string;
    if (resultado) where.resultado = resultado as string;
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha.gte = new Date(fechaDesde as string);
      if (fechaHasta) where.fecha.lte = new Date(fechaHasta as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [eventos, total] = await Promise.all([
      prisma.eventoSanitario.findMany({
        where, skip, take: parseInt(limit as string),
        include: {
          animal: {
            select: {
              id: true, areteNacional: true, nombre: true, raza: true,
              propietario: { select: { nombre: true, apellidos: true } },
              upp: { select: { claveUPP: true, nombre: true, municipio: true } },
            },
          },
        },
        orderBy: { fecha: 'desc' },
      }),
      prisma.eventoSanitario.count({ where }),
    ]);

    res.json({ data: eventos, total, pagina: parseInt(page as string), totalPaginas: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

// GET /api/eventos/reactores/lista
router.get('/reactores/lista', async (req: AuthRequest, res: Response) => {
  try {
    const where: any = { tipo: { in: ['PRUEBA_TB', 'PRUEBA_BR'] }, resultado: 'POSITIVO' };

    if (req.userRol === 'PRODUCTOR') {
      const miId = await getMiPropietarioId(req.userId!);
      if (miId) where.animal = { propietarioId: miId };
    }

    const reactores = await prisma.eventoSanitario.findMany({
      where,
      include: {
        animal: {
          select: {
            id: true, areteNacional: true, nombre: true, raza: true, estatusSanitario: true,
            propietario: { select: { nombre: true, apellidos: true, telefono: true } },
            upp: { select: { claveUPP: true, nombre: true, municipio: true } },
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });

    res.json(reactores);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener reactores' });
  }
});

// POST /api/eventos - SOLO MVZ y ADMIN
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRol !== 'MVZ' && req.userRol !== 'ADMIN') {
      res.status(403).json({ error: 'Solo un Médico Veterinario (MVZ) puede registrar eventos sanitarios' });
      return;
    }

    const data = createEventoSchema.parse(req.body);
    const animal = await prisma.animal.findUnique({ where: { id: data.animalId } });
    if (!animal) { res.status(404).json({ error: 'Animal no encontrado' }); return; }

    const evento = await prisma.eventoSanitario.create({
      data: { ...data, proximaFecha: data.proximaFecha || undefined },
      include: { animal: { select: { id: true, areteNacional: true, nombre: true } } },
    });

    if ((data.tipo === 'PRUEBA_TB' || data.tipo === 'PRUEBA_BR') && data.resultado === 'POSITIVO') {
      await prisma.animal.update({ where: { id: data.animalId }, data: { estatusSanitario: 'REACTOR' } });
    }

    // Registrar evento en blockchain automáticamente
    registrarPorId('evento', evento.id).catch(e => console.error('[blockchain] error registrar evento:', e));

    res.status(201).json(evento);
  } catch (error: any) {
    if (error.name === 'ZodError') { res.status(400).json({ error: 'Datos inválidos', detalles: error.errors }); return; }
    console.error(error);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

// POST /api/eventos/lote - SOLO MVZ y ADMIN
router.post('/lote', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRol !== 'MVZ' && req.userRol !== 'ADMIN') {
      res.status(403).json({ error: 'Solo un Médico Veterinario (MVZ) puede registrar eventos sanitarios' });
      return;
    }

    const { animalIds, ...eventoData } = req.body;
    if (!Array.isArray(animalIds) || animalIds.length === 0) {
      res.status(400).json({ error: 'Se requiere al menos un animal' });
      return;
    }

    const eventos = await prisma.$transaction(
      animalIds.map((animalId: string) =>
        prisma.eventoSanitario.create({
          data: { ...eventoData, animalId, fecha: new Date(eventoData.fecha), proximaFecha: eventoData.proximaFecha ? new Date(eventoData.proximaFecha) : undefined },
        })
      )
    );

    res.status(201).json({ message: `${eventos.length} eventos creados exitosamente`, total: eventos.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear eventos en lote' });
  }
});

// DELETE /api/eventos/:id - SOLO MVZ y ADMIN
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRol !== 'MVZ' && req.userRol !== 'ADMIN') {
      res.status(403).json({ error: 'Solo MVZ o Admin pueden eliminar eventos' });
      return;
    }
    await prisma.eventoSanitario.delete({ where: { id: req.params.id } });
    res.json({ message: 'Evento eliminado' });
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'Evento no encontrado' }); return; }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
});

export default router;
