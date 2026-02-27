import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Bell, BellOff, Filter, ChevronRight } from 'lucide-react';

const sevColor: Record<string, string> = {
  BAJA: 'bg-blue-50 border-blue-200 text-blue-700',
  MEDIA: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  ALTA: 'bg-orange-50 border-orange-200 text-orange-700',
  CRITICA: 'bg-red-50 border-red-200 text-red-700',
};
const tipoColor: Record<string, string> = {
  IOT: 'bg-violet-100 text-violet-700', MARKETPLACE: 'bg-emerald-100 text-emerald-700',
  SENASICA: 'bg-blue-100 text-blue-700', SANITARIO: 'bg-red-100 text-red-700',
};

const NotificacionesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [noLeidas, setNoLeidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>('TODAS');

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/notificaciones');
      setNotifs(res.data.notificaciones || []);
      setTotal(res.data.total || 0);
      setNoLeidas(res.data.noLeidas || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchNotifs(); }, []);

  const marcarIoTLeida = async (id: string) => {
    try { await api.put(`/iot/alertas/${id}/leer`); fetchNotifs(); } catch (e) { /* */ }
  };

  const filtradas = filtro === 'TODAS' ? notifs : filtro === 'NO_LEIDAS' ? notifs.filter(n => !n.leida) : notifs.filter(n => n.tipo === filtro);
  const tipos = ['TODAS', 'NO_LEIDAS', 'IOT', 'MARKETPLACE', 'SENASICA', 'SANITARIO'];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔔 Notificaciones</h1>
          <p className="text-gray-500 text-sm mt-1">{noLeidas > 0 ? `${noLeidas} sin leer de ${total} total` : 'Todas al día'}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {tipos.map(t => (
          <button key={t} onClick={() => setFiltro(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filtro === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t === 'TODAS' ? 'Todas' : t === 'NO_LEIDAS' ? `Sin leer (${noLeidas})` : t}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? <div className="text-center text-gray-400 py-12">Cargando...</div> :
      filtradas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <BellOff size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">{filtro === 'NO_LEIDAS' ? 'No tienes notificaciones sin leer' : 'No hay notificaciones'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((n: any) => (
            <div key={n.id}
              className={`rounded-xl border p-4 transition cursor-pointer hover:shadow-sm ${n.leida ? 'bg-gray-50 border-gray-200 opacity-70' : sevColor[n.severidad] || 'bg-white border-gray-200'}`}
              onClick={() => navigate(n.accion)}>
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{n.icono}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{n.titulo}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tipoColor[n.tipo] || 'bg-gray-100 text-gray-600'}`}>{n.tipo}</span>
                    {!n.leida && <span className="w-2 h-2 rounded-full bg-red-500" />}
                  </div>
                  <p className="text-sm text-gray-600">{n.mensaje}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.fecha).toLocaleString('es-MX')}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!n.leida && n.tipo === 'IOT' && (
                    <button onClick={(e) => { e.stopPropagation(); marcarIoTLeida(n.id); }} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border rounded">Leída</button>
                  )}
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default NotificacionesPage;
