import { Router, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

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

export default router;
