/**
 * simulador_iot.js
 * Simulador principal de sensores IoT para SIGGAN.
 *
 * - Conecta a PostgreSQL para obtener la lista de animales activos.
 * - Genera lecturas realistas (temperatura, GPS, RSSI, batería, vitales).
 * - Envía lecturas y alertas al backend vía HTTP.
 * - Si la API falla, guarda fallback en logs/lecturas_TIMESTAMP.json.
 * - Se ejecuta cada 30 s (configurable en config.json).
 * - Muestra estadísticas cada 60 s.
 * - Se detiene limpiamente con Ctrl+C.
 */

import axios from 'axios';
import pg   from 'pg';
import winston from 'winston';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { generarVitales }  from './generadores/generador_vitales.js';
import { generarGPS }      from './generadores/generador_gps.js';

// ─── Paths ───────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'config.json');
const LOGS_DIR    = join(__dirname, 'logs');

// ─── Config ──────────────────────────────────────────────────────────────────
let cfg;
try {
  cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
} catch (e) {
  console.error('❌ No se pudo leer config.json:', e.message);
  process.exit(1);
}

if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });

// ─── Logger (Winston) ─────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: cfg.logging?.nivel ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    cfg.logging?.formato === 'json'
      ? winston.format.json()
      : winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
          return `${timestamp} [${level.toUpperCase()}] ${message}${extra}`;
        })
  ),
  transports: [
    new winston.transports.File({ filename: join(__dirname, cfg.logging?.archivo ?? 'logs/simulador_iot.log') }),
    ...(cfg.logging?.console !== false
      ? [new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message }) =>
              `${timestamp} [${level}] ${message}`)
          ),
        })]
      : []),
  ],
});

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
const { Pool } = pg;
const pool = new Pool({
  host:     cfg.database.host,
  port:     cfg.database.port,
  user:     cfg.database.user,
  password: String(cfg.database.password),
  database: cfg.database.database,
  ssl:      cfg.database.ssl ? { rejectUnauthorized: false } : false,
});

// ─── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: cfg.backend.url,
  timeout: cfg.backend.timeout ?? 5000,
});

// ─── Autenticación ────────────────────────────────────────────────────────────
let jwtToken = cfg.autenticacion?.token ?? '';

async function login() {
  const { email, password, login_endpoint } = cfg.autenticacion ?? {};
  if (!email || !password) {
    logger.warn('⚠️  Sin credenciales en config.json → autenticacion.email / password. Configúralas para auto-login.');
    return false;
  }
  try {
    const res = await api.post(login_endpoint ?? '/api/auth/login', { email, password });
    jwtToken = res.data.token;
    api.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;
    logger.info(`✅ Login exitoso como ${res.data.usuario?.email} (${res.data.usuario?.rol})`);
    return true;
  } catch (e) {
    logger.error(`❌ Login fallido: ${e.response?.data?.error ?? e.message}`);
    return false;
  }
}

function setAuthHeader() {
  if (jwtToken) api.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;
}

// ─── Estadísticas globales ─────────────────────────────────────────────────
const stats = {
  ciclos: 0,
  lecturasEnviadas: 0,
  alertasEnviadas: 0,
  erroresApi: 0,
  fallbacksGuardados: 0,
  inicio: Date.now(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function elegirNodo(nodos) {
  const activos = nodos.filter(n => n.activo);
  if (!activos.length) return { nodoId: 'ESP32-001' };
  return activos[Math.floor(Math.random() * activos.length)];
}

function generarRSSI(cfg) {
  const media   = cfg?.rssi?.media    ?? -70;
  const variacion = cfg?.rssi?.variacion ?? 10;
  return Math.round(media + (Math.random() * variacion * 2 - variacion));
}

function generarBateria(cfg) {
  const min = cfg?.bateria?.min ?? 10;
  const max = cfg?.bateria?.max ?? 100;
  return parseFloat((min + Math.random() * (max - min)).toFixed(1));
}

// ─── Guardar fallback en disco ────────────────────────────────────────────────
function guardarFallback(datos) {
  const ts       = new Date().toISOString().replace(/[:.]/g, '-');
  const archivo  = join(LOGS_DIR, `lecturas_${ts}.json`);
  try {
    writeFileSync(archivo, JSON.stringify(datos, null, 2));
    stats.fallbacksGuardados++;
    logger.warn(`💾 Fallback guardado: ${archivo}`);
  } catch (e) {
    logger.error(`❌ No se pudo guardar fallback: ${e.message}`);
  }
}

// ─── Enviar lectura a la API con reintentos ───────────────────────────────────
async function enviarLectura(lectura, intentos = 0) {
  const maxRetries = cfg.backend.retries ?? 3;
  try {
    await api.post(cfg.backend.endpoints.lecturas, lectura);
    stats.lecturasEnviadas++;
    return true;
  } catch (e) {
    if (e.response?.status === 401 && intentos === 0) {
      // Token expirado → re-login y reintento
      logger.warn('🔑 Token expirado, re-autenticando...');
      await login();
      return enviarLectura(lectura, 1);
    }
    if (intentos < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 500 * (intentos + 1)));
      return enviarLectura(lectura, intentos + 1);
    }
    stats.erroresApi++;
    return false;
  }
}

// ─── Enviar alerta a la API ────────────────────────────────────────────────────
async function enviarAlerta(alerta) {
  try {
    await api.post(cfg.backend.endpoints.alertas, alerta);
    stats.alertasEnviadas++;
    return true;
  } catch (e) {
    stats.erroresApi++;
    return false;
  }
}

// ─── Ciclo principal de simulación ───────────────────────────────────────────
async function ejecutarCiclo() {
  stats.ciclos++;
  logger.info(`\n━━━ Ciclo #${stats.ciclos} — ${new Date().toLocaleString('es-MX')} ━━━`);

  // 1. Obtener animales de la BD
  let animales = [];
  try {
    const { rows } = await pool.query(`
      SELECT a.id, a."areteNacional", a.nombre, a.raza,
             u.municipio, u.latitud AS upp_lat, u.longitud AS upp_lon
      FROM   animales a
      LEFT   JOIN upps u ON u.id = a."uppId"
      WHERE  a.activo = true
      LIMIT  200
    `);
    animales = rows;
    logger.info(`🐄 ${animales.length} animales activos encontrados`);
  } catch (e) {
    logger.error(`❌ Error consultando animales: ${e.message}`);
    return;
  }

  if (!animales.length) {
    logger.warn('⚠️  No hay animales activos en la base de datos');
    return;
  }

  const nodos  = cfg.sensores.nodos;
  const fallback = { timestamp: new Date().toISOString(), ciclo: stats.ciclos, lecturas: [], alertas: [] };
  let apiFalló = false;

  for (const animal of animales) {
    const nodo    = elegirNodo(nodos);
    const vitales = generarVitales(animal.id, cfg.sensores);
    const gps     = generarGPS(
      animal.id,
      vitales.actividad,
      cfg.sensores.gps,
      cfg.alertas_probabilidades.fuera_geocerca
    );
    const rssi    = generarRSSI(cfg.sensores);
    const bateria = generarBateria(cfg.sensores);

    const lectura = {
      animalId:   animal.id,
      nodoId:     nodo.nodoId,
      latitud:    gps.latitud,
      longitud:   gps.longitud,
      temperatura: vitales.temperatura,
      rssi,
      bateria,
      // Campos extra (no se guardan en BD pero útiles para debug)
      _meta: {
        actividad:     vitales.actividad,
        ritmoCardiaco: vitales.ritmoCardiaco,
        estres:        vitales.estres,
        saturacionO2:  vitales.saturacionO2,
        precision:     gps.precision,
        distanciaCentro: gps.distanciaCentroMetros,
      },
    };

    // Enviar lectura (incluye vitales completos)
    const ok = await enviarLectura({
      animalId:      lectura.animalId,
      nodoId:        lectura.nodoId,
      latitud:       lectura.latitud,
      longitud:      lectura.longitud,
      temperatura:   lectura.temperatura,
      rssi:          lectura.rssi,
      bateria:       lectura.bateria,
      ritmoCardiaco: lectura._meta.ritmoCardiaco,
      estres:        lectura._meta.estres,
      saturacionO2:  lectura._meta.saturacionO2,
      actividad:     lectura._meta.actividad,
    });

    if (!ok) {
      apiFalló = true;
      fallback.lecturas.push(lectura);
    }

    // ── Detectar alertas ──────────────────────────────────────────────────
    const alertas = [];

    if (vitales.esFiebre) {
      alertas.push({
        tipo:      'TEMPERATURA_ALTA',
        severidad: vitales.temperatura > 41.5 ? 'CRITICA' : 'ALTA',
        mensaje:   `🌡️ ${animal.areteNacional} (${animal.nombre ?? animal.raza}) registra ${vitales.temperatura}°C — posible fiebre`,
        animalId:  animal.id,
        nodoId:    nodo.nodoId,
        valor:     vitales.temperatura,
        umbral:    cfg.sensores.temperatura.umbral_alerta,
      });
    }

    if (gps.fueraGeocerca) {
      alertas.push({
        tipo:      'FUERA_GEOCERCA',
        severidad: 'ALTA',
        mensaje:   `📍 ${animal.areteNacional} (${animal.nombre ?? animal.raza}) detectado fuera de geocerca (${gps.distanciaCentroMetros} m del centro)`,
        animalId:  animal.id,
        nodoId:    nodo.nodoId,
        valor:     gps.distanciaCentroMetros,
        umbral:    cfg.sensores.gps.radio_metros,
      });
    }

    if (bateria < cfg.sensores.bateria.umbral_baja) {
      alertas.push({
        tipo:      'BATERIA_BAJA',
        severidad: bateria < 10 ? 'ALTA' : 'MEDIA',
        mensaje:   `🔋 Nodo ${nodo.nodoId} con batería al ${bateria}%`,
        nodoId:    nodo.nodoId,
        valor:     bateria,
        umbral:    cfg.sensores.bateria.umbral_baja,
      });
    }

    if (vitales.esEstresAlto) {
      alertas.push({
        tipo:      'ESTRES_ALTO',
        severidad: vitales.estres > 90 ? 'ALTA' : 'MEDIA',
        mensaje:   `⚠️ ${animal.areteNacional} (${animal.nombre ?? animal.raza}) con estrés alto: ${vitales.estres}%`,
        animalId:  animal.id,
        nodoId:    nodo.nodoId,
        valor:     vitales.estres,
        umbral:    75,
      });
    }

    for (const alerta of alertas) {
      const alertaOk = await enviarAlerta(alerta);
      if (!alertaOk) fallback.alertas.push(alerta);
    }

    // Log por animal
    const fiebreTag  = vitales.esFiebre    ? ' 🌡️FIEBRE'    : '';
    const geocercaTag = gps.fueraGeocerca  ? ' 📍GEOCERCA'  : '';
    const bateriaTag  = bateria < 20       ? ' 🔋BATERÍA'   : '';
    logger.info(
      `  🐄 ${animal.areteNacional.padEnd(12)} ${vitales.actividad.padEnd(10)} ` +
      `${vitales.temperatura}°C  BPM:${vitales.ritmoCardiaco}  ` +
      `Estrés:${vitales.estres}%  O₂:${vitales.saturacionO2}%  ` +
      `GPS:(${gps.latitud},${gps.longitud})  RSSI:${rssi}  Bat:${bateria}%` +
      fiebreTag + geocercaTag + bateriaTag
    );
  }

  if (apiFalló && fallback.lecturas.length > 0) {
    guardarFallback(fallback);
  }

  logger.info(`✅ Ciclo #${stats.ciclos} completado — Lecturas enviadas: ${stats.lecturasEnviadas} | Alertas: ${stats.alertasEnviadas} | Errores API: ${stats.erroresApi}`);
}

// ─── Estadísticas cada 60 s ───────────────────────────────────────────────────
function mostrarEstadisticas() {
  const mins = Math.floor((Date.now() - stats.inicio) / 60000);
  logger.info(`\n📊 ESTADÍSTICAS (${mins} min activo)`);
  logger.info(`   Ciclos ejecutados : ${stats.ciclos}`);
  logger.info(`   Lecturas enviadas : ${stats.lecturasEnviadas}`);
  logger.info(`   Alertas enviadas  : ${stats.alertasEnviadas}`);
  logger.info(`   Errores API       : ${stats.erroresApi}`);
  logger.info(`   Fallbacks en disco: ${stats.fallbacksGuardados}`);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function main() {
  logger.info('╔══════════════════════════════════════════════════╗');
  logger.info('║   SIGGAN IoT Simulator — Unión Ganadera Durango  ║');
  logger.info('╚══════════════════════════════════════════════════╝');
  logger.info(`Backend  : ${cfg.backend.url}`);
  logger.info(`Base datos: ${cfg.database.database}@${cfg.database.host}:${cfg.database.port}`);
  logger.info(`Intervalo : ${cfg.simulador.intervaloSimulacion_ms / 1000} s`);

  // Verificar conexión a BD
  try {
    await pool.query('SELECT 1');
    logger.info('✅ PostgreSQL conectado');
  } catch (e) {
    logger.error(`❌ No se pudo conectar a PostgreSQL: ${e.message}`);
    logger.error('   Verifica host, puerto, usuario, contraseña y database en config.json');
    process.exit(1);
  }

  // Autenticar contra la API
  setAuthHeader();
  if (!jwtToken) await login();

  if (!jwtToken) {
    logger.warn('⚠️  Sin token JWT. Configura autenticacion.email y password en config.json');
    logger.warn('   El simulador intentará de todos modos (puede fallar con 401)');
  }

  if (!cfg.simulador.activo) {
    logger.warn('⚠️  simulador.activo = false en config.json. Saliendo.');
    process.exit(0);
  }

  // Primer ciclo inmediato
  await ejecutarCiclo();

  // Loop periódico
  const intervalo = setInterval(ejecutarCiclo, cfg.simulador.intervaloSimulacion_ms);
  const statsInterval = setInterval(mostrarEstadisticas, 60000);

  // Apagado limpio
  process.on('SIGINT', async () => {
    logger.info('\n🛑 Deteniendo simulador (SIGINT)...');
    clearInterval(intervalo);
    clearInterval(statsInterval);
    mostrarEstadisticas();
    await pool.end();
    logger.info('👋 Simulador detenido. ¡Hasta luego!');
    process.exit(0);
  });
}

main().catch(e => {
  logger.error('Error fatal:', e);
  process.exit(1);
});
