import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AnimalesPage from './pages/AnimalesPage';
import AnimalDetallePage from './pages/AnimalDetallePage';
import AnimalNuevoPage from './pages/AnimalNuevoPage';
import PropietariosPage from './pages/PropietariosPage';
import UPPsPage from './pages/UPPsPage';
import EventosPage from './pages/EventosPage';
import AretesPage from './pages/AretesPage';
import MarketplacePage from './pages/MarketplacePage';
import FormulariosPage from './pages/FormulariosPage';
import IoTPage from './pages/IoTPage';
import NotificacionesPage from './pages/NotificacionesPage';
import BiometriaPage from './pages/BiometriaPage';
import TrazabilidadPage from './pages/TrazabilidadPage';
import BusquedaPage from './pages/BusquedaPage';
import RegistroPage from './pages/RegistroPage';
import AdminUsuariosPage from './pages/AdminUsuariosPage';

const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Trazabilidad es pública - sin Layout/login */}
        <Route path="/trazabilidad/:arete" element={<TrazabilidadPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/" element={<Layout />}>
          <Route path="admin/usuarios" element={<AdminUsuariosPage />} />
          <Route index element={<DashboardPage />} />
          <Route path="animales" element={<AnimalesPage />} />
          <Route path="animales/nuevo" element={<AnimalNuevoPage />} />
          <Route path="animales/:id" element={<AnimalDetallePage />} />
          <Route path="propietarios" element={<PropietariosPage />} />
          <Route path="upps" element={<UPPsPage />} />
          <Route path="eventos" element={<EventosPage />} />
          <Route path="aretes" element={<AretesPage />} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="formularios" element={<FormulariosPage />} />
          <Route path="iot" element={<IoTPage />} />
          <Route path="notificaciones" element={<NotificacionesPage />} />
          <Route path="biometria" element={<BiometriaPage />} />
          <Route path="busqueda" element={<BusquedaPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
