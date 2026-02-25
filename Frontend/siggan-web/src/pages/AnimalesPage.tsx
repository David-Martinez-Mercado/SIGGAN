import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnimales } from '../services/api';
import { Search, Plus, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const RAZAS = ['Hereford', 'Angus', 'Charolais', 'Simmental', 'Brahman', 'Beefmaster', 'Brangus', 'Criollo', 'Holstein', 'Suizo'];

const estatusColor: Record<string, string> = {
  SANO: 'bg-green-100 text-green-800',
  EN_PRUEBA: 'bg-yellow-100 text-yellow-800',
  REACTOR: 'bg-red-100 text-red-800',
  CUARENTENADO: 'bg-orange-100 text-orange-800',
};

const AnimalesPage: React.FC = () => {
  const navigate = useNavigate();
  const [animales, setAnimales] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [filtroRaza, setFiltroRaza] = useState('');
  const [filtroSexo, setFiltroSexo] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchAnimales = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15 };
      if (buscar) params.buscar = buscar;
      if (filtroRaza) params.raza = filtroRaza;
      if (filtroSexo) params.sexo = filtroSexo;
      if (filtroEstatus) params.estatus = filtroEstatus;

      const res = await getAnimales(params);
      setAnimales(res.data.data);
      setTotal(res.data.total);
      setTotalPaginas(res.data.totalPaginas);
    } catch (error) {
      console.error('Error cargando animales:', error);
    } finally {
      setLoading(false);
    }
  }, [page, buscar, filtroRaza, filtroSexo, filtroEstatus]);

  useEffect(() => { fetchAnimales(); }, [fetchAnimales]);

  // Debounce para búsqueda
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscar(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Animales</h1>
          <p className="text-gray-500 text-sm mt-1">{total} animales registrados</p>
        </div>
        <button
          onClick={() => navigate('/animales/nuevo')}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition"
        >
          <Plus size={18} />
          Registrar Animal
        </button>
      </div>

      {/* Búsqueda y filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar por arete, nombre o RFID..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition ${showFilters ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            <Filter size={18} />
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
            <select
              value={filtroRaza}
              onChange={e => { setFiltroRaza(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">Todas las razas</option>
              {RAZAS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={filtroSexo}
              onChange={e => { setFiltroSexo(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">Ambos sexos</option>
              <option value="MACHO">Machos</option>
              <option value="HEMBRA">Hembras</option>
            </select>
            <select
              value={filtroEstatus}
              onChange={e => { setFiltroEstatus(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">Todos los estatus</option>
              <option value="SANO">Sano</option>
              <option value="EN_PRUEBA">En prueba</option>
              <option value="REACTOR">Reactor</option>
              <option value="CUARENTENADO">Cuarentenado</option>
            </select>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Arete</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Raza</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sexo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estatus</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Propietario</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">UPP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Cargando...</td></tr>
              ) : animales.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No se encontraron animales</td></tr>
              ) : (
                animales.map(animal => (
                  <tr
                    key={animal.id}
                    onClick={() => navigate(`/animales/${animal.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-emerald-600">{animal.areteNacional}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{animal.nombre || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{animal.raza}</td>
                    <td className="px-4 py-3 text-sm">
                      {animal.sexo === 'MACHO' ? '♂ Macho' : '♀ Hembra'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${estatusColor[animal.estatusSanitario] || 'bg-gray-100 text-gray-800'}`}>
                        {animal.estatusSanitario}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {animal.propietario?.nombre} {animal.propietario?.apellidos}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {animal.upp?.nombre}
                      <span className="text-xs text-gray-400 block">{animal.upp?.municipio}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Página {page} de {totalPaginas} • {total} animales
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPaginas, p + 1))}
                disabled={page === totalPaginas}
                className="p-2 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimalesPage;
