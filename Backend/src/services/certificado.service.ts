/**
 * SIGGAN — Servicio de Certificados Sanitarios Digitales
 *
 * Genera un certificado JSON estructurado para un animal, lo firma
 * con el hash final de integridad y lo registra en la blockchain simulada.
 *
 * Estructura del certificado:
 *   { version, folio, tipo, emitidoEn, animal, evento, mvz, integridad }
 *
 * El campo `integridad` contiene los tres valores criptográficos y el
 * ID del bloque en la cadena — suficiente para verificar autenticidad
 * sin conexión a internet.
 */

import fs   from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../config/database';
import {
  generarHash,
  funcionMatematica,
  generarHashFinal,
  registrarEnBlockchainSimulada,
  verificarIntegridad,
} from './blockchain.service';

// ─── Directorio de certificados ───────────────────────────────────────────────
const DIR_CERTIFICADOS = path.join(__dirname, '../../uploads/certificados');
if (!fs.existsSync(DIR_CERTIFICADOS)) fs.mkdirSync(DIR_CERTIFICADOS, { recursive: true });

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface CertificadoSanitario {
  version:    string;
  folio:      string;
  tipo:       'CERTIFICADO_ZOOSANITARIO';
  emitidoEn:  string;
  animal: {
    id:              string;
    areteNacional:   string;
    nombre:          string | null;
    raza:            string;
    sexo:            string;
    fechaNacimiento: string;
    propietario:     string;
    upp:             string;
  };
  evento: {
    id:             string;
    tipo:           string;
    fecha:          string;
    resultado:      string | null;
    observaciones:  string | null;
    lote:           string | null;
    proximaFecha:   string | null;
  };
  mvz: {
    nombre:             string | null;
    cedulaProfesional:  string | null;
    rnmvz:              string | null;
    vigencia:           string | null;
  };
  integridad: {
    hashDatos:        string;
    funcionMatematica: string;
    hashFinal:        string;
    blockchainId:     string;
    hashBloque:       string;
    timestamp:        string;
  };
}

export interface ResultadoVerificacionCert {
  valido:   boolean;
  folio:    string;
  mensaje:  string;
  detalles: {
    hashRecalculado: string;
    hashCertificado: string;
    coinciden:       boolean;
    blockchainValido: boolean;
  };
}

// ─── Generador de folio único ─────────────────────────────────────────────────
function generarFolio(): string {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand  = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CERT-${fecha}-${rand}`;
}

// ─── Serializar datos del certificado para hashing ────────────────────────────
function serializarCertificado(cert: Omit<CertificadoSanitario, 'integridad'>): string {
  return JSON.stringify({
    version:   cert.version,
    folio:     cert.folio,
    tipo:      cert.tipo,
    emitidoEn: cert.emitidoEn,
    animal:    cert.animal,
    evento:    cert.evento,
    mvz:       cert.mvz,
  });
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * 6. generarCertificadoSanitario(animalId)
 *
 * Usa el evento sanitario más reciente del animal.
 * Si quieres un evento específico, pasa `eventoId` como segundo argumento.
 */
export async function generarCertificadoSanitario(
  animalId: string,
  eventoId?: string,
): Promise<{ certificado: CertificadoSanitario; rutaArchivo: string }> {
  // 1 — Cargar animal con relaciones
  const animal = await prisma.animal.findUnique({
    where:   { id: animalId },
    include: {
      propietario: true,
      upp:         true,
    },
  });
  if (!animal) throw new Error(`Animal ${animalId} no encontrado`);

  // 2 — Cargar evento sanitario
  const evento = eventoId
    ? await prisma.eventoSanitario.findUnique({ where: { id: eventoId } })
    : await prisma.eventoSanitario.findFirst({
        where:   { animalId },
        orderBy: { fecha: 'desc' },
      });
  if (!evento) throw new Error(`No se encontró evento sanitario para el animal ${animalId}`);

  // 3 — Construir cuerpo del certificado (sin integridad todavía)
  const ts     = new Date().toISOString();
  const folio  = generarFolio();

  const cuerpo: Omit<CertificadoSanitario, 'integridad'> = {
    version:   '1.0',
    folio,
    tipo:      'CERTIFICADO_ZOOSANITARIO',
    emitidoEn: ts,
    animal: {
      id:              animal.id,
      areteNacional:   animal.areteNacional,
      nombre:          animal.nombre,
      raza:            animal.raza,
      sexo:            animal.sexo,
      fechaNacimiento: animal.fechaNacimiento.toISOString(),
      propietario:     `${animal.propietario.nombre} ${animal.propietario.apellidos}`,
      upp:             `${animal.upp.claveUPP} - ${animal.upp.nombre}`,
    },
    evento: {
      id:            evento.id,
      tipo:          evento.tipo,
      fecha:         evento.fecha.toISOString(),
      resultado:     evento.resultado,
      observaciones: evento.observaciones,
      lote:          evento.lote,
      proximaFecha:  evento.proximaFecha?.toISOString() ?? null,
    },
    mvz: {
      nombre:            evento.mvzResponsable,
      cedulaProfesional: evento.cedulaMvz,
      rnmvz:             evento.rnmvz,
      vigencia:          evento.vigenciaMvz,
    },
  };

  // 4 — Calcular hashes del certificado
  const payload    = serializarCertificado(cuerpo);
  const hashDatos  = generarHash(payload);
  const fmat       = funcionMatematica(payload);
  const hashFinal  = generarHashFinal(payload, ts);

  // 5 — Registrar en blockchain simulada
  const { blockId, hashActual } = await registrarEnBlockchainSimulada(
    'certificado',
    folio,
    { folio, animalId, eventoId: evento.id, hashFinal, emitidoEn: ts },
  );

  // 6 — Ensamblar certificado completo
  const certificado: CertificadoSanitario = {
    ...cuerpo,
    integridad: {
      hashDatos,
      funcionMatematica: fmat,
      hashFinal,
      blockchainId: blockId,
      hashBloque:   hashActual,
      timestamp:    ts,
    },
  };

  // 7 — Guardar en disco
  const nombreArchivo = `${folio}.json`;
  const rutaArchivo   = path.join(DIR_CERTIFICADOS, nombreArchivo);
  fs.writeFileSync(rutaArchivo, JSON.stringify(certificado, null, 2), 'utf8');

  // 8 — Actualizar hashBlockchain en el formulario si existe uno vinculado
  await prisma.formulario.updateMany({
    where:  { datos: { path: ['animalId'], equals: animalId }, tipo: 'CERTIFICADO_ZOOSANITARIO' },
    data:   { hashBlockchain: hashFinal, pdfUrl: rutaArchivo },
  }).catch(() => { /* no crítico si no hay formulario */ });

  return { certificado, rutaArchivo };
}

/**
 * 7. verificarCertificado(certificadoJson)
 *
 * Recibe el JSON del certificado (parseado) y verifica:
 *   a) Que el hashFinal embebido coincide con los datos actuales.
 *   b) Que el bloque en la cadena coincide con el folio.
 */
export async function verificarCertificado(
  certificado: CertificadoSanitario,
): Promise<ResultadoVerificacionCert> {
  const { integridad, ...cuerpo } = certificado;

  // Recalcular hash de los datos del cuerpo
  const payload        = serializarCertificado(cuerpo);
  const hashRecalc     = generarHashFinal(payload, integridad.timestamp);
  const datosCoinciden = hashRecalc === integridad.hashFinal;

  // Verificar existencia en blockchain
  const resultBC = await verificarIntegridad(
    'certificado',
    cuerpo.folio,
    { folio: cuerpo.folio, animalId: cuerpo.animal.id, eventoId: cuerpo.evento.id, hashFinal: integridad.hashFinal, emitidoEn: cuerpo.emitidoEn },
  );

  const valido = datosCoinciden && resultBC.valido;

  return {
    valido,
    folio:   cuerpo.folio,
    mensaje: valido
      ? `Certificado ${cuerpo.folio} auténtico e íntegro`
      : datosCoinciden
        ? `⚠️ Datos del certificado OK pero bloque en cadena inválido`
        : `⚠️ FRAUDE: datos del certificado ${cuerpo.folio} han sido alterados`,
    detalles: {
      hashRecalculado:  hashRecalc,
      hashCertificado:  integridad.hashFinal,
      coinciden:        datosCoinciden,
      blockchainValido: resultBC.valido,
    },
  };
}

/**
 * Carga un certificado desde disco y lo verifica.
 */
export async function verificarCertificadoDesdeArchivo(
  nombreArchivo: string,
): Promise<ResultadoVerificacionCert> {
  const ruta = path.join(DIR_CERTIFICADOS, nombreArchivo);
  if (!fs.existsSync(ruta)) throw new Error(`Archivo no encontrado: ${nombreArchivo}`);
  const certificado: CertificadoSanitario = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  return verificarCertificado(certificado);
}
