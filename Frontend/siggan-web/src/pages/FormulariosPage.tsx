import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileText, Plus, Send, CheckCircle, XCircle, Eye, Edit, Printer, X, ShoppingCart } from 'lucide-react';
import api from '../services/api';

const TIPOS: Record<string, string> = {
  GUIA_REEMO: '🚛 Guía de Tránsito REEMO',
  CERTIFICADO_ZOOSANITARIO: '📋 Constancia Zoosanitaria',
  SOLICITUD_TB_BR: '🔬 Solicitud Pruebas TB/BR',
  ACTA_NACIMIENTO: '🐄 Acta de Nacimiento Bovina',
  CONTRATO_COMPRAVENTA: '🤝 Contrato de Compraventa',
};
const estatusColor: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-700', ENVIADO: 'bg-blue-100 text-blue-700',
  APROBADO: 'bg-green-100 text-green-700', RECHAZADO: 'bg-red-100 text-red-700',
  PENDIENTE_FIRMA: 'bg-amber-100 text-amber-700',
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

  // Estado para generación de PDF con nuevos formatos
  const [generandoPDF, setGenerandoPDF] = useState(''); // clave del PDF en generación
  const [motiModal, setMotiModal] = useState<{ formulario: any } | null>(null);
  const [motiNumero, setMotiNumero] = useState<number>(1);

  // Estado para compraventa workflow
  const [mvzLista, setMvzLista] = useState<any[]>([]);
  const [rechazarModal, setRechazarModal] = useState<{ id: string } | null>(null);
  const [mvzModal, setMvzModal] = useState<{ id: string } | null>(null);
  const [mvzDatos, setMvzDatos] = useState<any>({});
  const [savingCV, setSavingCV] = useState('');

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
      try { const allRes = await api.get('/formularios/all-upps'); setTodasUpps(allRes.data || []); }
      catch { setTodasUpps([]); }
      // Cargar lista MVZ para compraventa
      try { const mvzRes = await api.get('/generar-documentos/mvz-lista'); setMvzLista(mvzRes.data || []); }
      catch { setMvzLista([]); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const toggleAnimal = (id: string) => setSelectedAnimals(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const set = (k: string, v: any) => setFormData((p: any) => ({ ...p, [k]: v }));

  // ── Handlers existentes (guardan en DB) ────────────────────────────────────
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

  // Aprobar acta de nacimiento (MVZ)
  const aprobarActa = async (formularioId: string) => {
    setMsg(''); setError('');
    const ok = await descargarPDF(
      `acta-nacimiento/${formularioId}/aprobar`,
      {},
      `acta_nacimiento_aprobada`,
      `acta_${formularioId}`
    );
    if (ok) { setViewForm(null); fetchAll(); setMsg('✅ Acta aprobada y PDF generado'); }
  };

  // ── Compraventa workflow handlers ─────────────────────────────────────────
  const cvEnviar = async (id: string) => {
    setSavingCV(id); setMsg(''); setError('');
    try { await api.put(`/formularios/${id}/compraventa/enviar`); fetchAll(); setViewForm(null); setMsg('✅ Contrato enviado al vendedor'); }
    catch (e: any) { setError(e.response?.data?.error || 'Error'); }
    finally { setSavingCV(''); }
  };
  const cvAceptar = async (id: string) => {
    setSavingCV(id); setMsg(''); setError('');
    try { await api.put(`/formularios/${id}/compraventa/aceptar`); fetchAll(); setViewForm(null); setMsg('✅ Contrato aceptado. El MVZ debe completar los datos.'); }
    catch (e: any) { setError(e.response?.data?.error || 'Error'); }
    finally { setSavingCV(''); }
  };
  const cvRechazar = async (id: string, motivo: string) => {
    setSavingCV(id); setMsg(''); setError('');
    try { await api.put(`/formularios/${id}/compraventa/rechazar`, { motivo }); fetchAll(); setRechazarModal(null); setViewForm(null); setMsg('Contrato rechazado.'); }
    catch (e: any) { setError(e.response?.data?.error || 'Error'); }
    finally { setSavingCV(''); }
  };
  const cvMvzGuardar = async (id: string) => {
    setSavingCV(id); setMsg(''); setError('');
    try {
      await api.put(`/formularios/${id}/compraventa/mvz-datos`, mvzDatos);
      fetchAll(); setMvzModal(null); setMvzDatos({});
      setMsg('✅ Datos veterinarios guardados. Ahora puedes generar el PDF.');
    }
    catch (e: any) { setError(e.response?.data?.error || 'Error'); }
    finally { setSavingCV(''); }
  };
  const cvGenerarPDF = async (id: string, folio: string) => {
    await descargarPDF(`compraventa-firmada/${id}`, {}, `compraventa_${folio}`, `cv_${id}`);
  };

  // Reimprimir acta ya aprobada
  const reimprimirActa = async (formularioId: string, folio: string) => {
    setMsg(''); setError('');
    await descargarPDF(
      `acta-nacimiento/${formularioId}/reimprimir`,
      {},
      `acta_nacimiento_${folio}`,
      `reimp_${formularioId}`
    );
  };

  // PDF HTML antiguo — solo GUIA_REEMO y CERTIFICADO_ZOOSANITARIO
  const verPDF = (id: string) => {
    const token = localStorage.getItem('siggan_token');
    window.open(`http://localhost:3001/api/formularios/${id}/pdf?token=${token}`, '_blank');
  };

  // ── Helper: genera PDF desde los nuevos endpoints con plantillas .docx ────
  const descargarPDF = async (
    endpoint: string,
    body: object,
    nombre: string,
    clave: string
  ): Promise<boolean> => {
    setGenerandoPDF(clave);
    try {
      const token = localStorage.getItem('siggan_token');
      const res = await fetch(`http://localhost:3001/api/generar-documentos/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Error al generar PDF' }));
        setError(e.error || 'Error al generar PDF');
        return false;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${nombre}.pdf`; a.click();
      URL.revokeObjectURL(url);
      return true;
    } catch {
      setError('Error al generar PDF. Verifica que LibreOffice esté instalado en el servidor.');
      return false;
    } finally {
      setGenerandoPDF('');
    }
  };

  // ── Handlers nuevos (generan PDF directo sin guardar en DB) ───────────────
  const handleProgPruebas = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setError('');
    if (!formData.uppId) { setError('Selecciona una UPP'); return; }
    const ok = await descargarPDF(
      'programacion-pruebas',
      { uppId: formData.uppId, datos_programacion: formData },
      'programacion_pruebas',
      'prog'
    );
    if (ok) { setShowForm(null); setFormData({}); }
  };

  const handleSolicitudExp = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(''); setError('');
    if (!selectedAnimals.length) { setError('Selecciona al menos un animal'); return; }
    const ok = await descargarPDF(
      'solicitud-exportacion',
      { animalIds: selectedAnimals.slice(0, 10), datos_exportacion: formData },
      'solicitud_exportacion',
      'exp'
    );
    if (ok) { setShowForm(null); setSelectedAnimals([]); setFormData({}); }
  };

  // PDF Formato 1 desde formulario SOLICITUD_TB_BR ya guardado en DB
  const descargarF1 = async (f: any) => {
    const uppId = f.datos?.uppId;
    if (!uppId) { setError('Este formulario no tiene UPP asociada'); return; }
    await descargarPDF('programacion-pruebas', { uppId }, `formato1_${f.folio}`, `f1_${f.id}`);
  };

  // PDF Formato 2 (solicitud de prueba con checkboxes del motivo)
  const descargarF2 = async (motivo: number) => {
    if (!motiModal) return;
    const uppId = motiModal.formulario.datos?.uppId;
    const formularioId = motiModal.formulario.id;
    const folio = motiModal.formulario.folio;
    if (!uppId) { setError('Este formulario no tiene UPP asociada'); setMotiModal(null); return; }
    setMotiModal(null); // cerrar modal antes de generar
    await descargarPDF(
      'solicitud-prueba',
      { uppId, motivo_numero: motivo },
      `formato2_${folio}`,
      `f2_${formularioId}`
    );
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
          {esMVZ && <button onClick={() => { setShowForm('PROG'); setFormData({}); }} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"><Plus size={16} /> Programación Pruebas</button>}
          <button onClick={() => { setShowForm('EXP'); setSelectedAnimals([]); setFormData({}); }} className="flex items-center gap-1 bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"><Plus size={16} /> Solicitud Exportación</button>
          <button onClick={() => { setShowForm('CV'); setFormData({}); }} className="flex items-center gap-1 bg-teal-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"><ShoppingCart size={16} /> Compraventa</button>
        </div>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{msg}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      {/* ── GUIA REEMO ─────────────────────────────────────────────────────── */}
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

      {/* ── CONSTANCIA ZOOSANITARIA ─────────────────────────────────────────── */}
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

      {/* ── SOLICITUD TB/BR ────────────────────────────────────────────────── */}
      {showForm === 'TB' && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">🔬 Solicitud de Pruebas TB/BR</h3>
              <p className="text-xs text-gray-400 mt-0.5">Se incluirán automáticamente todos los animales activos de la UPP seleccionada</p>
            </div>
            <button onClick={() => setShowForm(null)}><X size={20} className="text-gray-400" /></button>
          </div>
          <form onSubmit={handleSolicitudTB} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">UPP *</label>
              <select value={formData.uppId || ''} onChange={e => set('uppId', e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                <option value="">Seleccionar...</option>
                {(esMVZ ? todasUpps : misUpps).map((u: any) => <option key={u.id} value={u.id}>{u.nombre} ({u.claveUPP}){u.propietario ? ` — ${u.propietario.nombre}` : ''}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">MVZ responsable</label>
              <select value={formData.mvzUsuarioId || ''} onChange={e => set('mvzUsuarioId', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                <option value="">Sin asignar</option>
                {mvzLista.map((m: any) => <option key={m.id} value={m.id}>{m.nombre} {m.apellidos}{m.cedulaProfesional ? ` — Céd. ${m.cedulaProfesional}` : ''}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Motivo (Formato 2 — Checkbox)</label>
              <select value={formData.motivo_numero ?? ''} onChange={e => set('motivo_numero', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                <option value="">Sin especificar</option>
                <option value="1">1 — Campaña oficial TB/BR</option>
                <option value="2">2 — Movimiento pecuario</option>
                <option value="3">3 — Exportación</option>
                <option value="4">4 — Control de foco</option>
                <option value="5">5 — Nuevos ingresos</option>
                <option value="6">6 — Diagnóstico</option>
                <option value="7">7 — Compra-venta</option>
                <option value="8">8 — Reposición de vientres</option>
                <option value="9">9 — Ganadería certificada</option>
                <option value="10">10 — Concurso/Exposición</option>
                <option value="11">11 — Pastoreo</option>
                <option value="12">12 — Certificación hato</option>
                <option value="13">13 — Semen/embriones</option>
                <option value="14">14 — Otro</option>
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha solicitada</label><input type="date" value={formData.fechaSolicitada || ''} onChange={e => set('fechaSolicitada', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label><input value={formData.observaciones || ''} onChange={e => set('observaciones', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">Crear Solicitud</button>
            </div>
          </form>
        </div>
      )}

      {/* ── PROGRAMACIÓN DE PRUEBAS — Formato 1 (genera PDF directo) ─────────── */}
      {showForm === 'PROG' && esMVZ && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">📅 Programación de Pruebas — Formato 1</h3>
              <p className="text-xs text-gray-400 mt-0.5">Genera el PDF con la plantilla oficial • No guarda registro en el sistema</p>
            </div>
            <button onClick={() => setShowForm(null)}><X size={20} className="text-gray-400" /></button>
          </div>
          <form onSubmit={handleProgPruebas} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">UPP *</label>
                <select value={formData.uppId || ''} onChange={e => set('uppId', e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="">Seleccionar...</option>{todasUpps.map((u: any) => <option key={u.id} value={u.id}>{u.nombre} ({u.claveUPP}) — {u.propietario?.nombre}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">No. Solicitud</label><input value={formData.num_solicitud || ''} onChange={e => set('num_solicitud', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">DDR No.</label><input value={formData.ddr_no || ''} onChange={e => set('ddr_no', e.target.value)} placeholder="01" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Motivo de Prueba</label><input value={formData.motivo_prueba || ''} onChange={e => set('motivo_prueba', e.target.value)} placeholder="Campaña anual TB/BR..." className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Prueba</label><input type="date" value={formData.fecha_prueba || ''} onChange={e => set('fecha_prueba', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Hora de Inicio</label><input type="time" value={formData.hora_inicio || ''} onChange={e => set('hora_inicio', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre MVZ Aprobado</label><input value={formData.nombre_mvz_aprobado || ''} onChange={e => set('nombre_mvz_aprobado', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Credencial MVZ</label><input value={formData.credencial_mvz_aprobado || ''} onChange={e => set('credencial_mvz_aprobado', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Vigencia MVZ</label><input type="date" value={formData.vigencia_mvz_aprobado || ''} onChange={e => set('vigencia_mvz_aprobado', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">MVZ Supervisor</label><input value={formData.nombre_mvz_supervisor || ''} onChange={e => set('nombre_mvz_supervisor', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={generandoPDF === 'prog'} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                <FileText size={15} /> {generandoPDF === 'prog' ? 'Generando PDF...' : 'Generar Formato 1 PDF'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── SOLICITUD DE EXPORTACIÓN (tabla de animales, genera PDF directo) ─── */}
      {showForm === 'EXP' && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">🐄 Solicitud de Exportación de Ganado</h3>
              <p className="text-xs text-gray-400 mt-0.5">Genera el PDF con la plantilla oficial • No guarda registro en el sistema</p>
            </div>
            <button onClick={() => setShowForm(null)}><X size={20} className="text-gray-400" /></button>
          </div>
          <form onSubmit={handleSolicitudExp} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">DDR No.</label><input value={formData.ddr_no || ''} onChange={e => set('ddr_no', e.target.value)} placeholder="01" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label><input value={formData.motivo_prueba || ''} onChange={e => set('motivo_prueba', e.target.value)} placeholder="Exportación comercial" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Prueba</label><input type="date" value={formData.fecha_prueba || ''} onChange={e => set('fecha_prueba', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Hora de Inicio</label><input type="time" value={formData.hora_inicio || ''} onChange={e => set('hora_inicio', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre MVZ Aprobado</label><input value={formData.nombre_mvz_aprobado || ''} onChange={e => set('nombre_mvz_aprobado', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Credencial MVZ</label><input value={formData.credencial_mvz_aprobado || ''} onChange={e => set('credencial_mvz_aprobado', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label><input value={formData.observaciones || ''} onChange={e => set('observaciones', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            </div>
            <AnimalSelector />
            <p className="text-xs text-gray-400">Selecciona hasta 10 animales. Las filas sin animal quedarán vacías en el documento.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={generandoPDF === 'exp' || selectedAnimals.length === 0} className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-60">
                <FileText size={15} /> {generandoPDF === 'exp' ? 'Generando PDF...' : 'Generar Solicitud PDF'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── COMPRAVENTA — Nuevo contrato ────────────────────────────────────── */}
      {showForm === 'CV' && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">🤝 Nuevo Contrato de Compraventa</h3>
              <p className="text-xs text-gray-400 mt-0.5">El contrato se envía al vendedor para aceptar, luego al MVZ para firmar</p>
            </div>
            <button onClick={() => setShowForm(null)}><X size={20} className="text-gray-400" /></button>
          </div>
          <form onSubmit={async e => {
            e.preventDefault(); setMsg(''); setError('');
            try {
              const res = await api.post('/formularios/compraventa', formData);
              setMsg(`✅ ${res.data.message}`);
              setShowForm(null); setFormData({}); fetchAll();
            } catch (err: any) { setError(err.response?.data?.error || 'Error'); }
          }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Animal a comprar *</label>
                <select value={formData.animalId || ''} onChange={e => set('animalId', e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="">Seleccionar animal...</option>
                  {animales.map((a: any) => <option key={a.id} value={a.id}>{a.areteNacional} — {a.raza} {a.nombre ? `(${a.nombre})` : ''} | {a.sexo}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Tu UPP destino (dónde lo recibirás)</label>
                <select value={formData.compradorUPPId || ''} onChange={e => set('compradorUPPId', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="">Seleccionar UPP...</option>
                  {misUpps.map((u: any) => <option key={u.id} value={u.id}>{u.nombre} ({u.claveUPP})</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">MVZ responsable *</label>
                <select value={formData.mvzUsuarioId || ''} onChange={e => set('mvzUsuarioId', e.target.value)} required className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="">Seleccionar MVZ...</option>
                  {mvzLista.map((m: any) => <option key={m.id} value={m.id}>{m.nombre} {m.apellidos} {m.cedulaProfesional ? `— Céd. ${m.cedulaProfesional}` : ''}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Precio por animal (MXN) *</label>
                <input type="number" min="0" step="0.01" value={formData.precioUnitario || ''} onChange={e => set('precioUnitario', e.target.value)} required placeholder="ej. 25000" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago</label>
                <select value={formData.formaPago || ''} onChange={e => set('formaPago', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="">Seleccionar...</option>
                  <option>Transferencia bancaria</option><option>Efectivo</option><option>Cheque</option><option>Depósito bancario</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha de celebración</label>
                <input type="date" value={formData.fechaCelebracion || ''} onChange={e => set('fechaCelebracion', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Lugar de celebración</label>
                <input value={formData.lugarCelebracion || ''} onChange={e => set('lugarCelebracion', e.target.value)} placeholder="Municipio, Durango" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha de entrega</label>
                <input type="date" value={formData.fechaEntrega || ''} onChange={e => set('fechaEntrega', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
              </div>
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Cláusulas adicionales</label>
                <textarea value={formData.clausulasAdicionales || ''} onChange={e => set('clausulasAdicionales', e.target.value)} rows={3} placeholder="Condiciones especiales, garantías, etc." className="w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                <ShoppingCart size={15} /> Crear borrador
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL: Vista previa formulario ──────────────────────────────────── */}
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
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
              {Object.entries((viewForm.datos || {}) as Record<string, any>)
                .filter(([k]) => !k.toLowerCase().endsWith('id') && !['tipo', 'folio', 'fechaEmision', 'fechaSolicitud'].includes(k))
                .map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs">
                    <span className="font-medium text-gray-500 capitalize min-w-[120px]">{k.replace(/([A-Z])/g, ' $1')}:</span>
                    <span className="text-gray-800">{typeof v === 'boolean' ? (v ? 'Sí' : 'No') : Array.isArray(v) ? v.join(', ') : String(v ?? '—')}</span>
                  </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 mt-4 justify-end">
              {/* PDF HTML antiguo solo para GUIA y CERTIFICADO */}
              {['GUIA_REEMO', 'CERTIFICADO_ZOOSANITARIO'].includes(viewForm.tipo) && (
                <button onClick={() => verPDF(viewForm.id)} className="flex items-center gap-1 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900"><Printer size={14} /> Ver / Imprimir PDF</button>
              )}
              {/* Nuevas plantillas .docx para SOLICITUD_TB_BR */}
              {viewForm.tipo === 'SOLICITUD_TB_BR' && (
                <>
                  <button
                    onClick={() => descargarF1(viewForm)}
                    disabled={generandoPDF === `f1_${viewForm.id}`}
                    className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-60">
                    <FileText size={14} /> {generandoPDF === `f1_${viewForm.id}` ? 'Generando...' : 'Formato 1 — Programación'}
                  </button>
                  <button
                    onClick={() => { setViewForm(null); setMotiModal({ formulario: viewForm }); setMotiNumero(1); }}
                    className="flex items-center gap-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">
                    <FileText size={14} /> Formato 2 — Solicitud
                  </button>
                </>
              )}
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
              {/* Acta de Nacimiento pendiente de firma MVZ */}
              {viewForm.tipo === 'ACTA_NACIMIENTO' && viewForm.estatus === 'PENDIENTE_FIRMA' &&
                (user?.id === viewForm.datos?.mvzUsuarioId || user?.rol === 'ADMIN') && (
                  <button
                    onClick={() => aprobarActa(viewForm.id)}
                    disabled={generandoPDF === `acta_${viewForm.id}`}
                    className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-60">
                    <CheckCircle size={14} /> {generandoPDF === `acta_${viewForm.id}` ? 'Generando PDF...' : 'Firmar y generar PDF'}
                  </button>
              )}
              {/* ── Compraventa workflow buttons ── */}
              {viewForm.tipo === 'CONTRATO_COMPRAVENTA' && viewForm.estatus === 'BORRADOR' && viewForm.usuarioId === user?.id && (
                <button onClick={() => cvEnviar(viewForm.id)} disabled={savingCV === viewForm.id}
                  className="flex items-center gap-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-60">
                  <Send size={14} /> {savingCV === viewForm.id ? 'Enviando...' : 'Enviar al vendedor'}
                </button>
              )}
              {viewForm.tipo === 'CONTRATO_COMPRAVENTA' && viewForm.estatus === 'ENVIADO' &&
                (user?.id === viewForm.datos?.vendedorUsuarioId || user?.rol === 'ADMIN') && (
                  <>
                    <button onClick={() => cvAceptar(viewForm.id)} disabled={savingCV === viewForm.id}
                      className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60">
                      <CheckCircle size={14} /> Aceptar
                    </button>
                    <button onClick={() => { setViewForm(null); setRechazarModal({ id: viewForm.id }); }}
                      className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                      <XCircle size={14} /> Rechazar
                    </button>
                  </>
              )}
              {viewForm.tipo === 'CONTRATO_COMPRAVENTA' && viewForm.estatus === 'PENDIENTE_FIRMA' &&
                (user?.id === viewForm.datos?.mvzUsuarioId || user?.rol === 'ADMIN') && (
                  <button onClick={() => { setViewForm(null); setMvzModal({ id: viewForm.id }); setMvzDatos({ cedulaMVZ: viewForm.datos?.mvzCedula || '' }); }}
                    className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                    <Edit size={14} /> Completar datos veterinarios
                  </button>
              )}
              {viewForm.tipo === 'CONTRATO_COMPRAVENTA' && viewForm.estatus === 'APROBADO' && (
                <button onClick={() => cvGenerarPDF(viewForm.id, viewForm.folio)} disabled={generandoPDF === `cv_${viewForm.id}`}
                  className="flex items-center gap-1 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-900 disabled:opacity-60">
                  <Printer size={14} /> {generandoPDF === `cv_${viewForm.id}` ? 'Generando...' : 'Generar PDF'}
                </button>
              )}

              {/* Reimprimir acta ya aprobada */}
              {viewForm.tipo === 'ACTA_NACIMIENTO' && viewForm.estatus === 'APROBADO' && (
                <button
                  onClick={() => reimprimirActa(viewForm.id, viewForm.folio)}
                  disabled={generandoPDF === `reimp_${viewForm.id}`}
                  className="flex items-center gap-1 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-900 disabled:opacity-60">
                  <Printer size={14} /> {generandoPDF === `reimp_${viewForm.id}` ? 'Generando PDF...' : 'Reimprimir PDF'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Editar borrador ──────────────────────────────────────────── */}
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

      {/* ── MODAL: Seleccionar motivo para Formato 2 ────────────────────────── */}
      {motiModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setMotiModal(null)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h3 className="text-lg font-bold">📋 Formato 2 — Motivo de Solicitud</h3>
              <button onClick={() => setMotiModal(null)}><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Selecciona el número de motivo que aplica.<br />
              Se marcará con <strong>✓</strong> en el formato; los demás quedarán en blanco.
            </p>
            <div className="grid grid-cols-7 gap-2 mb-6">
              {Array.from({ length: 14 }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMotiNumero(n)}
                  className={`py-2 rounded-lg text-sm font-bold transition ${motiNumero === n ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-orange-50 hover:text-orange-700'}`}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setMotiModal(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button
                onClick={() => descargarF2(motiNumero)}
                disabled={generandoPDF.startsWith('f2_')}
                className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-60">
                <FileText size={15} /> {generandoPDF.startsWith('f2_') ? 'Generando...' : 'Generar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Rechazar contrato (vendedor) ─────────────────────────────── */}
      {rechazarModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRechazarModal(null)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h3 className="text-lg font-bold text-red-700">Rechazar contrato</h3>
              <button onClick={() => setRechazarModal(null)}><X size={20} /></button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del rechazo</label>
            <textarea id="motivo-rechazo" rows={3} placeholder="Ej. Precio no acordado, condiciones no aceptables..." className="w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRechazarModal(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button
                disabled={savingCV === rechazarModal.id}
                onClick={() => {
                  const motivo = (document.getElementById('motivo-rechazo') as HTMLTextAreaElement)?.value || '';
                  cvRechazar(rechazarModal.id, motivo);
                }}
                className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                {savingCV === rechazarModal.id ? 'Rechazando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: MVZ completa datos veterinarios ───────────────────────────── */}
      {mvzModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setMvzModal(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-indigo-700">Datos Veterinarios — Compraventa</h3>
                <p className="text-xs text-gray-400 mt-0.5">Completa la información sanitaria del animal</p>
              </div>
              <button onClick={() => setMvzModal(null)}><X size={20} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Núm. Certificado Zoosanitario</label>
                <input value={mvzDatos.numCertificado || ''} onChange={e => setMvzDatos((p: any) => ({ ...p, numCertificado: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Fecha del Certificado</label>
                <input type="date" value={mvzDatos.fechaCertificado || ''} onChange={e => setMvzDatos((p: any) => ({ ...p, fechaCertificado: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Resultado Prueba TB</label>
                <select value={mvzDatos.resultadoTB || ''} onChange={e => setMvzDatos((p: any) => ({ ...p, resultadoTB: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="">Seleccionar...</option><option>Negativo</option><option>Positivo</option><option>Sospechoso</option>
                </select></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Fecha Prueba TB</label>
                <input type="date" value={mvzDatos.fechaTB || ''} onChange={e => setMvzDatos((p: any) => ({ ...p, fechaTB: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Resultado Prueba Brucelosis</label>
                <select value={mvzDatos.resultadoBR || ''} onChange={e => setMvzDatos((p: any) => ({ ...p, resultadoBR: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="">Seleccionar...</option><option>Negativo</option><option>Positivo</option><option>Sospechoso</option>
                </select></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Fecha Prueba Brucelosis</label>
                <input type="date" value={mvzDatos.fechaBR || ''} onChange={e => setMvzDatos((p: any) => ({ ...p, fechaBR: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Cédula Profesional MVZ</label>
                <input value={mvzDatos.cedulaMVZ || ''} onChange={e => setMvzDatos((p: any) => ({ ...p, cedulaMVZ: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Vigencia de credencial</label>
                <input type="date" value={mvzDatos.vigenciaMVZ || ''} onChange={e => setMvzDatos((p: any) => ({ ...p, vigenciaMVZ: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setMvzModal(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={() => cvMvzGuardar(mvzModal.id)} disabled={savingCV === mvzModal.id}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                <CheckCircle size={14} /> {savingCV === mvzModal.id ? 'Guardando...' : 'Guardar y aprobar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TABLA DE FORMULARIOS ─────────────────────────────────────────────── */}
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
                  <div className="flex gap-2 flex-wrap items-center">
                    <button onClick={() => setViewForm(f)} className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"><Eye size={14} /> Ver</button>
                    {/* PDF HTML solo para GUIA y CERTIFICADO */}
                    {['GUIA_REEMO', 'CERTIFICADO_ZOOSANITARIO'].includes(f.tipo) && (
                      <button onClick={() => verPDF(f.id)} className="text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1"><Printer size={14} /></button>
                    )}
                    {/* Nuevas plantillas para SOLICITUD_TB_BR */}
                    {f.tipo === 'SOLICITUD_TB_BR' && (
                      <>
                        <button
                          onClick={() => descargarF1(f)}
                          disabled={generandoPDF === `f1_${f.id}`}
                          title="Formato 1 — Programación de Pruebas"
                          className="text-indigo-600 hover:text-indigo-800 text-xs font-bold disabled:opacity-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                          {generandoPDF === `f1_${f.id}` ? '...' : 'F1'}
                        </button>
                        <button
                          onClick={() => { setMotiModal({ formulario: f }); setMotiNumero(1); }}
                          title="Formato 2 — Solicitud de Prueba"
                          className="text-orange-600 hover:text-orange-800 text-xs font-bold border border-orange-200 px-1.5 py-0.5 rounded">
                          F2
                        </button>
                      </>
                    )}
                    {f.tipo === 'ACTA_NACIMIENTO' && f.estatus === 'PENDIENTE_FIRMA' &&
                      (user?.id === f.datos?.mvzUsuarioId || user?.rol === 'ADMIN') && (
                        <button
                          onClick={() => aprobarActa(f.id)}
                          disabled={generandoPDF === `acta_${f.id}`}
                          title="Firmar y generar PDF"
                          className="text-emerald-600 hover:text-emerald-800 text-xs font-bold disabled:opacity-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          {generandoPDF === `acta_${f.id}` ? '...' : '✓ Firmar'}
                        </button>
                    )}
                    {/* Compraventa en tabla */}
                    {f.tipo === 'CONTRATO_COMPRAVENTA' && f.estatus === 'BORRADOR' && f.usuarioId === user?.id && (
                      <button onClick={() => cvEnviar(f.id)} disabled={savingCV === f.id} title="Enviar al vendedor"
                        className="text-teal-600 hover:text-teal-800 text-xs font-bold disabled:opacity-50 border border-teal-200 px-1.5 py-0.5 rounded">
                        {savingCV === f.id ? '...' : '→ Vendedor'}
                      </button>
                    )}
                    {f.tipo === 'CONTRATO_COMPRAVENTA' && f.estatus === 'ENVIADO' &&
                      (user?.id === f.datos?.vendedorUsuarioId || user?.rol === 'ADMIN') && (
                        <>
                          <button onClick={() => cvAceptar(f.id)} disabled={savingCV === f.id} title="Aceptar contrato"
                            className="text-green-600 hover:text-green-800 text-xs font-bold disabled:opacity-50 border border-green-200 px-1.5 py-0.5 rounded">✓</button>
                          <button onClick={() => setRechazarModal({ id: f.id })} title="Rechazar"
                            className="text-red-600 hover:text-red-800 text-xs font-bold border border-red-200 px-1.5 py-0.5 rounded">✗</button>
                        </>
                    )}
                    {f.tipo === 'CONTRATO_COMPRAVENTA' && f.estatus === 'PENDIENTE_FIRMA' &&
                      (user?.id === f.datos?.mvzUsuarioId || user?.rol === 'ADMIN') && (
                        <button onClick={() => { setMvzModal({ id: f.id }); setMvzDatos({ cedulaMVZ: f.datos?.mvzCedula || '' }); }} title="Completar datos veterinarios"
                          className="text-indigo-600 hover:text-indigo-800 text-xs font-bold border border-indigo-200 px-1.5 py-0.5 rounded">MVZ</button>
                    )}
                    {f.tipo === 'CONTRATO_COMPRAVENTA' && f.estatus === 'APROBADO' && (
                      <button onClick={() => cvGenerarPDF(f.id, f.folio)} disabled={generandoPDF === `cv_${f.id}`} title="Generar PDF"
                        className="text-gray-600 hover:text-gray-800 text-xs font-bold disabled:opacity-50 border border-gray-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Printer size={11} /> {generandoPDF === `cv_${f.id}` ? '...' : 'PDF'}
                      </button>
                    )}
                    {f.tipo === 'ACTA_NACIMIENTO' && f.estatus === 'APROBADO' && (
                      <button
                        onClick={() => reimprimirActa(f.id, f.folio)}
                        disabled={generandoPDF === `reimp_${f.id}`}
                        title="Reimprimir PDF del acta"
                        className="text-gray-600 hover:text-gray-800 text-xs font-bold disabled:opacity-50 border border-gray-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Printer size={11} /> {generandoPDF === `reimp_${f.id}` ? '...' : 'PDF'}
                      </button>
                    )}
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
