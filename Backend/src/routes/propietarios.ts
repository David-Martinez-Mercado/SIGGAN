import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Middleware: Solo ADMIN puede acceder a propietarios
const soloAdmin = (req: AuthRequest, res: Response, next: Function) => {
  if (req.userRol !== 'ADMIN') {
    res.status(403).json({ error: 'Solo el administrador puede ver la lista de propietarios' });
    return;
  }
  next();
};

const createPropietarioSchema = z.object({
  nombre: z.string().min(2),
  apellidos: z.string().min(2),
  email: z.string().email().optional(),
  curp: z.string().length(18, 'CURP debe tener 18 caracteres').optional(),
  rfc: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  municipio: z.string().min(2),
  estado: z.string().default('Durango'),
});

// GET /api/propietarios - SOLO ADMIN
router.get('/', soloAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { buscar, municipio } = req.query;
    const where: any = {};
    if (buscar) {
      where.OR = [
        { nombre: { contains: buscar as string, mode: 'insensitive' } },
        { apellidos: { contains: buscar as string, mode: 'insensitive' } },
        { curp: { contains: buscar as string, mode: 'insensitive' } },
      ];
    }
    if (municipio) where.municipio = municipio as string;

    const propietarios = await prisma.propietario.findMany({
      where,
      include: { _count: { select: { animales: true, upps: true } } },
      orderBy: { nombre: 'asc' },
    });
    res.json(propietarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener propietarios' });
  }
});

// GET /api/propietarios/:id - SOLO ADMIN
router.get('/:id', soloAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const propietario = await prisma.propietario.findUnique({
      where: { id: req.params.id },
      include: { upps: true, animales: { where: { activo: true }, include: { upp: { select: { claveUPP: true, nombre: true } } } } },
    });
    if (!propietario) { res.status(404).json({ error: 'Propietario no encontrado' }); return; }
    res.json(propietario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener propietario' });
  }
});

// POST /api/propietarios - SOLO ADMIN
router.post('/', soloAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const data = createPropietarioSchema.parse(req.body);
    const propietario = await prisma.propietario.create({ data });
    res.status(201).json(propietario);
  } catch (error: any) {
    if (error.name === 'ZodError') { res.status(400).json({ error: 'Datos inválidos', detalles: error.errors }); return; }
    if (error.code === 'P2002') { res.status(409).json({ error: 'CURP ya registrado' }); return; }
    console.error(error);
    res.status(500).json({ error: 'Error al crear propietario' });
  }
});

router.put('/:id', soloAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const propietario = await prisma.propietario.update({ where: { id: req.params.id }, data: req.body });
    res.json(propietario);
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'Propietario no encontrado' }); return; }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

export default router;
