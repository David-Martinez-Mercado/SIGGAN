import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Thermometer, MapPin, Bell, BellOff, Radio, Wifi, AlertTriangle, Play, Heart, Activity, Wind } from 'lucide-react';
import api from '../services/api';

const severidadColor: Record<string, string> = {
  BAJA:   'bg-blue-100 text-blue-700 border-blue-200',
  MEDIA:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  ALTA:   'bg-orange-100 text-orange-700 border-orange-200',
  CRITICA:'bg-red-100 text-red-700 border-red-200',
};

const actividadColor: Record<string, string> = {
  reposo:    'bg-blue-100 text-blue-700',
  caminando: 'bg-emerald-100 text-emerald-700',
  comiendo:  'bg-amber-100 text-amber-700',
  corriendo: 'bg-red-100 text-red-700',
};

const actividadEmoji: Record<string, string> = {
  reposo: '😴', caminando: '🚶', comiendo: '🌿', corriendo: '🏃',
};

const IoTPage: React.FC = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<any>(null);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [lecturas, setLecturas] = useState<any[]>([]);
  const [nodos, setNodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'dashboard' | 'lecturas' | 'alertas' | 'nodos'>('dashboard');
  const [msg, setMsg] = useState('');
  const [simulando, setSimulando] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dashRes, alertRes, lecRes, nodosRes] = await Promise.all([
        api.get('/iot/dashboard'),
        api.get('/iot/alertas?limit=30'),
        api.get('/iot/lecturas?limit=50'),
        api.get('/iot/nodos'),
      ]);
      setDashboard(dashRes.data);
      setAlertas(alertRes.data || []);
      setLecturas(lecRes.data || []);
      setNodos(nodosRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const simular = async () => {
    setSimulando(true); setMsg('');
    try {
      const res = await api.post('/iot/simular');
      setMsg(res.data.message); fetchAll();
    } catch (e: any) { setMsg(e.response?.data?.error || 'Error'); }
    finally { setSimulando(false); }
  };

  const marcarLeida = async (id: string) => {
    try { await api.put(`/iot/alertas/${id}/leer`); fetchAll(); }
    catch (e) { console.error(e); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando sensores...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📡 IoT & Sensores</h1>
          <p className="text-gray-500 text-sm mt-1">Monitoreo en tiempo real de la red LoRa/Mesh</p>
        </div>
        {user?.rol === 'ADMIN' && (
          <button onClick={simular} disabled={simulando}
            className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50">
            <Play size={16} /> {simulando ? 'Simulando...' : 'Simular Lecturas'}
          </button>
        )}
      </div>

      {msg && <div className="bg-violet-50 border border-violet-200 text-violet-700 px-4 py-3 rounded-lg text-sm mb-4">{msg}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center"><Radio size={20} className="text-violet-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{dashboard?.nodosActivos || 0}</p><p className="text-xs text-gray-500">Nodos activos</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center"><Thermometer size={20} className="text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{dashboard?.temperatura?.promedio?.toFixed(1) || '—'}°C</p><p className="text-xs text-gray-500">Temp. promedio</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Wifi size={20} className="text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{dashboard?.totalLecturas || 0}</p><p className="text-xs text-gray-500">Lecturas totales</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(dashboard?.alertasNoLeidas || 0) > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
              <Bell size={20} className={(dashboard?.alertasNoLeidas || 0) > 0 ? 'text-red-600' : 'text-green-600'} />
            </div>
            <div><p className="text-2xl font-bold text-gray-900">{dashboard?.alertasNoLeidas || 0}</p><p className="text-xs text-gray-500">Alertas sin leer</p></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['dashboard', 'lecturas', 'alertas', 'nodos'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${tab===t?'bg-violet-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t === 'alertas' ? `⚠️ Alertas (${alertas.filter(a => !a.leida).length})` : t === 'lecturas' ? '📊 Lecturas' : t === 'nodos' ? '📡 Nodos' : '📈 Resumen'}
          </button>
        ))}
      </div>

      {/* ── Dashboard tab ─────────────────────────────────────────── */}
      {tab === 'dashboard' && dashboard?.ultimasLecturas && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4">Últimas Lecturas</h3>
            <div className="space-y-2">
              {dashboard.ultimasLecturas.map((l: any) => (
                <div key={l.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg">
                  {/* Izquierda: animal + vitales */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-base font-bold ${(l.temperatura || 0) > 40 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {l.temperatura?.toFixed(1)}°C
                    </span>
                    <span className="font-mono text-sm text-gray-700">{l.animal?.areteNacional}</span>
                    {l.animal?.nombre && <span className="text-sm text-gray-500">{l.animal.nombre}</span>}
                    {/* Actividad pill */}
                    {l.actividad && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actividadColor[l.actividad] || 'bg-gray-100 text-gray-600'}`}>
                        {actividadEmoji[l.actividad]} {l.actividad}
                      </span>
                    )}
                    {/* Vitales */}
                    {l.ritmoCardiaco && (
                      <span className="flex items-center gap-1 text-xs text-pink-600">
                        <Heart size={11} /> {l.ritmoCardiaco} BPM
                      </span>
                    )}
                    {l.estres !== null && l.estres !== undefined && (
                      <span className={`flex items-center gap-1 text-xs ${l.estres > 75 ? 'text-orange-600 font-semibold' : 'text-gray-500'}`}>
                        <Activity size={11} /> {l.estres}% estrés
                      </span>
                    )}
                    {l.saturacionO2 && (
                      <span className="flex items-center gap-1 text-xs text-sky-600">
                        <Wind size={11} /> {l.saturacionO2}% O₂
                      </span>
                    )}
                  </div>
                  {/* Derecha: GPS + nodo + hora */}
                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin size={12} />{l.latitud?.toFixed(4)}, {l.longitud?.toFixed(4)}</span>
                    <span>{l.nodoId}</span>
                    <span>{new Date(l.timestamp).toLocaleTimeString('es-MX')}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Rango temp */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Rango de temperaturas</h4>
              <div className="flex gap-8 text-sm">
                <span>Min: <strong className="text-blue-600">{dashboard.temperatura?.min?.toFixed(1)}°C</strong></span>
                <span>Promedio: <strong className="text-emerald-600">{dashboard.temperatura?.promedio?.toFixed(1)}°C</strong></span>
                <span>Max: <strong className={`${(dashboard.temperatura?.max || 0) > 40 ? 'text-red-600' : 'text-orange-600'}`}>{dashboard.temperatura?.max?.toFixed(1)}°C</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Lecturas tab ───────────────────────────────────────────── */}
      {tab === 'lecturas' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Animal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Temp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actividad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">BPM</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estrés</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">O₂</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Coordenadas</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nodo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">RSSI</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Bat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lecturas.map((l: any) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-emerald-600">{l.animal?.areteNacional}</span>
                    <span className="text-xs text-gray-400 block">{l.animal?.nombre}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${(l.temperatura || 0) > 40 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {l.temperatura?.toFixed(1)}°C
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {l.actividad
                      ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actividadColor[l.actividad] || 'bg-gray-100 text-gray-600'}`}>
                          {actividadEmoji[l.actividad]} {l.actividad}
                        </span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {l.ritmoCardiaco
                      ? <span className="flex items-center gap-1 text-sm text-pink-600"><Heart size={12} /> {l.ritmoCardiaco}</span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {l.estres !== null && l.estres !== undefined
                      ? <div className="flex items-center gap-1.5">
                          <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${l.estres > 75 ? 'bg-orange-500' : l.estres > 50 ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                              style={{ width: `${l.estres}%` }} />
                          </div>
                          <span className={`text-xs ${l.estres > 75 ? 'text-orange-600 font-semibold' : 'text-gray-500'}`}>{l.estres}%</span>
                        </div>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {l.saturacionO2
                      ? <span className="text-sm text-sky-600">{l.saturacionO2}%</span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{l.latitud?.toFixed(4)}, {l.longitud?.toFixed(4)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{l.nodoId}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{l.rssi} dBm</td>
                  <td className="px-4 py-3">
                    {l.bateria !== null && l.bateria !== undefined
                      ? <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${l.bateria > 50 ? 'bg-green-500' : l.bateria > 20 ? 'bg-yellow-400' : 'bg-red-500'}`}
                              style={{ width: `${l.bateria}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{Math.round(l.bateria)}%</span>
                        </div>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(l.timestamp).toLocaleString('es-MX')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Alertas tab ────────────────────────────────────────────── */}
      {tab === 'alertas' && (
        <div className="space-y-3">
          {alertas.length === 0
            ? <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">No hay alertas</div>
            : alertas.map((a: any) => (
              <div key={a.id} className={`rounded-xl border p-4 ${a.leida ? 'bg-gray-50 border-gray-200 opacity-60' : severidadColor[a.severidad] || 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={16} className={a.severidad === 'CRITICA' ? 'text-red-600' : 'text-orange-500'} />
                      <span className="font-medium text-sm">{a.tipo.replace(/_/g, ' ')}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${severidadColor[a.severidad]?.split(' ').slice(0, 2).join(' ')}`}>{a.severidad}</span>
                    </div>
                    <p className="text-sm text-gray-700">{a.mensaje}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(a.timestamp).toLocaleString('es-MX')}</p>
                  </div>
                  {!a.leida && (
                    <button onClick={() => marcarLeida(a.id)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 ml-4 shrink-0">
                      <BellOff size={14} /> Marcar leída
                    </button>
                  )}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Nodos tab ──────────────────────────────────────────────── */}
      {tab === 'nodos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodos.length === 0
            ? <div className="col-span-full bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">No hay nodos registrados. Ejecuta una simulación primero.</div>
            : nodos.map((n: any) => (
              <div key={n.id} className="bg-white rounded-xl shadow-sm border p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Radio size={18} className={n.activo ? 'text-green-500' : 'text-red-500'} />
                    <span className="font-mono font-bold">{n.nodoId ?? n.nombre}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${n.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {n.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between"><span>Tipo:</span><span className="font-medium">{n.tipo}</span></div>
                  <div className="flex justify-between items-center"><span>Batería:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${(n.bateria || 0) > 50 ? 'bg-green-500' : (n.bateria || 0) > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${n.bateria || 0}%` }} />
                      </div>
                      <span className="text-xs font-medium">{n.bateria?.toFixed(0) ?? '—'}%</span>
                    </div>
                  </div>
                  {n.ultimaConexion && (
                    <div className="flex justify-between">
                      <span>Última conexión:</span>
                      <span className="text-xs">{new Date(n.ultimaConexion).toLocaleString('es-MX')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};
export default IoTPage;
