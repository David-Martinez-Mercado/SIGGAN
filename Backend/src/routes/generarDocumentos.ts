import { Router, Response } from 'express';
import { authMiddleware, requireRol, AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import PizZip from 'pizzip';

const execFileAsync = promisify(execFile);
const router = Router();

// ─── RUTAS BASE ───────────────────────────────────────────────────────────────
const FORMATOS_DIR = path.join(process.cwd(), 'Formatos');

function getLibreOfficePath(): string {
  if (process.platform === 'win32') {
    const candidates = [
      'C:/Program Files/LibreOffice/program/soffice.exe',
      'C:/Program Files (x86)/LibreOffice/program/soffice.exe',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  return 'soffice';
}

function formatFecha(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date as string | Date);
  if (isNaN(d.getTime())) return '';
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('/');
}

function generarFolio(prefijo: string): string {
  const año = new Date().getFullYear();
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefijo}-${año}-${num}`;
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── XML DE IMAGEN INLINE ─────────────────────────────────────────────────────
function logoDrawingXml(rId: string): string {
  const cx = 1080000; // 3 cm
  const cy = 540000;  // 1.5 cm
  return (
    `<w:r><w:drawing>` +
    `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="9901" name="LogoUnionGanadera"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="9901" name="LogoUnionGanadera"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill>` +
    `<a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` +
    `<a:stretch><a:fillRect/></a:stretch>` +
    `</pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

// ─── NÚCLEO: REEMPLAZAR EN XML ────────────────────────────────────────────────
/**
 * Reemplaza {{CLAVE}} en el XML del docx tolerando placeholders partidos
 * entre distintos <w:r> / <w:t> por Word.
 *
 * ESTRATEGIA (sin reconstruir párrafos completos para no corromper el DOCX):
 * 1. Elimina <w:proofErr>.
 * 2. Mueve el carácter { "sobrante" al final de un <w:t> al inicio del
 *    siguiente <w:t> → reúne {{ en el mismo texto node.
 * 3. Mismo proceso para }}.
 * 4. Aplica regex principal que además tolera tags XML entre {{ y }}.
 */
function reemplazarEnXml(
  xml: string,
  datos: Record<string, string | undefined>,
  logoRid?: string
): string {
  // 1. Quitar marcadores de ortografía que fragmentan runs
  xml = xml.replace(/<w:proofErr[^>]+\/>/g, '');

  // 2. Normalizar {{ partidos entre runs:
  //    Si <w:t> termina en { y el siguiente <w:t> empieza en {,
  //    mover el primer { al segundo text-node (deja el primero sin él).
  //    Repetir hasta convergencia (cubre casos de triple fragmentación).
  let prev: string;
  do {
    prev = xml;
    xml = xml.replace(
      /(<w:t(?:[^>]*)>)([\s\S]*?)\{(<\/w:t>)([\s\S]*?)(<w:t(?:[^>]*)>)\{/g,
      (_m, t1o, before, t1c, mid, t2o) => {
        // Solo si entre los dos <w:t> no hay llaves sueltas
        if (/[{}]/.test(mid.replace(/<[^>]*>/g, ''))) return _m;
        return `${t1o}${before}${t1c}${mid}${t2o}{{`;
      }
    );
  } while (xml !== prev);

  // 3. Normalizar }} partidos entre runs (mismo principio)
  do {
    prev = xml;
    xml = xml.replace(
      /(<w:t(?:[^>]*)>)([\s\S]*?)\}(<\/w:t>)([\s\S]*?)(<w:t(?:[^>]*)>)\}/g,
      (_m, t1o, before, t1c, mid, t2o) => {
        if (/[{}]/.test(mid.replace(/<[^>]*>/g, ''))) return _m;
        return `${t1o}${before}${t1c}${mid}${t2o}}}`;
      }
    );
  } while (xml !== prev);

  // 4. Reemplazo principal: tolera tags XML entre {{ y }}
  //    (cubre el caso de KEY partido en varias <w:t> dentro de la misma run)
  xml = xml.replace(
    /\{\{((?:[^{}]|<[^>]*>)*?)\}\}/g,
    (_match, innerWithXml: string) => {
      const key = innerWithXml.replace(/<[^>]+>/g, '').trim();
      const value = datos[key];
      if (value === undefined) {
        // Logo → siempre vacío en texto; la imagen se inserta a nivel de run aparte
        if (key === 'LOGO_Union') return '';
        return 'No aplica';
      }
      return escapeXml(value);
    }
  );

  // 5. Logo: si existe, reemplazar el run completo que contenga el placeholder
  //    (debe estar fuera de <w:t> para que sea OOXML válido)
  if (logoRid) {
    xml = xml.replace(
      /<w:r(?:[^>]*)>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t(?:[^>]*)>\{\{LOGO_Union\}\}<\/w:t><\/w:r>/g,
      logoDrawingXml(logoRid)
    );
  }

  return xml;
}

// ─── NÚCLEO: LLENAR PLANTILLA ────────────────────────────────────────────────
async function llenarPlantilla(
  nombrePlantilla: string,
  datos: Record<string, string | undefined>
): Promise<Buffer> {
  const plantillaPath = path.join(FORMATOS_DIR, nombrePlantilla);
  if (!fs.existsSync(plantillaPath)) {
    throw new Error(`Plantilla no encontrada: ${plantillaPath}`);
  }

  const content = fs.readFileSync(plantillaPath, 'binary');
  const zip = new PizZip(content);

  // Logo
  const logoPath = path.join(FORMATOS_DIR, 'UnionGanadera.png');
  const logoExists = fs.existsSync(logoPath);
  const LOGO_RID = 'rIdLogoUnion99';

  if (logoExists) {
    const logoBuf = fs.readFileSync(logoPath);
    zip.file('word/media/logo_union.png', logoBuf);
  }

  const xmlFiles = [
    'word/document.xml',
    'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
    'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml',
  ];

  for (const xmlFile of xmlFiles) {
    const file = zip.file(xmlFile);
    if (!file) continue;

    const xmlContent = file.asText();
    const hasLogo = logoExists && xmlContent.includes('LOGO_Union');

    if (hasLogo) {
      const relsPath = xmlFile.replace('word/', 'word/_rels/') + '.rels';
      let relsContent = zip.file(relsPath)?.asText() ??
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
      if (!relsContent.includes(LOGO_RID)) {
        // Headers/footers necesitan ruta relativa distinta
        const target = (xmlFile.includes('header') || xmlFile.includes('footer'))
          ? '../media/logo_union.png'
          : 'media/logo_union.png';
        relsContent = relsContent.replace(
          '</Relationships>',
          `<Relationship Id="${LOGO_RID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/></Relationships>`
        );
        zip.file(relsPath, relsContent);
      }
    }

    zip.file(xmlFile, reemplazarEnXml(xmlContent, datos, hasLogo ? LOGO_RID : undefined));
  }

  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

// ─── NÚCLEO: DOCX → PDF ──────────────────────────────────────────────────────
async function convertirAPDF(docxBuffer: Buffer, nombreBase: string): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tmpDocx = path.join(tmpDir, `${nombreBase}-${uid}.docx`);

  fs.writeFileSync(tmpDocx, docxBuffer);

  const soffice = getLibreOfficePath();
  // En Windows, LibreOffice falla con backslashes — normalizar a forward slashes
  const toFwd = (p: string) => p.replace(/\\/g, '/');
  // Perfil de usuario único para evitar conflicto con LibreOffice abierto en GUI
  const loProfile = path.join(tmpDir, `lo-profile-${uid}`);
  const loProfileUri = `file:///${toFwd(loProfile)}`;
  const args = [
    `-env:UserInstallation=${loProfileUri}`,
    '--headless', '--norestore', '--nolockcheck',
    '--convert-to', 'pdf',
    '--outdir', toFwd(tmpDir),
    toFwd(tmpDocx),
  ];

  // Copia de depuración: si falla, el DOCX queda en el escritorio para inspeccionarlo
  const debugDocx = path.join(
    process.env['USERPROFILE'] || os.homedir(),
    'Desktop',
    `debug_${nombreBase}.docx`
  );
  fs.copyFileSync(tmpDocx, debugDocx);
  console.log('[LibreOffice] DOCX de depuración guardado en:', debugDocx);

  try {
    const { stdout, stderr } = await execFileAsync(soffice, args, { timeout: 60_000 });
    if (stdout) console.log('[LibreOffice stdout]', stdout.slice(0, 500));
    if (stderr) console.warn('[LibreOffice stderr]', stderr.slice(0, 500));

    const expectedPdf = tmpDocx.replace(/\.docx$/, '.pdf');
    if (!fs.existsSync(expectedPdf)) {
      // Intentar también con el nombre base sin extensión
      const altPdf = tmpDocx.replace(/\.[^.]+$/, '.pdf');
      if (!fs.existsSync(altPdf)) {
        throw new Error(
          `LibreOffice salió sin generar PDF (código 1). ` +
          `Abre el archivo de depuración en Word para verificar si el DOCX es válido: ${debugDocx}`
        );
      }
      const pdfBuffer = fs.readFileSync(altPdf);
      fs.unlinkSync(altPdf);
      // Conversión exitosa → borrar debug
      try { fs.unlinkSync(debugDocx); } catch {}
      return pdfBuffer;
    }
    const pdfBuffer = fs.readFileSync(expectedPdf);
    fs.unlinkSync(expectedPdf);
    // Conversión exitosa → borrar debug
    try { fs.unlinkSync(debugDocx); } catch {}
    return pdfBuffer;
  } finally {
    if (fs.existsSync(tmpDocx)) fs.unlinkSync(tmpDocx);
    try { fs.rmSync(loProfile, { recursive: true, force: true }); } catch {}
  }
}

function enviarPDF(res: Response, pdfBuffer: Buffer, nombreArchivo: string): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.end(pdfBuffer);
}

// ─── HELPER: construir datos del acta ────────────────────────────────────────
async function buildDatosActa(
  animalId: string,
  extras: { testigo?: string; observaciones?: string }
): Promise<{ datos: Record<string, string | undefined>; nombreArchivo: string }> {
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    include: {
      propietario: true,
      upp: true,
      madre: { select: { areteNacional: true, raza: true } },
    },
  });
  if (!animal) throw new Error('Animal no encontrado');

  const eventoConMVZ = await prisma.eventoSanitario.findFirst({
    where: { animalId, mvzResponsable: { not: null } },
    orderBy: { fecha: 'desc' },
  });

  const p = animal.propietario;
  const upp = animal.upp;
  const a = animal as any;

  const datos: Record<string, string | undefined> = {
    LOGO_Union:            undefined,  // si la imagen existe, el run-level replacement lo reemplaza
    NUM_FOLIO:             generarFolio('ACT'),
    FECHA_EMISION:         formatFecha(new Date()),
    // Propietario
    NOMBRE_PROPIETARIO:    `${p.nombre} ${p.apellidos}`,
    CURP_PROPIETARIO:      p.curp       || undefined,
    RFC_PROPIETARIO:       p.rfc        || undefined,
    DOMICILIO_PROPIETARIO: p.direccion  || undefined,
    TELEFONO_PROPIETARIO:  p.telefono   || undefined,
    EMAIL_PROPIETARIO:     (p as any).email || undefined,
    // UPP / Rancho
    NOMBRE_RANCHO:         upp.nombre,
    DOMICILIO_RANCHO:      upp.direccion || undefined,
    TELEFONO_RANCHO:       (upp as any).telefono || undefined,
    EMAIL_RANCHO:          (upp as any).email    || undefined,
    CLAVE_UPP:             upp.claveUPP,
    MUNICIPIO:             upp.municipio,
    ESTADO:                upp.estado,
    // Animal
    NUM_ARETE:             animal.areteNacional,
    NUM_SINIIGA:           animal.rfidTag    || undefined,
    RAZA:                  animal.raza,
    SEXO:                  animal.sexo === 'MACHO' ? 'Macho' : 'Hembra',
    COLOR_PELAJE:          animal.color      || undefined,
    FECHA_NACIMIENTO:      formatFecha(animal.fechaNacimiento),
    HORA_NACIMIENTO:       a.horaNacimiento  || undefined,
    PESO_NACIMIENTO_KG:    a.pesoNacimiento != null ? String(a.pesoNacimiento) : undefined,
    CONDICION_CORPORAL:    a.condicionCorporal != null ? String(a.condicionCorporal) : undefined,
    ESPECIE:               'Bovina',
    FUNCION_ZOOTECNICA:    animal.proposito  || undefined,
    // Genealogía
    NUM_ARETE_PADRE:       a.areteNacionalPadre        || undefined,
    RAZA_PADRE:            a.razaPadre                 || undefined,
    NUM_ARETE_MADRE:       animal.madre?.areteNacional || undefined,
    RAZA_MADRE:            animal.madre?.raza          || undefined,
    TIPO_PARTO:            a.tipoParto                 || undefined,
    ES_GEMELAR:            a.esGemelar != null ? (a.esGemelar ? 'Sí' : 'No') : undefined,
    NUM_CRIA_CAMADA:       a.numCriaCamada != null ? String(a.numCriaCamada) : undefined,
    // MVZ
    NOMBRE_MVZ:            eventoConMVZ?.mvzResponsable || undefined,
    CEDULA_MVZ:            eventoConMVZ?.cedulaMvz      || undefined,
    RNMVZ:                 (eventoConMVZ as any)?.rnmvz       || undefined,
    VIGENCIA_MVZ:          (eventoConMVZ as any)?.vigenciaMvz || undefined,
    // Testigo y observaciones
    NOMBRE_TESTIGO:        extras.testigo       || undefined,
    OBSERVACIONES:         extras.observaciones || eventoConMVZ?.observaciones || undefined,
  };

  return { datos, nombreArchivo: `acta_nacimiento_${animal.areteNacional}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/generar-documentos/mvz-lista
// Devuelve la lista de MVZ activos para seleccionar en el formulario del acta
// ─────────────────────────────────────────────────────────────────────────────
router.get('/mvz-lista', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const mvzs = await prisma.usuario.findMany({
      where: { rol: 'MVZ', estatus: 'ACTIVO' },
      select: { id: true, nombre: true, apellidos: true, cedulaProfesional: true, ddr: true },
      orderBy: { nombre: 'asc' },
    });
    res.json(mvzs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener MVZ' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 1A — SOLICITAR ACTA DE NACIMIENTO (guarda en DB, requiere firma MVZ)
// POST /api/generar-documentos/acta-nacimiento
// Body: { animalId, testigo?, observaciones?, mvzUsuarioId? }
//   Si mvzUsuarioId → guarda formulario PENDIENTE_FIRMA y notifica al MVZ
//   Si no           → genera PDF inmediatamente (modo legado)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/acta-nacimiento', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { animalId, testigo, observaciones, mvzUsuarioId } = req.body;
    if (!animalId) { res.status(400).json({ error: 'Se requiere animalId' }); return; }

    // Verificar que el animal existe
    const animalExiste = await prisma.animal.findUnique({ where: { id: animalId }, select: { id: true, areteNacional: true } });
    if (!animalExiste) { res.status(404).json({ error: 'Animal no encontrado' }); return; }

    if (mvzUsuarioId) {
      // ── Modo flujo MVZ: guardar en DB y esperar firma ──────────────────────
      const mvz = await prisma.usuario.findUnique({ where: { id: mvzUsuarioId }, select: { id: true, nombre: true, apellidos: true } });
      if (!mvz) { res.status(404).json({ error: 'MVZ no encontrado' }); return; }

      const folio = generarFolio('ACT');
      const formulario = await prisma.formulario.create({
        data: {
          tipo:     'ACTA_NACIMIENTO' as any,
          folio,
          estatus:  'PENDIENTE_FIRMA',
          usuarioId: req.userId!,
          datos: {
            animalId,
            testigo:       testigo       || null,
            observaciones: observaciones || null,
            mvzUsuarioId,
            mvzNombre:     `${mvz.nombre} ${mvz.apellidos}`,
            solicitanteId: req.userId,
          },
        },
      });
      res.json({
        message: `Acta enviada al MVZ ${mvz.nombre} ${mvz.apellidos} para firma. Folio: ${folio}`,
        formularioId: formulario.id,
        folio,
      });
    } else {
      // ── Modo directo: generar PDF inmediatamente ────────────────────────────
      const { datos, nombreArchivo } = await buildDatosActa(animalId, { testigo, observaciones });
      const docxBuffer = await llenarPlantilla('acta_nacimiento_bovina.docx', datos);
      const pdfBuffer  = await convertirAPDF(docxBuffer, 'acta_nacimiento');
      enviarPDF(res, pdfBuffer, nombreArchivo);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error generando documento';
    console.error('[acta-nacimiento]', error);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 1B — APROBAR Y GENERAR PDF DEL ACTA
// POST /api/generar-documentos/acta-nacimiento/:formularioId/aprobar
// Solo el MVZ asignado puede aprobar
// ─────────────────────────────────────────────────────────────────────────────
router.post('/acta-nacimiento/:formularioId/aprobar', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const formulario = await prisma.formulario.findUnique({ where: { id: String(req.params.formularioId) } });
    if (!formulario) { res.status(404).json({ error: 'Formulario no encontrado' }); return; }
    if (formulario.estatus !== 'PENDIENTE_FIRMA') {
      res.status(400).json({ error: `Este acta ya fue procesada (estado: ${formulario.estatus})` }); return;
    }

    const datos_f = formulario.datos as any;

    // Solo el MVZ asignado puede aprobar
    if (req.userRol !== 'ADMIN' && req.userId !== datos_f.mvzUsuarioId) {
      res.status(403).json({ error: 'Solo el MVZ asignado puede aprobar este acta' }); return;
    }

    // Generar PDF primero; solo marcar como aprobado si el PDF se generó
    const { datos, nombreArchivo } = await buildDatosActa(datos_f.animalId, {
      testigo:       datos_f.testigo       || undefined,
      observaciones: datos_f.observaciones || undefined,
    });

    const docxBuffer = await llenarPlantilla('acta_nacimiento_bovina.docx', datos);
    const pdfBuffer  = await convertirAPDF(docxBuffer, 'acta_nacimiento');

    // PDF generado exitosamente → marcar como aprobado
    await prisma.formulario.update({
      where: { id: formulario.id },
      data:  { estatus: 'APROBADO', updatedAt: new Date() },
    });

    enviarPDF(res, pdfBuffer, nombreArchivo);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error aprobando acta';
    console.error('[aprobar-acta]', error);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 1C — REIMPRIMIR ACTA YA APROBADA
// POST /api/generar-documentos/acta-nacimiento/:formularioId/reimprimir
// ─────────────────────────────────────────────────────────────────────────────
router.post('/acta-nacimiento/:formularioId/reimprimir', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const formulario = await prisma.formulario.findUnique({ where: { id: String(req.params.formularioId) } });
    if (!formulario) { res.status(404).json({ error: 'Formulario no encontrado' }); return; }
    if (formulario.estatus !== 'APROBADO') {
      res.status(400).json({ error: `Solo se pueden reimprimir actas aprobadas (estado actual: ${formulario.estatus})` }); return;
    }

    const datos_f = formulario.datos as any;
    // Solo el propietario solicitante, el MVZ asignado o admin pueden reimprimir
    if (req.userRol !== 'ADMIN' && req.userId !== datos_f.mvzUsuarioId && req.userId !== datos_f.solicitanteId) {
      res.status(403).json({ error: 'No tienes permiso para reimprimir este acta' }); return;
    }

    const { datos, nombreArchivo } = await buildDatosActa(datos_f.animalId, {
      testigo:       datos_f.testigo       || undefined,
      observaciones: datos_f.observaciones || undefined,
    });

    const docxBuffer = await llenarPlantilla('acta_nacimiento_bovina.docx', datos);
    const pdfBuffer  = await convertirAPDF(docxBuffer, 'acta_nacimiento');
    enviarPDF(res, pdfBuffer, nombreArchivo);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error reimprimiendo acta';
    console.error('[reimprimir-acta]', error);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 1D — GENERAR PDF DE COMPRAVENTA DESDE FORMULARIO APROBADO
// POST /api/generar-documentos/compraventa-firmada/:formularioId
// ─────────────────────────────────────────────────────────────────────────────
router.post('/compraventa-firmada/:formularioId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const formulario = await prisma.formulario.findUnique({ where: { id: String(req.params.formularioId) } });
    if (!formulario) { res.status(404).json({ error: 'Formulario no encontrado' }); return; }
    if (formulario.estatus !== 'APROBADO') {
      res.status(400).json({ error: `El contrato debe estar APROBADO (estado: ${formulario.estatus})` }); return;
    }

    const d = formulario.datos as any;
    // Cualquiera de las partes puede generar el PDF
    const partes = [d.compradorUsuarioId, d.vendedorUsuarioId, d.mvzUsuarioId];
    if (req.userRol !== 'ADMIN' && req.userRol !== 'SUPER_ADMIN' && !partes.includes(req.userId)) {
      res.status(403).json({ error: 'Sin permiso para generar este PDF' }); return;
    }

    // Calcular edad del animal
    const animal = await prisma.animal.findUnique({ where: { id: d.animalId }, select: { fechaNacimiento: true } });
    const meses = animal ? Math.floor((Date.now() - new Date(animal.fechaNacimiento).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;
    const edad  = meses >= 12 ? `${Math.floor(meses / 12)} año(s) ${meses % 12} mes(es)` : `${meses} mes(es)`;

    const datos: Record<string, string | undefined> = {
      LOGO_Union:          undefined,
      NUM_FOLIO:           formulario.folio,
      NUM_CONTRATO:        d.numContrato        || undefined,
      FECHA_EMISION:       formatFecha(new Date()),
      FECHA_CONTRATO:      d.fechaCelebracion   ? formatFecha(d.fechaCelebracion)   : undefined,
      LUGAR_CONTRATO:      d.lugarCelebracion   || undefined,
      FECHA_ENTREGA:       d.fechaEntrega       ? formatFecha(d.fechaEntrega)       : undefined,
      // Vendedor
      NOMBRE_VENDEDOR:     d.vendedorNombre     || undefined,
      RFC_VENDEDOR:        d.vendedorRFC        || undefined,
      CURP_VENDEDOR:       d.vendedorCURP       || undefined,
      DOMICILIO_VENDEDOR:  d.vendedorDomicilio  || undefined,
      TELEFONO_VENDEDOR:   d.vendedorTelefono   || undefined,
      EMAIL_VENDEDOR:      d.vendedorEmail      || undefined,
      RANCHO_VENDEDOR:     d.vendedorRancho     || undefined,
      CLAVE_UPP_VENDEDOR:  d.vendedorClaveUPP   || undefined,
      // Comprador
      NOMBRE_COMPRADOR:    d.compradorNombre    || undefined,
      RFC_COMPRADOR:       d.compradorRFC       || undefined,
      CURP_COMPRADOR:      d.compradorCURP      || undefined,
      DOMICILIO_COMPRADOR: d.compradorDomicilio || undefined,
      TELEFONO_COMPRADOR:  d.compradorTelefono  || undefined,
      EMAIL_COMPRADOR:     d.compradorEmail     || undefined,
      NOMBRE_RANCHO:       d.compradorRancho    || undefined,
      CLAVE_UPP:           d.compradorClaveUPP  || undefined,
      // Animal
      NUM_ARETE:           d.areteAnimal        || undefined,
      NUM_SINIIGA:         d.rfidAnimal         || undefined,
      RAZA:                d.razaAnimal         || undefined,
      SEXO:                d.sexoAnimal === 'MACHO' ? 'Macho' : 'Hembra',
      COLOR_PELAJE:        d.colorAnimal        || undefined,
      PESO_KG:             d.pesoAnimal != null ? String(d.pesoAnimal) : undefined,
      EDAD_ANIMAL:         edad,
      ESPECIE:             'Bovina',
      FUNCION_ZOOTECNICA:  d.propositoAnimal    || undefined,
      NUM_ARETE_PADRE:     d.aretePadre         || undefined,
      NUM_ARETE_MADRE:     d.areteMadre         || undefined,
      ESTADO_SALUD:        d.estatusSanitario === 'SANO' ? 'Sano' : d.estatusSanitario,
      // Documentación sanitaria (MVZ)
      NUM_CERTIFICADO:     d.numCertificado     || undefined,
      FECHA_CERTIFICADO:   d.fechaCertificado   ? formatFecha(d.fechaCertificado)   : undefined,
      RESULTADO_TB:        d.resultadoTB        || undefined,
      FECHA_PRUEBA_TB:     d.fechaTB            ? formatFecha(d.fechaTB)            : undefined,
      RESULTADO_BR:        d.resultadoBR        || undefined,
      FECHA_PRUEBA_BR:     d.fechaBR            ? formatFecha(d.fechaBR)            : undefined,
      NOMBRE_MVZ:          d.mvzNombre          || undefined,
      CEDULA_MVZ:          d.cedulaMVZ          || undefined,
      VIGENCIA_MVZ:        d.vigenciaMVZ        ? formatFecha(d.vigenciaMVZ)        : undefined,
      // Condiciones económicas
      PRECIO_UNITARIO_MXN: d.precioUnitario     || undefined,
      FORMA_PAGO:          d.formaPago          || undefined,
      MONEDA:              'MXN',
      OBSERVACIONES:       d.clausulasAdicionales || undefined,
    };

    const docxBuffer = await llenarPlantilla('compraventa_bovino.docx', datos);
    const pdfBuffer  = await convertirAPDF(docxBuffer, 'compraventa');
    enviarPDF(res, pdfBuffer, `compraventa_${d.areteAnimal}_${formulario.folio}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error generando PDF';
    console.error('[compraventa-firmada]', error);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 2 — CONTRATO DE COMPRAVENTA
// ─────────────────────────────────────────────────────────────────────────────
router.post('/compraventa', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { animalId, compradorId, datos_contrato = {} } = req.body;
    if (!animalId || !compradorId) {
      res.status(400).json({ error: 'Se requieren animalId y compradorId' }); return;
    }

    const [animal, comprador] = await Promise.all([
      prisma.animal.findUnique({ where: { id: animalId }, include: { propietario: true, upp: true } }),
      prisma.propietario.findUnique({ where: { id: compradorId } }),
    ]);
    if (!animal)   { res.status(404).json({ error: 'Animal no encontrado' });   return; }
    if (!comprador){ res.status(404).json({ error: 'Comprador no encontrado' }); return; }

    const [pruebaTB, pruebaBR] = await Promise.all([
      prisma.eventoSanitario.findFirst({ where: { animalId, tipo: 'PRUEBA_TB' as any }, orderBy: { fecha: 'desc' } }),
      prisma.eventoSanitario.findFirst({ where: { animalId, tipo: 'PRUEBA_BR' as any }, orderBy: { fecha: 'desc' } }),
    ]);

    const meses = Math.floor((Date.now() - new Date(animal.fechaNacimiento).getTime()) / (1000 * 60 * 60 * 24 * 30));
    const edad  = meses >= 12 ? `${Math.floor(meses / 12)} año(s) ${meses % 12} mes(es)` : `${meses} mes(es)`;

    const vendedor = animal.propietario;
    const upp      = animal.upp;
    const dc       = datos_contrato as Record<string, string>;

    const datos: Record<string, string | undefined> = {
      NUM_FOLIO:     generarFolio('CV'),
      FECHA_EMISION: formatFecha(new Date()),
      ...(dc.num_contrato    && { NUM_CONTRATO:    dc.num_contrato }),
      ...(dc.fecha_contrato  && { FECHA_CONTRATO:  dc.fecha_contrato }),
      ...(dc.lugar_contrato  && { LUGAR_CONTRATO:  dc.lugar_contrato }),
      NOMBRE_VENDEDOR:        `${vendedor.nombre} ${vendedor.apellidos}`,
      ...(vendedor.curp      && { CURP_VENDEDOR:      vendedor.curp }),
      ...(vendedor.rfc       && { RFC_VENDEDOR:       vendedor.rfc }),
      ...(vendedor.direccion && { DOMICILIO_VENDEDOR: vendedor.direccion }),
      ...(vendedor.telefono  && { TELEFONO_VENDEDOR:  vendedor.telefono }),
      ...((vendedor as any).email && { EMAIL_VENDEDOR: (vendedor as any).email }),
      RANCHO_VENDEDOR:        upp.nombre,
      CLAVE_UPP_VENDEDOR:     upp.claveUPP,
      NOMBRE_COMPRADOR:        `${comprador.nombre} ${comprador.apellidos}`,
      ...(comprador.curp      && { CURP_COMPRADOR:      comprador.curp }),
      ...(comprador.rfc       && { RFC_COMPRADOR:       comprador.rfc }),
      ...(comprador.direccion && { DOMICILIO_COMPRADOR: comprador.direccion }),
      ...(comprador.telefono  && { TELEFONO_COMPRADOR:  comprador.telefono }),
      ...((comprador as any).email && { EMAIL_COMPRADOR: (comprador as any).email }),
      NOMBRE_RANCHO: upp.nombre,
      MUNICIPIO:     upp.municipio,
      ESTADO:        upp.estado,
      NUM_ARETE:     animal.areteNacional,
      ...(animal.rfidTag  && { NUM_SINIIGA:  animal.rfidTag }),
      RAZA:          animal.raza,
      SEXO:          animal.sexo === 'MACHO' ? 'Macho' : 'Hembra',
      ...(animal.color    && { COLOR_PELAJE: animal.color }),
      EDAD_ANIMAL:   edad,
      ...(animal.peso != null && { PESO_KG: String(animal.peso) }),
      ESPECIE:       'Bovina',
      ...(animal.proposito && { FUNCION_ZOOTECNICA: animal.proposito }),
      ESTADO_SALUD:  animal.estatusSanitario === 'SANO' ? 'Sano' : animal.estatusSanitario,
      ...(pruebaTB?.resultado && { RESULTADO_TB:    pruebaTB.resultado }),
      ...(pruebaTB?.fecha     && { FECHA_PRUEBA_TB: formatFecha(pruebaTB.fecha) }),
      ...(pruebaBR?.resultado && { RESULTADO_BR:    pruebaBR.resultado }),
      ...(pruebaBR?.fecha     && { FECHA_PRUEBA_BR: formatFecha(pruebaBR.fecha) }),
      ...(dc.precio_unitario && { PRECIO_UNITARIO_MXN: dc.precio_unitario }),
      ...(dc.precio_letra    && { PRECIO_LETRA:        dc.precio_letra }),
      MONEDA:                   dc.moneda || 'MXN',
      ...(dc.forma_pago      && { FORMA_PAGO:      dc.forma_pago }),
      ...(dc.cuenta_bancaria && { CUENTA_BANCARIA: dc.cuenta_bancaria }),
      ...(dc.fecha_entrega   && { FECHA_ENTREGA:   dc.fecha_entrega }),
      ...(dc.nombre_mvz   && { NOMBRE_MVZ:   dc.nombre_mvz }),
      ...(dc.cedula_mvz   && { CEDULA_MVZ:   dc.cedula_mvz }),
      ...(dc.vigencia_mvz && { VIGENCIA_MVZ: dc.vigencia_mvz }),
      ...(dc.observaciones && { OBSERVACIONES: dc.observaciones }),
    };

    const docxBuffer = await llenarPlantilla('compraventa_bovino.docx', datos);
    const pdfBuffer  = await convertirAPDF(docxBuffer, 'compraventa');
    enviarPDF(res, pdfBuffer, `compraventa_${animal.areteNacional}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error generando documento';
    console.error('[compraventa]', error);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 3 — PROGRAMACIÓN DE PRUEBAS (Formato1)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/programacion-pruebas', authMiddleware, requireRol('MVZ', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { uppId, datos_programacion = {} } = req.body;
    if (!uppId) { res.status(400).json({ error: 'Se requiere uppId' }); return; }

    const upp = await (prisma as any).uPP.findUnique({
      where: { id: uppId },
      include: { propietario: true, animales: { where: { activo: true }, select: { id: true } } },
    });
    if (!upp) { res.status(404).json({ error: 'UPP no encontrada' }); return; }

    const dp            = datos_programacion as Record<string, string>;
    const totalAnimales = (upp.animales as unknown[]).length;

    const datos: Record<string, string | undefined> = {
      FECHA_PROGRAMACION: formatFecha(new Date()),
      PROPIETARIO:        `${upp.propietario.nombre} ${upp.propietario.apellidos}`,
      RANCHO:             upp.nombre,
      MUNICIPIO:          upp.municipio,
      ...(upp.direccion       && { DOMICILIO:          upp.direccion }),
      ...(upp.tipoExplotacion && { FUNCION_ZOOTECNICA: upp.tipoExplotacion }),
      NUM_ANIMALES_TB: dp.num_animales_tb || String(totalAnimales),
      NUM_ANIMALES_BR: dp.num_animales_br || String(totalAnimales),
      ...(dp.num_solicitud           && { NUM_SOLICITUD:           dp.num_solicitud }),
      ...(dp.ddr_no                  && { DDR_NO:                  dp.ddr_no }),
      ...(dp.motivo_prueba           && { MOTIVO_PRUEBA:           dp.motivo_prueba }),
      ...(dp.fecha_prueba            && { FECHA_PRUEBA:            dp.fecha_prueba }),
      ...(dp.hora_inicio             && { HORA_INICIO:             dp.hora_inicio }),
      ...(dp.nombre_mvz_aprobado     && { NOMBRE_MVZ_APROBADO:     dp.nombre_mvz_aprobado }),
      ...(dp.credencial_mvz_aprobado && { CREDENCIAL_MVZ_APROBADO: dp.credencial_mvz_aprobado }),
      ...(dp.vigencia_mvz_aprobado   && { VIGENCIA_MVZ_APROBADO:   dp.vigencia_mvz_aprobado }),
      ...(dp.nombre_mvz_supervisor   && { NOMBRE_MVZ_SUPERVISOR:   dp.nombre_mvz_supervisor }),
    };

    const docxBuffer = await llenarPlantilla('Formato1_Programacion_Pruebas.docx', datos);
    const pdfBuffer  = await convertirAPDF(docxBuffer, 'programacion_pruebas');
    enviarPDF(res, pdfBuffer, `programacion_pruebas_${upp.claveUPP}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error generando documento';
    console.error('[programacion-pruebas]', error);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 4 — SOLICITUD DE PRUEBA (Formato2)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/solicitud-prueba', authMiddleware, requireRol('MVZ', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { uppId, motivo_numero, datos_solicitud = {} } = req.body;
    if (!uppId) { res.status(400).json({ error: 'Se requiere uppId' }); return; }
    const motivo = Number(motivo_numero);
    if (!motivo_numero || motivo < 1 || motivo > 14) {
      res.status(400).json({ error: 'motivo_numero debe ser un número entre 1 y 14' }); return;
    }

    const upp = await (prisma as any).uPP.findUnique({
      where: { id: uppId },
      include: { propietario: true, animales: { where: { activo: true }, select: { id: true } } },
    });
    if (!upp) { res.status(404).json({ error: 'UPP no encontrada' }); return; }

    const ds            = datos_solicitud as Record<string, string>;
    const totalAnimales = (upp.animales as unknown[]).length;

    const checkboxes: Record<string, string> = {};
    for (let i = 1; i <= 14; i++) checkboxes[String(i)] = i === motivo ? '✓' : '';

    const datos: Record<string, string | undefined> = {
      NUM_FOLIO:          generarFolio('SOL'),
      FECHA_SOLICITUD:    formatFecha(new Date()),
      NOMBRE_SOLICITANTE: ds.nombre_solicitante || `${upp.propietario.nombre} ${upp.propietario.apellidos}`,
      NOMBRE_PREDIO:      ds.nombre_predio      || upp.nombre,
      MUNICIPIO:          upp.municipio,
      UPP_PSG:            upp.claveUPP,
      ...(upp.propietario.telefono && { TELEFONOS: upp.propietario.telefono }),
      CABEZAS_TB: ds.cabezas_tb || String(totalAnimales),
      CABEZAS_BR: ds.cabezas_br || String(totalAnimales),
      ...(ds.num_expediente       && { NUM_EXPEDIENTE:       ds.num_expediente }),
      ...(ds.nombre_ejido         && { NOMBRE_EJIDO:         ds.nombre_ejido }),
      ...(ds.localidad            && { LOCALIDAD:            ds.localidad }),
      ...(ds.colindante           && { COLINDANTE:           ds.colindante }),
      ...(ds.cantidad_productores && { CANTIDAD_PRODUCTORES: ds.cantidad_productores }),
      ...(ds.folio_aretes         && { FOLIO_ARETES:         ds.folio_aretes }),
      ...(ds.total_aretes         && { TOTAL_ARETES:         ds.total_aretes }),
      ...(ds.nombre_medico        && { NOMBRE_MEDICO:        ds.nombre_medico }),
      ...(ds.fecha_hora_prueba    && { FECHA_HORA_PRUEBA:    ds.fecha_hora_prueba }),
      ...(ds.nombre_quien_recibe  && { NOMBRE_QUIEN_RECIBE:  ds.nombre_quien_recibe }),
      ...checkboxes,
    };

    const docxBuffer = await llenarPlantilla('Formato2_Solicitud_Prueba.docx', datos);
    const pdfBuffer  = await convertirAPDF(docxBuffer, 'solicitud_prueba');
    enviarPDF(res, pdfBuffer, `solicitud_prueba_${upp.claveUPP}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error generando documento';
    console.error('[solicitud-prueba]', error);
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 5 — SOLICITUD DE EXPORTACIÓN DE GANADO
// ─────────────────────────────────────────────────────────────────────────────
router.post('/solicitud-exportacion', authMiddleware, requireRol('MVZ', 'ADMIN', 'PRODUCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { animalIds, datos_exportacion = {} } = req.body;
    if (!Array.isArray(animalIds) || !animalIds.length) {
      res.status(400).json({ error: 'Se requiere al menos un animalId en animalIds[]' }); return;
    }
    if (animalIds.length > 10) {
      res.status(400).json({ error: 'Máximo 10 animales por solicitud de exportación' }); return;
    }

    const animales = await prisma.animal.findMany({
      where: { id: { in: animalIds }, activo: true },
      include: { propietario: true, upp: true },
    });
    if (!animales.length) {
      res.status(404).json({ error: 'No se encontraron animales activos' }); return;
    }

    const ref        = animales[0];
    const upp        = ref.upp;
    const propietario = ref.propietario;
    const de          = datos_exportacion as Record<string, string>;

    const filasAnimales: Record<string, string> = {};
    for (let i = 1; i <= 10; i++) {
      const a = animales[i - 1];
      filasAnimales[`ARETE_${i}`]   = a?.areteNacional ?? '';
      filasAnimales[`SINIIGA_${i}`] = a?.rfidTag       ?? '';
      filasAnimales[`RAZA_${i}`]    = a?.raza          ?? '';
      filasAnimales[`SEXO_${i}`]    = a ? (a.sexo === 'MACHO' ? 'M' : 'H') : '';
      filasAnimales[`PRUEBA_${i}`]  = a ? (a.estatusSanitario === 'SANO' ? 'Negativo' : a.estatusSanitario) : '';
    }

    const datos: Record<string, string | undefined> = {
      NUM_FOLIO:     generarFolio('EXP'),
      FECHA_EMISION: formatFecha(new Date()),
      PROPIETARIO:   `${propietario.nombre} ${propietario.apellidos}`,
      NOMBRE_RANCHO: upp.nombre,
      RANCHO:        upp.nombre,
      MUNICIPIO:     upp.municipio,
      ESTADO:        upp.estado,
      ...(upp.direccion       && { DOMICILIO:          upp.direccion }),
      ...(upp.tipoExplotacion && { FUNCION_ZOOTECNICA: upp.tipoExplotacion }),
      NUM_ANIMALES_TB: de.num_animales_tb || String(animales.length),
      NUM_ANIMALES_BR: de.num_animales_br || String(animales.length),
      ...(de.num_solicitud           && { NUM_SOLICITUD:           de.num_solicitud }),
      ...(de.ddr_no                  && { DDR_NO:                  de.ddr_no }),
      ...(de.fecha_programacion      && { FECHA_PROGRAMACION:      de.fecha_programacion }),
      ...(de.motivo_prueba           && { MOTIVO_PRUEBA:           de.motivo_prueba }),
      ...(de.fecha_prueba            && { FECHA_PRUEBA:            de.fecha_prueba }),
      ...(de.hora_inicio             && { HORA_INICIO:             de.hora_inicio }),
      ...(de.nombre_mvz_aprobado     && { NOMBRE_MVZ_APROBADO:     de.nombre_mvz_aprobado }),
      ...(de.credencial_mvz_aprobado && { CREDENCIAL_MVZ_APROBADO: de.credencial_mvz_aprobado }),
      ...(de.vigencia_mvz_aprobado   && { VIGENCIA_MVZ_APROBADO:   de.vigencia_mvz_aprobado }),
      ...(de.nombre_mvz_supervisor   && { NOMBRE_MVZ_SUPERVISOR:   de.nombre_mvz_supervisor }),
      ...(de.observaciones           && { OBSERVACIONES:           de.observaciones }),
      ...filasAnimales,
    };

    const docxBuffer = await llenarPlantilla('solicitud_exportacion_ganado.docx', datos);
    const pdfBuffer  = await convertirAPDF(docxBuffer, 'solicitud_exportacion');
    enviarPDF(res, pdfBuffer, `solicitud_exportacion_${upp.claveUPP}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error generando documento';
    console.error('[solicitud-exportacion]', error);
    res.status(500).json({ error: msg });
  }
});

export default router;
