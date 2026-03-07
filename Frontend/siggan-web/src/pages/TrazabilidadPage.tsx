import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, MapPin, Syringe, Tags, Shield, Fingerprint } from 'lucide-react';

const tipoIcon: Record<string, string> = { VACUNACION:'💉', PRUEBA_TB:'🔬', PRUEBA_BR:'🔬', DESPARASITACION:'💊', TRATAMIENTO:'🩺', PESAJE:'⚖️', INSPECCION:'📋', OTRO:'📝' };
const estatusColor: Record<string, string> = { SANO:'bg-green-100 text-green-700', REACTOR:'bg-red-100 text-red-700', CUARENTENADO:'bg-orange-100 text-orange-700', EN_PRUEBA:'bg-yellow-100 text-yellow-700' };

const TrazabilidadPage: React.FC = () => {
  const { arete } = useParams<{ arete: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await window.fetch(`http://localhost:3001/api/biometria/trazabilidad/${arete}`);
        if (!res.ok) throw new Error('No encontrado');
        setData(await res.json());
      } catch (e) { setError('Animal no encontrado'); }
      finally { setLoading(false); }
    };
    if (arete) fetch();
  }, [arete]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Buscando animal...</div>;
  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md"><p className="text-red-500 text-lg font-bold mb-2">No encontrado</p><p className="text-gray-500">El arete {arete} no existe en el sistema SIGGAN.</p></div>
    </div>
  );

  const a = data?.animal;
  const p = data?.propietario;
  const u = data?.upp;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 text-white py-6 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold">🐄 SIGGAN — Trazabilidad</h1>
          <p className="text-emerald-200 text-sm mt-1">Sistema Integral de Gestión Ganadera • Durango</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 -mt-4">
        {/* Animal card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Arete Nacional</p>
              <p className="text-2xl font-bold font-mono text-emerald-600">{a?.arete}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${estatusColor[a?.estatusSanitario] || 'bg-gray-100'}`}>{a?.estatusSanitario}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {a?.nombre && <div><span className="text-gray-500">Nombre</span><p className="font-medium">{a.nombre}</p></div>}
            <div><span className="text-gray-500">Raza</span><p className="font-medium">{a?.raza}</p></div>
            <div><span className="text-gray-500">Sexo</span><p className="font-medium">{a?.sexo === 'MACHO' ? '♂ Macho' : '♀ Hembra'}</p></div>
            {a?.color && <div><span className="text-gray-500">Color</span><p className="font-medium">{a.color}</p></div>}
            {a?.peso && <div><span className="text-gray-500">Peso</span><p className="font-medium">{a.peso} kg</p></div>}
            {a?.proposito && <div><span className="text-gray-500">Propósito</span><p className="font-medium">{a.proposito}</p></div>}
            {a?.fechaNacimiento && <div><span className="text-gray-500">Nacimiento</span><p className="font-medium">{new Date(a.fechaNacimiento).toLocaleDateString('es-MX')}</p></div>}
            {a?.areteExportacion && <div><span className="text-gray-500">Arete exportación</span><p className="font-mono text-sm">{a.areteExportacion}</p></div>}
          </div>

          {a?.irisRegistrado && (
            <div className="mt-3 flex items-center gap-2 text-violet-600 text-sm"><Fingerprint size={14} /> Iris biométrico registrado</div>
          )}
        </div>

        {/* Propietario / UPP */}
        {(p || u) && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><MapPin size={16} className="text-blue-600" /> Ubicación actual</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {p && <div><span className="text-gray-500">Propietario</span><p className="font-medium">{p.nombre}</p><p className="text-xs text-gray-400">{p.municipio}, Durango</p></div>}
              {u && <div><span className="text-gray-500">UPP</span><p className="font-medium">{u.nombre}</p><p className="text-xs text-gray-400">{u.claveUPP} • {u.municipio}</p></div>}
            </div>
          </div>
        )}

        {/* Eventos */}
        {data?.eventosSanitarios?.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Syringe size={16} className="text-violet-600" /> Historial Sanitario</h3>
            <div className="space-y-2">
              {data.eventosSanitarios.map((ev: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg text-sm">
                  <span className="text-lg">{tipoIcon[ev.tipo] || '📝'}</span>
                  <div className="flex-1">
                    <p className="font-medium">{ev.tipo.replace(/_/g, ' ')}</p>
                    {ev.descripcion && <p className="text-xs text-gray-500">{ev.descripcion}</p>}
                  </div>
                  <div className="text-right">
                    {ev.resultado && <span className={`text-xs px-1.5 py-0.5 rounded ${ev.resultado === 'POSITIVO' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{ev.resultado}</span>}
                    <p className="text-xs text-gray-400">{new Date(ev.fecha).toLocaleDateString('es-MX')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Historial aretes */}
        {data?.historialAretes?.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Tags size={16} className="text-emerald-600" /> Historial de Aretes</h3>
            <div className="space-y-2">
              {data.historialAretes.map((h: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <p className="font-mono text-emerald-600">{h.numeroArete}</p>
                    <p className="text-xs text-gray-500">{h.tipoArete} — {h.accion}</p>
                  </div>
                  <div className="text-right">
                    {h.motivo && <p className="text-xs text-gray-500">{h.motivo}</p>}
                    <p className="text-xs text-gray-400">{new Date(h.fecha).toLocaleDateString('es-MX')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6 text-xs text-gray-400">
          <p className="flex items-center justify-center gap-1"><Shield size={12} /> Verificado por SIGGAN</p>
          <p>Sistema Integral de Gestión Ganadera • Durango, México</p>
        </div>
      </div>
    </div>
  );
};
export default TrazabilidadPage;
