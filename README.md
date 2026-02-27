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
# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
