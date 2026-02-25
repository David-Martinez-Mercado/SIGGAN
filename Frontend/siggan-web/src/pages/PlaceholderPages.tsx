import React from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description?: string;
}

const PlaceholderPage: React.FC<PlaceholderProps> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center h-64 text-center">
    <Construction size={48} className="text-gray-300 mb-4" />
    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    <p className="text-gray-500 mt-2">{description || 'Esta sección se completará próximamente.'}</p>
  </div>
);

export const PropietariosPage = () => <PlaceholderPage title="Propietarios" description="Gestión de propietarios — se conectará en el Día 5" />;
export const UPPsPage = () => <PlaceholderPage title="UPPs" description="Unidades de Producción Pecuaria — se conectará en el Día 5" />;
export const EventosPage = () => <PlaceholderPage title="Eventos Sanitarios" description="Vacunaciones, pruebas TB/BR — se conectará en el Día 5" />;
export const AretesPage = () => <PlaceholderPage title="Gestión de Aretes" description="Historial y transferencias — se conectará en el Día 5" />;
