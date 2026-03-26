import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../config/database';

const router = Router();

// Configurar almacenamiento
const uploadDir = path.join(process.cwd(), 'uploads', 'documentos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.cer', '.key'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Tipo de archivo no permitido: ${ext}. Permitidos: ${allowed.join(', ')}`));
  },
});

// POST /api/documentos/upload/:usuarioId
// Sube un documento asociado a un usuario
router.post('/upload/:usuarioId', upload.single('archivo'), async (req: any, res: Response) => {
  try {
    const { usuarioId } = req.params;
    const { tipo } = req.body; // TipoDocumento enum

    if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo' }); return; }
    if (!tipo) { res.status(400).json({ error: 'Se requiere el tipo de documento' }); return; }

    const tiposValidos = ['INE', 'EFIRMA_CER', 'EFIRMA_KEY', 'REGISTRO_SAT', 'DOCUMENTO_PROPIEDAD', 'RECIBO_COMPROBANTE', 'CREDENCIAL_SENASICA', 'CEDULA_PROFESIONAL'];
    if (!tiposValidos.includes(tipo)) {
      res.status(400).json({ error: `Tipo inválido. Válidos: ${tiposValidos.join(', ')}` }); return;
    }

    // Verificar usuario existe
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

    // Si ya existe un documento del mismo tipo, actualizarlo
    const existente = await prisma.documentoUsuario.findFirst({
      where: { usuarioId, tipo: tipo as any },
    });

    let doc;
    if (existente) {
      doc = await prisma.documentoUsuario.update({
        where: { id: existente.id },
        data: {
          nombreArchivo: req.file.originalname,
          rutaArchivo: req.file.path,
          mimeType: req.file.mimetype,
          size: req.file.size,
        },
      });
    } else {
      doc = await prisma.documentoUsuario.create({
        data: {
          tipo: tipo as any,
          nombreArchivo: req.file.originalname,
          rutaArchivo: req.file.path,
          mimeType: req.file.mimetype,
          size: req.file.size,
          usuarioId,
        },
      });
    }

    res.json({
      success: true,
      documento: { id: doc.id, tipo: doc.tipo, nombre: doc.nombreArchivo, size: doc.size },
    });
  } catch (error: any) {
    console.error('Upload error:', error.message);
    res.status(500).json({ error: error.message || 'Error al subir documento' });
  }
});

// POST /api/documentos/upload-multiple/:usuarioId
// Sube varios documentos a la vez
router.post('/upload-multiple/:usuarioId', upload.array('archivos', 10), async (req: any, res: Response) => {
  try {
    const { usuarioId } = req.params;
    const tipos = JSON.parse(req.body.tipos || '[]'); // Array de tipos correspondientes

    if (!req.files?.length) { res.status(400).json({ error: 'Se requieren archivos' }); return; }
    if (tipos.length !== req.files.length) {
      res.status(400).json({ error: 'Cantidad de tipos no coincide con archivos' }); return;
    }

    const results = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const tipo = tipos[i];

      const existente = await prisma.documentoUsuario.findFirst({
        where: { usuarioId, tipo: tipo as any },
      });

      let doc;
      if (existente) {
        doc = await prisma.documentoUsuario.update({
          where: { id: existente.id },
          data: { nombreArchivo: file.originalname, rutaArchivo: file.path, mimeType: file.mimetype, size: file.size },
        });
      } else {
        doc = await prisma.documentoUsuario.create({
          data: { tipo, nombreArchivo: file.originalname, rutaArchivo: file.path, mimeType: file.mimetype, size: file.size, usuarioId },
        });
      }
      results.push({ id: doc.id, tipo: doc.tipo, nombre: doc.nombreArchivo });
    }

    res.json({ success: true, documentos: results });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Error al subir documentos' });
  }
});

// GET /api/documentos/:usuarioId - Listar documentos de un usuario
router.get('/:usuarioId', async (req: any, res: Response) => {
  try {
    const docs = await prisma.documentoUsuario.findMany({
      where: { usuarioId: req.params.usuarioId },
      select: { id: true, tipo: true, nombreArchivo: true, mimeType: true, size: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ total: docs.length, documentos: docs });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

// GET /api/documentos/ver/:docId - Ver/descargar un documento
router.get('/ver/:docId', async (req: any, res: Response) => {
  try {
    const doc = await prisma.documentoUsuario.findUnique({ where: { id: req.params.docId } });
    if (!doc) { res.status(404).json({ error: 'Documento no encontrado' }); return; }

    if (!fs.existsSync(doc.rutaArchivo)) {
      res.status(404).json({ error: 'Archivo no encontrado en el servidor' }); return;
    }

    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.nombreArchivo}"`);
    fs.createReadStream(doc.rutaArchivo).pipe(res);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

// GET /api/documentos/descargar/:docId - Forzar descarga
router.get('/descargar/:docId', async (req: any, res: Response) => {
  try {
    const doc = await prisma.documentoUsuario.findUnique({ where: { id: req.params.docId } });
    if (!doc) { res.status(404).json({ error: 'No encontrado' }); return; }
    if (!fs.existsSync(doc.rutaArchivo)) { res.status(404).json({ error: 'Archivo no existe' }); return; }

    res.setHeader('Content-Disposition', `attachment; filename="${doc.nombreArchivo}"`);
    fs.createReadStream(doc.rutaArchivo).pipe(res);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

export default router;
