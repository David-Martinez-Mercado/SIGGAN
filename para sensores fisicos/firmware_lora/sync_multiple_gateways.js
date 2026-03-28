/**
 * SIGGAN - Sincronizador de múltiples Gateways LoRa BETA
 *
 * Un Raspberry Pi "master" se conecta a 3-5 gateways esclavos via TCP,
 * agrega las lecturas, elimina duplicados y las envía en batch al backend.
 * También expone un dashboard local en puerto 8080.
 *
 * Arquitectura:
 *   [Collar LoRa] → [Gateway 1] ─┐
 *   [Collar LoRa] → [Gateway 2] ─┼─→ [Master / Sync] ──→ SIGGAN API
 *   [Collar LoRa] → [Gateway 3] ─┘         │
 *                                    Dashboard :8080
 */

import net    from 'net';
import http   from 'http';
import axios  from 'axios';
import crypto from 'crypto';
import fs     from 'fs';
import path   from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config    = JSON.parse(fs.readFileSync(path.join(__dirname, 'config_lora.json'), 'utf8'));

// ─── Configuración de gateways esclavos ──────────────────────────────────────
const GATEWAYS = [
  { id: 'GW-01', host: '192.168.1.101', puerto: 9000 },
  { id: 'GW-02', host: '192.168.1.102', puerto: 9000 },
  { id: 'GW-03', host: '192.168.1.103', puerto: 9000 },
];

const API_URL       = config.gateway_raspberry.api_url;
const API_TIMEOUT   = config.gateway_raspberry.api_timeout_ms;
const BATCH_MAX     = 20;         // lecturas por lote
const BATCH_MS      = 10000;      // enviar batch cada 10 segundos
const DEDUP_WINDOW  = 60000;      // ventana de deduplicación: 60 segundos
const DASHBOARD_PORT = 8080;

// ─── Estado ──────────────────────────────────────────────────────────────────
let jwtToken   = null;
const buffer   = [];              // lecturas pendientes de enviar
const seenKeys = new Map();       // deduplicación: key → timestamp
const gwStatus = new Map();       // estado de cada gateway

for (const gw of GATEWAYS) {
  gwStatus.set(gw.id, { conectado: false, recibidos: 0, ultimoMensaje: null });
}

let statsGlobal = {
  totalRecibidos: 0,
  duplicados:     0,
  enviados:       0,
  erroresApi:     0,
  inicio:         new Date(),
};

// ─── Autenticación ──────────────────────────────────────────────────────────
async function autenticar() {
  try {
    const res = await axios.post(`${API_URL}/api/auth/login`,
      { email: 'admin@siggan.mx', password: 'admin123' },
      { timeout: API_TIMEOUT });
    jwtToken = res.data.token;
    console.log('[AUTH] Token OK');
  } catch (e) {
    console.error('[AUTH] Error:', e.message);
  }
}

// ─── Deduplicación ───────────────────────────────────────────────────────────
// Clave única: rfidTag + timestamp del dispositivo (redondeado a 30s)
function claveDedup(lectura) {
  const tsRedondeado = Math.floor((lectura.timestamp || Date.now() / 1000) / 30) * 30;
  return `${lectura.rfidTag || lectura.animalId}_${tsRedondeado}`;
}

function esDuplicado(lectura) {
  const key = claveDedup(lectura);
  const ahora = Date.now();

  // Limpiar entradas viejas
  for (const [k, t] of seenKeys) {
    if (ahora - t > DEDUP_WINDOW) seenKeys.delete(k);
  }

  if (seenKeys.has(key)) { statsGlobal.duplicados++; return true; }
  seenKeys.set(key, ahora);
  return false;
}

// ─── Sincronización NTP simplificada ─────────────────────────────────────────
function obtenerTimestampNTP() {
  // En producción: usar 'ntp' npm package para obtener tiempo de servidor NTP
  // En Beta: usamos Date.now() con la hora del sistema (que debe estar synced)
  return Math.floor(Date.now() / 1000);
}

// ─── Agregar lectura al buffer ────────────────────────────────────────────────
function agregarLectura(lectura, gatewayId) {
  statsGlobal.totalRecibidos++;

  const estado = gwStatus.get(gatewayId);
  if (estado) {
    estado.recibidos++;
    estado.ultimoMensaje = new Date();
  }

  if (esDuplicado(lectura)) {
    console.log(`[DEDUP] Lectura duplicada ignorada  rfid=${lectura.rfidTag}  gw=${gatewayId}`);
    return;
  }

  lectura.nodoId    = gatewayId;
  lectura.tsSync    = obtenerTimestampNTP();
  lectura.tsRecibido = new Date().toISOString();
  buffer.push(lectura);

  if (buffer.length >= BATCH_MAX) enviarBatch();
}

// ─── Enviar batch al backend ──────────────────────────────────────────────────
async function enviarBatch() {
  if (buffer.length === 0) return;
  if (!jwtToken) await autenticar();

  const lote = buffer.splice(0, BATCH_MAX);
  console.log(`[BATCH] Enviando ${lote.length} lecturas...`);

  let enviados = 0;
  for (const lectura of lote) {
    try {
      await axios.post(`${API_URL}/api/iot/lecturas`, lectura, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        timeout: API_TIMEOUT,
      });
      enviados++;
    } catch (e) {
      if (e.response?.status === 401) { await autenticar(); }
      statsGlobal.erroresApi++;
      // Reencolar lecturas fallidas
      buffer.unshift(lectura);
    }
  }

  statsGlobal.enviados += enviados;
  console.log(`[BATCH] Enviadas ${enviados}/${lote.length}  buffer=${buffer.length}`);
}

// ─── Conectar a un gateway esclavo ────────────────────────────────────────────
function conectarGateway(gw) {
  const estado = gwStatus.get(gw.id);
  console.log(`[GW] Conectando a ${gw.id} (${gw.host}:${gw.puerto})...`);

  const socket = new net.Socket();
  let parcial  = '';

  socket.connect(gw.puerto, gw.host, () => {
    console.log(`[GW] Conectado a ${gw.id}`);
    if (estado) estado.conectado = true;
  });

  socket.on('data', (data) => {
    parcial += data.toString();
    const lineas = parcial.split('\n');
    parcial = lineas.pop(); // guardar fragmento incompleto
    for (const linea of lineas) {
      const l = linea.trim();
      if (!l) continue;
      try {
        const lectura = JSON.parse(l);
        agregarLectura(lectura, gw.id);
      } catch (e) {
        // Puede ser un hexstring de payload crudo
        if (l.length >= 80) {
          agregarLectura({ rawHex: l, rfidTag: 'UNKNOWN', timestamp: Date.now() / 1000 }, gw.id);
        }
      }
    }
  });

  socket.on('error', (e) => {
    console.error(`[GW] Error ${gw.id}:`, e.message);
    if (estado) estado.conectado = false;
  });

  socket.on('close', () => {
    console.warn(`[GW] ${gw.id} desconectado — reconectando en 10s`);
    if (estado) estado.conectado = false;
    setTimeout(() => conectarGateway(gw), 10000);
  });
}

// ─── Dashboard HTTP local ─────────────────────────────────────────────────────
function iniciarDashboard() {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: Math.floor((Date.now() - statsGlobal.inicio.getTime()) / 1000) }));
      return;
    }
    if (req.url === '/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const gwList = GATEWAYS.map(gw => ({
        id: gw.id,
        host: gw.host,
        ...Object.fromEntries(gwStatus.get(gw.id) ? Object.entries(gwStatus.get(gw.id)) : []),
      }));
      res.end(JSON.stringify({ ...statsGlobal, gateways: gwList, bufferPendiente: buffer.length }, null, 2));
      return;
    }

    // Dashboard HTML simple
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const uptime = Math.floor((Date.now() - statsGlobal.inicio.getTime()) / 60000);
    const gwRows = GATEWAYS.map(gw => {
      const st = gwStatus.get(gw.id);
      return `<tr>
        <td>${gw.id}</td>
        <td>${gw.host}:${gw.puerto}</td>
        <td style="color:${st?.conectado ? 'green' : 'red'}">${st?.conectado ? '● Conectado' : '○ Desconectado'}</td>
        <td>${st?.recibidos || 0}</td>
        <td>${st?.ultimoMensaje ? new Date(st.ultimoMensaje).toLocaleTimeString() : '—'}</td>
      </tr>`;
    }).join('');

    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>SIGGAN Gateway Sync</title>
      <meta http-equiv="refresh" content="10">
      <style>body{font-family:monospace;padding:20px;background:#111;color:#eee}
        table{border-collapse:collapse;width:100%}td,th{padding:8px 12px;border:1px solid #333}
        .badge{display:inline-block;padding:3px 8px;border-radius:4px}
        .ok{background:#1a3a1a;color:#4ade80}.err{background:#3a1a1a;color:#f87171}</style>
    </head><body>
      <h2>📡 SIGGAN Gateway Sync Dashboard</h2>
      <p>Uptime: <strong>${uptime} min</strong> | Buffer pendiente: <strong>${buffer.length}</strong></p>
      <table>
        <tr><th>Total RX</th><th>Duplicados</th><th>Enviados</th><th>Errores API</th></tr>
        <tr><td>${statsGlobal.totalRecibidos}</td><td>${statsGlobal.duplicados}</td>
            <td>${statsGlobal.enviados}</td><td>${statsGlobal.erroresApi}</td></tr>
      </table>
      <h3 style="margin-top:20px">Gateways</h3>
      <table><tr><th>ID</th><th>Host</th><th>Estado</th><th>Recibidos</th><th>Último msg</th></tr>
        ${gwRows}
      </table>
      <p style="color:#666;margin-top:20px;font-size:11px">SIGGAN Beta — se recarga cada 10s</p>
    </body></html>`);
  });

  server.listen(DASHBOARD_PORT, () => {
    console.log(`[DASHBOARD] http://localhost:${DASHBOARD_PORT}`);
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══ SIGGAN Sync múltiples Gateways BETA ════════════');
  await autenticar();

  for (const gw of GATEWAYS) conectarGateway(gw);

  setInterval(enviarBatch, BATCH_MS);

  setInterval(() => {
    const uptime = Math.floor((Date.now() - statsGlobal.inicio.getTime()) / 60000);
    console.log(`[STATS] uptime=${uptime}m rx=${statsGlobal.totalRecibidos} dup=${statsGlobal.duplicados} env=${statsGlobal.enviados} buf=${buffer.length}`);
  }, config.ciclos.estadisticas_gateway_ms);

  setInterval(async () => { if (!jwtToken) await autenticar(); }, 3600000);

  iniciarDashboard();
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1); });
