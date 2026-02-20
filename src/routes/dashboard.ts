import { Router, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/dashboard/stats
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalAnimales,
      totalPropietarios,
      totalUPPs,
      animalesPorSexo,
      animalesPorEstatus,
      ultimosRegistros,
    ] = await Promise.all([
      prisma.animal.count({ where: { activo: true } }),
      prisma.propietario.count(),
      prisma.uPP.count({ where: { activa: true } }),
      prisma.animal.groupBy({
        by: ['sexo'],
        where: { activo: true },
        _count: true,
      }),
      prisma.animal.groupBy({
        by: ['estatusSanitario'],
        where: { activo: true },
        _count: true,
      }),
      prisma.animal.findMany({
        where: { activo: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          areteNacional: true,
          raza: true,
          sexo: true,
          createdAt: true,
          propietario: { select: { nombre: true, apellidos: true } },
        },
      }),
    ]);

    res.json({
      totales: {
        animales: totalAnimales,
        propietarios: totalPropietarios,
        upps: totalUPPs,
      },
      animalesPorSexo,
      animalesPorEstatus,
      ultimosRegistros,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

export default router;
