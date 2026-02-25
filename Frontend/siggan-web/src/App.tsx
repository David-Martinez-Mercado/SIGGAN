import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AnimalesPage from './pages/AnimalesPage';
import AnimalDetallePage from './pages/AnimalDetallePage';
import AnimalNuevoPage from './pages/AnimalNuevoPage';
import BusquedaPage from './pages/BusquedaPage';
import { PropietariosPage, UPPsPage, EventosPage, AretesPage } from './pages/PlaceholderPages';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="animales" element={<AnimalesPage />} />
            <Route path="animales/nuevo" element={<AnimalNuevoPage />} />
            <Route path="animales/:id" element={<AnimalDetallePage />} />
            <Route path="propietarios" element={<PropietariosPage />} />
            <Route path="upps" element={<UPPsPage />} />
            <Route path="eventos" element={<EventosPage />} />
            <Route path="aretes" element={<AretesPage />} />
            <Route path="busqueda" element={<BusquedaPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
