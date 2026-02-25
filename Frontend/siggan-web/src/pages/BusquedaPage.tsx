import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { busquedaGlobal, busquedaHistorial } from '../services/api';
import { Search, Bug, Users, MapPin, ShieldCheck, AlertTriangle } from 'lucide-react';

const BusquedaPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<any>(null);
  const [historial, setHistorial] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<'global' | 'historial'>('global');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.length < 2) return;
    setLoading(true);
    setHistorial(null);
    setResultados(null);
    try {
      if (modo === 'historial') {
        const res = await busquedaHistorial(query);
        setHistorial(res.data);
      } else {
        const res = await busquedaGlobal(query);
        setResultados(res.data);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setHistorial(null);
        setResultados(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Búsqueda</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setModo('global'); setHistorial(null); setResultados(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${modo === 'global' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Búsqueda General
        </button>
        <button onClick={() => { setModo('historial'); setHistorial(null); setResultados(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${modo === 'historial' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          🔍 Consultar Historial por Arete
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={modo === 'historial' ? 'Ingresa el número de arete, RFID o arete de exportación...' : 'Buscar por arete, nombre, CURP, municipio, raza...'}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-lg"
              autoFocus />
          </div>
          <button type="submit" disabled={loading || query.length < 2}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {modo === 'historial' && (
          <p className="text-sm text-gray-500 mt-2">Consulta el historial sanitario completo de un animal para verificar su estado de salud antes de comprarlo.</p>
        )}
      </form>

      {/* Historial por arete */}
      {historial && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{historial.animal.nombre || 'Sin nombre'}</h3>
                <p className="text-emerald-600 font-mono font-medium">{historial.animal.areteNacional}</p>
                {historial.animal.areteExportacion && <p className="text-blue-600 font-mono text-sm">Exp: {historial.animal.areteExportacion}</p>}
              </div>
              <div className={`px-4 py-2 rounded-lg text-sm font-bold ${historial.animal.estatusSanitario === 'SANO' ? 'bg-green-100 text-green-800' : historial.animal.estatusSanitario === 'REACTOR' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {historial.animal.estatusSanitario === 'SANO' ? '✅' : '⚠️'} {historial.animal.estatusSanitario}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div><p className="text-xs text-gray-500">Raza</p><p className="font-medium">{historial.animal.raza}</p></div>
              <div><p className="text-xs text-gray-500">Sexo</p><p className="font-medium">{historial.animal.sexo === 'MACHO' ? '♂ Macho' : '♀ Hembra'}</p></div>
              <div><p className="text-xs text-gray-500">Peso</p><p className="font-medium">{historial.animal.peso ? `${historial.animal.peso.toFixed(1)} kg` : '—'}</p></div>
              <div><p className="text-xs text-gray-500">Nacimiento</p><p className="font-medium">{new Date(historial.animal.fechaNacimiento).toLocaleDateString('es-MX')}</p></div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Propietario actual</p>
              <p className="font-medium">{historial.animal.propietario.nombre} {historial.animal.propietario.apellidos}</p>
              <p className="text-sm text-gray-400">{historial.animal.propietario.municipio} • Tel: {historial.animal.propietario.telefono || 'No disponible'}</p>
              <p className="text-sm text-gray-400 mt-1">UPP: {historial.animal.upp.nombre} ({historial.animal.upp.claveUPP})</p>
            </div>
          </div>

          {/* Resumen de salud */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShieldCheck size={20} className="text-emerald-600" /> Resumen de Salud
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{historial.resumenSalud.totalPruebasTB}</p>
                <p className="text-xs text-gray-500">Pruebas TB</p>
                {historial.resumenSalud.ultimaPruebaTB && (
                  <p className={`text-xs mt-1 font-medium ${historial.resumenSalud.ultimaPruebaTB.resultado === 'NEGATIVO' ? 'text-green-600' : 'text-red-600'}`}>
                    Última: {historial.resumenSalud.ultimaPruebaTB.resultado}
                  </p>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{historial.resumenSalud.totalPruebasBR}</p>
                <p className="text-xs text-gray-500">Pruebas BR</p>
                {historial.resumenSalud.ultimaPruebaBR && (
                  <p className={`text-xs mt-1 font-medium ${historial.resumenSalud.ultimaPruebaBR.resultado === 'NEGATIVO' ? 'text-green-600' : 'text-red-600'}`}>
                    Última: {historial.resumenSalud.ultimaPruebaBR.resultado}
                  </p>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{historial.resumenSalud.totalVacunas}</p>
                <p className="text-xs text-gray-500">Vacunas</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{historial.resumenSalud.totalEventos}</p>
                <p className="text-xs text-gray-500">Total Eventos</p>
              </div>
            </div>
          </div>

          {/* Historial completo */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Historial Sanitario Completo</h3>
            <div className="space-y-2">
              {historial.animal.eventos.map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-sm">{e.tipo.replace('_', ' ')}</span>
                    {e.descripcion && <span className="text-sm text-gray-500 ml-2">— {e.descripcion}</span>}
                    {e.resultado && (
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${e.resultado === 'POSITIVO' ? 'bg-red-100 text-red-700' : e.resultado === 'NEGATIVO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {e.resultado}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(e.fecha).toLocaleDateString('es-MX')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Búsqueda global */}
      {resultados && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">{resultados.totalResultados} resultados para "{resultados.termino}"</p>

          {resultados.resultados.animales.data.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                <Bug size={20} className="text-emerald-600" /> Animales ({resultados.resultados.animales.total})
              </h3>
              <div className="space-y-2">
                {resultados.resultados.animales.data.map((a: any) => (
                  <div key={a.id} onClick={() => setQuery(a.areteNacional)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-emerald-50 cursor-pointer transition">
                    <div>
                      <span className="font-mono text-emerald-600 font-medium">{a.areteNacional}</span>
                      <span className="text-gray-500 ml-2">{a.nombre} • {a.raza} • {a.sexo === 'MACHO' ? '♂' : '♀'}</span>
                    </div>
                    <span className="text-sm text-gray-400">{a.propietario?.nombre} {a.propietario?.apellidos} • {a.propietario?.municipio}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultados.resultados.propietarios.data.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                <Users size={20} className="text-blue-600" /> Propietarios ({resultados.resultados.propietarios.total})
              </h3>
              <div className="space-y-2">
                {resultados.resultados.propietarios.data.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{p.nombre} {p.apellidos}</span>
                    <span className="text-sm text-gray-400">{p.municipio} • {p._count?.animales} animales</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultados.resultados.upps.data.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
                <MapPin size={20} className="text-amber-600" /> UPPs ({resultados.resultados.upps.total})
              </h3>
              <div className="space-y-2">
                {resultados.resultados.upps.data.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div><span className="font-mono text-amber-600">{u.claveUPP}</span><span className="text-gray-500 ml-2">{u.nombre}</span></div>
                    <span className="text-sm text-gray-400">{u.municipio} • {u._count?.animales} animales</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultados.totalResultados === 0 && <div className="text-center py-12 text-gray-400">No se encontraron resultados</div>}
        </div>
      )}
    </div>
  );
};

export default BusquedaPage;
