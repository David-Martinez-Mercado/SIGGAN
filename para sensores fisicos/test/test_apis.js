/**
 * test_apis.js
 * Suite de pruebas para el backend SIGGAN + módulo IoT.
 * Ejecutar: npm run test:apis
 */

import axios   from 'axios';
import pg      from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dirname, '..', 'config.json'), 'utf-8'));

const BASE_URL = cfg.backend.url;
const DB_CFG   = cfg.database;

// ─── Colores ANSI ─────────────────────────────────────────────────────────────
const OK  = '\x1b[32m✅\x1b[0m';
const ERR = '\x1b[31m❌\x1b[0m';
const WARN = '\x1b[33m⚠️ \x1b[0m';
const INFO = '\x1b[36mℹ️ \x1b[0m';

const resultados = [];

function registrar(nombre, exito, detalle = '') {
  resultados.push({ nombre, exito, detalle });
  const icono = exito ? OK : ERR;
  console.log(`  ${icono} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

async function get(path, token) {
  return axios.get(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeout: cfg.backend.timeout,
    validateStatus: () => true,
  });
}

async function post(path, body, token) {
  return axios.post(`${BASE_URL}${path}`, body, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    timeout: cfg.backend.timeout,
    validateStatus: () => true,
  });
}

// ─── 1. Health check ──────────────────────────────────────────────────────────
async function testHealth() {
  console.log('\n🔎 1. Estado del Backend');
  try {
    const res = await get('/api/health');
    if (res.status === 200 && res.data?.status === 'ok') {
      registrar('Backend ACTIVO', true, `v${res.data.version} — ${res.data.timestamp}`);
      return true;
    }
    registrar('Backend ACTIVO', false, `HTTP ${res.status}`);
    return false;
  } catch (e) {
    registrar('Backend ACTIVO', false, `No responde: ${e.message}`);
    console.log(`  ${WARN} Asegúrate de que el backend esté corriendo: cd Backend && npm run dev`);
    return false;
  }
}

// ─── 2. PostgreSQL ────────────────────────────────────────────────────────────
async function testDatabase() {
  console.log('\n🔎 2. Base de Datos PostgreSQL');
  const { Pool } = pg;
  const pool = new Pool({
    host:     DB_CFG.host,
    port:     DB_CFG.port,
    user:     DB_CFG.user,
    password: String(DB_CFG.password),
    database: DB_CFG.database,
    ssl:      DB_CFG.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });

  let client;
  try {
    client = await pool.connect();
    registrar('PostgreSQL conectado', true, `${DB_CFG.database}@${DB_CFG.host}:${DB_CFG.port}`);

    // Contar animales
    const { rows: [cnt] } = await client.query('SELECT COUNT(*) AS total FROM animales WHERE activo = true');
    registrar('Tabla animales accesible', true, `${cnt.total} animales activos`);

    // Verificar tablas IoT
    const tablas = ['animales', 'lecturas_iot', 'alertas_iot', 'nodos_iot'];
    for (const tabla of tablas) {
      try {
        const { rows: [r] } = await client.query(`SELECT COUNT(*) AS n FROM ${tabla}`);
        registrar(`Tabla ${tabla}`, true, `${r.n} registros`);
      } catch (e) {
        registrar(`Tabla ${tabla}`, false, e.message);
      }
    }

    // Columnas clave de lecturas_iot
    try {
      const { rows } = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'lecturas_iot'
        ORDER BY ordinal_position
      `);
      const cols = rows.map(r => r.column_name).join(', ');
      console.log(`  ${INFO} Columnas lecturas_iot: ${cols}`);
    } catch (_) {}

    return { ok: true, pool };
  } catch (e) {
    registrar('PostgreSQL conectado', false, e.message);
    console.log(`  ${WARN} Verifica: host=${DB_CFG.host}, port=${DB_CFG.port}, user=${DB_CFG.user}, db=${DB_CFG.database}`);
    return { ok: false, pool };
  } finally {
    if (client) client.release();
  }
}

// ─── 3. Autenticación ─────────────────────────────────────────────────────────
async function testAuth() {
  console.log('\n🔎 3. Autenticación JWT');
  const { email, password, login_endpoint } = cfg.autenticacion ?? {};

  if (!email || !password) {
    console.log(`  ${WARN} Sin credenciales en config.json (autenticacion.email / password)`);
    console.log(`  ${INFO} Los tests de endpoints autenticados se ejecutarán sin token (esperando 401)`);
    return null;
  }

  try {
    const res = await post(login_endpoint ?? '/api/auth/login', { email, password });
    if (res.status === 200 && res.data?.token) {
      registrar('Login exitoso', true, `${res.data.usuario?.email} (${res.data.usuario?.rol})`);
      return res.data.token;
    }
    registrar('Login exitoso', false, `HTTP ${res.status}: ${res.data?.error}`);
    return null;
  } catch (e) {
    registrar('Login exitoso', false, e.message);
    return null;
  }
}

// ─── 4. Endpoints IoT (GET) ───────────────────────────────────────────────────
async function testEndpointsGet(token) {
  console.log('\n🔎 4. Endpoints GET IoT');

  const endpoints = [
    { path: '/api/iot/lecturas',  nombre: 'GET /api/iot/lecturas'  },
    { path: '/api/iot/alertas',   nombre: 'GET /api/iot/alertas'   },
    { path: '/api/iot/nodos',     nombre: 'GET /api/iot/nodos'     },
    { path: '/api/iot/dashboard', nombre: 'GET /api/iot/dashboard' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await get(ep.path, token);
      if (res.status === 200) {
        const n = Array.isArray(res.data) ? res.data.length : Object.keys(res.data).length;
        registrar(ep.nombre, true, `${n} items`);
      } else if (res.status === 401) {
        registrar(ep.nombre, false, '401 No autorizado — configura credenciales en config.json');
      } else {
        registrar(ep.nombre, false, `HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 80)}`);
      }
    } catch (e) {
      registrar(ep.nombre, false, e.message);
    }
  }
}

// ─── 5. Endpoint POST /api/iot/lecturas ───────────────────────────────────────
async function testPostLectura(token, pool) {
  console.log('\n🔎 5. POST /api/iot/lecturas (enviar lectura de sensor)');

  // Buscar un animalId real
  let animalId = null;
  if (pool) {
    try {
      const client = await pool.connect();
      const { rows } = await client.query('SELECT id FROM animales WHERE activo = true LIMIT 1');
      client.release();
      if (rows.length) animalId = rows[0].id;
    } catch (_) {}
  }

  if (!animalId) {
    console.log(`  ${WARN} No hay animales activos en BD. Skipping POST /api/iot/lecturas`);
    return;
  }

  const payload = {
    animalId,
    nodoId:      'ESP32-TEST',
    latitud:     24.0277,
    longitud:    -104.6532,
    temperatura: 38.7,
    rssi:        -65,
    bateria:     78.5,
  };

  try {
    const res = await post('/api/iot/lecturas', payload, token);
    if (res.status === 201 || res.status === 200) {
      registrar('POST /api/iot/lecturas', true, `ID: ${res.data?.id ?? 'ok'}`);
    } else if (res.status === 401) {
      registrar('POST /api/iot/lecturas', false, '401 No autorizado');
    } else if (res.status === 404) {
      registrar('POST /api/iot/lecturas', false, '404 Endpoint no existe — verifica que el backend tenga este endpoint');
    } else {
      registrar('POST /api/iot/lecturas', false, `HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 100)}`);
    }
  } catch (e) {
    registrar('POST /api/iot/lecturas', false, e.message);
  }
}

// ─── 6. Endpoint POST /api/iot/alertas ───────────────────────────────────────
async function testPostAlerta(token) {
  console.log('\n🔎 6. POST /api/iot/alertas (crear alerta)');

  const payload = {
    tipo:      'TEST_SIMULATOR',
    severidad: 'BAJA',
    mensaje:   '🧪 Alerta de prueba generada por test_apis.js',
    nodoId:    'ESP32-TEST',
    valor:     1.0,
    umbral:    0.5,
  };

  try {
    const res = await post('/api/iot/alertas', payload, token);
    if (res.status === 201 || res.status === 200) {
      registrar('POST /api/iot/alertas', true, `ID: ${res.data?.id ?? 'ok'}`);
    } else if (res.status === 401) {
      registrar('POST /api/iot/alertas', false, '401 No autorizado');
    } else if (res.status === 404) {
      registrar('POST /api/iot/alertas', false, '404 Endpoint no existe — verifica que el backend tenga este endpoint');
    } else {
      registrar('POST /api/iot/alertas', false, `HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 100)}`);
    }
  } catch (e) {
    registrar('POST /api/iot/alertas', false, e.message);
  }
}

// ─── 7. POST /api/iot/simular ─────────────────────────────────────────────────
async function testSimular(token) {
  console.log('\n🔎 7. POST /api/iot/simular (simulación batch — requiere rol ADMIN)');
  try {
    const res = await post('/api/iot/simular', {}, token);
    if (res.status === 200) {
      registrar('POST /api/iot/simular', true, res.data?.message ?? 'ok');
    } else if (res.status === 401) {
      registrar('POST /api/iot/simular', false, '401 No autorizado');
    } else if (res.status === 403) {
      registrar('POST /api/iot/simular', false, '403 Solo ADMIN puede simular (token no es ADMIN)');
    } else {
      registrar('POST /api/iot/simular', false, `HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 100)}`);
    }
  } catch (e) {
    registrar('POST /api/iot/simular', false, e.message);
  }
}

// ─── Resumen ──────────────────────────────────────────────────────────────────
function mostrarResumen() {
  console.log('\n' + '═'.repeat(55));
  console.log('  RESUMEN DE PRUEBAS');
  console.log('═'.repeat(55));

  const exitosos = resultados.filter(r => r.exito).length;
  const fallidos = resultados.filter(r => !r.exito).length;
  const total    = resultados.length;

  console.log(`\n  ${OK} Exitosos : ${exitosos}/${total}`);
  if (fallidos > 0) {
    console.log(`  ${ERR} Fallidos : ${fallidos}/${total}`);
    console.log('\n  Detalles de fallos:');
    resultados.filter(r => !r.exito).forEach(r => {
      console.log(`    ❌ ${r.nombre}: ${r.detalle}`);
    });
  }

  console.log('\n  DIAGNÓSTICO:');
  const backendOk    = resultados.find(r => r.nombre === 'Backend ACTIVO')?.exito;
  const dbOk         = resultados.find(r => r.nombre === 'PostgreSQL conectado')?.exito;
  const lecturasOk   = resultados.find(r => r.nombre === 'POST /api/iot/lecturas')?.exito;
  const alertasOk    = resultados.find(r => r.nombre === 'POST /api/iot/alertas')?.exito;

  if (!backendOk) {
    console.log(`  ${ERR} Backend no responde → cd Backend && npm run dev`);
  }
  if (!dbOk) {
    console.log(`  ${ERR} PostgreSQL sin conexión → verifica que el servicio esté corriendo`);
    console.log(`       y que config.json tenga: user="${DB_CFG.user}", password="${DB_CFG.password}", database="${DB_CFG.database}"`);
  }
  if (!lecturasOk) {
    console.log(`  ${WARN} POST /api/iot/lecturas falla → el simulador guardará fallback en logs/`);
  }
  if (!alertasOk) {
    console.log(`  ${WARN} POST /api/iot/alertas falla → las alertas no llegarán al backend`);
  }

  if (backendOk && dbOk && lecturasOk && alertasOk) {
    console.log(`  ${OK} ¡Todo listo! Ejecuta: npm start`);
  }

  console.log('');
}

// ─── Entry point ──────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║   SIGGAN IoT Simulator — Test de APIs y Base de Datos  ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`  Backend  : ${BASE_URL}`);
  console.log(`  Base datos: ${DB_CFG.database}@${DB_CFG.host}:${DB_CFG.port}`);

  const backendActivo = await testHealth();
  const { ok: dbOk, pool } = await testDatabase();
  const token = backendActivo ? await testAuth() : null;

  if (backendActivo) {
    await testEndpointsGet(token);
    await testPostLectura(token, dbOk ? pool : null);
    await testPostAlerta(token);
    await testSimular(token);
  } else {
    console.log(`\n  ${WARN} Backend inactivo — omitiendo tests de endpoints`);
  }

  mostrarResumen();

  if (pool) await pool.end().catch(() => {});
  process.exit(resultados.every(r => r.exito) ? 0 : 1);
}

main().catch(e => {
  console.error('\n❌ Error inesperado:', e.message);
  process.exit(1);
});
