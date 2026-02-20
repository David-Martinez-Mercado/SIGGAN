import { Router, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/busqueda?q=texto - Búsqueda global
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || (q as string).length < 2) {
      res.status(400).json({ error: 'Búsqueda debe tener al menos 2 caracteres' });
      return;
    }

    const termino = q as string;

    const [animales, propietarios, upps] = await Promise.all([
      prisma.animal.findMany({
        where: {
          activo: true,
          OR: [
            { areteNacional: { contains: termino, mode: 'insensitive' } },
            { areteExportacion: { contains: termino, mode: 'insensitive' } },
            { rfidTag: { contains: termino, mode: 'insensitive' } },
            { nombre: { contains: termino, mode: 'insensitive' } },
            { raza: { contains: termino, mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: {
          id: true,
          areteNacional: true,
          nombre: true,
          raza: true,
          sexo: true,
          estatusSanitario: true,
          propietario: { select: { nombre: true, apellidos: true } },
          upp: { select: { claveUPP: true, nombre: true, municipio: true } },
        },
      }),
      prisma.propietario.findMany({
        where: {
          OR: [
            { nombre: { contains: termino, mode: 'insensitive' } },
            { apellidos: { contains: termino, mode: 'insensitive' } },
            { curp: { contains: termino, mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          municipio: true,
          _count: { select: { animales: true } },
        },
      }),
      prisma.uPP.findMany({
        where: {
          activa: true,
          OR: [
            { claveUPP: { contains: termino, mode: 'insensitive' } },
            { nombre: { contains: termino, mode: 'insensitive' } },
            { municipio: { contains: termino, mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: {
          id: true,
          claveUPP: true,
          nombre: true,
          municipio: true,
          estatusSanitario: true,
          _count: { select: { animales: true } },
        },
      }),
    ]);

    res.json({
      termino,
      resultados: {
        animales: { data: animales, total: animales.length },
        propietarios: { data: propietarios, total: propietarios.length },
        upps: { data: upps, total: upps.length },
      },
      totalResultados: animales.length + propietarios.length + upps.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en la búsqueda' });
  }
});

// GET /api/busqueda/estadisticas/municipio - Stats por municipio
router.get('/estadisticas/municipio', async (req: AuthRequest, res: Response) => {
  try {
    const porMunicipio = await prisma.uPP.groupBy({
      by: ['municipio'],
      where: { activa: true },
      _count: true,
    });

    // Contar animales por municipio a través de UPP
    const animalesPorMunicipio = await prisma.animal.findMany({
      where: { activo: true },
      select: {
        upp: { select: { municipio: true } },
      },
    });

    const conteo: Record<string, number> = {};
    animalesPorMunicipio.forEach(a => {
      const mun = a.upp.municipio;
      conteo[mun] = (conteo[mun] || 0) + 1;
    });

    const estadisticas = porMunicipio.map(m => ({
      municipio: m.municipio,
      upps: m._count,
      animales: conteo[m.municipio] || 0,
    }));

    res.json(estadisticas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// GET /api/busqueda/estadisticas/razas - Distribución por raza
router.get('/estadisticas/razas', async (req: AuthRequest, res: Response) => {
  try {
    const porRaza = await prisma.animal.groupBy({
      by: ['raza'],
      where: { activo: true },
      _count: true,
      orderBy: { _count: { raza: 'desc' } },
    });

    res.json(porRaza.map(r => ({
      raza: r.raza,
      total: r._count,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

export default router;
