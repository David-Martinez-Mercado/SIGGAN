import { Router, Response } from 'express';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

async function getMiPropietarioId(userId: string): Promise<string | null> {
  const prop = await prisma.propietario.findFirst({
    where: { usuarioId: userId }, select: { id: true },
  });
  return prop?.id || null;
}

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
          id: true, areteNacional: true, areteExportacion: true, nombre: true,
          raza: true, sexo: true, estatusSanitario: true,
          propietario: { select: { nombre: true, apellidos: true, municipio: true, telefono: true } },
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
        select: { id: true, nombre: true, apellidos: true, municipio: true, _count: { select: { animales: true } } },
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
        select: { id: true, claveUPP: true, nombre: true, municipio: true, estatusSanitario: true, _count: { select: { animales: true } } },
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

// GET /api/busqueda/historial/:arete - Historial completo por arete (público para compradores)
router.get('/historial/:arete', async (req: AuthRequest, res: Response) => {
  try {
    const animal = await prisma.animal.findFirst({
      where: {
        OR: [
          { areteNacional: req.params.arete },
          { areteExportacion: req.params.arete },
          { rfidTag: req.params.arete },
        ],
      },
      select: {
        id: true, areteNacional: true, areteExportacion: true, rfidTag: true,
        nombre: true, raza: true, sexo: true, color: true, peso: true,
        fechaNacimiento: true, estatusSanitario: true, proposito: true,
        propietario: { select: { nombre: true, apellidos: true, municipio: true, telefono: true } },
        upp: { select: { claveUPP: true, nombre: true, municipio: true, estatusSanitario: true } },
        eventos: {
          orderBy: { fecha: 'desc' },
          select: {
            tipo: true, descripcion: true, fecha: true, resultado: true,
            mvzResponsable: true, observaciones: true, lote: true,
          },
        },
        aretes: {
          orderBy: { fecha: 'desc' },
          select: { tipoArete: true, numeroArete: true, accion: true, motivo: true, fecha: true },
        },
      },
    });

    if (!animal) {
      res.status(404).json({ error: 'No se encontró animal con ese identificador' });
      return;
    }

    // Resumen de salud
    const pruebasTB = animal.eventos.filter(e => e.tipo === 'PRUEBA_TB');
    const pruebasBR = animal.eventos.filter(e => e.tipo === 'PRUEBA_BR');
    const vacunas = animal.eventos.filter(e => e.tipo === 'VACUNACION');

    res.json({
      animal,
      resumenSalud: {
        estatusActual: animal.estatusSanitario,
        totalPruebasTB: pruebasTB.length,
        ultimaPruebaTB: pruebasTB[0] || null,
        totalPruebasBR: pruebasBR.length,
        ultimaPruebaBR: pruebasBR[0] || null,
        totalVacunas: vacunas.length,
        ultimaVacuna: vacunas[0] || null,
        totalEventos: animal.eventos.length,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// GET /api/busqueda/estadisticas/municipio - Filtrado por propietario
router.get('/estadisticas/municipio', async (req: AuthRequest, res: Response) => {
  try {
    const animalWhere: any = { activo: true };

    if (req.userRol === 'PRODUCTOR') {
      const miId = await getMiPropietarioId(req.userId!);
      if (miId) animalWhere.propietarioId = miId;
    }

    const animales = await prisma.animal.findMany({
      where: animalWhere,
      select: { upp: { select: { municipio: true } } },
    });

    const conteo: Record<string, number> = {};
    animales.forEach(a => {
      conteo[a.upp.municipio] = (conteo[a.upp.municipio] || 0) + 1;
    });

    const estadisticas = Object.entries(conteo).map(([municipio, animales]) => ({ municipio, animales }));
    res.json(estadisticas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// GET /api/busqueda/estadisticas/razas - Filtrado por propietario
router.get('/estadisticas/razas', async (req: AuthRequest, res: Response) => {
  try {
    const animalWhere: any = { activo: true };

    if (req.userRol === 'PRODUCTOR') {
      const miId = await getMiPropietarioId(req.userId!);
      if (miId) animalWhere.propietarioId = miId;
    }

    const porRaza = await prisma.animal.groupBy({
      by: ['raza'], where: animalWhere, _count: true,
      orderBy: { _count: { raza: 'desc' } },
    });

    res.json(porRaza.map(r => ({ raza: r.raza, total: r._count })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

export default router;
