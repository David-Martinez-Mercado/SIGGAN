import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

const createAnimalSchema = z.object({
  areteNacional: z.string().min(10, 'Arete nacional requerido'),
  areteExportacion: z.string().optional(),
  rfidTag: z.string().optional(),
  nombre: z.string().optional(),
  raza: z.string().min(2, 'Raza requerida'),
  sexo: z.enum(['MACHO', 'HEMBRA']),
  fechaNacimiento: z.string().transform(s => new Date(s)),
  color: z.string().optional(),
  peso: z.number().positive().optional(),
  proposito: z.string().optional(),
  propietarioId: z.string().uuid(),
  uppId: z.string().uuid(),
  madreId: z.string().uuid().optional(),
});

// GET /api/animales - Listar todos con filtros
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20', buscar, raza, sexo, estatus, uppId, propietarioId } = req.query;

    const where: any = { activo: true };
    if (buscar) {
      where.OR = [
        { areteNacional: { contains: buscar as string, mode: 'insensitive' } },
        { nombre: { contains: buscar as string, mode: 'insensitive' } },
        { rfidTag: { contains: buscar as string, mode: 'insensitive' } },
      ];
    }
    if (raza) where.raza = raza as string;
    if (sexo) where.sexo = sexo as string;
    if (estatus) where.estatusSanitario = estatus as string;
    if (uppId) where.uppId = uppId as string;
    if (propietarioId) where.propietarioId = propietarioId as string;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [animales, total] = await Promise.all([
      prisma.animal.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        include: {
          propietario: { select: { id: true, nombre: true, apellidos: true } },
          upp: { select: { id: true, claveUPP: true, nombre: true, municipio: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.animal.count({ where }),
    ]);

    res.json({
      data: animales,
      total,
      pagina: parseInt(page as string),
      totalPaginas: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener animales' });
  }
});

// GET /api/animales/:id - Detalle de un animal
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const animal = await prisma.animal.findUnique({
      where: { id: req.params.id },
      include: {
        propietario: true,
        upp: true,
        eventos: { orderBy: { fecha: 'desc' }, take: 20 },
        aretes: { orderBy: { fecha: 'desc' } },
        lecturas: { orderBy: { timestamp: 'desc' }, take: 10 },
        madre: { select: { id: true, areteNacional: true, nombre: true } },
        crias: { select: { id: true, areteNacional: true, nombre: true, sexo: true } },
      },
    });

    if (!animal) {
      res.status(404).json({ error: 'Animal no encontrado' });
      return;
    }

    res.json(animal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener animal' });
  }
});

// GET /api/animales/arete/:arete - Buscar por número de arete
router.get('/arete/:arete', async (req: AuthRequest, res: Response) => {
  try {
    const animal = await prisma.animal.findFirst({
      where: {
        OR: [
          { areteNacional: req.params.arete },
          { areteExportacion: req.params.arete },
        ],
      },
      include: {
        propietario: true,
        upp: true,
        eventos: { orderBy: { fecha: 'desc' }, take: 5 },
      },
    });

    if (!animal) {
      res.status(404).json({ error: 'Animal no encontrado con ese arete' });
      return;
    }

    res.json(animal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al buscar por arete' });
  }
});

// POST /api/animales - Registrar nuevo animal
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createAnimalSchema.parse(req.body);

    const animal = await prisma.animal.create({
      data: {
        ...data,
      },
      include: {
        propietario: { select: { id: true, nombre: true, apellidos: true } },
        upp: { select: { id: true, claveUPP: true, nombre: true } },
      },
    });

    // Crear registro en historial de aretes
    await prisma.historialArete.create({
      data: {
        animalId: animal.id,
        tipoArete: 'NACIONAL',
        numeroArete: animal.areteNacional,
        accion: 'ASIGNADO',
        motivo: 'Registro inicial',
      },
    });

    res.status(201).json(animal);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Datos inválidos', detalles: error.errors });
      return;
    }
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'El arete ya está registrado' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar animal' });
  }
});

// PUT /api/animales/:id - Actualizar animal
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const animal = await prisma.animal.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        propietario: { select: { id: true, nombre: true, apellidos: true } },
        upp: { select: { id: true, claveUPP: true, nombre: true } },
      },
    });

    res.json(animal);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Animal no encontrado' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar animal' });
  }
});

// DELETE /api/animales/:id - Baja lógica
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.animal.update({
      where: { id: req.params.id },
      data: { activo: false },
    });

    res.json({ message: 'Animal dado de baja correctamente' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Animal no encontrado' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Error al dar de baja' });
  }
});

export default router;
