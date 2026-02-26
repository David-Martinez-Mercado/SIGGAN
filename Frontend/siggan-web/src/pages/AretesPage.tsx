import React, { useState } from 'react';
import { getAnimalPorArete, getHistorialAretes, transferirAnimal, getPropietarios, getUPPs } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, Tag, ArrowRight, AlertCircle } from 'lucide-react';

const AretesPage: React.FC = () => {
  const { user } = useAuth();
  const [arete, setArete] = useState('');
  const [animal, setAnimal] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [propietarios, setPropietarios] = useState<any[]>([]);
  const [upps, setUpps] = useState<any[]>([]);
  const [transferForm, setTransferForm] = useState({ nuevoPropietarioId: '', nuevaUppId: '', motivo: '' });

  const buscarArete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arete.trim()) return;
    setLoading(true); setError(''); setAnimal(null); setHistorial([]);
    try {
      const res = await getAnimalPorArete(arete.trim());
      setAnimal(res.data);
      const histRes = await getHistorialAretes(res.data.id);
      setHistorial(histRes.data || []);
    } catch (err: any) {
      setError(err.response?.status === 404 ? 'No se encontró animal con ese arete' : 'Error al buscar');
    } finally { setLoading(false); }
  };

  const openTransfer = async () => {
    try {
      const [propRes, uppRes] = await Promise.all([getPropietarios(), getUPPs()]);
      setPropietarios(Array.isArray(propRes.data) ? propRes.data : propRes.data.data || []);
      setUpps(Array.isArray(uppRes.data) ? uppRes.data : uppRes.data.data || []);
      setShowTransfer(true);
    } catch (e) { console.error(e); }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMsg('');
    try {
      const res = await transferirAnimal({ animalId: animal.id, ...transferForm });
      setMsg(res.data.message); setShowTransfer(false);
      const animalRes = await getAnimalPorArete(arete.trim()); setAnimal(animalRes.data);
      const histRes = await getHistorialAretes(animalRes.data.id); setHistorial(histRes.data || []);
    } catch (err: any) { setError(err.response?.data?.error || 'Error en transferencia'); }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Gestión de Aretes</h1>
      <form onSubmit={buscarArete} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Tag size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={arete} onChange={e => setArete(e.target.value)}
              placeholder="Ingresa número de arete (ej: MX100045001)..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-lg" autoFocus />
          </div>
          <button type="submit" disabled={loading} className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2"><AlertCircle size={16} />{error}</div>}
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{msg}</div>}

      {animal && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{animal.nombre || 'Sin nombre'}</h3>
                <p className="text-emerald-600 font-mono font-medium">{animal.areteNacional}</p>
                {animal.areteExportacion && <p className="text-blue-600 font-mono text-sm">Exp: {animal.areteExportacion}</p>}
                {animal.rfidTag && <p className="text-gray-400 font-mono text-sm">RFID: {animal.rfidTag}</p>}
                <div className="flex gap-4 mt-2 text-sm text-gray-600"><span>{animal.raza}</span><span>{animal.sexo === 'MACHO' ? '♂ Macho' : '♀ Hembra'}</span></div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Propietario actual</p>
                <p className="font-medium">{animal.propietario?.nombre} {animal.propietario?.apellidos}</p>
                <p className="text-sm text-gray-400">{animal.upp?.nombre} — {animal.upp?.municipio}</p>
                {(user?.rol === 'ADMIN') && (
                  <button onClick={openTransfer} className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium ml-auto">
                    <ArrowRight size={14} /> Transferir
                  </button>
                )}
              </div>
            </div>
          </div>

          {showTransfer && (
            <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Transferir Animal</h3>
              <form onSubmit={handleTransfer} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo Propietario *</label>
                  <select value={transferForm.nuevoPropietarioId} onChange={e => setTransferForm(p => ({...p, nuevoPropietarioId: e.target.value}))} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    <option value="">Seleccionar...</option>
                    {propietarios.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nueva UPP *</label>
                  <select value={transferForm.nuevaUppId} onChange={e => setTransferForm(p => ({...p, nuevaUppId: e.target.value}))} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    <option value="">Seleccionar...</option>
                    {upps.map((u: any) => <option key={u.id} value={u.id}>{u.nombre} ({u.claveUPP})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                  <input value={transferForm.motivo} onChange={e => setTransferForm(p => ({...p, motivo: e.target.value}))}
                    placeholder="Venta, donación..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
                <div className="sm:col-span-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowTransfer(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Confirmar</button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Tag size={20} className="text-blue-600" /> Historial de Aretes</h3>
            {historial.length === 0 ? <p className="text-gray-400 text-sm">Sin registros</p> : (
              <div className="space-y-2">
                {historial.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${h.tipoArete==='EXPORTACION'?'bg-blue-100 text-blue-700':h.tipoArete==='RFID'?'bg-purple-100 text-purple-700':'bg-emerald-100 text-emerald-700'}`}>{h.tipoArete}</span>
                      <span className="font-mono text-sm font-medium">{h.numeroArete}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${h.accion==='TRANSFERIDO'?'bg-orange-100 text-orange-700':h.accion==='BAJA'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-700'}`}>{h.accion}</span>
                    </div>
                    <div className="text-right">
                      {h.motivo && <p className="text-xs text-gray-500">{h.motivo}</p>}
                      <p className="text-xs text-gray-400">{new Date(h.fecha).toLocaleDateString('es-MX')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default AretesPage;
