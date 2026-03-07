import { Router, Response, Request } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'siggan-secret-key-2026';

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: 'Email y contraseña requeridos' }); return; }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) { res.status(401).json({ error: 'Credenciales inválidas' }); return; }

    const valid = await bcrypt.compare(password, usuario.password);
    if (!valid) { res.status(401).json({ error: 'Credenciales inválidas' }); return; }

    // Verificar estatus
    if (usuario.estatus === 'PENDIENTE') {
      res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación por un administrador' }); return;
    }
    if (usuario.estatus === 'SUSPENDIDO_TEMPORAL' || usuario.estatus === 'SUSPENDIDO_DEFINITIVO') {
      res.status(403).json({
        error: `Tu cuenta ha sido suspendida${usuario.tipoSuspension === 'DEFINITIVO' ? ' definitivamente' : ' temporalmente'}`,
        motivo: usuario.motivoSuspension,
      }); return;
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol, nombre: usuario.nombre, apellidos: usuario.apellidos, esSuperAdmin: usuario.esSuperAdmin, esPrimario: usuario.esPrimario },
      JWT_SECRET, { expiresIn: '24h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id, email: usuario.email, nombre: usuario.nombre,
        apellidos: usuario.apellidos, rol: usuario.rol, estatus: usuario.estatus,
        esSuperAdmin: usuario.esSuperAdmin, esPrimario: usuario.esPrimario,
      },
    });
  } catch (error: any) { console.error(error); res.status(500).json({ error: 'Error en login' }); }
});

// POST /api/auth/registro/agricultor - Registro público
router.post('/registro/agricultor', async (req: Request, res: Response) => {
  try {
    const { email, password, nombre, apellidos, telefono, rfc, curp, direccion, municipio, estado } = req.body;

    if (!email || !password || !nombre || !apellidos) {
      res.status(400).json({ error: 'Campos requeridos: email, password, nombre, apellidos' }); return;
    }
    if (password.length < 6) { res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' }); return; }

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) { res.status(409).json({ error: 'Este email ya está registrado' }); return; }

    if (curp) {
      const existeCurp = await prisma.usuario.findFirst({ where: { curp } });
      if (existeCurp) { res.status(409).json({ error: 'Este CURP ya está registrado' }); return; }
    }

    const hash = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: {
        email, password: hash, nombre, apellidos, telefono,
        rfc, curp, direccion, municipio, estado: estado || 'Durango',
        rol: 'PRODUCTOR',
        estatus: 'PENDIENTE',  // Requiere aprobación
      },
    });

    res.status(201).json({
      success: true,
      mensaje: 'Registro exitoso. Tu cuenta está pendiente de aprobación por un administrador.',
      usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, estatus: usuario.estatus },
    });
  } catch (error: any) { console.error(error); res.status(500).json({ error: 'Error en registro' }); }
});

// POST /api/auth/registro/medico - Registro público de MVZ
router.post('/registro/medico', async (req: Request, res: Response) => {
  try {
    const { email, password, nombre, apellidos, telefono, rfc, cedulaProfesional, credencialSenasica, vigenciaCredencial, ddr } = req.body;

    if (!email || !password || !nombre || !apellidos) {
      res.status(400).json({ error: 'Campos requeridos: email, password, nombre, apellidos' }); return;
    }
    if (!cedulaProfesional) { res.status(400).json({ error: 'Se requiere número de cédula profesional' }); return; }
    if (password.length < 6) { res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' }); return; }

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) { res.status(409).json({ error: 'Este email ya está registrado' }); return; }

    const hash = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: {
        email, password: hash, nombre, apellidos, telefono, rfc,
        cedulaProfesional, credencialSenasica,
        vigenciaCredencial: vigenciaCredencial ? new Date(vigenciaCredencial) : null,
        ddr,
        rol: 'MVZ',
        estatus: 'PENDIENTE',  // Requiere aprobación
      },
    });

    res.status(201).json({
      success: true,
      mensaje: 'Registro exitoso. Tu cuenta está pendiente de aprobación por un administrador.',
      usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, estatus: usuario.estatus },
    });
  } catch (error: any) { console.error(error); res.status(500).json({ error: 'Error en registro' }); }
});

// GET /api/auth/perfil
router.get('/perfil', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.userId },
      select: {
        id: true, email: true, nombre: true, apellidos: true, rol: true, telefono: true,
        estatus: true, rfc: true, curp: true, direccion: true, municipio: true, estado: true,
        cedulaProfesional: true, credencialSenasica: true, vigenciaCredencial: true, ddr: true,
        esSuperAdmin: true, esPrimario: true, createdAt: true,
        documentos: { select: { id: true, tipo: true, nombreArchivo: true, createdAt: true } },
      },
    });
    if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
    res.json(usuario);
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

export default router;
