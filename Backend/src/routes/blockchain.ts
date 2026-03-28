/**
 * SIGGAN — Rutas de Blockchain Simulada
 *
 * Endpoints:
 *   POST   /api/blockchain/registrar/:tipo/:id         Registrar registro en cadena
 *   GET    /api/blockchain/verificar/:tipo/:id         Verificar integridad de un registro
 *   GET    /api/blockchain/cadena                      Ver cadena completa (paginada)
 *   GET    /api/blockchain/verificar-cadena            Auditoría completa de la cadena
 *   POST   /api/blockchain/certificado/:animalId       Generar certificado sanitario
 *   POST   /api/blockchain/verificar-certificado       Verificar certificado JSON
 *   GET    /api/blockchain/alertas                     Logs de integridad / fraudes
 *   GET    /api/blockchain/auditoria/:tipo/:id         Historial completo de un registro
 *
 * Acceso: ADMIN, MVZ, SUPER_ADMIN
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import {
  registrarPorId,
  verificarPorId,
  verificarCadena,
  generarHash,
  funcionMatematica,
  generarHashFinal,
  TipoRegistro,
} from '../services/blockchain.service';
import {
  generarCertificadoSanitario,
  verificarCertificado,
  verificarCertificadoDesdeArchivo,
} from '../services/certificado.service';

const router = Router();
router.use(authMiddleware);

// ─── Tipos válidos de registro ─────────────────────────────────────────────────
const TIPOS_VALIDOS: TipoRegistro[] = [
  'animal', 'evento', 'certificado', 'venta',
  'usuario', 'propietario', 'upp', 'formulario',
  'historial_arete', 'documento',
];

function esTipoValido(t: string): t is TipoRegistro {
  return TIPOS_VALIDOS.includes(t as TipoRegistro);
}

// ─── Roles permitidos para operaciones de escritura ───────────────────────────
function soloAdminOMvz(req: AuthRequest, res: Response): boolean {
  if (!['ADMIN', 'SUPER_ADMIN', 'MVZ'].includes(req.userRol ?? '')) {
    res.status(403).json({ error: 'Acceso denegado: se requiere ADMIN, SUPER_ADMIN o MVZ' });
    return false;
  }
  return true;
}

// ════════════════════════════════════════════════════════════════════════════════
// POST /api/blockchain/registrar/:tipo/:id
// Registra manualmente un registro en la cadena
// ════════════════════════════════════════════════════════════════════════════════
router.post('/registrar/:tipo/:id', async (req: AuthRequest, res: Response) => {
  if (!soloAdminOMvz(req, res)) return;

  const tipo = req.params.tipo as string;
  const id   = req.params.id   as string;
  if (!esTipoValido(tipo)) {
    res.status(400).json({ error: `Tipo inválido. Válidos: ${TIPOS_VALIDOS.join(', ')}` });
    return;
  }

  try {
    const resultado = await registrarPorId(tipo as TipoRegistro, id);
    if (!resultado) {
      res.status(404).json({ error: `Registro ${tipo}:${id} no encontrado en la BD` });
      return;
    }
    res.json({
      mensaje:    `Registro ${tipo}:${id} añadido a la cadena`,
      blockId:    resultado.blockId,
      hashActual: resultado.hashActual,
      hashFinal:  resultado.hashFinal,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/blockchain/verificar/:tipo/:id
// Verifica la integridad de un registro comparando con la cadena
// ════════════════════════════════════════════════════════════════════════════════
router.get('/verificar/:tipo/:id', async (req: AuthRequest, res: Response) => {
  const tipo = req.params.tipo as string;
  const id   = req.params.id   as string;
  if (!esTipoValido(tipo)) {
    res.status(400).json({ error: `Tipo inválido. Válidos: ${TIPOS_VALIDOS.join(', ')}` });
    return;
  }

  try {
    const resultado = await verificarPorId(tipo as TipoRegistro, id);
    const statusCode = resultado.valido ? 200 : resultado.tipoAlerta === 'SIN_REGISTRO' ? 404 : 409;
    res.status(statusCode).json(resultado);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/blockchain/cadena?page=1&limit=50&tipo=animal
// Devuelve la cadena completa (paginada, filtrable por tipo)
// ════════════════════════════════════════════════════════════════════════════════
router.get('/cadena', async (req: AuthRequest, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const tipo  = req.query.tipo as string | undefined;

  const where: { tipoRegistro?: string } = tipo && esTipoValido(tipo) ? { tipoRegistro: tipo } : {};

  try {
    const [total, bloques] = await Promise.all([
      prisma.blockchainSimulada.count({ where }),
      prisma.blockchainSimulada.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
    ]);

    res.json({
      total,
      pagina:        page,
      porPagina:     limit,
      totalPaginas:  Math.ceil(total / limit),
      bloques,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/blockchain/verificar-cadena
// Auditoría completa: verifica la integridad de TODA la cadena
// ════════════════════════════════════════════════════════════════════════════════
router.get('/verificar-cadena', async (req: AuthRequest, res: Response) => {
  if (!soloAdminOMvz(req, res)) return;

  try {
    const resultado = await verificarCadena();
    const status    = resultado.integra ? 200 : 409;
    res.status(status).json({
      ...resultado,
      mensaje: resultado.integra
        ? `Cadena íntegra — ${resultado.totalBloques} bloques verificados`
        : `⚠️ CADENA COMPROMETIDA — ${resultado.bloquesCorruptos.length} bloque(s) alterados`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /api/blockchain/certificado/:animalId
// Genera un certificado sanitario y lo registra en la cadena
// Body opcional: { eventoId: string }
// ════════════════════════════════════════════════════════════════════════════════
router.post('/certificado/:animalId', async (req: AuthRequest, res: Response) => {
  if (!soloAdminOMvz(req, res)) return;

  const animalId      = req.params.animalId as string;
  const { eventoId } = req.body as { eventoId?: string };

  try {
    const { certificado, rutaArchivo } = await generarCertificadoSanitario(animalId, eventoId);
    res.json({
      mensaje:      `Certificado ${certificado.folio} generado y registrado en cadena`,
      folio:        certificado.folio,
      rutaArchivo,
      certificado,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /api/blockchain/verificar-certificado
// Verifica un certificado JSON enviado en el body
// Body: { certificado: CertificadoSanitario }   — O —
// Body: { archivo: "CERT-20260327-ABC.json" }    (si está guardado en servidor)
// ════════════════════════════════════════════════════════════════════════════════
router.post('/verificar-certificado', async (req: AuthRequest, res: Response) => {
  const { certificado, archivo } = req.body as { certificado?: any; archivo?: string };

  try {
    let resultado;
    if (archivo) {
      resultado = await verificarCertificadoDesdeArchivo(archivo);
    } else if (certificado) {
      resultado = await verificarCertificado(certificado);
    } else {
      res.status(400).json({ error: 'Envía `certificado` (JSON) o `archivo` (nombre de archivo)' });
      return;
    }

    const status = resultado.valido ? 200 : 409;
    res.status(status).json(resultado);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/blockchain/alertas?tipo=MANIPULACION&page=1
// Retorna logs de integridad (fraudes, manipulaciones, verificaciones)
// ════════════════════════════════════════════════════════════════════════════════
router.get('/alertas', async (req: AuthRequest, res: Response) => {
  if (!soloAdminOMvz(req, res)) return;

  const page       = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit      = Math.min(100, parseInt(req.query.limit as string) || 50);
  const tipoAlerta = req.query.tipo as string | undefined;

  const where: { tipoAlerta?: string } = tipoAlerta ? { tipoAlerta } : {};

  try {
    const [total, logs] = await Promise.all([
      prisma.logIntegridad.count({ where }),
      prisma.logIntegridad.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
    ]);

    const resumen = await prisma.logIntegridad.groupBy({
      by:        ['tipoAlerta'],
      _count:    { tipoAlerta: true },
      orderBy:   { _count: { tipoAlerta: 'desc' } },
    });

    res.json({ total, pagina: page, resumen, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/blockchain/auditoria/:tipo/:id
// Historial completo de bloques para un registro específico
// ════════════════════════════════════════════════════════════════════════════════
router.get('/auditoria/:tipo/:id', async (req: AuthRequest, res: Response) => {
  const tipo = req.params.tipo as string;
  const id   = req.params.id   as string;
  if (!esTipoValido(tipo)) {
    res.status(400).json({ error: `Tipo inválido` });
    return;
  }

  try {
    const [bloques, logs] = await Promise.all([
      prisma.blockchainSimulada.findMany({
        where:   { tipoRegistro: tipo, referenciaId: id },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.logIntegridad.findMany({
        where:   { tipoRegistro: tipo, referenciaId: id },
        orderBy: { timestamp: 'desc' },
        take:    20,
      }),
    ]);

    res.json({
      tipo,
      referenciaId:    id,
      totalRegistros:  bloques.length,
      primerRegistro:  bloques[0]?.timestamp ?? null,
      ultimoRegistro:  bloques[bloques.length - 1]?.timestamp ?? null,
      historialBloques: bloques,
      logsIntegridad:  logs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POST /api/blockchain/hash-demo
// Endpoint de demostración: calcula los 3 hashes para cualquier texto
// ════════════════════════════════════════════════════════════════════════════════
router.post('/hash-demo', (req: AuthRequest, res: Response) => {
  const { data } = req.body as { data?: string };
  if (!data) {
    res.status(400).json({ error: 'Envía `data` (string) en el body' });
    return;
  }
  const ts   = new Date().toISOString();
  const sha  = generarHash(data);
  const fmat = funcionMatematica(data);
  const hf   = generarHashFinal(data, ts);
  res.json({
    input:             data,
    timestamp:         ts,
    sha256:            sha,
    funcionMatematica: fmat,
    hashFinal:         hf,
    descripcion: {
      sha256:            'SHA-256 estándar del dato',
      funcionMatematica: 'Σ ASCII(cᵢ)·Pᵢ^i  mod 1_000_000_007',
      hashFinal:         'SHA-256( sha256 + F(data) + SALT + timestamp )',
    },
  });
});

export default router;
