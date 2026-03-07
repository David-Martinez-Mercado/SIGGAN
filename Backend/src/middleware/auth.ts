import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'siggan-secret-key-2026';

export interface AuthRequest extends Request {
  userId?: string;
  userRol?: string;
  userEmail?: string;
  userName?: string;
  esSuperAdmin?: boolean;
  esPrimario?: boolean;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    // Token desde header o query param (para PDFs en nueva ventana)
    let token = req.headers.authorization?.replace('Bearer ', '') || (req.query.token as string);

    if (!token) {
      res.status(401).json({ error: 'Token requerido' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.userId = decoded.id;
    req.userRol = decoded.rol;
    req.userEmail = decoded.email;
    req.userName = decoded.nombre;
    req.esSuperAdmin = decoded.esSuperAdmin || false;
    req.esPrimario = decoded.esPrimario || false;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function requireRol(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRol) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    // SUPER_ADMIN tiene acceso a todo lo que ADMIN puede hacer
    const effectiveRoles = [...roles];
    if (roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN')) {
      effectiveRoles.push('SUPER_ADMIN');
    }

    if (!effectiveRoles.includes(req.userRol)) {
      res.status(403).json({ error: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}` });
      return;
    }
    next();
  };
}
