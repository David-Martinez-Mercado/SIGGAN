# SIGGAN IoT Simulator

Simulador de sensores IoT para el sistema SIGGAN de la Unión Ganadera de Durango.

Genera lecturas realistas de temperatura, GPS, ritmo cardíaco, estrés y batería para cada
animal registrado en la base de datos, y las envía al backend SIGGAN cada 30 segundos.

---

## Requisitos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 18+ |
| npm | 9+ |
| PostgreSQL | 14+ (siggan_db corriendo) |
| Backend SIGGAN | corriendo en puerto 3001 |

---

## Instalación

```bash
# 1. Entrar a la carpeta
cd "para sensores fisicos"

# 2. Instalar dependencias
npm install

# 3. Crear carpeta de logs (si no existe)
mkdir logs

# 4. Configurar credenciales en config.json
#    Editar: autenticacion.email y autenticacion.password
```

---

## Configuración (`config.json`)

Los valores más importantes a ajustar:

```json
{
  "backend": {
    "url": "http://localhost:3001"         ← URL del backend SIGGAN
  },
  "database": {
    "host": "localhost",
    "user": "postgres",
    "password": "123456789",
    "database": "siggan_db"
  },
  "simulador": {
    "intervaloSimulacion_ms": 30000        ← Cada 30 segundos
  },
  "autenticacion": {
    "email": "admin@tudominio.com",        ← ⚠️ Llenar con cuenta ADMIN
    "password": "tupassword"
  }
}
```

---

## Ejecución

```bash
# Simulación continua (cada 30 s)
npm start

# Con recarga automática al editar
npm run dev

# Test de APIs y base de datos
npm run test:apis
```

---

## Estructura de carpetas

```
para sensores fisicos/
├── simulador_iot.js          ← Entrada principal
├── config.json               ← Configuración (backend, BD, sensores)
├── package.json
├── generadores/
│   ├── generador_vitales.js  ← Temperatura, BPM, estrés, O₂
│   └── generador_gps.js      ← Coordenadas GPS con Haversine
├── adaptadores/              ← (futuro: MQTT, LoRa, serial)
├── test/
│   └── test_apis.js          ← Suite de pruebas
└── logs/
    ├── simulador_iot.log     ← Log general
    └── lecturas_*.json       ← Fallback cuando la API no responde
```

---

## Ejemplo de lectura generada

```json
{
  "animalId": "uuid-del-animal",
  "nodoId": "ESP32-001",
  "latitud": 24.027814,
  "longitud": -104.652931,
  "temperatura": 38.7,
  "rssi": -68,
  "bateria": 74.3
}
```

El simulador también genera internamente (para logs y alertas):

```json
{
  "_meta": {
    "actividad": "caminando",
    "ritmoCardiaco": 72,
    "estres": 18,
    "saturacionO2": 98.2,
    "precision": 5.3,
    "distanciaCentro": 1243
  }
}
```

---

## Alertas automáticas

| Condición | Tipo | Severidad |
|---|---|---|
| Temperatura ≥ 40.5°C | `TEMPERATURA_ALTA` | ALTA / CRITICA |
| Animal fuera de 5 km | `FUERA_GEOCERCA` | ALTA |
| Batería < 20% | `BATERIA_BAJA` | MEDIA / ALTA |
| Estrés ≥ 75% | `ESTRES_ALTO` | MEDIA / ALTA |

---

## Configuración avanzada

### Cambiar intervalo de simulación
```json
"simulador": { "intervaloSimulacion_ms": 10000 }   ← cada 10 s
```

### Ajustar rangos de temperatura
```json
"temperatura": {
  "min": 36.5,
  "max": 40.0,
  "media": 38.5,
  "desviacion": 0.8,
  "umbral_alerta": 40.5
}
```

### Cambiar epicentro GPS (geocerca)
```json
"gps": {
  "epicentro_lat": 24.0277,
  "epicentro_lon": -104.6532,
  "radio_metros": 5000
}
```

### Probabilidades de eventos anómalos
```json
"alertas_probabilidades": {
  "fiebre_alto": 0.05,          ← 5% por ciclo
  "fuera_geocerca": 0.03,       ← 3% por ciclo
  "bateria_baja": 0.02,
  "perdida_conexion": 0.01
}
```

---

## Autenticación JWT

El simulador hace login automático si configuras:

```json
"autenticacion": {
  "email": "admin@siggan.com",
  "password": "mipassword"
}
```

También puedes pegar un token JWT directamente (expira en 24h):

```json
"autenticacion": {
  "token": "eyJhbGciOi..."
}
```

---

## Troubleshooting

### ❌ Backend no responde
```
Error: connect ECONNREFUSED 127.0.0.1:3001
```
→ Inicia el backend: `cd Backend && npm run dev`

### ❌ PostgreSQL: connection refused
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
→ Verifica que PostgreSQL esté corriendo en Windows Services

### ❌ PostgreSQL: autenticación fallida
```
Error: password authentication failed
```
→ Verifica `database.user` y `database.password` en `config.json`

### ❌ 401 Unauthorized en todos los endpoints
→ Configura `autenticacion.email` y `autenticacion.password` en `config.json`

### ❌ 403 Solo admin puede simular
→ La cuenta configurada no tiene rol ADMIN. Usa una cuenta ADMIN.

### ⚠️ No hay animales activos
```
⚠️  No hay animales activos en la base de datos
```
→ Registra animales en SIGGAN o verifica que `activo = true` en la tabla `animales`

### 💾 Lecturas guardadas en logs/
Si la API no responde, las lecturas se guardan en `logs/lecturas_TIMESTAMP.json`
para reenviarlas manualmente o importarlas.

---

## Preparación para sensores físicos (LoRa/MQTT)

La carpeta `adaptadores/` está reservada para futuras integraciones:

```
adaptadores/
├── adaptador_mqtt.js     ← Broker MQTT (Mosquitto, HiveMQ)
├── adaptador_lora.js     ← Serial/USB desde gateway LoRa
└── adaptador_serial.js   ← Lectura directa de ESP32 via USB
```

Los adaptadores recibirán datos del hardware físico y los normalizarán
al mismo formato que usa el simulador antes de enviarlos al backend.

El endpoint `POST /api/iot/lecturas` acepta también `rfidTag` o `areteNacional`
para identificar al animal si el sensor no tiene el UUID interno:

```json
{
  "rfidTag": "EM4100-ABC123",
  "nodoId": "ESP32-001",
  "latitud": 24.0277,
  "longitud": -104.6532,
  "temperatura": 38.9,
  "rssi": -72,
  "bateria": 61.0
}
```
