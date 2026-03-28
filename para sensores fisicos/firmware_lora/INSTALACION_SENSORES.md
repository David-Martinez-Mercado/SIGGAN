# SIGGAN — Instalación de Sensores LoRa (BETA)

> **Nota:** Estos son programas BETA/prototipo para aprendizaje.
> No van a producción aún. Se optimizarán después.

---

## Arquitectura

```
[Collar ESP32]  ──LoRa SF12 915MHz──►  [Gateway RPi]  ──HTTP──►  [SIGGAN Backend]
    MAX30102 (pulso/O₂)                  SX1276 HAT                  :3001
    DHT22 (temperatura)                  Node.js                   PostgreSQL
    MPU6050 (actividad)                  SD card backup
    RFID RC522 (identificación)
```

---

## 1. Collar ESP32 — Compilación con Arduino IDE

### Librerías requeridas (Arduino Library Manager)

| Librería | Autor | Versión |
|----------|-------|---------|
| LoRa | sandeepmistry | ≥ 0.8.0 |
| DHT sensor library | Adafruit | ≥ 1.4.4 |
| SparkFun MAX3010x | SparkFun | ≥ 1.1.2 |
| MPU6050_light | rfetick | ≥ 1.1.0 |
| MFRC522 | miguelbalboa | ≥ 1.4.10 |
| AESLib | suculent | ≥ 2.2.0 |

### Configuración Arduino IDE

1. Instalar ESP32 board support:
   - File → Preferences → Additional URLs:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Tools → Board Manager → buscar "esp32" → instalar "esp32 by Espressif"

2. Seleccionar placa:
   - Tools → Board → ESP32 Arduino → **ESP32 Dev Module**
   - Upload Speed: 921600
   - Flash Size: 4MB
   - Partition Scheme: Default 4MB

3. Cambiar `DEVICE_ID` en [firmware_collar_lora.ino](firmware_collar_lora.ino) línea 37:
   ```cpp
   #define DEVICE_ID  0x00000001UL  // ← ID único por collar (1, 2, 3...)
   ```

4. Si el animal tiene coordenadas GPS fijas (sin módulo GPS), cambiar líneas 149-150:
   ```cpp
   float GPS_LAT =  24.0277;   // ← Latitud de la UPP
   float GPS_LNG = -104.6532;  // ← Longitud de la UPP
   ```

5. Compilar y subir: Ctrl+U

---

## 2. Conexiones de Hardware ESP32

### MAX30102 (Pulso y O₂) — I2C
```
MAX30102    ESP32
VIN    →   3.3V
GND    →   GND
SDA    →   GPIO 21
SCL    →   GPIO 22
```

### DHT22 (Temperatura)
```
DHT22    ESP32
VCC  →   3.3V
GND  →   GND
DATA →   GPIO 4  (con resistencia pull-up 10kΩ a 3.3V)
```

### MPU6050 (Acelerómetro/Giroscopio) — I2C (comparte bus con MAX30102)
```
MPU6050    ESP32
VCC    →   3.3V
GND    →   GND
SDA    →   GPIO 21
SCL    →   GPIO 22
AD0    →   GND (dirección I2C 0x68)
```

### LoRa SX1276 (Comunicación 915 MHz)
```
SX1276    ESP32
VCC   →   3.3V
GND   →   GND
NSS   →   GPIO 18
RESET →   GPIO 14
DIO0  →   GPIO 26
MOSI  →   GPIO 23
MISO  →   GPIO 19
SCK   →   GPIO 5
```

### RFID RC522 (Identificación RFID) — SPI (comparte bus con LoRa)
```
RC522    ESP32
VCC  →   3.3V
GND  →   GND
SS   →   GPIO 5
RST  →   GPIO 27
MOSI →   GPIO 23
MISO →   GPIO 19
SCK  →   GPIO 18
```

### LED de estado
```
LED (ánodo) → GPIO 2 → resistencia 330Ω → GND
```

---

## 3. Gateway Raspberry Pi — Instalación

### OS recomendado
- **Raspberry Pi OS Lite** (64-bit) — sin escritorio, más ligero
- Probado en: RPi 3B+, RPi 4B, RPi Zero 2W

### Instalar Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # debe mostrar v20.x.x
```

### Módulo LoRa HAT
Conectar el HAT SX1276 915MHz (ej. RAK831, WaveShare SX1262) al GPIO del RPi.
Verificar qué puerto serial usa:
```bash
ls /dev/tty*
# Normalmente: /dev/ttyS0 o /dev/ttyAMA0
```

Habilitar serial en RPi:
```bash
sudo raspi-config
# Interface Options → Serial Port → Login shell: NO → Serial hardware: YES
```

### Instalar dependencias del gateway
```bash
cd /opt/siggan/firmware_lora
npm install serialport @serialport/parser-readline axios
```

> **Nota:** `serialport` requiere node-gyp y compilación nativa:
> ```bash
> sudo apt-get install -y build-essential python3
> ```

### Instalar como servicio con PM2
```bash
sudo npm install -g pm2
pm2 start gateway_lora.js --name siggan-gateway
pm2 startup systemd   # para que arranque con el sistema
pm2 save
```

Verificar:
```bash
pm2 status
pm2 logs siggan-gateway
```

### Configurar SD card de respaldo
```bash
sudo mkdir -p /mnt/sd
# Montar automáticamente la SD en /mnt/sd editando /etc/fstab:
# /dev/sda1  /mnt/sd  ext4  defaults,noatime  0  2
```

---

## 4. Sincronizador de múltiples Gateways

Solo necesario si tienes más de un gateway en la misma UPP.

```bash
pm2 start sync_multiple_gateways.js --name siggan-sync
```

Configurar IPs de los gateways esclavos en [sync_multiple_gateways.js](sync_multiple_gateways.js) líneas 15-19:
```js
const GATEWAYS = [
  { id: 'GW-01', host: '192.168.1.101', puerto: 9000 },
  { id: 'GW-02', host: '192.168.1.102', puerto: 9000 },
];
```

Dashboard local disponible en: `http://<ip-raspberry>:8080`

---

## 5. Ejecutar el simulador/tester

No requiere hardware real. Prueba la encriptación, CRC y HMAC.

```bash
# Simular 5 collares × 10 ciclos (sin hardware)
node test_lora_simulator.js --collares=5 --ciclos=10 --delay=200

# Con gateway real escuchando en 192.168.1.100:9001
node test_lora_simulator.js --collares=3 --ciclos=20 --host=192.168.1.100 --puerto=9001
```

El reporte se guarda como `reporte_lora_FECHA.json` en la misma carpeta.

---

## 6. Frecuencias y Parámetros LoRa

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| Frecuencia | 915 MHz | Banda libre en México |
| Spreading Factor | SF12 | Máximo alcance (~10-15 km rural) |
| Bandwidth | 125 kHz | Balance alcance/velocidad |
| Coding Rate | 4/5 | Corrección de errores básica |
| TX Power | 20 dBm | Máximo legal en México (100 mW) |
| Sync Word | 0x12 | Identificador red SIGGAN |
| Preamble | 8 símbolos | Estándar |
| CRC | Habilitado | Detección de errores en capa LoRa |

### Tiempo de vuelo (ToA) estimado — Payload 40 bytes con SF12
```
~2.8 segundos por transmisión
```
> Por esto se usa deep sleep de 5 min: la ventana de transmisión es muy corta.

---

## 7. Claves de Encriptación

> ⚠️ Cambiar antes de usar en producción real.

Las claves están en [config_lora.json](config_lora.json) en formato base64.
Para regenerarlas:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

Actualizar la misma clave en `firmware_collar_lora.ino` (array `AES_KEY[]` línea 47).

---

## 8. Solución de Problemas

### El collar no transmite
- Verificar conexiones SPI del SX1276
- En `Serial Monitor` (115200 baud) debería aparecer `[LORA] OK — 915 MHz SF12`
- Verificar que la frecuencia sea 915E6 (no 868E6 que es Europa)

### El gateway no recibe paquetes
- Verificar que el puerto serial está habilitado: `ls /dev/ttyS0`
- Verificar baud rate coincide con el HAT LoRa
- Probar con: `cat /dev/ttyS0` (deberían aparecer datos hex)

### Error CRC en gateway
- Asegurarse de que la clave AES en firmware y config_lora.json es la misma
- El payload debe ser exactamente 40 bytes

### El backend rechaza las lecturas (404 Animal no encontrado)
- Verificar que el RFID tag del collar está registrado en SIGGAN
- En el panel SIGGAN: ir a Animales → editar animal → campo `RFID Tag`
- El formato debe ser hexadecimal: `A1B2C3D4` (sin espacios)

---

## Próximas mejoras (para versión hardened)

- [ ] IV aleatorio por transmisión (actualmente fijo)
- [ ] Módulo GPS NEO-6M real (reemplazar coordenadas fijas)
- [ ] OTA (Over-the-Air firmware update) via LoRa o WiFi
- [ ] MQTT en lugar de HTTP REST para menor latencia
- [ ] Certificados TLS para el gateway → backend
- [ ] Batería con carga solar (LiPo + panel 5V)
