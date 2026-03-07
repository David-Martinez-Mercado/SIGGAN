import { Router, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import QRCode from 'qrcode';

const router = Router();
const IRIS_SERVICE = process.env.IRIS_SERVICE_URL || 'http://localhost:5000';

// Helper: obtener info completa de un animal (como si buscaran por arete)
async function getAnimalCompleto(animalId: string) {
  return prisma.animal.findUnique({
    where: { id: animalId },
    include: {
      propietario: { select: { id: true, nombre: true, apellidos: true, curp: true, municipio: true, telefono: true } },
      upp: { select: { id: true, nombre: true, claveUPP: true, municipio: true, estatusSanitario: true } },
      eventos: { orderBy: { fecha: 'desc' }, take: 10, select: { tipo: true, fecha: true, resultado: true, descripcion: true, mvzResponsable: true } },
      aretes: { orderBy: { fecha: 'desc' }, take: 10, select: { tipoArete: true, numeroArete: true, accion: true, fecha: true, motivo: true } },
    },
  });
}

function formatAnimalInfo(animal: any) {
  if (!animal) return null;
  return {
    id: animal.id,
    arete: animal.areteNacional,
    areteExportacion: animal.areteExportacion,
    rfid: animal.rfidTag,
    nombre: animal.nombre,
    raza: animal.raza,
    sexo: animal.sexo,
    color: animal.color,
    fechaNacimiento: animal.fechaNacimiento,
    peso: animal.peso,
    proposito: animal.proposito,
    estatusSanitario: animal.estatusSanitario,
    irisRegistrado: !!animal.irisHash,
    irisHash: animal.irisHash,
    propietario: animal.propietario ? {
      nombre: `${animal.propietario.nombre} ${animal.propietario.apellidos}`,
      curp: animal.propietario.curp,
      municipio: animal.propietario.municipio,
      telefono: animal.propietario.telefono,
    } : null,
    upp: animal.upp,
    eventosSanitarios: animal.eventos,
    historialAretes: animal.aretes,
  };
}

// ==================== IRIS ====================

// POST /api/biometria/iris/registrar
router.post('/iris/registrar', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { animalId, imagenBase64, modo } = req.body;
    if (!animalId) { res.status(400).json({ error: 'Se requiere animalId' }); return; }

    const animal = await prisma.animal.findUnique({ where: { id: animalId }, select: { id: true, areteNacional: true, irisHash: true } });
    if (!animal) { res.status(404).json({ error: 'Animal no encontrado' }); return; }

    const response = await fetch(`${IRIS_SERVICE}/api/iris/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ animal_id: animalId, imagen_base64: imagenBase64 || null, modo: modo || 'simulado' }),
    });

    const resultado = await response.json();

    // Si es duplicado (409), enriquecer con info del animal existente
    if (response.status === 409 && resultado.animal_existente) {
      const animalExistente = await getAnimalCompleto(resultado.animal_existente);
      resultado.info_animal_existente = formatAnimalInfo(animalExistente);
      res.status(409).json(resultado);
      return;
    }

    if (!response.ok) {
      res.status(response.status).json(resultado); return;
    }

    // Guardar hash en BD
    await prisma.animal.update({
      where: { id: animalId },
      data: { irisHash: resultado.iris_hash },
    });

    res.json({
      success: true,
      animal: animal.areteNacional,
      irisHash: resultado.iris_hash,
      modo: resultado.modo,
      codeBits: resultado.code_length,
      bitsActivos: resultado.bits_activos,
      preprocesamiento: resultado.preprocess_info,
      validacion_ia: resultado.validacion_ia,
      mensaje: `Iris registrado para ${animal.areteNacional}`,
    });
  } catch (error: any) {
    console.error('Error iris registrar:', error.message);
    res.status(500).json({ error: 'Error al registrar iris. Verifica que el servicio de IA esté activo (puerto 5000).' });
  }
});

// POST /api/biometria/iris/verificar
router.post('/iris/verificar', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { animalId, imagenBase64, modo } = req.body;
    if (!animalId) { res.status(400).json({ error: 'Se requiere animalId' }); return; }

    const animal = await prisma.animal.findUnique({ where: { id: animalId }, select: { id: true, areteNacional: true, irisHash: true } });
    if (!animal) { res.status(404).json({ error: 'Animal no encontrado' }); return; }
    if (!animal.irisHash) { res.status(400).json({ error: 'Este animal no tiene iris registrado' }); return; }

    const response = await fetch(`${IRIS_SERVICE}/api/iris/verificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ animal_id: animalId, imagen_base64: imagenBase64 || null, modo: modo || 'simulado' }),
    });

    const resultado = await response.json();
    if (!response.ok) { res.status(response.status).json(resultado); return; }

    // Si hay alerta de fraude, enriquecer con info del animal real
    if (resultado.alerta_fraude?.animal_real) {
      const animalReal = await getAnimalCompleto(resultado.alerta_fraude.animal_real);
      resultado.alerta_fraude.info_animal_real = formatAnimalInfo(animalReal);
    }

    // Agregar info del animal solicitado
    const animalCompleto = await getAnimalCompleto(animalId);
    resultado.info_animal_solicitado = formatAnimalInfo(animalCompleto);

    res.json({
      success: true,
      animal: animal.areteNacional,
      irisHashRegistrado: animal.irisHash,
      verificacion: resultado.verificacion,
      validacion_ia: resultado.validacion_ia,
      alerta_fraude: resultado.alerta_fraude || null,
      info_animal_solicitado: resultado.info_animal_solicitado,
    });
  } catch (error: any) {
    console.error('Error iris verificar:', error.message);
    res.status(500).json({ error: 'Error al verificar iris' });
  }
});

// POST /api/biometria/iris/buscar - Buscar animal por iris (1:N)
router.post('/iris/buscar', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { imagenBase64 } = req.body;

    const response = await fetch(`${IRIS_SERVICE}/api/iris/buscar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagen_base64: imagenBase64 || null, modo: 'real' }),
    });

    const resultado = await response.json();
    if (!response.ok) { res.status(response.status).json(resultado); return; }

    // Enriquecer matches con info completa del animal
    if (resultado.matches?.length > 0) {
      for (let i = 0; i < resultado.matches.length; i++) {
        const animalData = await getAnimalCompleto(resultado.matches[i].animal_id);
        resultado.matches[i].animal = formatAnimalInfo(animalData);
      }
    }

    res.json(resultado);
  } catch (error: any) {
    console.error('Error iris buscar:', error.message);
    res.status(500).json({ error: 'Error al buscar por iris' });
  }
});

// GET /api/biometria/iris/status
router.get('/iris/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const response = await fetch(`${IRIS_SERVICE}/api/iris/health`);
    const data = await response.json();
    res.json({ ...data, backend: 'conectado' });
  } catch (error) {
    res.json({ status: 'offline', backend: 'conectado', error: 'Servicio IA no disponible' });
  }
});

// GET /api/biometria/iris/registros - Listar todos los iris registrados
router.get('/iris/registros', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const response = await fetch(`${IRIS_SERVICE}/api/iris/registros`);
    const data = await response.json();

    // Enriquecer con info del animal desde BD
    for (let i = 0; i < data.registros.length; i++) {
      const reg = data.registros[i];
      const animal = await prisma.animal.findUnique({
        where: { id: reg.animal_id },
        select: { areteNacional: true, nombre: true, raza: true, sexo: true, irisHash: true,
          propietario: { select: { nombre: true, apellidos: true } } },
      });
      data.registros[i].animal = animal;
    }

    res.json(data);
  } catch (error) {
    res.json({ total: 0, registros: [], error: 'Servicio IA no disponible' });
  }
});

// DELETE /api/biometria/iris/reset - Borrar TODOS los registros de iris
router.delete('/iris/reset', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Borrar en Python
    await fetch(`${IRIS_SERVICE}/api/iris/reset`, { method: 'DELETE' });

    // Borrar irisHash de todos los animales en BD
    await prisma.animal.updateMany({ data: { irisHash: null } });

    res.json({ success: true, mensaje: 'Todos los registros de iris eliminados' });
  } catch (error: any) {
    console.error('Error reset iris:', error.message);
    res.status(500).json({ error: 'Error al resetear iris' });
  }
});

// DELETE /api/biometria/iris/reset/:animalId - Borrar iris de UN animal
router.delete('/iris/reset/:animalId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { animalId } = req.params;
    await fetch(`${IRIS_SERVICE}/api/iris/reset/${animalId}`, { method: 'DELETE' });
    await prisma.animal.update({ where: { id: animalId }, data: { irisHash: null } });
    res.json({ success: true, mensaje: `Iris de ${animalId} eliminado` });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al eliminar iris' });
  }
});

// GET /api/biometria/iris/demo/:animalId
router.get('/iris/demo/:animalId', async (req: any, res: Response) => {
  try {
    const response = await fetch(`${IRIS_SERVICE}/api/iris/demo-image/${req.params.animalId}`);
    if (!response.ok) { res.status(500).json({ error: 'Error generando imagen' }); return; }
    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: 'Servicio IA no disponible' });
  }
});

// ==================== QR ====================

router.get('/qr/:animalId', async (req: any, res: Response) => {
  try {
    const animal = await prisma.animal.findUnique({ where: { id: req.params.animalId }, select: { id: true, areteNacional: true, nombre: true } });
    if (!animal) { res.status(404).json({ error: 'No encontrado' }); return; }
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const url = `${baseUrl}/trazabilidad/${animal.areteNacional}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#006847', light: '#FFFFFF' }, errorCorrectionLevel: 'H' });
    res.json({ animal: animal.areteNacional, nombre: animal.nombre, url, qrDataUrl });
  } catch (error) { res.status(500).json({ error: 'Error generando QR' }); }
});

router.get('/qr/image/:animalId', async (req: any, res: Response) => {
  try {
    const animal = await prisma.animal.findUnique({ where: { id: req.params.animalId }, select: { areteNacional: true } });
    if (!animal) { res.status(404).json({ error: 'No encontrado' }); return; }
    const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/trazabilidad/${animal.areteNacional}`;
    const qrBuffer = await QRCode.toBuffer(url, { width: 400, margin: 2, color: { dark: '#006847', light: '#FFFFFF' }, errorCorrectionLevel: 'H' });
    res.setHeader('Content-Type', 'image/png');
    res.send(qrBuffer);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

// ==================== TRAZABILIDAD PUBLICA ====================

router.get('/trazabilidad/:arete', async (req: any, res: Response) => {
  try {
    const animal = await prisma.animal.findFirst({
      where: { areteNacional: req.params.arete },
      include: {
        propietario: { select: { nombre: true, apellidos: true, municipio: true } },
        upp: { select: { nombre: true, claveUPP: true, municipio: true, estatusSanitario: true } },
        eventos: { orderBy: { fecha: 'desc' }, take: 10, select: { tipo: true, fecha: true, resultado: true, descripcion: true, mvzResponsable: true } },
        aretes: { orderBy: { fecha: 'desc' }, take: 10, select: { tipoArete: true, numeroArete: true, accion: true, fecha: true, motivo: true } },
      },
    });
    if (!animal) { res.status(404).json({ error: 'Animal no encontrado' }); return; }
    res.json({
      animal: {
        arete: animal.areteNacional, areteExportacion: animal.areteExportacion, rfid: animal.rfidTag,
        nombre: animal.nombre, raza: animal.raza, sexo: animal.sexo, color: animal.color,
        fechaNacimiento: animal.fechaNacimiento, peso: animal.peso, proposito: animal.proposito,
        estatusSanitario: animal.estatusSanitario, irisRegistrado: !!animal.irisHash,
      },
      propietario: animal.propietario ? { nombre: `${animal.propietario.nombre} ${animal.propietario.apellidos}`, municipio: animal.propietario.municipio } : null,
      upp: animal.upp,
      eventosSanitarios: animal.eventos,
      historialAretes: animal.aretes,
    });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

export default router;
