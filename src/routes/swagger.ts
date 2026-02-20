import { Router, Request, Response } from 'express';

const router = Router();

const swaggerDoc = {
  openapi: '3.0.3',
  info: {
    title: 'SIGGAN API',
    description: 'Sistema Integral de Gestión Ganadera — API REST para gestión de ganado, trazabilidad, IoT y formularios SENASICA.',
    version: '1.0.0',
    contact: { name: 'SIGGAN', email: 'admin@siggan.mx' },
  },
  servers: [{ url: 'http://localhost:3001/api', description: 'Desarrollo local' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Animal: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          areteNacional: { type: 'string', example: 'MX100045001' },
          areteExportacion: { type: 'string', nullable: true },
          rfidTag: { type: 'string', nullable: true },
          nombre: { type: 'string', example: 'Luna' },
          raza: { type: 'string', example: 'Hereford' },
          sexo: { type: 'string', enum: ['MACHO', 'HEMBRA'] },
          fechaNacimiento: { type: 'string', format: 'date-time' },
          color: { type: 'string' },
          peso: { type: 'number' },
          estatusSanitario: { type: 'string', enum: ['SANO', 'EN_PRUEBA', 'REACTOR', 'CUARENTENADO'] },
          proposito: { type: 'string', enum: ['Cría', 'Engorda', 'Leche', 'Exportación'] },
        },
      },
      Propietario: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          nombre: { type: 'string' },
          apellidos: { type: 'string' },
          curp: { type: 'string', example: 'MALJ800515HDGRPN01' },
          municipio: { type: 'string', example: 'Durango' },
        },
      },
      UPP: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          claveUPP: { type: 'string', example: 'DGO10001234' },
          nombre: { type: 'string' },
          municipio: { type: 'string' },
          estatusSanitario: { type: 'string', enum: ['LIBRE', 'EN_PROCESO', 'CUARENTENADO'] },
        },
      },
      EventoSanitario: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tipo: { type: 'string', enum: ['VACUNACION', 'PRUEBA_TB', 'PRUEBA_BR', 'DESPARASITACION', 'TRATAMIENTO', 'PESAJE', 'INSPECCION', 'OTRO'] },
          fecha: { type: 'string', format: 'date-time' },
          resultado: { type: 'string' },
          mvzResponsable: { type: 'string' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@siggan.mx' },
                  password: { type: 'string', example: 'siggan2026' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Token JWT y datos del usuario' } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Autenticación'],
        summary: 'Registrar usuario',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'nombre', 'apellidos'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string', minLength: 6 },
                  nombre: { type: 'string' },
                  apellidos: { type: 'string' },
                  rol: { type: 'string', enum: ['ADMIN', 'PRODUCTOR', 'MVZ', 'AUTORIDAD', 'OPERADOR'] },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Usuario creado' } },
      },
    },
    '/animales': {
      get: {
        tags: ['Animales'],
        summary: 'Listar animales con filtros y paginación',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'buscar', in: 'query', schema: { type: 'string' }, description: 'Buscar por arete, nombre o RFID' },
          { name: 'raza', in: 'query', schema: { type: 'string' } },
          { name: 'sexo', in: 'query', schema: { type: 'string', enum: ['MACHO', 'HEMBRA'] } },
          { name: 'estatus', in: 'query', schema: { type: 'string' } },
          { name: 'uppId', in: 'query', schema: { type: 'string' } },
          { name: 'propietarioId', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Lista paginada de animales' } },
      },
      post: {
        tags: ['Animales'],
        summary: 'Registrar nuevo animal',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['areteNacional', 'raza', 'sexo', 'fechaNacimiento', 'propietarioId', 'uppId'],
                properties: {
                  areteNacional: { type: 'string', example: 'MX100099001' },
                  raza: { type: 'string', example: 'Angus' },
                  sexo: { type: 'string', enum: ['MACHO', 'HEMBRA'] },
                  fechaNacimiento: { type: 'string', format: 'date', example: '2024-03-15' },
                  color: { type: 'string' },
                  peso: { type: 'number' },
                  proposito: { type: 'string' },
                  propietarioId: { type: 'string', format: 'uuid' },
                  uppId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Animal registrado' } },
      },
    },
    '/animales/{id}': {
      get: {
        tags: ['Animales'],
        summary: 'Detalle de un animal con historial completo',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Datos del animal con eventos, aretes, lecturas IoT' } },
      },
      put: {
        tags: ['Animales'],
        summary: 'Actualizar datos de un animal',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Animal actualizado' } },
      },
      delete: {
        tags: ['Animales'],
        summary: 'Dar de baja un animal (baja lógica)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Animal dado de baja' } },
      },
    },
    '/animales/arete/{arete}': {
      get: {
        tags: ['Animales'],
        summary: 'Buscar animal por número de arete',
        parameters: [{ name: 'arete', in: 'path', required: true, schema: { type: 'string' }, example: 'MX100045001' }],
        responses: { 200: { description: 'Animal encontrado' } },
      },
    },
    '/propietarios': {
      get: {
        tags: ['Propietarios'],
        summary: 'Listar propietarios',
        parameters: [
          { name: 'buscar', in: 'query', schema: { type: 'string' } },
          { name: 'municipio', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Lista de propietarios' } },
      },
      post: { tags: ['Propietarios'], summary: 'Crear propietario', responses: { 201: { description: 'Creado' } } },
    },
    '/upps': {
      get: {
        tags: ['UPPs'],
        summary: 'Listar Unidades de Producción Pecuaria',
        parameters: [
          { name: 'buscar', in: 'query', schema: { type: 'string' } },
          { name: 'municipio', in: 'query', schema: { type: 'string' } },
          { name: 'estatus', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Lista de UPPs' } },
      },
      post: { tags: ['UPPs'], summary: 'Crear UPP', responses: { 201: { description: 'Creada' } } },
    },
    '/eventos': {
      get: {
        tags: ['Eventos Sanitarios'],
        summary: 'Listar eventos con filtros',
        parameters: [
          { name: 'animalId', in: 'query', schema: { type: 'string' } },
          { name: 'tipo', in: 'query', schema: { type: 'string' } },
          { name: 'fechaDesde', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'fechaHasta', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Lista de eventos' } },
      },
      post: { tags: ['Eventos Sanitarios'], summary: 'Crear evento sanitario', responses: { 201: { description: 'Creado' } } },
    },
    '/eventos/lote': {
      post: { tags: ['Eventos Sanitarios'], summary: 'Crear evento para múltiples animales (vacunación masiva)', responses: { 201: { description: 'Eventos creados' } } },
    },
    '/eventos/reactores/lista': {
      get: { tags: ['Eventos Sanitarios'], summary: 'Listar animales reactores a TB/BR', responses: { 200: { description: 'Reactores' } } },
    },
    '/aretes/animal/{animalId}': {
      get: { tags: ['Aretes'], summary: 'Historial de aretes de un animal', parameters: [{ name: 'animalId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Historial' } } },
    },
    '/aretes/transferir': {
      post: { tags: ['Aretes'], summary: 'Transferir animal a nuevo propietario y UPP', responses: { 200: { description: 'Transferencia exitosa' } } },
    },
    '/busqueda': {
      get: {
        tags: ['Búsqueda'],
        summary: 'Búsqueda global (animales, propietarios, UPPs)',
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 }, example: 'Hereford' }],
        responses: { 200: { description: 'Resultados agrupados' } },
      },
    },
    '/dashboard/stats': {
      get: { tags: ['Dashboard'], summary: 'Estadísticas generales del sistema', responses: { 200: { description: 'Totales, distribución por sexo, estatus, últimos registros' } } },
    },
  },
  tags: [
    { name: 'Autenticación', description: 'Login y registro' },
    { name: 'Animales', description: 'Gestión de ganado' },
    { name: 'Propietarios', description: 'Gestión de propietarios' },
    { name: 'UPPs', description: 'Unidades de Producción Pecuaria' },
    { name: 'Eventos Sanitarios', description: 'Vacunaciones, pruebas TB/BR, tratamientos' },
    { name: 'Aretes', description: 'Historial y transferencias de aretes' },
    { name: 'Búsqueda', description: 'Búsqueda global y estadísticas' },
    { name: 'Dashboard', description: 'Estadísticas del sistema' },
  ],
};

// GET /api/docs - Swagger JSON
router.get('/json', (req: Request, res: Response) => {
  res.json(swaggerDoc);
});

// GET /api/docs - Swagger UI
router.get('/', (req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>SIGGAN API - Documentación</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/docs/json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout"
    });
  </script>
</body>
</html>`;
  res.type('html').send(html);
});

export default router;
