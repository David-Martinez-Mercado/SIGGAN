import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error('Error:', err);

  if (err.code === 'P2002') {
    // Prisma unique constraint violation
    const field = err.meta?.target?.[0] || 'campo';
    res.status(409).json({ error: `Ya existe un registro con ese ${field}` });
    return;
  }

  if (err.code === 'P2025') {
    res.status(404).json({ error: 'Registro no encontrado' });
    return;
  }

  if (err.name === 'ZodError') {
    res.status(400).json({ error: 'Datos inválidos', detalles: err.errors });
    return;
  }

  res.status(500).json({ error: 'Error interno del servidor' });
};
