# SIGGAN - Sistema Integral de Gestión Ganadera

Sistema de identificación y gestión ganadera con biometría de iris, IoT, formularios SENASICA y generación de documentos oficiales.

---

## Stack tecnológico

| Capa | Tecnología | Puerto |
|------|-----------|--------|
| Backend | Node.js + Express + TypeScript + Prisma | 3001 |
| Frontend | React 19 + Tailwind CSS + React Router v7 | 3000 |
| Biometría | Python 3 + Flask + PyTorch (CNN ArcFace) | 5000 |
| Base de datos | PostgreSQL 15+ | 5432 |

---

## Requisitos previos

- Node.js 18+
- PostgreSQL 15+
- Python 3.10+ con pip
- LibreOffice (para conversión de documentos a PDF)

---

## Instalación

### 1. Base de datos

```bash
# Crear base de datos PostgreSQL
createdb siggan
```

### 2. Backend

```bash
cd Backend
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu DATABASE_URL y JWT_SECRET

# Ejecutar migraciones y seed
npx prisma migrate dev
npx prisma db seed

# Iniciar servidor
npm run dev
```

### 3. Frontend

```bash
cd Frontend/siggan-web
npm install
npm start
```

### 4. Servicio de biometría (opcional)

```bash
cd Backend
pip install flask torch torchvision opencv-python pillow numpy

python iris_service.py
```

---

## Inicio rápido (Windows)

```bat
start-all.bat
```

---

## Credenciales de prueba

| Rol | Email | Password |
|-----|-------|----------|
| Super Admin | admin@siggan.mx | siggan2026 |
| MVZ | mvz@siggan.mx | siggan2026 |
| Productor | juan.martinez@siggan.mx | siggan2026 |
| Productor | maria.garcia@siggan.mx | siggan2026 |

---

## Estructura del proyecto

```
siggan-proyecto/
├── Backend/
│   ├── src/
│   │   ├── index.ts              # Servidor principal
│   │   ├── routes/               # Endpoints de la API
│   │   ├── middleware/           # Auth (JWT), manejo de errores
│   │   └── config/               # Configuración Prisma
│   ├── prisma/
│   │   ├── schema.prisma         # Modelos de datos
│   │   ├── seed.ts               # Datos de prueba
│   │   └── migrations/           # Historial de migraciones
│   ├── Formatos/                 # Plantillas DOCX (SENASICA)
│   ├── uploads/                  # Archivos subidos
│   ├── models/                   # Modelo PyTorch entrenado
│   ├── iris_service.py           # Microservicio de biometría
│   └── iris_db.json              # Base de embeddings de iris
├── Frontend/
│   └── siggan-web/
│       └── src/
│           ├── pages/            # Vistas de la aplicación
│           ├── components/       # Componentes reutilizables
│           ├── services/api.ts   # Cliente HTTP (Axios)
│           └── context/          # AuthContext (estado global)
├── iris-training/                # Pipeline de entrenamiento del modelo de iris
└── start-all.bat                 # Script para iniciar todos los servicios
```

---

## API — Endpoints principales

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/register` | Solicitud de registro |

### Animales
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/animales` | Listar animales |
| POST | `/api/animales` | Registrar animal |
| GET | `/api/animales/:id` | Detalle de animal |
| PUT | `/api/animales/:id` | Actualizar animal |

### UPPs y Propietarios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/upps` | Listar UPPs |
| GET | `/api/propietarios` | Listar propietarios |

### Documentos SENASICA
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/generar-documentos/acta-nacimiento` | Acta de nacimiento |
| POST | `/api/generar-documentos/compraventa` | Contrato de compraventa |
| POST | `/api/generar-documentos/programacion-pruebas` | Programación de pruebas |
| POST | `/api/generar-documentos/solicitud-prueba` | Solicitud de prueba |
| POST | `/api/generar-documentos/solicitud-exportacion` | Solicitud de exportación (máx. 10 animales) |

### Biometría de Iris
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/biometria/registrar` | Registrar iris de un animal |
| POST | `/api/biometria/verificar` | Verificar identidad por iris |

### Dashboard e IoT
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/dashboard/stats` | Estadísticas generales |
| GET | `/api/iot/lecturas` | Lecturas de sensores |
| GET | `/api/iot/alertas` | Alertas activas |

---

## Roles y permisos

```
SUPER_ADMIN (Primario) > SUPER_ADMIN > ADMIN > MVZ > PRODUCTOR
```

- **SUPER_ADMIN**: Acceso total al sistema
- **ADMIN**: Gestión de usuarios, UPPs y animales
- **MVZ**: Eventos sanitarios, formularios SENASICA, cuarentenas
- **PRODUCTOR**: Consulta y registro de sus propios animales

---

## Modelos de datos principales

| Modelo | Descripción |
|--------|-------------|
| `Usuario` | Usuarios del sistema con roles |
| `Propietario` | Dueños de ganado |
| `UPP` | Unidades de Producción Pecuaria |
| `Animal` | Ganado registrado con biometría y QR |
| `EventoSanitario` | Vacunaciones, pruebas de TB/BR, tratamientos |
| `HistorialArete` | Trazabilidad de aretes |
| `Formulario` | Formularios SENASICA generados |
| `NodoIoT` / `LecturaIoT` / `AlertaIoT` | Monitoreo con sensores |
| `OfertaMarketplace` | Compraventa de animales |
| `AreteDisponible` | Inventario de aretes disponibles |

---

## Variables de entorno (Backend/.env)

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/siggan"
JWT_SECRET="tu_secreto_jwt"
PORT=3001
IRIS_SERVICE_URL="http://localhost:5000"
```
