/**
 * SIGGAN - Gateway LoRa (Raspberry Pi) BETA
 *
 * Lee paquetes LoRa desde el HAT serial, los decodifica, verifica
 * integridad, desencripta y los envía al backend de SIGGAN.
 * Si el backend no responde, guarda en archivo JSONL de respaldo.
 *
 * Prerequisitos:
 *   npm install serialport axios crypto-js node-crc
 *   sudo npm install -g pm2   (para correr como servicio)
 */

import { SerialPort }  from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import axios           from 'axios';
import crypto          from 'crypto';
import fs              from 'fs';
import path            from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config    = JSON.parse(fs.readFileSync(path.join(__dirname, 'config_lora.json'), 'utf8'));

// ─── Configuración ──────────────────────────────────────────────────────────
const SERIAL_PORT    = config.gateway_raspberry.puerto_serial;     // '/dev/ttyS0'
const BAUD_RATE      = config.gateway_raspberry.baud_rate;         // 9600
const API_URL        = config.gateway_raspberry.api_url;           // 'http://localhost:3001'
const API_TIMEOUT    = config.gateway_raspberry.api_timeout_ms;    // 3000
const MAX_REINTENTOS = config.gateway_raspberry.reintentos;        // 3
const BACKOFF_BASE   = config.gateway_raspberry.backoff_base_ms;   // 500
const BACKUP_PATH    = config.gateway_raspberry.backup_sd_path;    // '/mnt/sd/lecturas'
const STATS_INTERVAL = config.ciclos.estadisticas_gateway_ms;      // 60000

// Clave AES-128 desde base64
const AES_KEY = Buffer.from(config.encriptacion.clave_base64, 'base64').slice(0, 16);
const AES_IV  = Buffer.from(config.encriptacion.iv_base64,    'base64').slice(0, 16);

// ─── Estado global ───────────────────────────────────────────────────────────
let jwtToken    = null;
let stats = {
  recibidos: 0,
  crcErrors: 0,
  hmacErrors: 0,
  enviados: 0,
  erroresApi: 0,
  backups: 0,
  inicio: new Date(),
};

// ─── Autenticación contra SIGGAN ─────────────────────────────────────────────
async function autenticar() {
  try {
    const res = await axios.post(`${API_URL}/api/auth/login`, {
      email:    'admin@siggan.mx',
      password: 'admin123',
    }, { timeout: API_TIMEOUT });
    jwtToken = res.data.token;
    console.log('[AUTH] Token obtenido OK');
  } catch (e) {
    console.error('[AUTH] Error al autenticar:', e.message);
    jwtToken = null;
  }
}

// ─── CRC16 Modbus ────────────────────────────────────────────────────────────
function crc16Modbus(buf) {
  let crc = 0xFFFF;
  for (const byte of buf) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0xA001) : (crc >>> 1);
    }
  }
  return crc;
}

// ─── HMAC simple de 4 bytes (mismo que en el firmware) ───────────────────────
const HMAC_KEY = Buffer.from(config.encriptacion.hmac_clave_base64, 'base64').slice(0, 4);
function hmac4(buf) {
  const out = Buffer.alloc(4);
  HMAC_KEY.copy(out);
  for (let i = 0; i < buf.length; i++) out[i % 4] ^= buf[i];
  return out;
}

// ─── Desencriptar payload AES-128-CBC ────────────────────────────────────────
function desencriptarPayload(rawBuf) {
  const cifrado = rawBuf.slice(0, 32);
  const resto   = rawBuf.slice(32);         // bytes 32-39: sin encriptar
  const decipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, AES_IV);
  decipher.setAutoPadding(false);
  const claro = Buffer.concat([decipher.update(cifrado), decipher.final()]);
  return Buffer.concat([claro, resto]);
}

// ─── Mapas de enum ───────────────────────────────────────────────────────────
const ACTIVIDAD_MAP = { 0: 'reposo', 1: 'caminando', 2: 'comiendo', 3: 'corriendo' };

// ─── Decodificar payload de 40 bytes → objeto JSON ───────────────────────────
function decodificarPayload(rawBuf) {
  if (rawBuf.length < 40) return null;

  // 1. Verificar CRC16 (bytes 0-33)
  const crcEsperado = rawBuf.readUInt16BE(34);
  const crcCalculado = crc16Modbus(rawBuf.slice(0, 34));
  if (crcEsperado !== crcCalculado) {
    console.error(`[DECODE] CRC ERROR: esperado=0x${crcEsperado.toString(16)} calc=0x${crcCalculado.toString(16)}`);
    stats.crcErrors++;
    return null;
  }

  // 2. Verificar HMAC (bytes 0-35 → bytes 36-39)
  const hmacEsperado  = rawBuf.slice(36, 40);
  const hmacCalculado = hmac4(rawBuf.slice(0, 36));
  if (!hmacEsperado.equals(hmacCalculado)) {
    console.error('[DECODE] HMAC ERROR — posible manipulación del paquete');
    stats.hmacErrors++;
    return null;
  }

  // 3. Desencriptar los primeros 32 bytes
  const buf = desencriptarPayload(rawBuf);

  // 4. Parsear campos
  const version    = buf[0];
  const deviceId   = buf.readUInt32BE(1);
  const timestamp  = buf.readUInt32BE(5);
  const latitud    = buf.readInt32BE(9)  / 1e6;
  const longitud   = buf.readInt32BE(13) / 1e6;
  const temperatura = buf.readUInt16BE(17) / 10.0;
  const ritmoCardiaco = buf.readUInt16BE(19);
  const saturacionO2  = buf[21];
  const estres        = buf[22];
  const actividadIdx  = buf[23];
  const rssi          = buf.readInt8(24);
  const bateria       = buf[25];
  const rfidTag = buf.slice(26, 34).toString('hex').toUpperCase();

  return {
    version, deviceId, timestamp,
    latitud, longitud,
    temperatura, ritmoCardiaco, saturacionO2, estres,
    actividad: ACTIVIDAD_MAP[actividadIdx] ?? 'reposo',
    rssi, bateria,
    rfidTag,
    nodoId: `LORA-GW-${process.env.GATEWAY_ID || '01'}`,
    tsRecibido: new Date().toISOString(),
  };
}

// ─── Enviar lectura al backend con reintentos ─────────────────────────────────
async function enviarLectura(datos) {
  if (!jwtToken) await autenticar();

  const body = {
    rfidTag:       datos.rfidTag,
    nodoId:        datos.nodoId,
    latitud:       datos.latitud,
    longitud:      datos.longitud,
    temperatura:   datos.temperatura,
    rssi:          datos.rssi,
    bateria:       datos.bateria,
    ritmoCardiaco: datos.ritmoCardiaco,
    estres:        datos.estres,
    saturacionO2:  datos.saturacionO2,
    actividad:     datos.actividad,
  };

  for (let intento = 1; intento <= MAX_REINTENTOS; intento++) {
    try {
      await axios.post(`${API_URL}/api/iot/lecturas`, body, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        timeout: API_TIMEOUT,
      });
      stats.enviados++;
      console.log(`[API] Lectura enviada OK  rfid=${datos.rfidTag}  temp=${datos.temperatura}°C`);
      return true;
    } catch (e) {
      const status = e.response?.status;
      if (status === 401) { await autenticar(); } // token expirado
      const espera = BACKOFF_BASE * Math.pow(2, intento - 1);
      console.warn(`[API] Intento ${intento}/${MAX_REINTENTOS} fallido (${status || e.code}) — esperando ${espera}ms`);
      await new Promise(r => setTimeout(r, espera));
    }
  }

  stats.erroresApi++;
  return false;
}

// ─── Guardar en archivo de respaldo (SD card) ─────────────────────────────────
function guardarBackup(datos) {
  try {
    if (!fs.existsSync(BACKUP_PATH)) fs.mkdirSync(BACKUP_PATH, { recursive: true });
    const fecha = new Date().toISOString().slice(0, 10);
    const archivo = path.join(BACKUP_PATH, `lecturas_${fecha}.jsonl`);
    fs.appendFileSync(archivo, JSON.stringify(datos) + '\n');
    stats.backups++;
    console.log(`[BACKUP] Guardado en ${archivo}`);
  } catch (e) {
    console.error('[BACKUP] Error al guardar:', e.message);
  }
}

// ─── Procesar paquete LoRa recibido ──────────────────────────────────────────
async function procesarPaquete(hexStr) {
  stats.recibidos++;
  // El módulo LoRa HAT típicamente entrega datos en hex o binario
  // Aquí asumimos hex string (ej: "0102030A..." de 80 chars = 40 bytes)
  const hexLimpio = hexStr.trim().replace(/\s/g, '');
  if (hexLimpio.length < 80) {
    console.warn(`[GATEWAY] Paquete muy corto: ${hexLimpio.length / 2} bytes`);
    return;
  }

  const rawBuf = Buffer.from(hexLimpio.slice(0, 80), 'hex');
  const rssiMatch = hexStr.match(/RSSI=(-?\d+)/);
  if (rssiMatch) rawBuf[24] = parseInt(rssiMatch[1]) & 0xFF;

  const datos = decodificarPayload(rawBuf);
  if (!datos) { console.warn('[GATEWAY] Paquete descartado (CRC/HMAC inválido)'); return; }

  console.log(`[GATEWAY] Paquete OK — DevID=${datos.deviceId} RFID=${datos.rfidTag} Temp=${datos.temperatura}°C`);

  const enviado = await enviarLectura(datos);
  if (!enviado) guardarBackup(datos);
}

// ─── Estadísticas periódicas ──────────────────────────────────────────────────
function imprimirEstadisticas() {
  const uptime = Math.floor((Date.now() - stats.inicio.getTime()) / 60000);
  console.log(`\n╔═══ SIGGAN Gateway Stats ═══════════════════╗`);
  console.log(`║  Uptime:      ${uptime} min`);
  console.log(`║  Recibidos:   ${stats.recibidos}`);
  console.log(`║  CRC errors:  ${stats.crcErrors}`);
  console.log(`║  HMAC errors: ${stats.hmacErrors}`);
  console.log(`║  Enviados:    ${stats.enviados}`);
  console.log(`║  Errores API: ${stats.erroresApi}`);
  console.log(`║  Backups:     ${stats.backups}`);
  console.log(`╚════════════════════════════════════════════╝\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══ SIGGAN Gateway LoRa BETA ═══════════════════');
  console.log(`Puerto serial: ${SERIAL_PORT}  Baud: ${BAUD_RATE}`);
  console.log(`API: ${API_URL}`);
  console.log('═══════════════════════════════════════════════\n');

  await autenticar();

  // Abrir puerto serial del módulo LoRa HAT
  const port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });
  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  port.on('open',  () => console.log(`[SERIAL] Puerto ${SERIAL_PORT} abierto`));
  port.on('error', e  => console.error('[SERIAL] Error:', e.message));
  port.on('close', ()  => {
    console.warn('[SERIAL] Puerto cerrado — reconectando en 5s...');
    setTimeout(main, 5000);
  });

  parser.on('data', async (linea) => {
    const l = linea.trim();
    if (!l || l.startsWith('#')) return; // ignorar comentarios
    await procesarPaquete(l);
  });

  setInterval(imprimirEstadisticas, STATS_INTERVAL);
  setInterval(async () => {
    if (!jwtToken) await autenticar();
  }, 3600000); // Re-autenticar cada hora
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1); });
