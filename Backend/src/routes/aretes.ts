import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const createAreteSchema = z.object({
  animalId: z.string().uuid(),
  tipoArete: z.enum(['NACIONAL', 'EXPORTACION', 'RFID']),
  numeroArete: z.string().min(5),
  accion: z.enum(['ASIGNADO', 'BAJA', 'REEMPLAZO', 'TRANSFERIDO']),
  motivo: z.string().optional(),
});

// GET /api/aretes/animal/:animalId - Historial de aretes de un animal
router.get('/animal/:animalId', async (req: AuthRequest, res: Response) => {
  try {
    const historial = await prisma.historialArete.findMany({
      where: { animalId: req.params.animalId },
      orderBy: { fecha: 'desc' },
    });

    res.json(historial);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener historial de aretes' });
  }
});

// GET /api/aretes/buscar/:numero - Buscar por número de arete (en historial)
router.get('/buscar/:numero', async (req: AuthRequest, res: Response) => {
  try {
    const registros = await prisma.historialArete.findMany({
      where: {
        numeroArete: { contains: req.params.numero, mode: 'insensitive' },
      },
      include: {
        animal: {
          select: {
            id: true,
            areteNacional: true,
            nombre: true,
            raza: true,
            activo: true,
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

// POST /api/aretes - Registrar movimiento de arete
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createAreteSchema.parse(req.body);

    // Verificar que el animal existe
    const animal = await prisma.animal.findUnique({ where: { id: data.animalId } });
    if (!animal) {
      res.status(404).json({ error: 'Animal no encontrado' });
      return;
    }

    const registro = await prisma.historialArete.create({ data });

    // Si es asignación de arete de exportación, actualizar el animal
    if (data.accion === 'ASIGNADO' && data.tipoArete === 'EXPORTACION') {
      await prisma.animal.update({
        where: { id: data.animalId },
        data: { areteExportacion: data.numeroArete },
      });
    }

    // Si es asignación de RFID, actualizar el animal
    if (data.accion === 'ASIGNADO' && data.tipoArete === 'RFID') {
      await prisma.animal.update({
        where: { id: data.animalId },
        data: { rfidTag: data.numeroArete },
      });
    }

    res.status(201).json(registro);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Datos inválidos', detalles: error.errors });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar movimiento de arete' });
  }
});

// POST /api/aretes/transferir - Transferir animal a nuevo propietario
router.post('/transferir', async (req: AuthRequest, res: Response) => {
  try {
    const { animalId, nuevoPropietarioId, nuevaUppId, motivo } = req.body;

    if (!animalId || !nuevoPropietarioId || !nuevaUppId) {
      res.status(400).json({ error: 'Se requiere animalId, nuevoPropietarioId y nuevaUppId' });
      return;
    }

    // Verificar que existen
    const [animal, propietario, upp] = await Promise.all([
      prisma.animal.findUnique({ where: { id: animalId } }),
      prisma.propietario.findUnique({ where: { id: nuevoPropietarioId } }),
      prisma.uPP.findUnique({ where: { id: nuevaUppId } }),
    ]);

    if (!animal) { res.status(404).json({ error: 'Animal no encontrado' }); return; }
    if (!propietario) { res.status(404).json({ error: 'Nuevo propietario no encontrado' }); return; }
    if (!upp) { res.status(404).json({ error: 'Nueva UPP no encontrada' }); return; }

    // Realizar transferencia en una transacción
    const resultado = await prisma.$transaction([
      // Registrar en historial de aretes
      prisma.historialArete.create({
        data: {
          animalId,
          tipoArete: 'NACIONAL',
          numeroArete: animal.areteNacional,
          accion: 'TRANSFERIDO',
          motivo: motivo || `Transferido a ${propietario.nombre} ${propietario.apellidos}`,
        },
      }),
      // Actualizar propietario y UPP del animal
      prisma.animal.update({
        where: { id: animalId },
        data: {
          propietarioId: nuevoPropietarioId,
          uppId: nuevaUppId,
        },
        include: {
          propietario: { select: { nombre: true, apellidos: true } },
          upp: { select: { claveUPP: true, nombre: true } },
        },
      }),
    ]);

    res.json({
      message: 'Transferencia realizada exitosamente',
      animal: resultado[1],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al transferir animal' });
  }
});

export default router;
