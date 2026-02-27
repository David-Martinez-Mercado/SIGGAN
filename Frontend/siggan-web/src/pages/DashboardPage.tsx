import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardStats, estadisticasRazas, estadisticasMunicipio } from '../services/api';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';
import { Bug, Users, MapPin, AlertTriangle, Syringe, ShoppingCart, Bell, TrendingUp, Weight, FileText, Activity } from 'lucide-react';

const COLORS = ['#059669', '#0891b2', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#65a30d', '#ea580c'];
const tipoIcon: Record<string, string> = { VACUNACION:'💉', PRUEBA_TB:'🔬', PRUEBA_BR:'🔬', DESPARASITACION:'💊', TRATAMIENTO:'🩺', PESAJE:'⚖️', INSPECCION:'📋', OTRO:'📝' };

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [razas, setRazas] = useState<any[]>([]);
  const [municipios, setMunicipios] = useState<any[]>([]);
  const [notifs, setNotifs] = useState<any>({ noLeidas: 0, notificaciones: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [s, r, m, n] = await Promise.all([
          getDashboardStats(), estadisticasRazas(), estadisticasMunicipio(),
          api.get('/dashboard/notificaciones'),
        ]);
        setStats(s.data); setRazas(r.data); setMunicipios(m.data); setNotifs(n.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando dashboard...</div>;

  const sexoData = stats?.animalesPorSexo?.map((s: any) => ({ name: s.sexo === 'MACHO' ? '♂ Machos' : '♀ Hembras', value: s._count })) || [];
  const estatusData = stats?.animalesPorEstatus?.map((e: any) => ({ name: e.estatusSanitario, value: e._count })) || [];
  const propositoData = stats?.animalesPorProposito || [];
  const eventosTipoData = stats?.eventosPorTipo || [];
  const tendencia = stats?.tendenciaRegistros || [];
  const notifsNoLeidas = notifs?.notificaciones?.filter((n: any) => !n.leida) || [];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bienvenido, {user?.nombre}</h1>
          <p className="text-gray-500 mt-1">{user?.rol === 'ADMIN' ? 'Panel de control general del sistema' : 'Panel de control de tu ganado'} — {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        {notifsNoLeidas.length > 0 && (
          <button onClick={() => navigate('/notificaciones')} className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100">
            <Bell size={16} /> {notifsNoLeidas.length} notificación{notifsNoLeidas.length > 1 ? 'es' : ''} nueva{notifsNoLeidas.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Animales', value: stats?.totales?.animales || 0, icon: Bug, color: 'emerald' },
          { label: 'UPPs', value: stats?.totales?.upps || 0, icon: MapPin, color: 'blue' },
          { label: 'Eventos', value: stats?.totales?.eventos || 0, icon: Syringe, color: 'violet' },
          { label: 'Reactores', value: estatusData.find((e: any) => e.name === 'REACTOR')?.value || 0, icon: AlertTriangle, color: 'red' },
          { label: 'En venta', value: stats?.totales?.ofertasActivas || 0, icon: ShoppingCart, color: 'amber' },
          { label: 'Peso prom.', value: stats?.peso?.promedio ? `${stats.peso.promedio.toFixed(0)}kg` : '—', icon: Weight, color: 'cyan' },
        ].map((c, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-8 h-8 rounded-lg bg-${c.color}-100 flex items-center justify-center`}><c.icon size={16} className={`text-${c.color}-600`} /></div>
              <span className="text-xs text-gray-500">{c.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Notificaciones urgentes */}
      {notifsNoLeidas.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Bell size={16} className="text-red-500" /> Notificaciones pendientes</h3>
          <div className="space-y-2">
            {notifsNoLeidas.slice(0, 5).map((n: any) => (
              <div key={n.id} onClick={() => navigate(n.accion)} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                <span className="text-lg">{n.icono}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{n.titulo}</p>
                  <p className="text-xs text-gray-500 truncate">{n.mensaje}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${n.severidad === 'CRITICA' ? 'bg-red-100 text-red-700' : n.severidad === 'ALTA' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{n.severidad}</span>
              </div>
            ))}
          </div>
          {notifsNoLeidas.length > 5 && (
            <button onClick={() => navigate('/notificaciones')} className="text-sm text-blue-600 hover:underline mt-2">Ver todas ({notifsNoLeidas.length})</button>
          )}
        </div>
      )}

      {/* Row 1: Razas + Sexo/Estatus */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribución por Raza</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={razas}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="raza" fontSize={11} angle={-30} textAnchor="end" height={60} />
              <YAxis fontSize={11} /><Tooltip />
              <Bar dataKey="total" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Sexo & Estatus</h3>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={sexoData} cx="50%" cy="50%" outerRadius={45} innerRadius={25} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {sexoData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {estatusData.map((e: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${e.name === 'SANO' ? 'bg-green-500' : e.name === 'REACTOR' ? 'bg-red-500' : e.name === 'CUARENTENADO' ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                  {e.name}
                </span>
                <span className="font-semibold">{e.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Tendencia + Propósito + Eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-600" /> Registros por mes</h3>
          {tendencia.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={tendencia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" fontSize={10} />
                <YAxis fontSize={11} /><Tooltip />
                <Area type="monotone" dataKey="total" stroke="#059669" fill="#d1fae5" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center py-8">Sin datos de tendencia</p>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Por Propósito</h3>
          {propositoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={propositoData} cx="50%" cy="50%" outerRadius={70} dataKey="total" nameKey="proposito" label={(props: any) => `${props.proposito}: ${props.total}`} labelLine={false}>
                  {propositoData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center py-8">Sin datos</p>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Eventos Sanitarios</h3>
          {eventosTipoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={eventosTipoData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="tipo" fontSize={10} width={90} /><Tooltip />
                <Bar dataKey="total" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center py-8">Sin eventos</p>}
        </div>
      </div>

      {/* Row 3: Municipios + Últimos + Eventos recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Por Municipio</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={municipios} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="municipio" fontSize={11} width={130} /><Tooltip />
              <Bar dataKey="animales" fill="#0891b2" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Bug size={16} className="text-emerald-600" /> Últimos registros</h3>
          <div className="space-y-2.5">
            {stats?.ultimosRegistros?.map((a: any) => (
              <div key={a.id} onClick={() => navigate(`/animales/${a.id}`)} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-emerald-50 cursor-pointer transition">
                <div>
                  <p className="font-medium text-sm">{a.nombre || 'Sin nombre'}</p>
                  <p className="text-xs text-emerald-600 font-mono">{a.areteNacional}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{a.raza} {a.sexo === 'MACHO' ? '♂' : '♀'}</p>
                  <p className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString('es-MX')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Activity size={16} className="text-violet-600" /> Actividad reciente</h3>
          <div className="space-y-2.5">
            {stats?.eventosRecientes?.map((ev: any) => (
              <div key={ev.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                <span className="text-lg">{tipoIcon[ev.tipo] || '📝'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ev.tipo.replace('_', ' ')}</p>
                  <p className="text-xs text-gray-500 truncate">{ev.animal?.areteNacional} — {ev.descripcion || ''}</p>
                </div>
                <div className="text-right">
                  {ev.resultado && <span className={`text-xs px-1.5 py-0.5 rounded ${ev.resultado === 'POSITIVO' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{ev.resultado}</span>}
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(ev.fecha).toLocaleDateString('es-MX')}</p>
                </div>
              </div>
            ))}
            {(!stats?.eventosRecientes || stats.eventosRecientes.length === 0) && <p className="text-gray-400 text-sm text-center py-4">Sin actividad reciente</p>}
          </div>
        </div>
      </div>

      {/* Peso stats */}
      {stats?.peso?.promedio && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Estadísticas de Peso</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-blue-50 rounded-lg"><p className="text-xs text-gray-500">Mínimo</p><p className="text-xl font-bold text-blue-600">{stats.peso.min?.toFixed(0)} kg</p></div>
            <div className="p-3 bg-emerald-50 rounded-lg"><p className="text-xs text-gray-500">Promedio</p><p className="text-xl font-bold text-emerald-600">{stats.peso.promedio?.toFixed(0)} kg</p></div>
            <div className="p-3 bg-amber-50 rounded-lg"><p className="text-xs text-gray-500">Máximo</p><p className="text-xl font-bold text-amber-600">{stats.peso.max?.toFixed(0)} kg</p></div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DashboardPage;