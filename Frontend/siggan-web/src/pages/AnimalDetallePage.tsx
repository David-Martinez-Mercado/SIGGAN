import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnimal, cambiarProposito } from '../services/api';
import { ArrowLeft, Syringe, Tag, MapPin, Thermometer, RefreshCw } from 'lucide-react';

const estatusColor: Record<string, string> = {
  SANO: 'bg-green-100 text-green-800', EN_PRUEBA: 'bg-yellow-100 text-yellow-800',
  REACTOR: 'bg-red-100 text-red-800', CUARENTENADO: 'bg-orange-100 text-orange-800',
};
const tipoEventoIcon: Record<string, string> = {
  VACUNACION: '💉', PRUEBA_TB: '🔬', PRUEBA_BR: '🔬', DESPARASITACION: '💊',
  TRATAMIENTO: '🩺', PESAJE: '⚖️', INSPECCION: '📋', OTRO: '📝',
};

const AnimalDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [animal, setAnimal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showProposito, setShowProposito] = useState(false);
  const [nuevoProposito, setNuevoProposito] = useState('');
  const [propositoMsg, setPropositoMsg] = useState('');

  useEffect(() => {
    const fetchAnimal = async () => {
      try { const res = await getAnimal(id!); setAnimal(res.data); }
      catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    fetchAnimal();
  }, [id]);

  const handleCambiarProposito = async () => {
    if (!nuevoProposito) return;
    try {
      const res = await cambiarProposito(id!, nuevoProposito);
      setPropositoMsg(res.data.message);
      setAnimal(res.data.animal);
      setShowProposito(false);
      // Recargar para ver arete exportación si se asignó
      const updated = await getAnimal(id!);
      setAnimal(updated.data);
    } catch (err: any) {
      setPropositoMsg(err.response?.data?.error || 'Error');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>;
  if (!animal) return <div className="text-center text-red-500 py-12">Animal no encontrado</div>;

  return (
    <div>
      <button onClick={() => navigate('/animales')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={18} /> Volver a animales
      </button>

      {propositoMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm mb-4">
          {propositoMsg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{animal.nombre || 'Sin nombre'}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${estatusColor[animal.estatusSanitario]}`}>
                {animal.estatusSanitario}
              </span>
            </div>
            <p className="text-emerald-600 font-mono text-lg font-medium">{animal.areteNacional}</p>
            {animal.areteExportacion && <p className="text-blue-600 font-mono text-sm">🔵 Exportación: {animal.areteExportacion}</p>}
            {animal.rfidTag && <p className="text-gray-400 font-mono text-sm">📡 RFID: {animal.rfidTag}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Propietario</p>
            <p className="font-medium">{animal.propietario?.nombre} {animal.propietario?.apellidos}</p>
            <p className="text-sm text-gray-500 mt-2">UPP</p>
            <p className="font-medium">{animal.upp?.nombre}</p>
            <p className="text-xs text-gray-400">{animal.upp?.claveUPP} • {animal.upp?.municipio}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mt-6 pt-6 border-t border-gray-100">
          {[
            { label: 'Raza', value: animal.raza },
            { label: 'Sexo', value: animal.sexo === 'MACHO' ? '♂ Macho' : '♀ Hembra' },
            { label: 'Color', value: animal.color || '—' },
            { label: 'Peso', value: animal.peso ? `${animal.peso.toFixed(1)} kg` : '—' },
            { label: 'Nacimiento', value: new Date(animal.fechaNacimiento).toLocaleDateString('es-MX') },
          ].map((item, i) => (
            <div key={i}>
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="font-medium text-gray-900 mt-0.5">{item.value}</p>
            </div>
          ))}

          {/* Propósito editable */}
          <div>
            <p className="text-xs text-gray-500">Propósito</p>
            {showProposito ? (
              <div className="flex items-center gap-1 mt-0.5">
                <select value={nuevoProposito} onChange={e => setNuevoProposito(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-emerald-500 outline-none">
                  <option value="">Seleccionar...</option>
                  <option value="Cría">Cría</option>
                  <option value="Engorda">Engorda</option>
                  <option value="Leche">Leche</option>
                  <option value="Exportación">Exportación</option>
                </select>
                <button onClick={handleCambiarProposito}
                  className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700">OK</button>
                <button onClick={() => setShowProposito(false)}
                  className="text-xs text-gray-400 hover:text-gray-600">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-0.5">
                <p className="font-medium text-gray-900">{animal.proposito || '—'}</p>
                <button onClick={() => { setShowProposito(true); setNuevoProposito(animal.proposito || ''); }}
                  className="text-gray-400 hover:text-emerald-600" title="Cambiar propósito">
                  <RefreshCw size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {(animal.madre || animal.crias?.length > 0) && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Genealogía</h3>
            {animal.madre && (
              <p className="text-sm text-gray-600">Madre: <span className="text-emerald-600 cursor-pointer hover:underline" onClick={() => navigate(`/animales/${animal.madre.id}`)}>{animal.madre.nombre || animal.madre.areteNacional}</span></p>
            )}
            {animal.crias?.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                Crías: {animal.crias.map((c: any, i: number) => (
                  <span key={c.id}>{i > 0 && ', '}<span className="text-emerald-600 cursor-pointer hover:underline" onClick={() => navigate(`/animales/${c.id}`)}>{c.nombre || c.areteNacional}</span></span>
                ))}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Syringe size={20} className="text-emerald-600" /> Historial Sanitario
          </h3>
          {animal.eventos?.length === 0 ? (
            <p className="text-gray-400 text-sm">Sin eventos registrados</p>
          ) : (
            <div className="space-y-3">
              {animal.eventos?.map((evento: any) => (
                <div key={evento.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl">{tipoEventoIcon[evento.tipo] || '📝'}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-gray-900">{evento.tipo.replace('_', ' ')}</p>
                      <span className="text-xs text-gray-400">{new Date(evento.fecha).toLocaleDateString('es-MX')}</span>
                    </div>
                    {evento.descripcion && <p className="text-sm text-gray-600 mt-0.5">{evento.descripcion}</p>}
                    {evento.resultado && (
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${evento.resultado === 'POSITIVO' ? 'bg-red-100 text-red-700' : evento.resultado === 'NEGATIVO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {evento.resultado}
                      </span>
                    )}
                    {evento.mvzResponsable && <p className="text-xs text-gray-400 mt-1">MVZ: {evento.mvzResponsable}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Tag size={20} className="text-blue-600" /> Historial de Aretes
          </h3>
          {animal.aretes?.length === 0 ? (
            <p className="text-gray-400 text-sm">Sin historial</p>
          ) : (
            <div className="space-y-3">
              {animal.aretes?.map((arete: any) => (
                <div key={arete.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Tag size={16} className="text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{arete.numeroArete}</p>
                    <p className="text-xs text-gray-500">{arete.tipoArete} • {arete.accion}</p>
                    {arete.motivo && <p className="text-xs text-gray-400">{arete.motivo}</p>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(arete.fecha).toLocaleDateString('es-MX')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {animal.lecturas?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Thermometer size={20} className="text-orange-600" /> Lecturas IoT
            </h3>
            <div className="space-y-2">
              {animal.lecturas.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-orange-600 font-medium">{l.temperatura?.toFixed(1)}°C</span>
                    <span className="text-gray-500 flex items-center gap-1"><MapPin size={14} />{l.latitud.toFixed(4)}, {l.longitud.toFixed(4)}</span>
                  </div>
                  <span className="text-gray-400 text-xs">{new Date(l.timestamp).toLocaleString('es-MX')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimalDetallePage;
