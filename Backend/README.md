# 🐄 SIGGAN - Sistema Integral de Gestión Ganadera

Sistema de Identificación y Gestión Ganadera con Arquitectura de Nueva Generación.
Integra IoT, Blockchain, Biometría de Iris y formularios SENASICA.

## Requisitos previos

- Node.js 18+
- PostgreSQL 15+
- Python 3.10+ (para módulos IoT y biometría)
- Git

## Instalación rápida

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/TU_USUARIO/siggan.git
cd siggan
npm install

# 2. Configurar base de datos
# Edita .env con tu password de PostgreSQL
cp .env.example .env

# 3. Crear tablas y poblar datos de prueba
npx prisma migrate dev --name init
npx prisma db seed

# 4. Iniciar servidor
npm run dev
```

## Credenciales de prueba

| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@siggan.mx | siggan2026 |
| MVZ | mvz@siggan.mx | siggan2026 |
| Productor | productor@siggan.mx | siggan2026 |
| Productor | juan.martinez@siggan.mx | siggan2026 |
| Productor | maria.garcia@siggan.mx | siggan2026 |
| Productor | pedro.rodriguez@siggan.mx | siggan2026 |
| Productor | asociacion.santiago@siggan.mx | siggan2026 |

## Endpoints principales

- `GET /api/health` — Estado del servidor
- `POST /api/auth/register` — Registro de usuario
- `POST /api/auth/login` — Iniciar sesión
- `GET /api/animales` — Listar animales
- `POST /api/animales` — Registrar animal
- `GET /api/propietarios` — Listar propietarios
- `GET /api/upps` — Listar UPPs
- `GET /api/dashboard/stats` — Estadísticas

## Stack tecnológico

- **Backend:** Node.js + Express + TypeScript
- **ORM:** Prisma
- **Base de datos:** PostgreSQL
- **Auth:** JWT + bcrypt
- **Validación:** Zod

## Estructura del proyecto

```
siggan/
├── prisma/
│   ├── schema.prisma    # Modelos de datos
│   └── seed.ts          # Datos de prueba
├── src/
│   ├── config/          # Configuración (BD)
│   ├── middleware/       # Auth, errores
│   ├── routes/          # Endpoints API
│   └── index.ts         # Servidor principal
├── .env                 # Variables de entorno
└── package.json
```
