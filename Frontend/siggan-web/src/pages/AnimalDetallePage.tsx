import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnimal, cambiarProposito, cambiarEstatus } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Syringe, Tag, MapPin, Thermometer, RefreshCw, DollarSign, ShoppingCart } from 'lucide-react';
import api from '../services/api';

const estatusColor: Record<string, string> = { SANO:'bg-green-100 text-green-800', EN_PRUEBA:'bg-yellow-100 text-yellow-800', REACTOR:'bg-red-100 text-red-800', CUARENTENADO:'bg-orange-100 text-orange-800' };
const tipoEventoIcon: Record<string, string> = { VACUNACION:'💉', PRUEBA_TB:'🔬', PRUEBA_BR:'🔬', DESPARASITACION:'💊', TRATAMIENTO:'🩺', PESAJE:'⚖️', INSPECCION:'📋', OTRO:'📝' };

const AnimalDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [animal, setAnimal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showProposito, setShowProposito] = useState(false);
  const [nuevoProposito, setNuevoProposito] = useState('');
  const [showEstatus, setShowEstatus] = useState(false);
  const [nuevoEstatus, setNuevoEstatus] = useState('');
  const [showVenta, setShowVenta] = useState(false);
  const [precio, setPrecio] = useState('');
  const [descripcionVenta, setDescripcionVenta] = useState('');
  const [ofertaActiva, setOfertaActiva] = useState<any>(null);

  const esMVZ = user?.rol === 'MVZ' || user?.rol === 'ADMIN';
  const esProductor = user?.rol === 'PRODUCTOR';

  const fetchAnimal = async () => {
    try {
      const r = await getAnimal(id!);
      setAnimal(r.data);
      // Verificar si tiene oferta activa
      try {
        const mkt = await api.get('/marketplace/mis-ofertas');
        const activa = (mkt.data || []).find((o: any) => o.animalId === id && ['PUBLICADO', 'CON_OFERTA'].includes(o.estatus));
        setOfertaActiva(activa || null);
      } catch (e) { /* no tiene ofertas */ }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAnimal(); }, [id]);

  const handleCambiarProposito = async () => {
    if (!nuevoProposito) return;
    try { const r = await cambiarProposito(id!, nuevoProposito); setMsg(r.data.message); setShowProposito(false); fetchAnimal(); }
    catch (e: any) { setMsg(e.response?.data?.error || 'Error'); }
  };

  const handleCambiarEstatus = async () => {
    if (!nuevoEstatus) return;
    try { const r = await cambiarEstatus(id!, nuevoEstatus); setMsg(r.data.message); setShowEstatus(false); fetchAnimal(); }
    catch (e: any) { setMsg(e.response?.data?.error || 'Error'); }
  };

  const handleVender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!precio) return;
    setMsg('');
    try {
      await api.post('/marketplace', { animalId: id, precioSolicitado: parseFloat(precio), descripcion: descripcionVenta });
      setMsg('✅ Animal puesto a la venta exitosamente. Aparecerá en el Marketplace.');
      setShowVenta(false); setPrecio(''); setDescripcionVenta('');
      fetchAnimal();
    } catch (e: any) { setMsg(e.response?.data?.error || 'Error al publicar'); }
  };

  const cancelarVenta = async () => {
    if (!ofertaActiva) return;
    try {
      await api.put(`/marketplace/${ofertaActiva.id}/cancelar`);
      setMsg('Venta cancelada'); setOfertaActiva(null); fetchAnimal();
    } catch (e: any) { setMsg(e.response?.data?.error || 'Error'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Cargando...</div>;
  if (!animal) return <div className="text-center text-red-500 py-12">Animal no encontrado</div>;

  return (
    <div>
      <button onClick={() => navigate('/animales')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"><ArrowLeft size={18} /> Volver</button>
      {msg && <div className={`${msg.startsWith('✅') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'} border px-4 py-3 rounded-lg text-sm mb-4`}>{msg}</div>}

      {/* Banner si está en venta */}
      {ofertaActiva && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart size={20} className="text-amber-600" />
            <div>
              <p className="font-semibold text-amber-800">Este animal está en venta</p>
              <p className="text-sm text-amber-600">Precio: <span className="font-bold">${ofertaActiva.precioSolicitado?.toLocaleString('es-MX')} MXN</span>
                {ofertaActiva.estatus === 'CON_OFERTA' && <span className="ml-2 text-green-600 font-medium">— Tiene un comprador interesado</span>}
              </p>
            </div>
          </div>
          {esProductor && (
            <button onClick={cancelarVenta} className="text-sm text-red-600 hover:text-red-800 font-medium">Cancelar venta</button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{animal.nombre || 'Sin nombre'}</h1>
              {showEstatus ? (
                <div className="flex items-center gap-1">
                  <select value={nuevoEstatus} onChange={e => setNuevoEstatus(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-1 outline-none">
                    <option value="">...</option><option value="SANO">SANO</option><option value="EN_PRUEBA">EN PRUEBA</option><option value="REACTOR">REACTOR</option><option value="CUARENTENADO">CUARENTENADO</option>
                  </select>
                  <button onClick={handleCambiarEstatus} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">OK</button>
                  <button onClick={() => setShowEstatus(false)} className="text-xs text-gray-400">✕</button>
                </div>
              ) : (
                <span onClick={() => esMVZ && setShowEstatus(true)}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${estatusColor[animal.estatusSanitario]} ${esMVZ ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-emerald-400' : ''}`}
                  title={esMVZ ? 'Click para cambiar estatus' : ''}>
                  {animal.estatusSanitario}
                </span>
              )}
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
            {/* Solo PRODUCTOR puede vender, y solo si no tiene oferta activa */}
            {esProductor && !ofertaActiva && (
              <button onClick={() => setShowVenta(!showVenta)}
                className="mt-3 flex items-center gap-1 text-sm bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition ml-auto">
                <DollarSign size={16} /> Poner a la venta
              </button>
            )}
          </div>
        </div>

        {showVenta && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="font-semibold text-amber-900 mb-3">Publicar en Marketplace</h4>
            <form onSubmit={handleVender} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio (MXN) *</label>
                <input type="number" value={precio} onChange={e => setPrecio(e.target.value)} required min="1"
                  placeholder="25000" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input value={descripcionVenta} onChange={e => setDescripcionVenta(e.target.value)}
                  placeholder="Excelente para cría..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
              </div>
              <div className="flex items-end gap-2">
                <button type="submit" className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700">Publicar</button>
                <button type="button" onClick={() => setShowVenta(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600">Cancelar</button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mt-6 pt-6 border-t border-gray-100">
          {[
            { label:'Raza', value:animal.raza },
            { label:'Sexo', value:animal.sexo==='MACHO'?'♂ Macho':'♀ Hembra' },
            { label:'Color', value:animal.color||'—' },
            { label:'Peso', value:animal.peso?`${animal.peso.toFixed(1)} kg`:'—' },
            { label:'Nacimiento', value:new Date(animal.fechaNacimiento).toLocaleDateString('es-MX') },
          ].map((item, i) => (<div key={i}><p className="text-xs text-gray-500">{item.label}</p><p className="font-medium text-gray-900 mt-0.5">{item.value}</p></div>))}
          <div>
            <p className="text-xs text-gray-500">Propósito</p>
            {showProposito ? (
              <div className="flex items-center gap-1 mt-0.5">
                <select value={nuevoProposito} onChange={e => setNuevoProposito(e.target.value)} className="text-sm border border-gray-300 rounded px-1 py-0.5 outline-none">
                  <option value="">...</option><option value="Cría">Cría</option><option value="Engorda">Engorda</option><option value="Leche">Leche</option><option value="Exportación">Exportación</option>
                </select>
                <button onClick={handleCambiarProposito} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">OK</button>
                <button onClick={() => setShowProposito(false)} className="text-xs text-gray-400">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-0.5">
                <p className="font-medium text-gray-900">{animal.proposito||'—'}</p>
                <button onClick={() => {setShowProposito(true); setNuevoProposito(animal.proposito||'');}} className="text-gray-400 hover:text-emerald-600"><RefreshCw size={14} /></button>
              </div>
            )}
          </div>
        </div>

        {(animal.madre || animal.crias?.length > 0) && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Genealogía</h3>
            {animal.madre && <p className="text-sm text-gray-600">Madre: <span className="text-emerald-600 cursor-pointer hover:underline" onClick={() => navigate(`/animales/${animal.madre.id}`)}>{animal.madre.nombre||animal.madre.areteNacional}</span></p>}
            {animal.crias?.length > 0 && <p className="text-sm text-gray-600 mt-1">Crías: {animal.crias.map((c:any,i:number) => <span key={c.id}>{i>0&&', '}<span className="text-emerald-600 cursor-pointer hover:underline" onClick={() => navigate(`/animales/${c.id}`)}>{c.nombre||c.areteNacional}</span></span>)}</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Syringe size={20} className="text-emerald-600" /> Historial Sanitario</h3>
          {animal.eventos?.length===0 ? <p className="text-gray-400 text-sm">Sin eventos</p> : (
            <div className="space-y-3">{animal.eventos?.map((ev:any) => (
              <div key={ev.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl">{tipoEventoIcon[ev.tipo]||'📝'}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between"><p className="font-medium text-sm">{ev.tipo.replace('_',' ')}</p><span className="text-xs text-gray-400">{new Date(ev.fecha).toLocaleDateString('es-MX')}</span></div>
                  {ev.descripcion && <p className="text-sm text-gray-600 mt-0.5">{ev.descripcion}</p>}
                  {ev.resultado && <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${ev.resultado==='POSITIVO'?'bg-red-100 text-red-700':ev.resultado==='NEGATIVO'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-700'}`}>{ev.resultado}</span>}
                  {ev.mvzResponsable && <p className="text-xs text-gray-400 mt-1">MVZ: {ev.mvzResponsable}</p>}
                </div>
              </div>
            ))}</div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Tag size={20} className="text-blue-600" /> Historial de Aretes</h3>
          {animal.aretes?.length===0 ? <p className="text-gray-400 text-sm">Sin historial</p> : (
            <div className="space-y-3">{animal.aretes?.map((a:any) => (
              <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Tag size={16} className="text-gray-400" />
                <div className="flex-1"><p className="text-sm font-medium">{a.numeroArete}</p><p className="text-xs text-gray-500">{a.tipoArete} • {a.accion}</p>{a.motivo && <p className="text-xs text-gray-400">{a.motivo}</p>}</div>
                <span className="text-xs text-gray-400">{new Date(a.fecha).toLocaleDateString('es-MX')}</span>
              </div>
            ))}</div>
          )}
        </div>
        {animal.lecturas?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Thermometer size={20} className="text-orange-600" /> Lecturas IoT</h3>
            <div className="space-y-2">{animal.lecturas.map((l:any) => (
              <div key={l.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex items-center gap-4"><span className="text-orange-600 font-medium">{l.temperatura?.toFixed(1)}°C</span><span className="text-gray-500 flex items-center gap-1"><MapPin size={14} />{l.latitud.toFixed(4)}, {l.longitud.toFixed(4)}</span></div>
                <span className="text-gray-400 text-xs">{new Date(l.timestamp).toLocaleString('es-MX')}</span>
              </div>
            ))}</div>
          </div>
        )}
      </div>
    </div>
  );
};
export default AnimalDetallePage;
