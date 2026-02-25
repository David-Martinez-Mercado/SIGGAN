import { Router, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

async function getMiPropietarioId(userId: string): Promise<string | null> {
  const prop = await prisma.propietario.findFirst({
    where: { usuarioId: userId }, select: { id: true },
  });
  return prop?.id || null;
}

router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const animalWhere: any = { activo: true };
    const uppWhere: any = { activa: true };

    if (req.userRol === 'PRODUCTOR') {
      const miId = await getMiPropietarioId(req.userId!);
      if (!miId) {
        res.json({ totales: { animales: 0, propietarios: 0, upps: 0 }, animalesPorSexo: [], animalesPorEstatus: [], ultimosRegistros: [] });
        return;
      }
      animalWhere.propietarioId = miId;
      uppWhere.propietarioId = miId;
    }

    const [totalAnimales, totalPropietarios, totalUPPs, animalesPorSexo, animalesPorEstatus, ultimosRegistros] = await Promise.all([
      prisma.animal.count({ where: animalWhere }),
      req.userRol === 'PRODUCTOR' ? Promise.resolve(1) : prisma.propietario.count(),
      prisma.uPP.count({ where: uppWhere }),
      prisma.animal.groupBy({ by: ['sexo'], where: animalWhere, _count: true }),
      prisma.animal.groupBy({ by: ['estatusSanitario'], where: animalWhere, _count: true }),
      prisma.animal.findMany({
        where: animalWhere, orderBy: { createdAt: 'desc' }, take: 5,
        select: {
          id: true, areteNacional: true, raza: true, sexo: true, createdAt: true,
          propietario: { select: { nombre: true, apellidos: true } },
        },
      }),
    ]);

    res.json({ totales: { animales: totalAnimales, propietarios: totalPropietarios, upps: totalUPPs }, animalesPorSexo, animalesPorEstatus, ultimosRegistros });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

export default router;
