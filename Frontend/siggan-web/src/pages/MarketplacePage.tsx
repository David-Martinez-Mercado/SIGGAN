import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, MapPin, Heart, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

const MarketplacePage: React.FC = () => {
  const { user } = useAuth();
  const esProductor = user?.rol === 'PRODUCTOR';
  const [ofertas, setOfertas] = useState<any[]>([]);
  const [misOfertas, setMisOfertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'catalogo' | 'mis-ofertas'>('catalogo');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const ofertasRes = await api.get('/marketplace');
      setOfertas(ofertasRes.data || []);
      if (esProductor) {
        const misRes = await api.get('/marketplace/mis-ofertas');
        setMisOfertas(misRes.data || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const comprar = async (id: string) => {
    if (!window.confirm('¿Deseas comprar este animal al precio publicado?')) return;
    setMsg(''); setError('');
    try { const r = await api.put(`/marketplace/${id}/ofertar`); setMsg(r.data.message); fetchData(); }
    catch (e: any) { setError(e.response?.data?.error || 'Error'); }
  };
  const aceptar = async (id: string) => {
    if (!window.confirm('¿Aceptar oferta? El animal será transferido al comprador.')) return;
    setMsg(''); setError('');
    try { const r = await api.put(`/marketplace/${id}/aceptar`); setMsg(r.data.message); fetchData(); }
    catch (e: any) { setError(e.response?.data?.error || 'Error'); }
  };
  const cancelar = async (id: string) => {
    if (!window.confirm('¿Cancelar esta oferta?')) return;
    setMsg(''); setError('');
    try { const r = await api.put(`/marketplace/${id}/cancelar`); setMsg(r.data.message); fetchData(); }
    catch (e: any) { setError(e.response?.data?.error || 'Error'); }
  };

  const edad = (f: string) => {
    const y = Math.floor((Date.now() - new Date(f).getTime()) / (365.25*24*60*60*1000));
    const m = Math.floor(((Date.now() - new Date(f).getTime()) % (365.25*24*60*60*1000)) / (30.44*24*60*60*1000));
    return y > 0 ? `${y} año${y>1?'s':''} ${m} mes${m!==1?'es':''}` : `${m} meses`;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ShoppingCart size={28} className="text-emerald-600" /> Marketplace</h1>
        <p className="text-gray-500 text-sm mt-1">Compra y venta de ganado entre productores</p>
      </div>
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{msg}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('catalogo')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab==='catalogo'?'bg-emerald-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>🛒 Catálogo ({ofertas.length})</button>
        {esProductor && (
          <button onClick={() => setTab('mis-ofertas')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab==='mis-ofertas'?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>📋 Mis Transacciones ({misOfertas.length})</button>
        )}
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Cargando...</div> : tab === 'catalogo' ? (
        ofertas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <ShoppingCart size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay animales a la venta en este momento</p>
            {esProductor && <p className="text-sm text-gray-400 mt-1">Puedes poner a la venta desde el detalle de tus animales</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ofertas.map((o: any) => (
              <div key={o.id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition">
                <div className="bg-emerald-50 px-5 py-3 border-b border-emerald-100 flex items-center justify-between">
                  <span className="text-2xl font-bold text-emerald-700">${o.precioSolicitado?.toLocaleString('es-MX')}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${o.animal?.estatusSanitario==='SANO'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{o.animal?.estatusSanitario}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-900">{o.animal?.nombre || 'Sin nombre'}</h3>
                  <p className="text-emerald-600 font-mono text-sm">{o.animal?.areteNacional}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-gray-600">
                    <span>🐄 {o.animal?.raza}</span><span>{o.animal?.sexo==='MACHO'?'♂ Macho':'♀ Hembra'}</span>
                    <span>⚖️ {o.animal?.peso?`${o.animal.peso.toFixed(0)} kg`:'—'}</span><span>📅 {edad(o.animal?.fechaNacimiento)}</span>
                    {o.animal?.color && <span>🎨 {o.animal.color}</span>}
                    {o.animal?.proposito && <span>🎯 {o.animal.proposito}</span>}
                  </div>
                  {o.descripcion && <p className="text-sm text-gray-500 mt-3 italic">"{o.descripcion}"</p>}
                  <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
                    <MapPin size={12} /> {o.vendedor?.municipio} — {o.vendedor?.nombre} {o.vendedor?.apellidos}
                  </div>
                  {/* Solo PRODUCTOR puede comprar */}
                  {esProductor && (
                    <button onClick={() => comprar(o.id)} className="w-full mt-4 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition flex items-center justify-center gap-2"><Heart size={16} /> Comprar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {misOfertas.length===0 ? <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">No tienes transacciones</div> :
          misOfertas.map((o: any) => (
            <div key={o.id} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-emerald-600 font-medium">{o.animal?.areteNacional}</span>
                    <span className="text-gray-600">{o.animal?.nombre} — {o.animal?.raza}</span>
                  </div>
                  <span className="font-bold text-emerald-700">${o.precioSolicitado?.toLocaleString('es-MX')}</span>
                  {o.comprador && <p className="text-sm text-gray-500 mt-1">Comprador: {o.comprador.nombre} {o.comprador.apellidos}</p>}
                  {o.vendedor && <p className="text-sm text-gray-500">Vendedor: {o.vendedor.nombre} {o.vendedor.apellidos}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${o.estatus==='PUBLICADO'?'bg-blue-100 text-blue-700':o.estatus==='CON_OFERTA'?'bg-yellow-100 text-yellow-700':o.estatus==='TRANSFERIDA'?'bg-green-100 text-green-700':o.estatus==='CANCELADA'?'bg-gray-100 text-gray-700':'bg-gray-100 text-gray-700'}`}>{o.estatus === 'TRANSFERIDA' ? 'VENDIDO' : o.estatus}</span>
                  {o.estatus==='CON_OFERTA' && <div className="flex gap-2">
                    <button onClick={() => aceptar(o.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"><CheckCircle size={14} /> Aceptar</button>
                    <button onClick={() => cancelar(o.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200"><XCircle size={14} /> Rechazar</button>
                  </div>}
                  {o.estatus==='PUBLICADO' && <button onClick={() => cancelar(o.id)} className="text-xs text-red-500 hover:underline">Cancelar venta</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default MarketplacePage;
