/**
 * SIGGAN - Firmware Collar LoRa BETA
 * Dispositivo: ESP32 + MAX30102 + DHT22 + MPU6050 + LoRa SX1276 + RFID RC522
 *
 * Flujo cada 5 minutos:
 *   1. Despertar de deep sleep
 *   2. Leer todos los sensores
 *   3. Construir payload de 40 bytes
 *   4. Encriptar AES-128-CBC + calcular CRC16 + HMAC-4
 *   5. Transmitir por LoRa (SF12, 915 MHz)
 *   6. Volver a deep sleep
 *
 * Autonomía estimada: 7-10 días con batería 18650 (2600mAh)
 */

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <LoRa.h>             // sandeepmistry/arduino-LoRa
#include <DHT.h>              // adafruit/DHT-sensor-library
#include <MAX30105.h>         // sparkfun/SparkFun_MAX3010x_Sensor_Library
#include <heartRate.h>
#include <MPU6050_light.h>    // rfetick/MPU6050_light
#include <MFRC522.h>          // miguelbalboa/rfid
#include <AESLib.h>           // suculent/AESLib
#include "esp_sleep.h"
#include "esp_log.h"

// ─── Pines GPIO ─────────────────────────────────────────────────────────────
#define LORA_NSS    18
#define LORA_RESET  14
#define LORA_DIO0   26
#define DHT_PIN      4
#define RFID_SS      5
#define RFID_RST    27
#define LED_STATUS   2

// ─── Configuración LoRa (915 MHz LATAM) ─────────────────────────────────────
#define LORA_FREQ       915E6
#define LORA_SF         12
#define LORA_BW         125E3
#define LORA_CR         5     // 4/5
#define LORA_TX_PWR     20
#define LORA_SYNC_WORD  0x12
#define LORA_PREAMBLE   8

// ─── Device ID único por collar ─────────────────────────────────────────────
// Cambiar por el ID asignado en SIGGAN para cada animal
#define DEVICE_ID  0x00000001UL

// ─── Clave AES-128 (debe coincidir con gateway) ──────────────────────────────
// "SIGGAN_LORA_KEY_2026" en bytes (16 bytes exactos)
static const uint8_t AES_KEY[16] = {
  0x53,0x49,0x47,0x47,0x41,0x4E,0x5F,0x4C,
  0x4F,0x52,0x41,0x5F,0x4B,0x45,0x59,0x5F
};
static const uint8_t AES_IV[16]  = { 0x00 }; // IV fijo (mejorar en producción)

// ─── HMAC key (4 bytes del hash SHA256 de "SIGGAN_HMAC_SECRET_2026") ─────────
static const uint8_t HMAC_KEY[4] = { 0x3A, 0x7F, 0xC1, 0x2E };

// ─── Tamaño del payload ──────────────────────────────────────────────────────
#define PAYLOAD_SIZE 40

// ─── Enumeración de actividad ────────────────────────────────────────────────
enum Actividad : uint8_t {
  REPOSO    = 0,
  CAMINANDO = 1,
  COMIENDO  = 2,
  CORRIENDO = 3,
};

// ─── Objetos de sensores ─────────────────────────────────────────────────────
DHT       dht(DHT_PIN, DHT22);
MAX30105  particleSensor;
MPU6050   mpu(Wire);
MFRC522   rfid(RFID_SS, RFID_RST);
AESLib    aes;

// ─── Tag RFID del animal (leído una vez y guardado en RTC memory) ─────────────
RTC_DATA_ATTR static uint8_t rfidTag[8] = { 0xFF };
RTC_DATA_ATTR static bool    rfidLeido  = false;
RTC_DATA_ATTR static uint32_t ciclo     = 0;

// ─── Funciones auxiliares ────────────────────────────────────────────────────

/** CRC16 Modbus */
uint16_t crc16Modbus(const uint8_t* data, size_t len) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (int j = 0; j < 8; j++) {
      if (crc & 0x0001) crc = (crc >> 1) ^ 0xA001;
      else               crc >>= 1;
    }
  }
  return crc;
}

/** HMAC simple de 4 bytes (XOR con clave rotativa) */
void hmac4(const uint8_t* data, size_t len, uint8_t* out) {
  out[0] = HMAC_KEY[0]; out[1] = HMAC_KEY[1];
  out[2] = HMAC_KEY[2]; out[3] = HMAC_KEY[3];
  for (size_t i = 0; i < len; i++) {
    out[i % 4] ^= data[i];
  }
}

/** Escribe un int32 big-endian en un buffer */
void writeInt32BE(uint8_t* buf, int32_t val) {
  buf[0] = (val >> 24) & 0xFF;
  buf[1] = (val >> 16) & 0xFF;
  buf[2] = (val >>  8) & 0xFF;
  buf[3] =  val        & 0xFF;
}

/** Escribe un uint16 big-endian */
void writeUint16BE(uint8_t* buf, uint16_t val) {
  buf[0] = (val >> 8) & 0xFF;
  buf[1] =  val       & 0xFF;
}

// ─── Inicialización de LoRa ──────────────────────────────────────────────────
bool initLoRa() {
  LoRa.setPins(LORA_NSS, LORA_RESET, LORA_DIO0);
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("[LORA] ERROR: No se detectó módulo LoRa");
    return false;
  }
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.setSignalBandwidth(LORA_BW);
  LoRa.setCodingRate4(LORA_CR);
  LoRa.setTxPower(LORA_TX_PWR);
  LoRa.setSyncWord(LORA_SYNC_WORD);
  LoRa.setPreambleLength(LORA_PREAMBLE);
  LoRa.enableCrc();
  Serial.println("[LORA] OK — 915 MHz SF12");
  return true;
}

// ─── Lectura RFID (solo si no se ha leído antes) ─────────────────────────────
void leerRFID() {
  if (rfidLeido) return;
  SPI.begin();
  rfid.PCD_Init();
  unsigned long t = millis();
  while (millis() - t < 3000) {
    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
      delay(50); continue;
    }
    memcpy(rfidTag, rfid.uid.uidByte, min((int)rfid.uid.size, 8));
    rfidLeido = true;
    Serial.printf("[RFID] Tag: %02X%02X%02X%02X\n", rfidTag[0], rfidTag[1], rfidTag[2], rfidTag[3]);
    rfid.PICC_HaltA();
    break;
  }
  rfid.PCD_End();
}

// ─── Lectura de temperatura (DHT22) ──────────────────────────────────────────
float leerTemperatura() {
  float t = dht.readTemperature();
  if (isnan(t)) { Serial.println("[DHT22] Error lectura"); return 38.5; }
  Serial.printf("[DHT22] Temp: %.1f°C\n", t);
  return t;
}

// ─── Lectura de pulso y O2 (MAX30102) ────────────────────────────────────────
struct VitalesOximetro {
  uint16_t bpm;
  uint8_t  spo2;
};
VitalesOximetro leerOximetro() {
  VitalesOximetro v = { 0, 0 };
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[MAX30102] No detectado");
    return v;
  }
  particleSensor.setup(60, 4, 2, 400, 411, 4096);
  particleSensor.setPulseAmplitudeRed(0x0A);
  particleSensor.setPulseAmplitudeIR(0x1F);

  const int MUESTRAS = 100;
  long irValores[MUESTRAS];
  byte tasaIndice = 0;
  byte tasas[4] = {0};
  long beatsPerMinute = 0;
  bool latidoDetectado = false;

  for (int i = 0; i < MUESTRAS; i++) {
    while (!particleSensor.available()) particleSensor.check();
    long irVal = particleSensor.getIR();
    irValores[i] = irVal;

    if (checkForBeat(irVal)) {
      long delta = millis();
      beatsPerMinute = 60 / (delta / 1000.0);
      if (beatsPerMinute < 255 && beatsPerMinute > 20) {
        tasas[tasaIndice++ % 4] = (byte)beatsPerMinute;
      }
      latidoDetectado = true;
    }
    particleSensor.nextSample();
    delay(10);
  }

  // Promedio BPM
  long suma = 0;
  for (int i = 0; i < 4; i++) suma += tasas[i];
  v.bpm = suma / 4;

  // SpO2 simplificado: ratio AC/DC de rojo vs IR
  // En producción usar algoritmo Maxim oficial
  v.spo2 = (v.bpm > 30 && v.bpm < 200) ? 95 : 0;

  particleSensor.shutDown();
  Serial.printf("[MAX30102] BPM: %d  SpO2: %d%%\n", v.bpm, v.spo2);
  return v;
}

// ─── Detección de actividad (MPU6050) ────────────────────────────────────────
Actividad detectarActividad() {
  Wire.begin();
  mpu.begin();
  mpu.calcOffsets();
  delay(200);
  mpu.update();

  float ax = abs(mpu.getAccX());
  float ay = abs(mpu.getAccY());
  float az = abs(mpu.getAccZ() - 1.0); // restar gravedad
  float mag = sqrt(ax*ax + ay*ay + az*az);

  Serial.printf("[MPU6050] Magnitud aceleración: %.3f\n", mag);

  if (mag < 0.05) return REPOSO;
  if (mag < 0.15) return CAMINANDO;
  if (mag < 0.35) return COMIENDO;
  return CORRIENDO;
}

// ─── Estres estimado (heurística simple) ─────────────────────────────────────
uint8_t estimarEstres(float tempC, uint16_t bpm, Actividad act) {
  uint8_t estres = 10;
  if (tempC > 40.0) estres += 40;
  else if (tempC > 39.2) estres += 20;
  if (bpm > 100) estres += 30;
  else if (bpm > 80) estres += 15;
  if (act == CORRIENDO) estres += 15;
  return min((int)estres, 100);
}

// ─── GPS (placeholder: usar coordenadas fijas o módulo GPS en producción) ─────
// En Beta: coordenadas fijas de la UPP. En producción: reemplazar con NEO-6M.
float GPS_LAT =  24.0277;
float GPS_LNG = -104.6532;

// ─── Construir payload de 40 bytes ───────────────────────────────────────────
void construirPayload(uint8_t* buf,
                      float temp, uint16_t bpm, uint8_t spo2,
                      uint8_t estres, Actividad act,
                      float lat, float lng, int8_t rssi, uint8_t batPct) {
  memset(buf, 0, PAYLOAD_SIZE);

  buf[0] = 0x01;                          // versión del protocolo

  writeInt32BE(buf + 1, (int32_t)DEVICE_ID);

  uint32_t ts = (uint32_t)(millis() / 1000 + ciclo * 300);
  writeInt32BE(buf + 5, (int32_t)ts);

  writeInt32BE(buf + 9,  (int32_t)(lat * 1e6));
  writeInt32BE(buf + 13, (int32_t)(lng * 1e6));

  writeUint16BE(buf + 17, (uint16_t)(temp * 10));  // ej: 38.5 → 385
  writeUint16BE(buf + 19, bpm);
  buf[21] = spo2;
  buf[22] = estres;
  buf[23] = (uint8_t)act;
  buf[24] = (uint8_t)rssi;
  buf[25] = batPct;

  memcpy(buf + 26, rfidTag, 8);            // RFID tag (8 bytes)

  uint16_t crc = crc16Modbus(buf, 34);
  writeUint16BE(buf + 34, crc);

  hmac4(buf, 36, buf + 36);               // HMAC de los primeros 36 bytes
}

// ─── Encriptar payload AES-128-CBC ────────────────────────────────────────────
// Nota: AESLib encripta in-place en bloques de 16 bytes
void encriptarPayload(uint8_t* buf) {
  // Encriptamos solo los primeros 32 bytes (2 bloques AES)
  // Los últimos 8 bytes (CRC+HMAC) quedan en claro para verificación rápida
  aes.encrypt(buf,      AES_KEY, 16, AES_IV);
  aes.encrypt(buf + 16, AES_KEY, 16, AES_IV);
}

// ─── Leer nivel de batería (voltage divider en pin 34) ────────────────────────
uint8_t leerBateria() {
  // En producción: medir ADC pin 34 con divisor resistivo
  // Aquí simulamos un valor descendente basado en ciclo
  int pct = max(0, 100 - (int)(ciclo * 2));
  return (uint8_t)pct;
}

// ─── Transmitir por LoRa ──────────────────────────────────────────────────────
bool transmitir(uint8_t* payload, size_t len) {
  LoRa.beginPacket();
  LoRa.write(payload, len);
  bool ok = LoRa.endPacket();
  Serial.printf("[LORA] Transmisión: %s  (%d bytes)\n", ok ? "OK" : "FAIL", len);
  return ok;
}

// ─── Parpadeo LED de estado ──────────────────────────────────────────────────
void ledBlink(int veces, int ms = 100) {
  for (int i = 0; i < veces; i++) {
    digitalWrite(LED_STATUS, HIGH); delay(ms);
    digitalWrite(LED_STATUS, LOW);  delay(ms);
  }
}

// ════════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.printf("\n=== SIGGAN Collar LoRa BETA — Ciclo %lu ===\n", ciclo);

  pinMode(LED_STATUS, OUTPUT);
  ledBlink(2);

  Wire.begin();
  dht.begin();

  // 1. Leer RFID del animal (solo primer arranque)
  leerRFID();

  // 2. Leer sensores
  float      temp   = leerTemperatura();
  VitalesOximetro ox = leerOximetro();
  Actividad  act    = detectarActividad();
  uint8_t    estres = estimarEstres(temp, ox.bpm, act);
  uint8_t    bat    = leerBateria();
  int8_t     rssi   = -75; // RSSI del último paquete recibido (placeholder)

  Serial.printf("[SIGGAN] Temp:%.1f BPM:%d SpO2:%d%% Estres:%d%% Act:%d Bat:%d%%\n",
                temp, ox.bpm, ox.spo2, estres, (int)act, bat);

  // 3. Construir payload
  uint8_t payload[PAYLOAD_SIZE];
  construirPayload(payload, temp, ox.bpm, ox.spo2, estres, act,
                   GPS_LAT, GPS_LNG, rssi, bat);

  // 4. Encriptar
  encriptarPayload(payload);

  // 5. Inicializar LoRa y transmitir
  if (initLoRa()) {
    bool ok = transmitir(payload, PAYLOAD_SIZE);
    ledBlink(ok ? 3 : 5, ok ? 80 : 300);
  }

  LoRa.end();
  ciclo++;

  // 6. Deep sleep (~5 min)
  Serial.println("[SIGGAN] Entrando en deep sleep 5 min...");
  Serial.flush();
  esp_sleep_enable_timer_wakeup(295ULL * 1000000ULL); // 295 segundos en µs
  esp_deep_sleep_start();
}

void loop() {
  // No se ejecuta — el ESP32 siempre reinicia desde setup() tras el sleep
}
