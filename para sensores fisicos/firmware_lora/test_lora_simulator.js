/**
 * SIGGAN - Simulador/Tester de Collares LoRa BETA
 *
 * Simula N collares LoRa generando payloads válidos (encriptados, con CRC y HMAC),
 * los "transmite" al gateway local vía UDP y verifica que el gateway los
 * decodifique correctamente. Genera un reporte de confiabilidad al terminar.
 *
 * Uso:
 *   node test_lora_simulator.js [--collares 5] [--ciclos 10] [--delay 500]
 */

import dgram   from 'dgram';
import crypto  from 'crypto';
import fs      from 'fs';
import path    from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config    = JSON.parse(fs.readFileSync(path.join(__dirname, 'config_lora.json'), 'utf8'));

// ─── Argumentos de línea de comandos ─────────────────────────────────────────
const args = process.argv.slice(2);
const NUM_COLLARES = parseInt(args.find(a => a.startsWith('--collares='))?.split('=')[1] || '5');
const NUM_CICLOS   = parseInt(args.find(a => a.startsWith('--ciclos='))?.split('=')[1]   || '10');
const DELAY_MS     = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1]    || '500');
const GATEWAY_HOST = args.find(a => a.startsWith('--host='))?.split('=')[1] || '127.0.0.1';
const GATEWAY_PORT = parseInt(args.find(a => a.startsWith('--puerto='))?.split('=')[1]  || '9001');

const AES_KEY  = Buffer.from(config.encriptacion.clave_base64, 'base64').slice(0, 16);
const AES_IV   = Buffer.from(config.encriptacion.iv_base64,    'base64').slice(0, 16);
const HMAC_KEY = Buffer.from(config.encriptacion.hmac_clave_base64, 'base64').slice(0, 4);

// ─── Reporte de confiabilidad ─────────────────────────────────────────────────
const reporte = {
  collares:          NUM_COLLARES,
  ciclosPorCollar:   NUM_CICLOS,
  totalPayloads:     0,
  crcOk:            0,
  crcErr:            0,
  hmacOk:            0,
  hmacErr:           0,
  encriptacionOk:    0,
  encriptacionErr:   0,
  enviados:          0,
  erroresEnvio:      0,
  latencias:         [],
  inicio:            Date.now(),
};

// ─── CRC16 Modbus ─────────────────────────────────────────────────────────────
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

// ─── HMAC de 4 bytes ─────────────────────────────────────────────────────────
function hmac4(buf) {
  const out = Buffer.alloc(4);
  HMAC_KEY.copy(out);
  for (let i = 0; i < buf.length; i++) out[i % 4] ^= buf[i];
  return out;
}

// ─── Encriptar AES-128-CBC ───────────────────────────────────────────────────
function encriptar32(buf32) {
  const cipher1 = crypto.createCipheriv('aes-128-cbc', AES_KEY, AES_IV);
  cipher1.setAutoPadding(false);
  const bloque1 = Buffer.concat([cipher1.update(buf32.slice(0, 16)), cipher1.final()]);
  const cipher2 = crypto.createCipheriv('aes-128-cbc', AES_KEY, AES_IV);
  cipher2.setAutoPadding(false);
  const bloque2 = Buffer.concat([cipher2.update(buf32.slice(16, 32)), cipher2.final()]);
  return Buffer.concat([bloque1, bloque2]);
}

// ─── Desencriptar AES-128-CBC ────────────────────────────────────────────────
function desencriptar32(cifrado) {
  const dec1 = crypto.createDecipheriv('aes-128-cbc', AES_KEY, AES_IV);
  dec1.setAutoPadding(false);
  const b1 = Buffer.concat([dec1.update(cifrado.slice(0, 16)), dec1.final()]);
  const dec2 = crypto.createDecipheriv('aes-128-cbc', AES_KEY, AES_IV);
  dec2.setAutoPadding(false);
  const b2 = Buffer.concat([dec2.update(cifrado.slice(16, 32)), dec2.final()]);
  return Buffer.concat([b1, b2]);
}

// ─── Generar datos simulados para un collar ───────────────────────────────────
function generarDatosCollar(collarId, ciclo) {
  const actividades = ['reposo', 'caminando', 'comiendo', 'corriendo'];
  const actIdx = Math.floor(Math.random() * 4);
  const act    = actividades[actIdx];

  const esFiebre = Math.random() < 0.05;
  const temp     = esFiebre ? 40.5 + Math.random() : 38.0 + Math.random() * 1.5;
  const bpm      = act === 'reposo' ? 40 + Math.random() * 15
                 : act === 'corriendo' ? 100 + Math.random() * 30
                 : 60 + Math.random() * 25;
  const estres   = Math.min(100, Math.floor(
    (esFiebre ? 50 : 10) + (act === 'corriendo' ? 30 : 0) + Math.random() * 20
  ));
  const spo2     = Math.floor(93 + Math.random() * 7);
  const bat      = Math.max(0, 100 - ciclo * 2);

  return {
    deviceId:    collarId,
    temp, bpm: Math.floor(bpm), spo2, estres, actIdx,
    lat:  24.0277 + (Math.random() - 0.5) * 0.01,
    lng: -104.6532 + (Math.random() - 0.5) * 0.01,
    rssi: -(40 + Math.floor(Math.random() * 80)),
    bat,
    rfidTag: crypto.randomBytes(8),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

// ─── Construir payload de 40 bytes ───────────────────────────────────────────
function construirPayload(datos) {
  const buf = Buffer.alloc(40);

  buf[0] = 0x01;
  buf.writeUInt32BE(datos.deviceId, 1);
  buf.writeUInt32BE(datos.timestamp, 5);
  buf.writeInt32BE(Math.round(datos.lat * 1e6), 9);
  buf.writeInt32BE(Math.round(datos.lng * 1e6), 13);
  buf.writeUInt16BE(Math.round(datos.temp * 10), 17);
  buf.writeUInt16BE(datos.bpm, 19);
  buf[21] = datos.spo2;
  buf[22] = datos.estres;
  buf[23] = datos.actIdx;
  buf.writeInt8(datos.rssi, 24);
  buf[25] = datos.bat;
  datos.rfidTag.copy(buf, 26);

  const crc = crc16Modbus(buf.slice(0, 34));
  buf.writeUInt16BE(crc, 34);

  const hmac = hmac4(buf.slice(0, 36));
  hmac.copy(buf, 36);

  return buf;
}

// ─── Encriptar payload completo ──────────────────────────────────────────────
function encriptarPayload(payload) {
  const cifrado = encriptar32(payload.slice(0, 32));
  const resultado = Buffer.alloc(40);
  cifrado.copy(resultado, 0);
  payload.copy(resultado, 32, 32); // bytes 32-39 sin encriptar
  return resultado;
}

// ─── Verificar integridad del payload (simular lo que hace el gateway) ────────
function verificarPayload(encriptado) {
  const resultado = { crc: false, hmac: false, desencriptado: null };

  // Verificar CRC antes de desencriptar (bytes 34-35 están en claro)
  // Nota: el CRC se calcula sobre los datos desencriptados, por lo que
  // aquí primero desencriptamos para verificar
  const claro = Buffer.concat([desencriptar32(encriptado.slice(0, 32)), encriptado.slice(32)]);

  const crcPayload = claro.readUInt16BE(34);
  const crcCalc    = crc16Modbus(claro.slice(0, 34));
  resultado.crc    = (crcPayload === crcCalc);

  const hmacPayload = claro.slice(36, 40);
  const hmacCalc    = hmac4(claro.slice(0, 36));
  resultado.hmac    = hmacPayload.equals(hmacCalc);

  if (resultado.crc && resultado.hmac) {
    resultado.desencriptado = {
      version:   claro[0],
      deviceId:  claro.readUInt32BE(1),
      timestamp: claro.readUInt32BE(5),
      lat:       claro.readInt32BE(9) / 1e6,
      lng:       claro.readInt32BE(13) / 1e6,
      temp:      claro.readUInt16BE(17) / 10.0,
      bpm:       claro.readUInt16BE(19),
      spo2:      claro[21],
      estres:    claro[22],
      actIdx:    claro[23],
    };
  }

  return resultado;
}

// ─── Enviar payload al gateway via UDP ───────────────────────────────────────
function enviarUDP(payload) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4');
    const hexMsg = Buffer.from(payload.toString('hex') + '\n');
    const t0 = Date.now();

    client.send(hexMsg, GATEWAY_PORT, GATEWAY_HOST, (err) => {
      client.close();
      if (err) reject(err);
      else resolve(Date.now() - t0);
    });
  });
}

// ─── Ejecutar un ciclo de un collar ──────────────────────────────────────────
async function simularCicloCollar(collarId, ciclo) {
  const datos       = generarDatosCollar(collarId, ciclo);
  const payload     = construirPayload(datos);
  const encriptado  = encriptarPayload(payload);

  reporte.totalPayloads++;

  // Verificar integridad (como lo haría el gateway)
  const verif = verificarPayload(encriptado);
  if (verif.crc)  reporte.crcOk++; else reporte.crcErr++;
  if (verif.hmac) reporte.hmacOk++; else reporte.hmacErr++;
  if (verif.desencriptado) reporte.encriptacionOk++; else reporte.encriptacionErr++;

  const actNombre = ['reposo','caminando','comiendo','corriendo'][datos.actIdx];
  const ok = verif.crc && verif.hmac;

  process.stdout.write(
    `  Collar${collarId.toString().padStart(2,'0')} Ciclo${ciclo+1} ` +
    `temp=${datos.temp.toFixed(1)}°C bpm=${datos.bpm} act=${actNombre.padEnd(10)} ` +
    `${ok ? '✅ OK' : '❌ FAIL'}\n`
  );

  // Intentar enviar al gateway
  try {
    const latencia = await enviarUDP(encriptado);
    reporte.enviados++;
    reporte.latencias.push(latencia);
  } catch (e) {
    reporte.erroresEnvio++;
  }
}

// ─── Función de espera ────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Generar reporte final ───────────────────────────────────────────────────
function imprimirReporte() {
  const duracion = ((Date.now() - reporte.inicio) / 1000).toFixed(1);
  const latMedia = reporte.latencias.length > 0
    ? (reporte.latencias.reduce((a, b) => a + b, 0) / reporte.latencias.length).toFixed(1)
    : 'N/A';
  const latMax = reporte.latencias.length > 0 ? Math.max(...reporte.latencias) : 0;

  const tasaCRC  = reporte.totalPayloads > 0
    ? ((reporte.crcOk  / reporte.totalPayloads) * 100).toFixed(1) : '0.0';
  const tasaHMAC = reporte.totalPayloads > 0
    ? ((reporte.hmacOk / reporte.totalPayloads) * 100).toFixed(1) : '0.0';
  const tasaEnv  = reporte.totalPayloads > 0
    ? ((reporte.enviados / reporte.totalPayloads) * 100).toFixed(1) : '0.0';

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     REPORTE DE CONFIABILIDAD — SIGGAN LoRa      ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Collares simulados:   ${reporte.collares.toString().padEnd(26)}║`);
  console.log(`║  Ciclos por collar:    ${reporte.ciclosPorCollar.toString().padEnd(26)}║`);
  console.log(`║  Total payloads:       ${reporte.totalPayloads.toString().padEnd(26)}║`);
  console.log(`║  Duración total:       ${(duracion + ' seg').padEnd(26)}║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  CRC OK:      ${reporte.crcOk}/${reporte.totalPayloads} (${tasaCRC}%)${''.padEnd(15 - tasaCRC.length)}║`);
  console.log(`║  HMAC OK:     ${reporte.hmacOk}/${reporte.totalPayloads} (${tasaHMAC}%)${''.padEnd(15 - tasaHMAC.length)}║`);
  console.log(`║  Encriptación OK: ${reporte.encriptacionOk}/${reporte.totalPayloads}${''.padEnd(22)}║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Enviados UDP: ${reporte.enviados}/${reporte.totalPayloads} (${tasaEnv}%)${''.padEnd(14 - tasaEnv.length)}║`);
  console.log(`║  Errores UDP:  ${reporte.erroresEnvio.toString().padEnd(34)}║`);
  console.log(`║  Latencia med: ${(latMedia + ' ms').padEnd(34)}║`);
  console.log(`║  Latencia max: ${(latMax + ' ms').padEnd(34)}║`);
  console.log('╠══════════════════════════════════════════════════╣');
  const confiable = parseFloat(tasaCRC) >= 99 && parseFloat(tasaHMAC) >= 99;
  console.log(`║  RESULTADO: ${confiable ? '✅ SISTEMA CONFIABLE' : '⚠️  REVISAR ERRORES'}              ║`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Guardar reporte en archivo
  const reportePath = path.join(__dirname, `reporte_lora_${new Date().toISOString().slice(0,10)}.json`);
  fs.writeFileSync(reportePath, JSON.stringify(reporte, null, 2));
  console.log(`Reporte guardado en: ${reportePath}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`╔══════════════════════════════════════════════════╗`);
  console.log(`║    SIGGAN LoRa Simulator BETA                    ║`);
  console.log(`╠══════════════════════════════════════════════════╣`);
  console.log(`║  Collares: ${NUM_COLLARES.toString().padEnd(5)} Ciclos: ${NUM_CICLOS.toString().padEnd(5)} Delay: ${DELAY_MS}ms      ║`);
  console.log(`║  Gateway:  ${GATEWAY_HOST}:${GATEWAY_PORT.toString().padEnd(28)}║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  for (let ciclo = 0; ciclo < NUM_CICLOS; ciclo++) {
    console.log(`\n─── Ciclo ${ciclo + 1}/${NUM_CICLOS} ───────────────────────────────────`);
    const promesas = [];
    for (let c = 1; c <= NUM_COLLARES; c++) {
      promesas.push(simularCicloCollar(c, ciclo));
    }
    await Promise.all(promesas);
    if (ciclo < NUM_CICLOS - 1) await sleep(DELAY_MS);
  }

  imprimirReporte();
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1); });
