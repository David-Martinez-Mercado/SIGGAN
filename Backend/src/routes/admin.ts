import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { authMiddleware, AuthRequest, requireRol } from '../middleware/auth';

const router = Router();

// Middleware: solo ADMIN o SUPER_ADMIN
const adminOnly = [authMiddleware, requireRol('ADMIN', 'SUPER_ADMIN')];
const superOnly = [authMiddleware, requireRol('SUPER_ADMIN')];

// Helper para obtener info del solicitante
async function getSolicitante(userId: string) {
  return prisma.usuario.findUnique({
    where: { id: userId },
    select: { id: true, rol: true, esSuperAdmin: true, esPrimario: true },
  });
}

// GET /api/admin/pendientes - Usuarios pendientes de aprobación
router.get('/pendientes', ...adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const pendientes = await prisma.usuario.findMany({
      where: { estatus: 'PENDIENTE' },
      select: {
        id: true, email: true, nombre: true, apellidos: true, rol: true,
        telefono: true, rfc: true, curp: true, direccion: true, municipio: true,
        cedulaProfesional: true, credencialSenasica: true, vigenciaCredencial: true, ddr: true,
        createdAt: true, estatus: true,
        documentos: { select: { id: true, tipo: true, nombreArchivo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ total: pendientes.length, pendientes });
  } catch (error) { res.status(500).json({ error: 'Error al obtener pendientes' }); }
});

// GET /api/admin/usuarios - Todos los usuarios
router.get('/usuarios', ...adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { rol, estatus, buscar } = req.query;
    const where: any = {};
    if (rol) where.rol = rol;
    if (estatus) where.estatus = estatus;
    if (buscar) {
      where.OR = [
        { nombre: { contains: buscar as string, mode: 'insensitive' } },
        { apellidos: { contains: buscar as string, mode: 'insensitive' } },
        { email: { contains: buscar as string, mode: 'insensitive' } },
        { curp: { contains: buscar as string, mode: 'insensitive' } },
      ];
    }

    const usuarios = await prisma.usuario.findMany({
      where,
      select: {
        id: true, email: true, nombre: true, apellidos: true, rol: true,
        telefono: true, rfc: true, curp: true, municipio: true, estatus: true,
        esSuperAdmin: true, esPrimario: true, createdAt: true,
        cedulaProfesional: true, credencialSenasica: true, ddr: true,
        motivoSuspension: true, tipoSuspension: true, suspendidoAt: true,
        documentos: { select: { id: true, tipo: true, nombreArchivo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ total: usuarios.length, usuarios });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

// POST /api/admin/usuarios/:id/aprobar
router.post('/usuarios/:id/aprobar', ...adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
    if (usuario.estatus !== 'PENDIENTE') { res.status(400).json({ error: `No se puede aprobar: estatus actual es ${usuario.estatus}` }); return; }

    const actualizado = await prisma.usuario.update({
      where: { id },
      data: { estatus: 'ACTIVO', activo: true },
    });

    // Si es PRODUCTOR, crear automáticamente su registro de Propietario
    if (actualizado.rol === 'PRODUCTOR') {
      const existePropietario = await prisma.propietario.findFirst({ where: { usuarioId: id } });
      if (!existePropietario) {
        await prisma.propietario.create({
          data: {
            nombre: actualizado.nombre,
            apellidos: actualizado.apellidos,
            email: actualizado.email,
            curp: actualizado.curp,
            rfc: actualizado.rfc,
            telefono: actualizado.telefono,
            direccion: actualizado.direccion,
            municipio: actualizado.municipio || 'Durango',
            estado: actualizado.estado || 'Durango',
            usuarioId: id,
          },
        });
      }
    }

    res.json({
      success: true,
      mensaje: `Usuario ${actualizado.nombre} ${actualizado.apellidos} aprobado como ${actualizado.rol}`,
      usuario: { id: actualizado.id, nombre: actualizado.nombre, rol: actualizado.rol, estatus: actualizado.estatus },
    });
  } catch (error: any) { console.error(error); res.status(500).json({ error: 'Error al aprobar' }); }
});

// POST /api/admin/usuarios/:id/suspender
router.post('/usuarios/:id/suspender', ...adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { motivo, tipo } = req.body;  // tipo: TEMPORAL | DEFINITIVO

    if (!motivo || motivo.length < 10) {
      res.status(400).json({ error: 'Se requiere un motivo de suspensión (mínimo 10 caracteres)' }); return;
    }
    if (!tipo || !['TEMPORAL', 'DEFINITIVO'].includes(tipo)) {
      res.status(400).json({ error: 'Se requiere tipo: TEMPORAL o DEFINITIVO' }); return;
    }

    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

    // No se puede suspender a un Super Admin Primario
    if (usuario.esPrimario) {
      res.status(403).json({ error: 'No se puede suspender al Super Admin Primario' }); return;
    }

    // Solo Super Admin puede suspender a otros admins
    const solicitante = await getSolicitante(req.userId!);
    if ((usuario.rol === 'ADMIN' || usuario.rol === 'SUPER_ADMIN') && !solicitante?.esSuperAdmin) {
      res.status(403).json({ error: 'Solo un Super Admin puede suspender a otro administrador' }); return;
    }

    const estatus = tipo === 'DEFINITIVO' ? 'SUSPENDIDO_DEFINITIVO' : 'SUSPENDIDO_TEMPORAL';

    await prisma.usuario.update({
      where: { id },
      data: {
        estatus,
        activo: false,
        motivoSuspension: motivo,
        tipoSuspension: tipo,
        suspendidoAt: new Date(),
        suspendidoPorId: req.userId,
      },
    });

    // TODO: enviar correo de notificación con motivo

    res.json({
      success: true,
      mensaje: `Usuario ${usuario.nombre} suspendido (${tipo.toLowerCase()}). Motivo: ${motivo}`,
    });
  } catch (error: any) { console.error(error); res.status(500).json({ error: 'Error al suspender' }); }
});

// POST /api/admin/usuarios/:id/reactivar
router.post('/usuarios/:id/reactivar', ...adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

    if (usuario.estatus === 'SUSPENDIDO_DEFINITIVO') {
      res.status(400).json({ error: 'No se puede reactivar un usuario con suspensión definitiva' }); return;
    }
    if (usuario.estatus !== 'SUSPENDIDO_TEMPORAL') {
      res.status(400).json({ error: `No se puede reactivar: estatus actual es ${usuario.estatus}` }); return;
    }

    await prisma.usuario.update({
      where: { id },
      data: {
        estatus: 'ACTIVO',
        activo: true,
        motivoSuspension: null,
        tipoSuspension: null,
        suspendidoAt: null,
        suspendidoPorId: null,
      },
    });

    res.json({ success: true, mensaje: `Usuario ${usuario.nombre} reactivado` });
  } catch (error: any) { res.status(500).json({ error: 'Error al reactivar' }); }
});

// POST /api/admin/crear-admin - Solo Super Admin
router.post('/crear-admin', ...superOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, nombre, apellidos, telefono } = req.body;
    if (!email || !password || !nombre || !apellidos) {
      res.status(400).json({ error: 'Campos requeridos: email, password, nombre, apellidos' }); return;
    }

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) { res.status(409).json({ error: 'Email ya registrado' }); return; }

    const solicitante = await getSolicitante(req.userId!);

    const hash = await bcrypt.hash(password, 10);
    const admin = await prisma.usuario.create({
      data: {
        email, password: hash, nombre, apellidos, telefono,
        rol: 'ADMIN',
        estatus: 'ACTIVO',  // Admins creados por Super Admin se activan automáticamente
        activo: true,
        creadoPorId: req.userId,
      },
    });

    res.status(201).json({
      success: true,
      mensaje: `Admin ${nombre} ${apellidos} creado y activado`,
      admin: { id: admin.id, email: admin.email, nombre: admin.nombre, rol: admin.rol, estatus: admin.estatus },
    });
  } catch (error: any) { console.error(error); res.status(500).json({ error: 'Error al crear admin' }); }
});

// POST /api/admin/crear-super-admin - Solo Super Admin Primario
router.post('/crear-super-admin', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const solicitante = await getSolicitante(req.userId!);
    if (!solicitante?.esPrimario) {
      res.status(403).json({ error: 'Solo el Super Admin Primario puede crear otros Super Admins' }); return;
    }

    const { email, password, nombre, apellidos, telefono } = req.body;
    if (!email || !password || !nombre || !apellidos) {
      res.status(400).json({ error: 'Campos requeridos' }); return;
    }

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) { res.status(409).json({ error: 'Email ya registrado' }); return; }

    const hash = await bcrypt.hash(password, 10);
    const superAdmin = await prisma.usuario.create({
      data: {
        email, password: hash, nombre, apellidos, telefono,
        rol: 'SUPER_ADMIN',
        estatus: 'ACTIVO',
        activo: true,
        esSuperAdmin: true,
        creadoPorId: req.userId,
      },
    });

    res.status(201).json({
      success: true,
      mensaje: `Super Admin ${nombre} creado`,
      admin: { id: superAdmin.id, email: superAdmin.email, nombre: superAdmin.nombre, rol: superAdmin.rol },
    });
  } catch (error: any) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

// DELETE /api/admin/admins/:id - Solo Super Admin Primario
router.delete('/admins/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const solicitante = await getSolicitante(req.userId!);
    if (!solicitante?.esPrimario) {
      res.status(403).json({ error: 'Solo el Super Admin Primario puede eliminar cuentas de administrador' }); return;
    }

    const { id } = req.params;
    const admin = await prisma.usuario.findUnique({ where: { id } });
    if (!admin) { res.status(404).json({ error: 'No encontrado' }); return; }
    if (admin.esPrimario) { res.status(403).json({ error: 'No se puede eliminar al Super Admin Primario' }); return; }
    if (admin.rol !== 'ADMIN' && admin.rol !== 'SUPER_ADMIN') {
      res.status(400).json({ error: 'Solo se pueden eliminar cuentas de tipo ADMIN o SUPER_ADMIN' }); return;
    }

    // No eliminar, solo suspender definitivamente (nunca se borran datos)
    await prisma.usuario.update({
      where: { id },
      data: {
        estatus: 'SUSPENDIDO_DEFINITIVO',
        activo: false,
        motivoSuspension: 'Cuenta eliminada por Super Admin Primario',
        tipoSuspension: 'DEFINITIVO',
        suspendidoAt: new Date(),
        suspendidoPorId: req.userId,
      },
    });

    res.json({ success: true, mensaje: `Admin ${admin.nombre} eliminado (suspensión definitiva)` });
  } catch (error: any) { console.error(error); res.status(500).json({ error: 'Error' }); }
});

export default router;
