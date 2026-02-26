import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth';
import animalesRoutes from './routes/animales';
import propietariosRoutes from './routes/propietarios';
import uppsRoutes from './routes/upps';
import dashboardRoutes from './routes/dashboard';
import eventosRoutes from './routes/eventos';
import aretesRoutes from './routes/aretes';
import busquedaRoutes from './routes/busqueda';
import marketplaceRoutes from './routes/marketplace';
import swaggerRoutes from './routes/swagger';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SIGGAN API', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.use('/api/docs', swaggerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/animales', animalesRoutes);
app.use('/api/propietarios', propietariosRoutes);
app.use('/api/upps', uppsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/aretes', aretesRoutes);
app.use('/api/busqueda', busquedaRoutes);
app.use('/api/marketplace', marketplaceRoutes);

app.use(errorHandler);
app.use((req, res) => { res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` }); });

app.listen(PORT, () => {
  console.log(`\n  🐄 SIGGAN API v1.0.0 | Puerto: ${PORT}\n  API: http://localhost:${PORT}/api/health\n  Docs: http://localhost:${PORT}/api/docs\n`);
});

export default app;
