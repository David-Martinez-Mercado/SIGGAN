import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Bug, Users, MapPin, Syringe, Tags, Search, ShoppingCart, FileText, Radio, LogOut, Menu, X } from 'lucide-react';

const Sidebar: React.FC<{ isOpen: boolean; setIsOpen: (o: boolean) => void }> = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/animales', icon: Bug, label: 'Animales' },
    ...(user?.rol === 'ADMIN' ? [{ to: '/propietarios', icon: Users, label: 'Propietarios' }] : []),
    { to: '/upps', icon: MapPin, label: 'UPPs' },
    { to: '/eventos', icon: Syringe, label: 'Eventos Sanitarios' },
    { to: '/aretes', icon: Tags, label: 'Aretes' },
    { to: '/marketplace', icon: ShoppingCart, label: 'Marketplace' },
    { to: '/formularios', icon: FileText, label: 'SENASICA' },
    { to: '/iot', icon: Radio, label: 'IoT & Sensores' },
    { to: '/busqueda', icon: Search, label: 'Búsqueda' },
  ];

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsOpen(false)} />}
      <aside className={`fixed top-0 left-0 z-30 h-full w-64 bg-gray-900 text-white transform transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-0 flex flex-col`}>
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div><h1 className="text-xl font-bold text-emerald-400">🐄 SIGGAN</h1><p className="text-xs text-gray-400 mt-1">Gestión Ganadera Integral</p></div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden text-gray-400 hover:text-white"><X size={20} /></button>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} onClick={() => setIsOpen(false)} end={item.to === '/'}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-emerald-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
              <item.icon size={18} />{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold">{user?.nombre?.[0]}</div>
            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{user?.nombre} {user?.apellidos}</p><p className="text-xs text-gray-400">{user?.rol}</p></div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-400" title="Cerrar sesión"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>
    </>
  );
};

export const TopBar: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => (
  <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 lg:hidden">
    <button onClick={onMenuClick} className="text-gray-600 hover:text-gray-900"><Menu size={24} /></button>
    <h1 className="text-lg font-bold text-emerald-600">🐄 SIGGAN</h1>
  </header>
);

export default Sidebar;
