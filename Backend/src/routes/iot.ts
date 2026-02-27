import { Router, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Coordenadas base de UPPs en Durango para simular GPS
const GEOCERCAS: Record<string, { lat: number; lng: number; radio: number }> = {
  'Durango': { lat: 24.0277, lng: -104.6532, radio: 0.01 },
  'Canatlán': { lat: 24.5208, lng: -104.7814, radio: 0.015 },
  'Nombre de Dios': { lat: 23.8475, lng: -104.2456, radio: 0.012 },
  'Santiago Papasquiaro': { lat: 25.0442, lng: -105.4194, radio: 0.02 },
};

// GET /api/iot/lecturas - Lecturas recientes
router.get('/lecturas', async (req: AuthRequest, res: Response) => {
  try {
    const { animalId, limit = '50' } = req.query;
    const where: any = {};
    if (animalId) where.animalId = animalId as string;

    const lecturas = await prisma.lecturaIoT.findMany({
      where, take: parseInt(limit as string),
      include: { animal: { select: { id: true, areteNacional: true, nombre: true, raza: true, upp: { select: { municipio: true } } } } },
      orderBy: { timestamp: 'desc' },
    });
    res.json(lecturas);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

// GET /api/iot/alertas - Alertas
router.get('/alertas', async (req: AuthRequest, res: Response) => {
  try {
    const { leida, severidad, limit = '50' } = req.query;
    const where: any = {};
    if (leida !== undefined) where.leida = leida === 'true';
    if (severidad) where.severidad = severidad as string;

    const alertas = await prisma.alertaIoT.findMany({
      where, take: parseInt(limit as string), orderBy: { createdAt: 'desc' },
    });
    res.json(alertas);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

// PUT /api/iot/alertas/:id/leer
router.put('/alertas/:id/leer', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.alertaIoT.update({ where: { id: req.params.id }, data: { leida: true } });
    res.json({ message: 'Alerta marcada como leída' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

// GET /api/iot/nodos - Nodos IoT
router.get('/nodos', async (req: AuthRequest, res: Response) => {
  try {
    const nodos = await prisma.nodoIoT.findMany({ orderBy: { nodoId: 'asc' } });
    res.json(nodos);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

// GET /api/iot/dashboard - Resumen IoT
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const [totalLecturas, alertasNoLeidas, nodosActivos, ultimasLecturas] = await Promise.all([
      prisma.lecturaIoT.count(),
      prisma.alertaIoT.count({ where: { leida: false } }),
      prisma.nodoIoT.count({ where: { activo: true } }),
      prisma.lecturaIoT.findMany({
        take: 10, orderBy: { timestamp: 'desc' },
        include: { animal: { select: { areteNacional: true, nombre: true } } },
      }),
    ]);

    // Promedios de temperatura
    const tempStats = await prisma.lecturaIoT.aggregate({
      _avg: { temperatura: true }, _max: { temperatura: true }, _min: { temperatura: true },
    });

    res.json({
      totalLecturas, alertasNoLeidas, nodosActivos,
      temperatura: { promedio: tempStats._avg.temperatura, max: tempStats._max.temperatura, min: tempStats._min.temperatura },
      ultimasLecturas,
    });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

// POST /api/iot/simular - Simular lecturas de todos los animales
router.post('/simular', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRol !== 'ADMIN') { res.status(403).json({ error: 'Solo admin puede simular' }); return; }

    const animales = await prisma.animal.findMany({
      where: { activo: true },
      include: { upp: { select: { municipio: true, latitud: true, longitud: true } } },
    });

    const lecturas = [];
    const alertas = [];
    const nodoIds = ['ESP32-001', 'ESP32-002', 'LORA-001', 'LORA-002', 'LORA-003'];

    for (const animal of animales) {
      const baseCoords = GEOCERCAS[animal.upp?.municipio || 'Durango'] || GEOCERCAS['Durango'];
      const baseLat = animal.upp?.latitud || baseCoords.lat;
      const baseLng = animal.upp?.longitud || baseCoords.lng;

      // Temperatura normal 38-39.5°C, con 5% chance de fiebre
      const esFiebre = Math.random() < 0.05;
      const temp = esFiebre ? 40.5 + Math.random() * 1.5 : 38.0 + Math.random() * 1.5;

      // GPS con variación normal, 3% chance fuera de geocerca
      const fueraGeocerca = Math.random() < 0.03;
      const latVariacion = fueraGeocerca ? (Math.random() * 0.05) : (Math.random() * baseCoords.radio - baseCoords.radio / 2);
      const lngVariacion = fueraGeocerca ? (Math.random() * 0.05) : (Math.random() * baseCoords.radio - baseCoords.radio / 2);

      lecturas.push({
        nodoId: nodoIds[Math.floor(Math.random() * nodoIds.length)],
        latitud: baseLat + latVariacion,
        longitud: baseLng + lngVariacion,
        temperatura: parseFloat(temp.toFixed(1)),
        rssi: -40 - Math.floor(Math.random() * 80),
        bateria: 20 + Math.random() * 80,
        animalId: animal.id,
      });

      // Generar alertas si hay anomalías
      if (esFiebre) {
        alertas.push({
          tipo: 'TEMPERATURA_ALTA', severidad: temp > 41.5 ? 'CRITICA' : 'ALTA',
          mensaje: `🌡️ ${animal.areteNacional} (${animal.nombre || animal.raza}) registra ${temp.toFixed(1)}°C — posible fiebre`,
          animalId: animal.id, nodoId: nodoIds[0],
          datos: { temperatura: temp, umbral: 40.0 },
        });
      }
      if (fueraGeocerca) {
        alertas.push({
          tipo: 'FUERA_GEOCERCA', severidad: 'ALTA',
          mensaje: `📍 ${animal.areteNacional} (${animal.nombre || animal.raza}) detectado fuera de geocerca en ${animal.upp?.municipio}`,
          animalId: animal.id, nodoId: nodoIds[1],
          datos: { latitud: baseLat + latVariacion, longitud: baseLng + lngVariacion },
        });
      }
    }

    // Alerta de batería baja en un nodo
    if (Math.random() < 0.2) {
      alertas.push({
        tipo: 'BATERIA_BAJA', severidad: 'MEDIA',
        mensaje: `🔋 Nodo ESP32-002 con batería al ${(5 + Math.random() * 10).toFixed(0)}%`,
        nodoId: 'ESP32-002', datos: { bateria: 8 },
      });
    }

    // Insertar todo en batch
    const [lecResult] = await Promise.all([
      prisma.lecturaIoT.createMany({ data: lecturas }),
      alertas.length > 0 ? prisma.alertaIoT.createMany({ data: alertas }) : Promise.resolve({ count: 0 }),
    ]);

    // Actualizar nodos
    for (const nId of nodoIds) {
      await prisma.nodoIoT.upsert({
        where: { nodoId: nId },
        update: { ultimaLectura: new Date(), bateria: 20 + Math.random() * 80 },
        create: { nodoId: nId, tipo: nId.startsWith('ESP') ? 'ESP32' : 'LORA', bateria: 80 + Math.random() * 20, activo: true },
      });
    }

    res.json({
      message: `Simulación completada: ${lecResult.count} lecturas, ${alertas.length} alertas generadas`,
      lecturas: lecResult.count, alertas: alertas.length,
    });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Error al simular' }); }
});

export default router;
