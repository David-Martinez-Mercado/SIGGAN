import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileText, Plus, Send, CheckCircle, XCircle, Eye, Edit, Printer, X } from 'lucide-react';
import api from '../services/api';

const TIPOS: Record<string, string> = {
  GUIA_REEMO: '🚛 Guía de Tránsito REEMO',
  CERTIFICADO_ZOOSANITARIO: '📋 Constancia Zoosanitaria',
  SOLICITUD_TB_BR: '🔬 Solicitud Pruebas TB/BR',
};
const estatusColor: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-700', ENVIADO: 'bg-blue-100 text-blue-700',
  APROBADO: 'bg-green-100 text-green-700', RECHAZADO: 'bg-red-100 text-red-700',
};

const FormulariosPage: React.FC = () => {
  const { user } = useAuth();
  const esMVZ = user?.rol === 'MVZ' || user?.rol === 'ADMIN';
  const esAdmin = user?.rol === 'ADMIN';
  const [formularios, setFormularios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<string | null>(null);
  const [viewForm, setViewForm] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const [animales, setAnimales] = useState<any[]>([]);
  const [misUpps, setMisUpps] = useState<any[]>([]);
  const [todasUpps, setTodasUpps] = useState<any[]>([]);
  const [selectedAnimals, setSelectedAnimals] = useState<string[]>([]);
  const [formData, setFormData] = useState<any>({});

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [formRes, animRes, uppRes] = await Promise.all([
        api.get('/formularios'),
        api.get('/animales?limit=100'),
        api.get('/upps'),
      ]);
      setFormularios(formRes.data || []);
      setAnimales(animRes.data.data || []);
      setMisUpps(Array.isArray(uppRes.data) ? uppRes.data : uppRes.data.data || []);
      // Todas las UPPs para guías
      try { const allRes = await api.get('/formularios/all-upps'); setTodasUpps(allRes.data || []); }
      catch { setTodasUpps([]); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const toggleAnimal = (id: string) => setSelectedAnimals(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const set = (k: string, v: any) => setFormData((p: any) => ({ ...p, [k]: v }));

  const handleGuiaReemo = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setError('');
    try {
      const res = await api.post('/formularios/guia-reemo', { ...formData, animalIds: selectedAnimals });
      setMsg(`✅ Guía REEMO creada: ${res.data.folio}`);
      setShowForm(null); setSelectedAnimals([]); setFormData({}); fetchAll();
    } catch (err: any) { setError(err.response?.data?.error || 'Error'); }
  };
  const handleConstancia = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setError('');
    try {
      const res = await api.post('/formularios/constancia-zoosanitaria', { ...formData, animalIds: selectedAnimals });
      setMsg(`✅ Constancia creada: ${res.data.folio}`);
      setShowForm(null); setSelectedAnimals([]); setFormData({}); fetchAll();
    } catch (err: any) { setError(err.response?.data?.error || 'Error'); }
  };
  const handleSolicitudTB = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setError('');
    try {
      const res = await api.post('/formularios/solicitud-tb-br', formData);
      setMsg(`✅ Solicitud creada: ${res.data.folio}`);
      setShowForm(null); setFormData({}); fetchAll();
    } catch (err: any) { setError(err.response?.data?.error || 'Error'); }
  };

  const cambiarEstatus = async (id: string, estatus: string) => {
    try { await api.put(`/formularios/${id}/estatus`, { estatus }); setMsg(`Formulario ${estatus.toLowerCase()}`); setViewForm(null); fetchAll(); }
    catch (err: any) { setError(err.response?.data?.error || 'Error'); }
  };

  const guardarEdicion = async () => {
    if (!editForm) return;
    try {
      await api.put(`/formularios/${editForm.id}`, { datos: editForm.datos });
      setMsg('✅ Formulario actualizado'); setEditForm(null); fetchAll();
    } catch (err: any) { setError(err.response?.data?.error || 'Error'); }
  };

  const verPDF = (id: string) => {
    const token = localStorage.getItem('siggan_token');
    window.open(`http://localhost:3001/api/formularios/${id}/pdf?token=${token}`, '_blank');
  };

  // Selector de animales reutilizable
  const AnimalSelector = ({ color = 'emerald' }: { color?: string }) => (
    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
      <label className="text-sm font-medium text-gray-700 mb-2 block">Animales a incluir ({selectedAnimals.length})</label>
      {animales.map(a => (
        <label key={a.id} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-sm ${selectedAnimals.includes(a.id) ? `bg-${color}-50` : ''}`}>
          <input type="checkbox" checked={selectedAnimals.includes(a.id)} onChange={() => toggleAnimal(a.id)} className="rounded" />
          <span className="font-mono text-emerald-600">{a.areteNacional}</span>
          <span className="text-gray-600">{a.nombre || a.raza} — {a.sexo}</span>
          <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${a.estatusSanitario === 'SANO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{a.estatusSanitario}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">📋 Formularios SENASICA</h1><p className="text-gray-500 text-sm mt-1">Guías de tránsito, constancias y solicitudes oficiales</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setShowForm('GUIA'); setSelectedAnimals([]); setFormData({}); }} className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"><Plus size={16} /> Guía REEMO</button>
          {esMVZ && <button onClick={() => { setShowForm('CONST'); setSelectedAnimals([]); setFormData({}); }} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"><Plus size={16} /> Constancia</button>}
          <button onClick={() => { setShowForm('TB'); setFormData({}); }} className="flex items-center gap-1 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700"><Plus size={16} /> Solicitud TB/BR</button>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{msg}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      {/* GUIA REEMO FORM */}
      {showForm === 'GUIA' && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex justify-between mb-4"><h3 className="text-lg font-semibold">🚛 Nueva Guía de Tránsito REEMO</h3><button onClick={() => setShowForm(null)}><X size={20} className="text-gray-400" /></button></div>
          <form onSubmit={handleGuiaReemo} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">UPP Origen (mía) *</label>
                <select value={formData.uppOrigenId || ''} onChange={e => set('uppOrigenId', e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="">Seleccionar...</option>{misUpps.map((u: any) => <option key={u.id} value={u.id}>{u.nombre} ({u.claveUPP})</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">UPP Destino (cualquiera)</label>
                <select value={formData.uppDestinoId || ''} onChange={e => set('uppDestinoId', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="">Seleccionar...</option>{todasUpps.map((u: any) => <option key={u.id} value={u.id}>{u.nombre} ({u.claveUPP}) — {u.propietario?.nombre} {u.propietario?.apellidos}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <select value={formData.motivoMovimiento || 'Movilización'} onChange={e => set('motivoMovimiento', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option>Movilización</option><option>Venta</option><option>Feria/Exposición</option><option>Sacrificio</option><option>Exportación</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Transportista</label><input value={formData.transportista || ''} onChange={e => set('transportista', e.target.value)} placeholder="Nombre" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Placas</label><input value={formData.placas || ''} onChange={e => set('placas', e.target.value)} placeholder="DGO-123-A" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            </div>
            <AnimalSelector />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={selectedAnimals.length === 0} className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">Generar Guía</button>
            </div>
          </form>
        </div>
      )}

      {/* CONSTANCIA FORM */}
      {showForm === 'CONST' && esMVZ && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex justify-between mb-4"><h3 className="text-lg font-semibold">📋 Nueva Constancia Zoosanitaria</h3><button onClick={() => setShowForm(null)}><X size={20} className="text-gray-400" /></button></div>
          <form onSubmit={handleConstancia} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">UPP *</label>
                <select value={formData.uppId || ''} onChange={e => set('uppId', e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="">Seleccionar...</option>{todasUpps.map((u: any) => <option key={u.id} value={u.id}>{u.nombre} ({u.claveUPP}) — {u.propietario?.nombre}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Dictamen</label>
                <select value={formData.dictamen || 'FAVORABLE'} onChange={e => set('dictamen', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="FAVORABLE">Favorable</option><option value="NO_FAVORABLE">No Favorable</option><option value="PENDIENTE">Pendiente</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">MVZ Nombre</label><input value={formData.mvzNombre || ''} onChange={e => set('mvzNombre', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Cédula MVZ</label><input value={formData.mvzCedula || ''} onChange={e => set('mvzCedula', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label><input value={formData.observaciones || ''} onChange={e => set('observaciones', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            </div>
            <AnimalSelector color="blue" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={selectedAnimals.length === 0} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Generar Constancia</button>
            </div>
          </form>
        </div>
      )}

      {/* SOLICITUD TB/BR FORM */}
      {showForm === 'TB' && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex justify-between mb-4"><h3 className="text-lg font-semibold">🔬 Solicitud de Pruebas TB/BR</h3><button onClick={() => setShowForm(null)}><X size={20} className="text-gray-400" /></button></div>
          <form onSubmit={handleSolicitudTB} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">UPP *</label>
              <select value={formData.uppId || ''} onChange={e => set('uppId', e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                <option value="">Seleccionar...</option>{misUpps.map((u: any) => <option key={u.id} value={u.id}>{u.nombre} ({u.claveUPP})</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Animales a muestrear</label><input type="number" value={formData.totalAnimalesPrueba || ''} onChange={e => set('totalAnimalesPrueba', parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha solicitada</label><input type="date" value={formData.fechaSolicitada || ''} onChange={e => set('fechaSolicitada', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label><input value={formData.observaciones || ''} onChange={e => set('observaciones', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">Crear Solicitud</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Vista previa */}
      {viewForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewForm(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <div><h3 className="text-lg font-bold">{TIPOS[viewForm.tipo] || viewForm.tipo}</h3><p className="font-mono text-sm text-emerald-600">{viewForm.folio}</p></div>
              <button onClick={() => setViewForm(null)}><X size={20} /></button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${estatusColor[viewForm.estatus]}`}>{viewForm.estatus}</span>
              <span className="text-xs text-gray-400">por {viewForm.usuario?.nombre} {viewForm.usuario?.apellidos}</span>
            </div>
            <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-auto max-h-64 whitespace-pre-wrap">{JSON.stringify(viewForm.datos, null, 2)}</pre>

            <div className="flex flex-wrap gap-2 mt-4 justify-end">
              <button onClick={() => verPDF(viewForm.id)} className="flex items-center gap-1 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900"><Printer size={14} /> Ver / Imprimir PDF</button>
              {viewForm.estatus === 'BORRADOR' && viewForm.usuarioId === user?.id && (
                <>
                  <button onClick={() => { setEditForm({ ...viewForm, datos: { ...viewForm.datos } }); setViewForm(null); }} className="flex items-center gap-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"><Edit size={14} /> Editar</button>
                  <button onClick={() => cambiarEstatus(viewForm.id, 'ENVIADO')} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Send size={14} /> Enviar a revisión</button>
                </>
              )}
              {esAdmin && viewForm.estatus === 'ENVIADO' && (
                <>
                  <button onClick={() => cambiarEstatus(viewForm.id, 'APROBADO')} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"><CheckCircle size={14} /> Aprobar</button>
                  <button onClick={() => cambiarEstatus(viewForm.id, 'RECHAZADO')} className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"><XCircle size={14} /> Rechazar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editar borrador */}
      {editForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditForm(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h3 className="text-lg font-bold">✏️ Editar Borrador — {editForm.folio}</h3>
              <button onClick={() => setEditForm(null)}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              {Object.entries(editForm.datos as Record<string, any>).filter(([k]) => !['tipo', 'folio', 'animales', 'fechaEmision', 'fechaSolicitud', 'requiereAprobacionDestino', 'estatusSanitarioOrigen'].includes(k)).map(([key, val]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{key.replace(/([A-Z])/g, ' $1')}</label>
                  <input value={typeof val === 'string' ? val : JSON.stringify(val)}
                    onChange={e => setEditForm((prev: any) => ({ ...prev, datos: { ...prev.datos, [key]: e.target.value } }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditForm(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={guardarEdicion} className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* TABLA */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Folio</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estatus</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Creado por</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Cargando...</td></tr> :
            formularios.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400"><FileText className="mx-auto mb-2 text-gray-300" size={32} />No hay formularios</td></tr> :
            formularios.map((f: any) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm text-emerald-600 font-medium">{f.folio}</td>
                <td className="px-4 py-3 text-sm">{TIPOS[f.tipo] || f.tipo}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${estatusColor[f.estatus]}`}>{f.estatus}</span></td>
                <td className="px-4 py-3 text-sm text-gray-600">{f.usuario?.nombre} {f.usuario?.apellidos}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{new Date(f.createdAt).toLocaleDateString('es-MX')}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setViewForm(f)} className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"><Eye size={14} /> Ver</button>
                    <button onClick={() => verPDF(f.id)} className="text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1"><Printer size={14} /></button>
                    {f.estatus === 'BORRADOR' && f.usuarioId === user?.id && (
                      <button onClick={() => setEditForm({ ...f, datos: { ...f.datos } })} className="text-amber-600 hover:text-amber-800 text-sm flex items-center gap-1"><Edit size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default FormulariosPage;
