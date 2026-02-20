import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth';
import animalesRoutes from './routes/animales';
import propietariosRoutes from './routes/propietarios';
import uppsRoutes from './routes/upps';
import dashboardRoutes from './routes/dashboard';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'SIGGAN API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/animales', animalesRoutes);
app.use('/api/propietarios', propietariosRoutes);
app.use('/api/upps', uppsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Manejo de errores
app.use(errorHandler);

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║     🐄 SIGGAN API v1.0.0            ║
  ║     Puerto: ${PORT}                    ║
  ║     http://localhost:${PORT}/api/health ║
  ╚══════════════════════════════════════╝
  `);
});

export default app;
