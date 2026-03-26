import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generarAreteNacional, generarRFIDTag, generarAreteExportacion } from '../services/folios';

const router = Router();
router.use(authMiddleware);

const createAnimalSchema = z.object({
  nombre:             z.string().optional(),
  raza:               z.string().min(2, 'Raza requerida'),
  sexo:               z.enum(['MACHO', 'HEMBRA']),
  fechaNacimiento:    z.string().transform(s => new Date(s)),
  color:              z.string().optional(),
  peso:               z.number().positive().optional(),
  pesoNacimiento:     z.number().min(0).max(200).optional(),
  horaNacimiento:     z.string().optional(),
  condicionCorporal:  z.number().min(1).max(5).optional(),
  areteNacionalPadre: z.string().optional(),
  razaPadre:          z.string().optional(),
  tipoParto:          z.string().optional(),
  esGemelar:          z.boolean().optional(),
  numCriaCamada:      z.number().int().positive().optional(),
  proposito:          z.string().optional(),
  uppId:              z.string().uuid('UPP requerida'),
  madreId:            z.string().uuid().optional(),
});

// Helper
async function getMiPropietarioId(userId: string): Promise<string | null> {
  const prop = await prisma.propietario.findFirst({
    where: { usuarioId: userId },
    select: { id: true },
  });
  return prop?.id || null;
}

// GET /api/animales
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20', buscar, raza, sexo, estatus, uppId, propietarioId } = req.query;
    const where: any = { activo: true };

    if (req.userRol === 'PRODUCTOR') {
      const miId = await getMiPropietarioId(req.userId!);
      if (!miId) { res.json({ data: [], total: 0, pagina: 1, totalPaginas: 0 }); return; }
      where.propietarioId = miId;
    } else {
      if (propietarioId) where.propietarioId = propietarioId as string;
    }

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

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [animales, total] = await Promise.all([
      prisma.animal.findMany({
        where, skip, take: parseInt(limit as string),
        include: {
          propietario: { select: { id: true, nombre: true, apellidos: true } },
          upp: { select: { id: true, claveUPP: true, nombre: true, municipio: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.animal.count({ where }),
    ]);

    res.json({ data: animales, total, pagina: parseInt(page as string), totalPaginas: Math.ceil(total / parseInt(limit as string)) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener animales' });
  }
});

// GET /api/animales/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const animal = await prisma.animal.findUnique({
      where: { id: req.params.id },
      include: {
        propietario: true, upp: true,
        eventos: { orderBy: { fecha: 'desc' }, take: 20 },
        aretes: { orderBy: { fecha: 'desc' } },
        lecturas: { orderBy: { timestamp: 'desc' }, take: 10 },
        madre: { select: { id: true, areteNacional: true, nombre: true } },
        crias: { select: { id: true, areteNacional: true, nombre: true, sexo: true } },
      },
    });

    if (!animal) { res.status(404).json({ error: 'Animal no encontrado' }); return; }

    if (req.userRol === 'PRODUCTOR') {
      const miId = await getMiPropietarioId(req.userId!);
      if (animal.propietarioId !== miId) {
        res.status(403).json({ error: 'No tienes acceso a este animal' });
        return;
      }
    }

    res.json(animal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener animal' });
  }
});

// GET /api/animales/arete/:arete - Búsqueda pública por arete (cualquier usuario)
router.get('/arete/:arete', async (req: AuthRequest, res: Response) => {
  try {
    const animal = await prisma.animal.findFirst({
      where: { OR: [{ areteNacional: req.params.arete }, { areteExportacion: req.params.arete }] },
      include: {
        propietario: { select: { nombre: true, apellidos: true, municipio: true, telefono: true } },
        upp: { select: { claveUPP: true, nombre: true, municipio: true } },
        eventos: { orderBy: { fecha: 'desc' } },
        aretes: { orderBy: { fecha: 'desc' } },
      },
    });
    if (!animal) { res.status(404).json({ error: 'Animal no encontrado con ese arete' }); return; }
    res.json(animal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al buscar por arete' });
  }
});

// POST /api/animales - Registro con folios automáticos
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createAnimalSchema.parse(req.body);

    // Determinar propietarioId
    let propietarioId: string;

    if (req.userRol === 'PRODUCTOR') {
      // Productor siempre registra a su nombre
      const miId = await getMiPropietarioId(req.userId!);
      if (!miId) { res.status(400).json({ error: 'No tienes un perfil de propietario vinculado' }); return; }
      propietarioId = miId;

      // Verificar que la UPP le pertenece
      const upp = await prisma.uPP.findFirst({ where: { id: data.uppId, propietarioId: miId } });
      if (!upp) { res.status(403).json({ error: 'Esa UPP no te pertenece' }); return; }
    } else {
      // Admin/MVZ deben enviar propietarioId
      const { propietarioId: pid } = req.body;
      if (!pid) { res.status(400).json({ error: 'propietarioId es requerido' }); return; }
      propietarioId = pid;
    }

    // Arete nacional: primero del pool, si no hay → generar automáticamente
    let areteNacional: string;
    let areteDelPool: any = null;
    areteDelPool = await prisma.areteDisponible.findFirst({
      where: { tipo: 'NACIONAL', asignado: false }, orderBy: { numero: 'asc' },
    });
    areteNacional = areteDelPool ? areteDelPool.numero : await generarAreteNacional();

    const rfidTag = await generarRFIDTag();

    // Exportación: NO asignar arete inmediatamente — crear solicitud pendiente
    const esExportacion = data.proposito === 'Exportación';

    const animal = await prisma.animal.create({
      data: { ...data, areteNacional, rfidTag, propietarioId },
      include: {
        propietario: { select: { id: true, nombre: true, apellidos: true } },
        upp: { select: { id: true, claveUPP: true, nombre: true } },
      },
    });

    // Marcar arete nacional del pool como asignado
    if (areteDelPool) {
      await prisma.areteDisponible.update({ where: { id: areteDelPool.id }, data: { asignado: true, animalId: animal.id } });
    }

    // Historial de aretes
    await prisma.historialArete.createMany({
      data: [
        { animalId: animal.id, tipoArete: 'NACIONAL', numeroArete: areteNacional, accion: 'ASIGNADO', motivo: areteDelPool ? 'Asignado desde pool' : 'Generado automáticamente' },
        { animalId: animal.id, tipoArete: 'RFID', numeroArete: rfidTag, accion: 'ASIGNADO', motivo: 'Asignación automática' },
      ],
    });

    // Si es para exportación → crear solicitud pendiente de aprobación
    if (esExportacion) {
      const folio = `SOL-EXP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
      await prisma.formulario.create({
        data: {
          tipo: 'SOLICITUD_ARETES_EXPORTACION' as any, folio, estatus: 'ENVIADO',
          usuarioId: req.userId!,
          datos: {
            animalId: animal.id, areteAnimal: animal.areteNacional,
            razaAnimal: animal.raza, sexoAnimal: animal.sexo,
            uppId: animal.uppId, uppNombre: animal.upp.nombre, uppClave: animal.upp.claveUPP,
            propietarioNombre: `${animal.propietario.nombre} ${animal.propietario.apellidos}`,
            propietarioId: animal.propietarioId, propositoAnterior: null,
          },
        },
      });
      await prisma.alertaIoT.create({
        data: { tipo: 'EXPORTACION_PENDIENTE', mensaje: `Nueva solicitud de exportación para el animal ${animal.areteNacional}. Pendiente de asignar arete y aprobar.`, severidad: 'MEDIA', animalId: animal.id, leida: false },
      });
    }

    res.status(201).json({ ...animal, solicitudExportacionPendiente: esExportacion });
  } catch (error: any) {
    if (error.name === 'ZodError') { res.status(400).json({ error: 'Datos inválidos', detalles: error.errors }); return; }
    if (error.code === 'P2002') { res.status(409).json({ error: 'Error de duplicidad en registro' }); return; }
    console.error(error);
    res.status(500).json({ error: 'Error al registrar animal' });
  }
});

// PUT /api/animales/:id/proposito - Cambiar propósito (con arete exportación automático)
router.put('/:id/proposito', async (req: AuthRequest, res: Response) => {
  try {
    const { proposito } = req.body;
    if (!proposito) { res.status(400).json({ error: 'Propósito requerido' }); return; }

    const animal = await prisma.animal.findUnique({ where: { id: req.params.id } });
    if (!animal) { res.status(404).json({ error: 'Animal no encontrado' }); return; }

    // PRODUCTOR solo puede cambiar sus animales
    if (req.userRol === 'PRODUCTOR') {
      const miId = await getMiPropietarioId(req.userId!);
      if (animal.propietarioId !== miId) {
        res.status(403).json({ error: 'No tienes acceso a este animal' });
        return;
      }
    }

    // Si cambia a exportación y no tiene arete → crear solicitud pendiente (NO asignar aún)
    if (proposito === 'Exportación' && !animal.areteExportacion) {
      // Verificar si ya hay una solicitud pendiente para este animal
      const solPendiente = await prisma.formulario.findFirst({
        where: { tipo: 'SOLICITUD_ARETES_EXPORTACION' as any, estatus: { in: ['ENVIADO', 'BORRADOR'] }, datos: { path: ['animalId'], equals: animal.id } },
      });
      if (!solPendiente) {
        const folio = `SOL-EXP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
        await prisma.formulario.create({
          data: {
            tipo: 'SOLICITUD_ARETES_EXPORTACION' as any, folio, estatus: 'ENVIADO',
            usuarioId: req.userId!,
            datos: {
              animalId: animal.id, areteAnimal: animal.areteNacional,
              razaAnimal: animal.raza, sexoAnimal: animal.sexo,
              uppId: animal.uppId, propietarioId: animal.propietarioId,
              propositoAnterior: animal.proposito,
            },
          },
        });
        await prisma.alertaIoT.create({
          data: { tipo: 'EXPORTACION_PENDIENTE', mensaje: `Solicitud de exportación para ${animal.areteNacional}. Pendiente de asignar arete y aprobación del admin.`, severidad: 'MEDIA', animalId: animal.id, leida: false },
        });
      }

      const actualizado = await prisma.animal.update({
        where: { id: req.params.id }, data: { proposito },
        include: { propietario: { select: { id: true, nombre: true, apellidos: true } }, upp: { select: { id: true, claveUPP: true, nombre: true } } },
      });
      res.json({ message: 'Solicitud de exportación creada. El admin asignará el arete cuando la apruebe.', animal: actualizado, solicitudPendiente: true });
      return;
    }

    const actualizado = await prisma.animal.update({
      where: { id: req.params.id }, data: { proposito },
      include: { propietario: { select: { id: true, nombre: true, apellidos: true } }, upp: { select: { id: true, claveUPP: true, nombre: true } } },
    });
    res.json({ message: 'Propósito actualizado', animal: actualizado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar propósito' });
  }
});

// PUT /api/animales/:id/estatus - Cambiar estatus sanitario (SOLO MVZ o ADMIN)
router.put('/:id/estatus', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRol !== 'MVZ' && req.userRol !== 'ADMIN') {
      res.status(403).json({ error: 'Solo un MVZ o Administrador puede cambiar el estatus sanitario' });
      return;
    }
    const { estatusSanitario, observaciones } = req.body;
    const VALIDOS = ['SANO', 'EN_PRUEBA', 'REACTOR', 'CUARENTENADO'];
    if (!estatusSanitario || !VALIDOS.includes(estatusSanitario)) {
      res.status(400).json({ error: `Estatus inválido. Opciones: ${VALIDOS.join(', ')}` }); return;
    }
    const animal = await prisma.animal.findUnique({ where: { id: req.params.id } });
    if (!animal) { res.status(404).json({ error: 'Animal no encontrado' }); return; }

    const actualizado = await prisma.animal.update({
      where: { id: req.params.id }, data: { estatusSanitario },
      include: { propietario: { select: { id: true, nombre: true, apellidos: true } }, upp: { select: { id: true, claveUPP: true, nombre: true } } },
    });
    await prisma.eventoSanitario.create({
      data: { animalId: req.params.id, tipo: 'INSPECCION', descripcion: `Cambio de estatus: ${animal.estatusSanitario} → ${estatusSanitario}`, fecha: new Date(), resultado: estatusSanitario, mvzResponsable: observaciones || undefined },
    });
    res.json({ message: `Estatus actualizado: ${animal.estatusSanitario} → ${estatusSanitario}`, animal: actualizado });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al cambiar estatus' }); }
});

// PUT /api/animales/:id - Update general
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRol === 'PRODUCTOR') {
      const animal = await prisma.animal.findUnique({ where: { id: req.params.id } });
      const miId = await getMiPropietarioId(req.userId!);
      if (!animal || animal.propietarioId !== miId) {
        res.status(403).json({ error: 'No tienes acceso a este animal' });
        return;
      }
    }

    const animal = await prisma.animal.update({
      where: { id: req.params.id }, data: req.body,
      include: {
        propietario: { select: { id: true, nombre: true, apellidos: true } },
        upp: { select: { id: true, claveUPP: true, nombre: true } },
      },
    });
    res.json(animal);
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'Animal no encontrado' }); return; }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar animal' });
  }
});

// DELETE /api/animales/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.animal.update({ where: { id: req.params.id }, data: { activo: false } });
    res.json({ message: 'Animal dado de baja correctamente' });
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'Animal no encontrado' }); return; }
    console.error(error);
    res.status(500).json({ error: 'Error al dar de baja' });
  }
});

export default router;
