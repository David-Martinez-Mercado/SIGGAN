import React, { useEffect, useState } from 'react';
import { getUPPs } from '../services/api';
import { Search, MapPin, Shield, Bug } from 'lucide-react';

const estatusColor: Record<string, string> = {
  LIBRE: 'bg-green-100 text-green-800',
  EN_PROCESO: 'bg-yellow-100 text-yellow-800',
  CUARENTENADO: 'bg-red-100 text-red-800',
};

const UPPsPage: React.FC = () => {
  const [upps, setUpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getUPPs({ buscar: buscar || undefined });
        setUpps(Array.isArray(res.data) ? res.data : res.data.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, [buscar]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unidades de Producción Pecuaria</h1>
          <p className="text-gray-500 text-sm mt-1">{upps.length} UPPs registradas</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por clave UPP, nombre o municipio..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-400">Cargando...</div>
        ) : upps.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">No se encontraron UPPs</div>
        ) : (
          upps.map((u: any) => (
            <div key={u.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{u.nombre}</h3>
                  <p className="text-emerald-600 font-mono text-sm">{u.claveUPP}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${estatusColor[u.estatusSanitario] || 'bg-gray-100 text-gray-800'}`}>
                  {u.estatusSanitario}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-gray-400" />
                  <span>{u.municipio}</span>
                </div>
                {u.direccion && <p className="text-xs text-gray-400 ml-5">{u.direccion}</p>}
                {u.tipoExplotacion && (
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-gray-400" />
                    <span>{u.tipoExplotacion}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <Bug size={14} /> {u._count?.animales || 0} animales
                  </span>
                  {u.superficieHa && <span className="text-gray-400">{u.superficieHa} ha</span>}
                  {u.capacidadAnimales && <span className="text-gray-400">Cap: {u.capacidadAnimales}</span>}
                </div>
                {u.propietario && (
                  <span className="text-xs text-gray-400">{u.propietario.nombre} {u.propietario.apellidos}</span>
                )}
              </div>

              {u.latitud && u.longitud && (
                <p className="text-xs text-gray-300 mt-2 font-mono">📍 {u.latitud.toFixed(4)}, {u.longitud.toFixed(4)}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UPPsPage;
