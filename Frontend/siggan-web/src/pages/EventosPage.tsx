import React, { useEffect, useState } from 'react';
import { getEventos, getAnimales, createEvento, createEventoLote, getReactores } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Syringe, Plus, AlertTriangle, Filter, X } from 'lucide-react';

const TIPOS = [
  { value: 'VACUNACION', label: '💉 Vacunación' }, { value: 'PRUEBA_TB', label: '🔬 Prueba TB' },
  { value: 'PRUEBA_BR', label: '🔬 Prueba BR' }, { value: 'DESPARASITACION', label: '💊 Desparasitación' },
  { value: 'TRATAMIENTO', label: '🩺 Tratamiento' }, { value: 'PESAJE', label: '⚖️ Pesaje' },
  { value: 'INSPECCION', label: '📋 Inspección' }, { value: 'OTRO', label: '📝 Otro' },
];
const tipoIcon: Record<string, string> = { VACUNACION:'💉', PRUEBA_TB:'🔬', PRUEBA_BR:'🔬', DESPARASITACION:'💊', TRATAMIENTO:'🩺', PESAJE:'⚖️', INSPECCION:'📋', OTRO:'📝' };

const EventosPage: React.FC = () => {
  const { user } = useAuth();
  const esMVZ = user?.rol === 'MVZ' || user?.rol === 'ADMIN';
  const [eventos, setEventos] = useState<any[]>([]);
  const [reactores, setReactores] = useState<any[]>([]);
  const [animales, setAnimales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showLote, setShowLote] = useState(false);
  const [tab, setTab] = useState<'eventos' | 'reactores'>('eventos');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    animalId: '', tipo: 'VACUNACION', descripcion: '', fecha: new Date().toISOString().split('T')[0],
    resultado: '', mvzResponsable: '', cedulaMvz: '', lote: '', observaciones: '', pesoKg: '',
  });

  const [loteForm, setLoteForm] = useState({
    selectedIds: [] as string[], tipo: 'VACUNACION', descripcion: '', fecha: new Date().toISOString().split('T')[0],
    resultado: '', mvzResponsable: '', lote: '',
  });

  const fetchEventos = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (filtroTipo) params.tipo = filtroTipo;
      const [evRes, reactRes] = await Promise.all([getEventos(params), getReactores()]);
      setEventos(evRes.data.data || []);
      setReactores(reactRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchAnimales = async () => {
    try { const res = await getAnimales({ limit: 100 }); setAnimales(res.data.data || []); }
    catch (e) { console.error(e); }
  };

  useEffect(() => { fetchEventos(); }, [filtroTipo]);
  useEffect(() => { if (showForm || showLote) fetchAnimales(); }, [showForm, showLote]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMsg('');
    try {
      const data = { ...form };
      // Si es pesaje, poner los kg en resultado
      if (form.tipo === 'PESAJE' && form.pesoKg) {
        data.resultado = `${form.pesoKg} kg`;
        data.descripcion = data.descripcion || `Pesaje en báscula: ${form.pesoKg} kg`;
      }
      await createEvento(data);
      setMsg('Evento registrado exitosamente');
      setShowForm(false);
      setForm({ animalId: '', tipo: 'VACUNACION', descripcion: '', fecha: new Date().toISOString().split('T')[0], resultado: '', mvzResponsable: '', cedulaMvz: '', lote: '', observaciones: '', pesoKg: '' });
      fetchEventos();
    } catch (err: any) { setError(err.response?.data?.error || 'Error al registrar'); }
  };

  const handleLoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMsg('');
    if (loteForm.selectedIds.length === 0) { setError('Selecciona al menos un animal'); return; }
    try {
      const { selectedIds, ...data } = loteForm;
      await createEventoLote({ animalIds: selectedIds, ...data });
      setMsg(`Evento aplicado a ${selectedIds.length} animales`);
      setShowLote(false);
      setLoteForm({ selectedIds: [], tipo: 'VACUNACION', descripcion: '', fecha: new Date().toISOString().split('T')[0], resultado: '', mvzResponsable: '', lote: '' });
      fetchEventos();
    } catch (err: any) { setError(err.response?.data?.error || 'Error'); }
  };

  const toggleAnimal = (id: string) => setLoteForm(p => ({ ...p, selectedIds: p.selectedIds.includes(id) ? p.selectedIds.filter(x => x !== id) : [...p.selectedIds, id] }));
  const selectAll = () => setLoteForm(p => ({ ...p, selectedIds: p.selectedIds.length === animales.length ? [] : animales.map(a => a.id) }));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Eventos Sanitarios</h1>
        {esMVZ && (
          <div className="flex gap-2">
            <button onClick={() => { setShowLote(true); setShowForm(false); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700"><Syringe size={18} /> Vacunación en Lote</button>
            <button onClick={() => { setShowForm(true); setShowLote(false); }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-emerald-700"><Plus size={18} /> Nuevo Evento</button>
          </div>
        )}
      </div>

      {!esMVZ && <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm mb-4">Solo los Médicos Veterinarios (MVZ) pueden registrar eventos sanitarios. Aquí puedes consultar el historial de tus animales.</div>}
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{msg}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('eventos')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab==='eventos'?'bg-emerald-600 text-white':'bg-gray-100 text-gray-600'}`}>Todos los Eventos</button>
        <button onClick={() => setTab('reactores')} className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1 ${tab==='reactores'?'bg-red-600 text-white':'bg-gray-100 text-gray-600'}`}><AlertTriangle size={14} /> Reactores ({reactores.length})</button>
      </div>

      {/* Form individual - solo MVZ */}
      {showForm && esMVZ && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Registrar Evento Sanitario</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Animal *</label>
              <select value={form.animalId} onChange={e => setForm(p => ({...p, animalId: e.target.value}))} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value="">Seleccionar...</option>
                {animales.map(a => <option key={a.id} value={a.id}>{a.areteNacional} — {a.nombre || a.raza}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(p => ({...p, tipo: e.target.value, resultado: '', pesoKg: ''}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm(p => ({...p, fecha: e.target.value}))} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(p => ({...p, descripcion: e.target.value}))} placeholder={form.tipo === 'PESAJE' ? 'Pesaje en báscula' : 'Vacuna contra Brucela (RB51)'} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>

            {/* Campo especial para PESAJE */}
            {form.tipo === 'PESAJE' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg) *</label>
                <input type="number" step="0.1" min="0" value={form.pesoKg} onChange={e => setForm(p => ({...p, pesoKg: e.target.value}))} required
                  placeholder="450.5" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resultado</label>
                <select value={form.resultado} onChange={e => setForm(p => ({...p, resultado: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="">Sin resultado</option><option value="APLICADA">Aplicada</option><option value="NEGATIVO">Negativo</option><option value="POSITIVO">Positivo</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MVZ Responsable</label>
              <input value={form.mvzResponsable} onChange={e => setForm(p => ({...p, mvzResponsable: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cédula MVZ</label>
              <input value={form.cedulaMvz} onChange={e => setForm(p => ({...p, cedulaMvz: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
              <input value={form.lote} onChange={e => setForm(p => ({...p, lote: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700">Cancelar</button>
              <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Form lote - solo MVZ */}
      {showLote && esMVZ && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-900">Evento en Lote</h3>
            <button onClick={() => setShowLote(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleLoteSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label><select value={loteForm.tipo} onChange={e => setLoteForm(p => ({...p, tipo: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm">{TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label><input type="date" value={loteForm.fecha} onChange={e => setLoteForm(p => ({...p, fecha: e.target.value}))} required className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Resultado</label><select value={loteForm.resultado} onChange={e => setLoteForm(p => ({...p, resultado: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="">Sin resultado</option><option value="APLICADA">Aplicada</option><option value="NEGATIVO">Negativo</option><option value="POSITIVO">Positivo</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label><input value={loteForm.descripcion} onChange={e => setLoteForm(p => ({...p, descripcion: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">MVZ</label><input value={loteForm.mvzResponsable} onChange={e => setLoteForm(p => ({...p, mvzResponsable: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Lote</label><input value={loteForm.lote} onChange={e => setLoteForm(p => ({...p, lote: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
            <div className="border rounded-lg p-3 mb-4 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Seleccionados: <span className="text-blue-600">{loteForm.selectedIds.length}</span> de {animales.length}</label>
                <button type="button" onClick={selectAll} className="text-xs text-blue-600 hover:underline">{loteForm.selectedIds.length === animales.length ? 'Deseleccionar' : 'Seleccionar todos'}</button>
              </div>
              {animales.map(a => (
                <label key={a.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${loteForm.selectedIds.includes(a.id)?'bg-blue-50':'hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={loteForm.selectedIds.includes(a.id)} onChange={() => toggleAnimal(a.id)} className="rounded" />
                  <span className="font-mono text-emerald-600">{a.areteNacional}</span>
                  <span className="text-gray-600">{a.nombre || a.raza}</span>
                  <span className="text-gray-400 text-xs ml-auto">{a.upp?.nombre}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowLote(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={loteForm.selectedIds.length===0} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Aplicar a {loteForm.selectedIds.length} animales</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
        <div className="flex items-center gap-3"><Filter size={18} className="text-gray-400" />
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">Todos los tipos</option>{TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {tab === 'eventos' ? (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50"><tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Animal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Resultado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">MVZ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Cargando...</td></tr> :
                eventos.length===0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No hay eventos</td></tr> :
                eventos.map((ev: any) => (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm"><span className="mr-1">{tipoIcon[ev.tipo]}</span>{ev.tipo.replace('_',' ')}</td>
                    <td className="px-4 py-3"><span className="font-mono text-sm text-emerald-600">{ev.animal?.areteNacional}</span><span className="text-xs text-gray-400 block">{ev.animal?.nombre||ev.animal?.raza}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{ev.descripcion||'—'}</td>
                    <td className="px-4 py-3">{ev.resultado ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${ev.resultado==='POSITIVO'?'bg-red-100 text-red-700':ev.resultado==='NEGATIVO'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-700'}`}>{ev.resultado}</span> : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ev.mvzResponsable||'—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{new Date(ev.fecha).toLocaleDateString('es-MX')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reactores.length===0 ? <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-400">No hay reactores</div> :
          reactores.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-red-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1"><AlertTriangle size={16} className="text-red-500" /><span className="font-mono text-emerald-600 font-medium">{r.animal?.areteNacional}</span><span className="text-gray-600">{r.animal?.nombre} — {r.animal?.raza}</span></div>
                  <p className="text-sm text-gray-600">{r.tipo.replace('_',' ')} — <span className="text-red-600 font-medium">POSITIVO</span></p>
                  <p className="text-sm text-gray-400">{new Date(r.fecha).toLocaleDateString('es-MX')}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-600">{r.animal?.propietario?.nombre} {r.animal?.propietario?.apellidos}</p>
                  <p className="text-gray-400">{r.animal?.upp?.nombre} — {r.animal?.upp?.municipio}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default EventosPage;
