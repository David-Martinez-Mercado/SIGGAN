import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboardStats, estadisticasRazas, estadisticasMunicipio } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Bug, Users, MapPin, AlertTriangle } from 'lucide-react';

const COLORS = ['#059669', '#0891b2', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#65a30d', '#ea580c', '#2563eb', '#4f46e5'];

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [razas, setRazas] = useState<any[]>([]);
  const [municipios, setMunicipios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, razasRes, munRes] = await Promise.all([
          getDashboardStats(), estadisticasRazas(), estadisticasMunicipio(),
        ]);
        setStats(statsRes.data);
        setRazas(razasRes.data);
        setMunicipios(munRes.data);
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500 text-lg">Cargando dashboard...</div>;

  const statCards = [
    { label: 'Mis Animales', value: stats?.totales?.animales || 0, icon: Bug, color: 'bg-emerald-500' },
    { label: user?.rol === 'ADMIN' ? 'Propietarios' : 'Propietario', value: stats?.totales?.propietarios || 0, icon: Users, color: 'bg-blue-500' },
    { label: 'UPPs', value: stats?.totales?.upps || 0, icon: MapPin, color: 'bg-amber-500' },
    { label: 'Reactores', value: stats?.animalesPorEstatus?.find((e: any) => e.estatusSanitario === 'REACTOR')?._count || 0, icon: AlertTriangle, color: 'bg-red-500' },
  ];

  const sexoData = stats?.animalesPorSexo?.map((s: any) => ({
    name: s.sexo === 'MACHO' ? 'Machos' : 'Hembras', value: s._count,
  })) || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bienvenido, {user?.nombre}</h1>
        <p className="text-gray-500 mt-1">
          {user?.rol === 'ADMIN' ? 'Panel de control general del sistema' : 'Panel de control de tu ganado'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} p-3 rounded-lg`}><card.icon size={24} className="text-white" /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Raza</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={razas}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="raza" fontSize={12} angle={-45} textAnchor="end" height={80} />
              <YAxis /><Tooltip />
              <Bar dataKey="total" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Sexo</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={sexoData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {sexoData.map((_: any, i: number) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Animales por Municipio</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={municipios} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" /><YAxis type="category" dataKey="municipio" fontSize={12} width={150} /><Tooltip />
              <Bar dataKey="animales" fill="#0891b2" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Últimos Registros</h3>
          <div className="space-y-3">
            {stats?.ultimosRegistros?.map((animal: any) => (
              <div key={animal.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{animal.nombre || 'Sin nombre'} — <span className="text-emerald-600">{animal.areteNacional}</span></p>
                  <p className="text-sm text-gray-500">{animal.raza} • {animal.sexo === 'MACHO' ? '♂' : '♀'}</p>
                </div>
                <span className="text-xs text-gray-400">{new Date(animal.createdAt).toLocaleDateString('es-MX')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
