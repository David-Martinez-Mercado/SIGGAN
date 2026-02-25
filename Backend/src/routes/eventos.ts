import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const createEventoSchema = z.object({
  animalId: z.string().uuid('ID de animal inválido'),
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

// GET /api/eventos - Listar eventos con filtros
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { animalId, tipo, resultado, fechaDesde, fechaHasta, page = '1', limit = '20' } = req.query;

    const where: any = {};
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
        where,
        skip,
        take: parseInt(limit as string),
        include: {
          animal: {
            select: {
              id: true,
              areteNacional: true,
              nombre: true,
              raza: true,
              propietario: { select: { nombre: true, apellidos: true } },
              upp: { select: { claveUPP: true, nombre: true, municipio: true } },
            },
          },
        },
        orderBy: { fecha: 'desc' },
      }),
      prisma.eventoSanitario.count({ where }),
    ]);

    res.json({
      data: eventos,
      total,
      pagina: parseInt(page as string),
      totalPaginas: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

// GET /api/eventos/animal/:animalId - Historial de un animal
router.get('/animal/:animalId', async (req: AuthRequest, res: Response) => {
  try {
    const eventos = await prisma.eventoSanitario.findMany({
      where: { animalId: req.params.animalId },
      orderBy: { fecha: 'desc' },
    });

    res.json(eventos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// GET /api/eventos/proximos - Eventos próximos programados
router.get('/proximos/pendientes', async (req: AuthRequest, res: Response) => {
  try {
    const { dias = '30' } = req.query;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + parseInt(dias as string));

    const proximos = await prisma.eventoSanitario.findMany({
      where: {
        proximaFecha: {
          gte: new Date(),
          lte: fechaLimite,
        },
      },
      include: {
        animal: {
          select: {
            id: true,
            areteNacional: true,
            nombre: true,
            propietario: { select: { nombre: true, apellidos: true } },
            upp: { select: { nombre: true, municipio: true } },
          },
        },
      },
      orderBy: { proximaFecha: 'asc' },
    });

    res.json(proximos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener eventos próximos' });
  }
});

// GET /api/eventos/reactores - Animales reactores (positivos a TB/BR)
router.get('/reactores/lista', async (req: AuthRequest, res: Response) => {
  try {
    const reactores = await prisma.eventoSanitario.findMany({
      where: {
        tipo: { in: ['PRUEBA_TB', 'PRUEBA_BR'] },
        resultado: 'POSITIVO',
      },
      include: {
        animal: {
          select: {
            id: true,
            areteNacional: true,
            nombre: true,
            raza: true,
            estatusSanitario: true,
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

// POST /api/eventos - Crear evento sanitario
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createEventoSchema.parse(req.body);

    // Verificar que el animal existe
    const animal = await prisma.animal.findUnique({ where: { id: data.animalId } });
    if (!animal) {
      res.status(404).json({ error: 'Animal no encontrado' });
      return;
    }

    const evento = await prisma.eventoSanitario.create({
      data: {
        ...data,
        proximaFecha: data.proximaFecha || undefined,
      },
      include: {
        animal: {
          select: { id: true, areteNacional: true, nombre: true },
        },
      },
    });

    // Si es prueba TB/BR positiva, actualizar estatus del animal
    if ((data.tipo === 'PRUEBA_TB' || data.tipo === 'PRUEBA_BR') && data.resultado === 'POSITIVO') {
      await prisma.animal.update({
        where: { id: data.animalId },
        data: { estatusSanitario: 'REACTOR' },
      });
    }

    res.status(201).json(evento);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Datos inválidos', detalles: error.errors });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear evento' });
  }
});

// POST /api/eventos/lote - Crear evento para múltiples animales (vacunación masiva)
router.post('/lote', async (req: AuthRequest, res: Response) => {
  try {
    const { animalIds, ...eventoData } = req.body;

    if (!Array.isArray(animalIds) || animalIds.length === 0) {
      res.status(400).json({ error: 'Se requiere al menos un animal' });
      return;
    }

    const eventos = await prisma.$transaction(
      animalIds.map((animalId: string) =>
        prisma.eventoSanitario.create({
          data: {
            ...eventoData,
            animalId,
            fecha: new Date(eventoData.fecha),
            proximaFecha: eventoData.proximaFecha ? new Date(eventoData.proximaFecha) : undefined,
          },
        })
      )
    );

    res.status(201).json({
      message: `${eventos.length} eventos creados exitosamente`,
      total: eventos.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear eventos en lote' });
  }
});

// DELETE /api/eventos/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.eventoSanitario.delete({ where: { id: req.params.id } });
    res.json({ message: 'Evento eliminado' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Evento no encontrado' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar evento' });
  }
});

export default router;
