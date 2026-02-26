import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPropietarios } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, Users, MapPin, ShieldOff } from 'lucide-react';

const PropietariosPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [propietarios, setPropietarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getPropietarios({ buscar: buscar || undefined });
        setPropietarios(Array.isArray(res.data) ? res.data : res.data.data || []);
      } catch (e: any) {
        if (e.response?.status === 403) setDenied(true);
        console.error(e);
      }
      finally { setLoading(false); }
    };
    fetch();
  }, [buscar]);

  if (denied) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <ShieldOff size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Acceso restringido</h2>
        <p className="text-gray-500 mt-2">Solo los administradores pueden ver el listado de propietarios.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Propietarios</h1>
          <p className="text-gray-500 text-sm mt-1">{propietarios.length} propietarios registrados</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por nombre, CURP o municipio..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full text-center py-12 text-gray-400">Cargando...</div> :
        propietarios.length === 0 ? <div className="col-span-full text-center py-12 text-gray-400">No se encontraron propietarios</div> :
        propietarios.map((p: any) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                {p.nombre?.[0]}{p.apellidos?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{p.nombre} {p.apellidos}</h3>
                <div className="flex items-center gap-1 text-sm text-gray-500 mt-1"><MapPin size={14} /> {p.municipio}</div>
                {p.curp && <p className="text-xs text-gray-400 mt-1 font-mono">{p.curp}</p>}
                {p.telefono && <p className="text-xs text-gray-400">{p.telefono}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1 text-sm text-emerald-600 font-medium"><Users size={14} /> {p._count?.animales || 0} animales</div>
              <span className="text-xs text-gray-400">{p._count?.upps || 0} UPPs</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PropietariosPage;
