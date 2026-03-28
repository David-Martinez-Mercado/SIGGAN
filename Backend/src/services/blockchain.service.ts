/**
 * SIGGAN — Servicio de Blockchain Simulada
 *
 * Implementa un sistema de integridad tipo blockchain usando:
 *   1. SHA-256 estándar
 *   2. Función matemática personalizada:  F(d) = Σ ASCII(cᵢ) · Pᵢ^i  mod N
 *   3. Hash final:  SHA256( SHA256(d) + F(d) + SALT + ts )
 *
 * Cada bloque encadena el hashAnterior → hashActual, de modo que
 * cualquier alteración rompe la cadena y es detectable.
 *
 * Preparado para migrar a Ethereum / Polygon: la función
 * registrarEnBlockchainSimulada() puede reemplazarse por una llamada
 * a un smart-contract sin cambiar el modelo de seguridad.
 */

import crypto from 'crypto';
import prisma from '../config/database';

// ─── Constantes ───────────────────────────────────────────────────────────────
const SALT = process.env.BLOCKCHAIN_SALT ?? 'SIGGAN_INTEGRITY_SALT_2026';
const N    = 1_000_000_007n;   // Primo grande módulo para F(data)

// Hash del bloque génesis (bloque 0, sin predecesor)
const GENESIS_HASH = '0'.repeat(64);

// ─── Tipos públicos ────────────────────────────────────────────────────────────
export type TipoRegistro =
  | 'animal'
  | 'evento'
  | 'certificado'
  | 'venta'
  | 'usuario'
  | 'propietario'
  | 'upp'
  | 'formulario'
  | 'historial_arete'
  | 'documento';

export interface ResultadoVerificacion {
  valido:       boolean;
  tipoAlerta:   'VERIFICADO' | 'MANIPULACION' | 'FRAUDE' | 'SIN_REGISTRO';
  hashEsperado: string;
  hashAlmacenado: string | null;
  mensaje:      string;
}

export interface ResultadoCadena {
  integra:      boolean;
  totalBloques: number;
  bloquesCorruptos: Array<{ indice: number; id: string; tipo: string; referenciaId: string }>;
}

// ─── Utilidades internas ───────────────────────────────────────────────────────

/** Criba de Eratóstenes — genera los primeros primos hasta `limit` */
function generarPrimos(limit: number): number[] {
  const comp = new Uint8Array(limit + 1);
  const primos: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (!comp[i]) {
      primos.push(i);
      for (let j = i * i; j <= limit; j += i) comp[j] = 1;
    }
  }
  return primos;
}

// 1 229 primos (suficiente para cualquier payload razonable)
const PRIMOS = generarPrimos(10_000);

/** Exponenciación modular rápida con BigInt */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) result = result * base % mod;
    exp >>= 1n;
    base  = base * base % mod;
  }
  return result;
}

/** Serialización determinista (claves ordenadas alfabéticamente) */
function serializar(data: Record<string, unknown>): string {
  const ordenado = Object.keys(data)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => { acc[k] = data[k]; return acc; }, {});
  return JSON.stringify(ordenado);
}

// ─── Funciones públicas de hash ────────────────────────────────────────────────

/**
 * 1. SHA-256 estándar del dato serializado.
 */
export function generarHash(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * 2. Función matemática personalizada:
 *    F(d) = Σᵢ [ ASCII(dᵢ) · Pᵢ^i ]  mod N
 *    donde Pᵢ es el i-ésimo primo y N = 1 000 000 007
 */
export function funcionMatematica(data: string): string {
  let acc = 0n;
  for (let i = 0; i < data.length; i++) {
    const ascii  = BigInt(data.charCodeAt(i));
    const primo  = BigInt(PRIMOS[i % PRIMOS.length]);
    const expo   = BigInt(i + 1);
    acc = (acc + ascii * modPow(primo, expo, N)) % N;
  }
  return acc.toString();
}

/**
 * 3. Hash final:
 *    FINAL_HASH = SHA256( SHA256(data) + F(data) + SALT + timestamp )
 */
export function generarHashFinal(data: string, timestamp: string): string {
  const sha  = generarHash(data);
  const fmat = funcionMatematica(data);
  return generarHash(sha + fmat + SALT + timestamp);
}

// ─── Blockchain simulada ───────────────────────────────────────────────────────

/**
 * 4. Registra un nuevo bloque en la cadena.
 *    hashActual = SHA256( hashAnterior + tipo + referenciaId + hashFinal + timestamp )
 */
export async function registrarEnBlockchainSimulada(
  tipo:        TipoRegistro,
  referenciaId: string,
  datos:       Record<string, unknown>,
): Promise<{ blockId: string; hashActual: string; hashFinal: string }> {
  const ts        = new Date().toISOString();
  const payload   = serializar(datos);
  const hashDatos = generarHash(payload);
  const fmat      = funcionMatematica(payload);
  const hashFinal = generarHashFinal(payload, ts);

  // Obtener el último bloque para encadenar
  const ultimo = await prisma.blockchainSimulada.findFirst({
    orderBy: { timestamp: 'desc' },
    select:  { hashActual: true },
  });
  const hashAnterior = ultimo?.hashActual ?? GENESIS_HASH;

  // Hash del bloque (enlace de cadena)
  const hashActual = generarHash(hashAnterior + tipo + referenciaId + hashFinal + ts);

  const bloque = await prisma.blockchainSimulada.create({
    data: {
      hashActual,
      hashAnterior,
      tipoRegistro: tipo,
      referenciaId,
      hashDatos,
      funcionMatem: fmat,
      hashFinal,
      timestamp:    new Date(ts),
    },
  });

  return { blockId: bloque.id, hashActual, hashFinal };
}

/**
 * 5. Verifica la integridad de un registro comparando su hash actual
 *    con el almacenado en la cadena.
 */
export async function verificarIntegridad(
  tipo:        TipoRegistro,
  referenciaId: string,
  datosActuales: Record<string, unknown>,
): Promise<ResultadoVerificacion> {
  // Buscar el bloque más reciente para este registro
  const bloque = await prisma.blockchainSimulada.findFirst({
    where:   { tipoRegistro: tipo, referenciaId },
    orderBy: { timestamp: 'desc' },
  });

  if (!bloque) {
    return {
      valido:          false,
      tipoAlerta:      'SIN_REGISTRO',
      hashEsperado:    '',
      hashAlmacenado:  null,
      mensaje:         `No existe registro en la cadena para ${tipo}:${referenciaId}`,
    };
  }

  const payload      = serializar(datosActuales);
  const tsAlmacenado = bloque.timestamp.toISOString();
  const hashRecalc   = generarHashFinal(payload, tsAlmacenado);

  const valido = hashRecalc === bloque.hashFinal;

  const resultado: ResultadoVerificacion = {
    valido,
    tipoAlerta:      valido ? 'VERIFICADO' : 'MANIPULACION',
    hashEsperado:    hashRecalc,
    hashAlmacenado:  bloque.hashFinal,
    mensaje: valido
      ? `Integridad confirmada para ${tipo}:${referenciaId}`
      : `⚠️ ALERTA: datos manipulados en ${tipo}:${referenciaId}`,
  };

  // Guardar log siempre
  await prisma.logIntegridad.create({
    data: {
      tipoAlerta:   resultado.tipoAlerta,
      tipoRegistro: tipo,
      referenciaId,
      detalles:     resultado.mensaje,
    },
  });

  return resultado;
}

/**
 * 6. Verifica la integridad completa de toda la cadena.
 *    Recorre cada bloque y recalcula hashActual = SHA256(hashAnterior + tipo + refId + hashFinal + ts)
 */
export async function verificarCadena(): Promise<ResultadoCadena> {
  const bloques = await prisma.blockchainSimulada.findMany({
    orderBy: { timestamp: 'asc' },
  });

  const corruptos: ResultadoCadena['bloquesCorruptos'] = [];

  for (let i = 0; i < bloques.length; i++) {
    const b  = bloques[i];
    const ts = b.timestamp.toISOString();

    const hashEsperado = generarHash(
      b.hashAnterior + b.tipoRegistro + b.referenciaId + b.hashFinal + ts,
    );

    if (hashEsperado !== b.hashActual) {
      corruptos.push({ indice: i, id: b.id, tipo: b.tipoRegistro, referenciaId: b.referenciaId });
    }

    // Verificar encadenamiento con bloque anterior
    if (i > 0 && b.hashAnterior !== bloques[i - 1].hashActual) {
      corruptos.push({ indice: i, id: b.id, tipo: b.tipoRegistro, referenciaId: b.referenciaId });
    }
  }

  if (corruptos.length > 0) {
    await prisma.logIntegridad.create({
      data: {
        tipoAlerta:   'CADENA_INVALIDA',
        tipoRegistro: 'sistema',
        referenciaId: 'cadena_completa',
        detalles:     `Bloques corruptos: ${corruptos.map(c => c.id).join(', ')}`,
      },
    });
  }

  return {
    integra:      corruptos.length === 0,
    totalBloques: bloques.length,
    bloquesCorruptos: corruptos,
  };
}

// ─── Helpers de extracción de datos por modelo ────────────────────────────────

/** Datos canónicos a proteger de cada entidad */
export async function obtenerDatosCanonicos(
  tipo: TipoRegistro,
  id:   string,
): Promise<Record<string, unknown> | null> {
  switch (tipo) {
    case 'animal': {
      const r = await prisma.animal.findUnique({ where: { id } });
      if (!r) return null;
      return {
        id: r.id, areteNacional: r.areteNacional, nombre: r.nombre,
        raza: r.raza, sexo: r.sexo, fechaNacimiento: r.fechaNacimiento?.toISOString(),
        estatusSanitario: r.estatusSanitario, propietarioId: r.propietarioId,
        uppId: r.uppId, irisHash: r.irisHash,
      };
    }
    case 'evento': {
      const r = await prisma.eventoSanitario.findUnique({ where: { id } });
      if (!r) return null;
      return {
        id: r.id, tipo: r.tipo, fecha: r.fecha?.toISOString(),
        resultado: r.resultado, mvzResponsable: r.mvzResponsable,
        cedulaMvz: r.cedulaMvz, rnmvz: r.rnmvz, animalId: r.animalId,
      };
    }
    case 'usuario': {
      const r = await prisma.usuario.findUnique({ where: { id } });
      if (!r) return null;
      return {
        id: r.id, email: r.email, nombre: r.nombre,
        apellidos: r.apellidos, rol: r.rol, estatus: r.estatus,
      };
    }
    case 'propietario': {
      const r = await prisma.propietario.findUnique({ where: { id } });
      if (!r) return null;
      return {
        id: r.id, nombre: r.nombre, apellidos: r.apellidos,
        curp: r.curp, rfc: r.rfc, email: r.email,
      };
    }
    case 'upp': {
      const r = await prisma.uPP.findUnique({ where: { id } });
      if (!r) return null;
      return {
        id: r.id, claveUPP: r.claveUPP, nombre: r.nombre,
        estatusSanitario: r.estatusSanitario, propietarioId: r.propietarioId,
      };
    }
    case 'formulario': {
      const r = await prisma.formulario.findUnique({ where: { id } });
      if (!r) return null;
      return {
        id: r.id, tipo: r.tipo, folio: r.folio,
        datos: r.datos, estatus: r.estatus, usuarioId: r.usuarioId,
      };
    }
    case 'historial_arete': {
      const r = await prisma.historialArete.findUnique({ where: { id } });
      if (!r) return null;
      return {
        id: r.id, tipoArete: r.tipoArete, numeroArete: r.numeroArete,
        accion: r.accion, motivo: r.motivo, animalId: r.animalId,
        fecha: r.fecha?.toISOString(),
      };
    }
    case 'documento': {
      const r = await prisma.documentoUsuario.findUnique({ where: { id } });
      if (!r) return null;
      return {
        id: r.id, tipo: r.tipo, nombreArchivo: r.nombreArchivo,
        rutaArchivo: r.rutaArchivo, usuarioId: r.usuarioId,
      };
    }
    case 'venta': {
      const r = await prisma.ofertaMarketplace.findUnique({ where: { id } });
      if (!r) return null;
      return {
        id: r.id, precioSolicitado: r.precioSolicitado,
        precioOfertado: r.precioOfertado, estatus: r.estatus,
        animalId: r.animalId, vendedorId: r.vendedorId,
        compradorId: r.compradorId, fechaCierre: r.fechaCierre?.toISOString(),
      };
    }
    default:
      return null;
  }
}

/**
 * Registra automáticamente un registro en la cadena obteniendo
 * sus datos canónicos desde la base de datos.
 */
export async function registrarPorId(
  tipo: TipoRegistro,
  id:   string,
): Promise<{ blockId: string; hashActual: string; hashFinal: string } | null> {
  const datos = await obtenerDatosCanonicos(tipo, id);
  if (!datos) return null;
  return registrarEnBlockchainSimulada(tipo, id, datos);
}

/**
 * Verifica un registro obteniéndolo directamente desde la BD.
 */
export async function verificarPorId(
  tipo: TipoRegistro,
  id:   string,
): Promise<ResultadoVerificacion> {
  const datos = await obtenerDatosCanonicos(tipo, id);
  if (!datos) {
    return {
      valido: false, tipoAlerta: 'SIN_REGISTRO',
      hashEsperado: '', hashAlmacenado: null,
      mensaje: `Registro ${tipo}:${id} no encontrado en la BD`,
    };
  }
  return verificarIntegridad(tipo, id, datos);
}
