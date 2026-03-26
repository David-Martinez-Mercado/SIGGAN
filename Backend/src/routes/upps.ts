import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const createUPPSchema = z.object({
  claveUPP: z.string().min(10, 'Clave UPP requerida'),
  nombre: z.string().min(2),
  direccion: z.string().optional(),
  municipio: z.string().min(2),
  estado: z.string().default('Durango'),
  latitud: z.number().optional(),
  longitud: z.number().optional(),
  tipoExplotacion: z.string().optional(),
  superficieHa: z.number().positive().optional(),
  capacidadAnimales: z.number().int().positive().optional(),
  propietarioId: z.string().uuid(),
});

// GET /api/upps
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { buscar, municipio, estatus, propietarioId } = req.query;
    const where: any = { activa: true };

    // PRODUCTOR solo ve sus UPPs
    if (req.userRol === 'PRODUCTOR') {
      const prop = await prisma.propietario.findFirst({ where: { usuarioId: req.userId }, select: { id: true } });
      if (!prop) { res.json([]); return; }
      where.propietarioId = prop.id;
    } else if (propietarioId) {
      where.propietarioId = propietarioId as string;
    }

    if (buscar) {
      where.OR = [
        { claveUPP: { contains: buscar as string, mode: 'insensitive' } },
        { nombre: { contains: buscar as string, mode: 'insensitive' } },
      ];
    }
    if (municipio) where.municipio = municipio as string;
    if (estatus) where.estatusSanitario = estatus as string;

    const upps = await prisma.uPP.findMany({
      where,
      include: {
        propietario: { select: { id: true, nombre: true, apellidos: true } },
        _count: { select: { animales: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    res.json(upps);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener UPPs' });
  }
});

// GET /api/upps/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const upp = await prisma.uPP.findUnique({
      where: { id: req.params.id },
      include: {
        propietario: true,
        animales: {
          where: { activo: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!upp) {
      res.status(404).json({ error: 'UPP no encontrada' });
      return;
    }

    res.json(upp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener UPP' });
  }
});

// POST /api/upps
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createUPPSchema.parse(req.body);
    const upp = await prisma.uPP.create({
      data,
      include: {
        propietario: { select: { id: true, nombre: true, apellidos: true } },
      },
    });
    res.status(201).json(upp);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Datos inválidos', detalles: error.errors });
      return;
    }
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Clave UPP ya registrada' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear UPP' });
  }
});

// PUT /api/upps/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const upp = await prisma.uPP.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(upp);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'UPP no encontrada' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar UPP' });
  }
});

export default router;
