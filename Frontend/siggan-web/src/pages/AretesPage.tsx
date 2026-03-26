import React, { useState, useEffect } from 'react';
import {
  getAnimalPorArete, getHistorialAretes, transferirAnimal, getPropietarios, getUPPs,
  getPoolAretes, addPoolAretes, deletePoolArete,
  getExportacionPendientes, aprobarExportacion, rechazarExportacion,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, Tag, ArrowRight, AlertCircle, Plus, Trash2, CheckCircle, XCircle, Package, RefreshCw } from 'lucide-react';

// ─── Tab helper ────────────────────────────────────────────────────────────────
type Tab = 'buscar' | 'pool' | 'exportacion';

const AretesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN' || user?.rol === 'SUPER_ADMIN';
  const [tab, setTab] = useState<Tab>('buscar');

  // ── Búsqueda ─────────────────────────────────────────────────────────────────
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

  // ── Pool ──────────────────────────────────────────────────────────────────────
  const [pool, setPool] = useState<any[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolMsg, setPoolMsg] = useState('');
  const [poolError, setPoolError] = useState('');
  const [poolFilter, setPoolFilter] = useState<'TODOS' | 'NACIONAL' | 'EXPORTACION'>('TODOS');
  const [showAddPool, setShowAddPool] = useState(false);
  const [addMode, setAddMode] = useState<'rango' | 'lista'>('rango');
  const [addForm, setAddForm] = useState({ tipo: 'NACIONAL', desde: '', hasta: '', prefijo: '', numerosRaw: '' });
  const [adding, setAdding] = useState(false);

  const loadPool = async () => {
    setPoolLoading(true); setPoolError('');
    try {
      const params: any = {};
      if (poolFilter !== 'TODOS') params.tipo = poolFilter;
      const res = await getPoolAretes(params);
      setPool(res.data || []);
    } catch { setPoolError('Error al cargar pool'); }
    finally { setPoolLoading(false); }
  };

  useEffect(() => { if (tab === 'pool') loadPool(); }, [tab, poolFilter]);

  const handleAddPool = async (e: React.FormEvent) => {
    e.preventDefault(); setAdding(true); setPoolMsg(''); setPoolError('');
    try {
      const payload: any = { tipo: addForm.tipo };
      if (addMode === 'rango') {
        payload.desde = addForm.desde;
        payload.hasta = addForm.hasta;
        if (addForm.prefijo) payload.prefijo = addForm.prefijo;
      } else {
        payload.numeros = addForm.numerosRaw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      }
      const res = await addPoolAretes(payload);
      setPoolMsg(res.data.message);
      setShowAddPool(false);
      setAddForm({ tipo: 'NACIONAL', desde: '', hasta: '', prefijo: '', numerosRaw: '' });
      loadPool();
    } catch (err: any) { setPoolError(err.response?.data?.error || 'Error al agregar'); }
    finally { setAdding(false); }
  };

  const handleDeletePool = async () => {
    if (!deletePoolId) return;
    try {
      await deletePoolArete(deletePoolId.id);
      setPool(p => p.filter(a => a.id !== deletePoolId.id));
      setDeletePoolId(null);
    } catch (err: any) { setPoolError(err.response?.data?.error || 'Error al eliminar'); setDeletePoolId(null); }
  };

  // ── Solicitudes exportación ───────────────────────────────────────────────────
  const [exportSols, setExportSols] = useState<any[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [exportError, setExportError] = useState('');
  const [poolDisponibles, setPoolDisponibles] = useState<any[]>([]);
  const [aprobarForm, setAprobarForm] = useState<{ [id: string]: string }>({}); // formularioId → areteNumero
  const [rechazarId, setRechazarId] = useState<string | null>(null);
  const [rechazarMotivo, setRechazarMotivo] = useState('');
  const [deletePoolId, setDeletePoolId] = useState<{ id: string; numero: string } | null>(null);

  const loadExportSols = async () => {
    setExportLoading(true); setExportError('');
    try {
      const [solRes, poolRes] = await Promise.all([
        getExportacionPendientes(),
        getPoolAretes({ tipo: 'EXPORTACION', soloDisponibles: 'true' }),
      ]);
      setExportSols(solRes.data || []);
      setPoolDisponibles(poolRes.data || []);
    } catch { setExportError('Error al cargar solicitudes'); }
    finally { setExportLoading(false); }
  };

  useEffect(() => { if (tab === 'exportacion') loadExportSols(); }, [tab]);

  const handleAprobar = async (formularioId: string) => {
    setExportMsg(''); setExportError('');
    try {
      const areteNumero = aprobarForm[formularioId] || undefined;
      const res = await aprobarExportacion(formularioId, areteNumero ? { areteNumero } : {});
      setExportMsg(res.data.message + ` — Arete: ${res.data.areteAsignado}`);
      loadExportSols();
    } catch (err: any) { setExportError(err.response?.data?.error || 'Error al aprobar'); }
  };

  const handleRechazar = async () => {
    if (!rechazarId) return;
    setExportMsg(''); setExportError('');
    try {
      await rechazarExportacion(rechazarId, rechazarMotivo);
      setExportMsg('Solicitud rechazada');
      setRechazarId(null); setRechazarMotivo('');
      loadExportSols();
    } catch (err: any) { setExportError(err.response?.data?.error || 'Error al rechazar'); }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Aretes</h1>
        {isAdmin && (
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button className={tabClass('buscar')} onClick={() => setTab('buscar')}>
              <Search size={14} className="inline mr-1" />Buscar
            </button>
            <button className={tabClass('pool')} onClick={() => setTab('pool')}>
              <Package size={14} className="inline mr-1" />Pool
            </button>
            <button className={tabClass('exportacion')} onClick={() => setTab('exportacion')}>
              <Tag size={14} className="inline mr-1" />Exportación
            </button>
          </div>
        )}
      </div>

      {/* ── TAB: BUSCAR ─────────────────────────────────────────────────────────── */}
      {tab === 'buscar' && (
        <>
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
                    {isAdmin && (
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
        </>
      )}

      {/* ── TAB: POOL ────────────────────────────────────────────────────────────── */}
      {tab === 'pool' && isAdmin && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Filtrar:</label>
              {(['TODOS', 'NACIONAL', 'EXPORTACION'] as const).map(f => (
                <button key={f} onClick={() => setPoolFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${poolFilter === f ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {f}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={loadPool} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                <RefreshCw size={16} />
              </button>
              <button onClick={() => setShowAddPool(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                <Plus size={16} /> Agregar aretes
              </button>
            </div>
          </div>

          {poolMsg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{poolMsg}</div>}
          {poolError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{poolError}</div>}

          {/* Add form */}
          {showAddPool && (
            <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Agregar aretes al pool</h3>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setAddMode('rango')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${addMode === 'rango' ? 'bg-emerald-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  Por rango numérico
                </button>
                <button onClick={() => setAddMode('lista')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${addMode === 'lista' ? 'bg-emerald-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  Por lista manual
                </button>
              </div>
              <form onSubmit={handleAddPool}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                    <select value={addForm.tipo} onChange={e => setAddForm(p => ({...p, tipo: e.target.value}))} required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                      <option value="NACIONAL">Nacional</option>
                      <option value="EXPORTACION">Exportación</option>
                    </select>
                  </div>
                  {addMode === 'rango' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prefijo (opcional)</label>
                      <input value={addForm.prefijo} onChange={e => setAddForm(p => ({...p, prefijo: e.target.value}))}
                        placeholder={addForm.tipo === 'NACIONAL' ? 'MX10-' : 'EXP-MX-'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                    </div>
                  )}
                </div>
                {addMode === 'rango' ? (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Desde (número) *</label>
                      <input type="number" value={addForm.desde} onChange={e => setAddForm(p => ({...p, desde: e.target.value}))} required
                        placeholder="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hasta (número) *</label>
                      <input type="number" value={addForm.hasta} onChange={e => setAddForm(p => ({...p, hasta: e.target.value}))} required
                        placeholder="100" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                    </div>
                    {addForm.desde && addForm.hasta && Number(addForm.hasta) >= Number(addForm.desde) && (
                      <p className="col-span-2 text-xs text-gray-500">
                        Se generarán {Number(addForm.hasta) - Number(addForm.desde) + 1} aretes.
                        Ejemplo: {addForm.prefijo || (addForm.tipo === 'NACIONAL' ? 'MX10-' : 'EXP-MX-')}{String(addForm.desde).padStart(7, '0')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Números (uno por línea o separados por coma) *</label>
                    <textarea value={addForm.numerosRaw} onChange={e => setAddForm(p => ({...p, numerosRaw: e.target.value}))} required
                      rows={5} placeholder="MX10-0000001&#10;MX10-0000002&#10;MX10-0000003"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none font-mono" />
                    <p className="text-xs text-gray-400 mt-1">{addForm.numerosRaw.split(/[\n,]+/).filter(s => s.trim()).length} aretes detectados</p>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAddPool(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
                  <button type="submit" disabled={adding} className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                    {adding ? 'Agregando...' : 'Agregar al pool'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Pool table */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Pool de aretes
                {!poolLoading && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({pool.filter(a => !a.asignado).length} disponibles / {pool.length} total)
                  </span>
                )}
              </h3>
            </div>
            {poolLoading ? (
              <div className="p-8 text-center text-gray-400">Cargando...</div>
            ) : pool.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No hay aretes en el pool</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estatus</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agregado</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pool.map((a: any) => (
                      <tr key={a.id} className={a.asignado ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3 font-mono font-medium">{a.numero}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.tipo === 'EXPORTACION' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {a.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.asignado ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                            {a.asignado ? 'Asignado' : 'Disponible'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{new Date(a.createdAt).toLocaleDateString('es-MX')}</td>
                        <td className="px-4 py-3 text-right">
                          {!a.asignado && (
                            <button onClick={() => setDeletePoolId({ id: a.id, numero: a.numero })}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: EXPORTACIÓN ─────────────────────────────────────────────────────── */}
      {tab === 'exportacion' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border p-4">
            <div>
              <h3 className="font-semibold text-gray-900">Solicitudes de exportación pendientes</h3>
              <p className="text-xs text-gray-500 mt-0.5">Aretes disponibles en pool: {poolDisponibles.length}</p>
            </div>
            <button onClick={loadExportSols} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
              <RefreshCw size={16} />
            </button>
          </div>

          {exportMsg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{exportMsg}</div>}
          {exportError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{exportError}</div>}

          {exportLoading ? (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-400">Cargando...</div>
          ) : exportSols.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-400">
              <CheckCircle size={40} className="mx-auto mb-3 text-green-300" />
              No hay solicitudes pendientes
            </div>
          ) : (
            <div className="space-y-4">
              {exportSols.map((sol: any) => {
                const d = sol.datos || {};
                return (
                  <div key={sol.id} className="bg-white rounded-xl shadow-sm border p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-mono text-sm font-medium text-gray-500">{sol.folio}</p>
                        <p className="font-semibold text-gray-900 mt-0.5">Animal: {d.areteAnimal || '—'}</p>
                        {d.nombreAnimal && <p className="text-sm text-gray-500">{d.nombreAnimal} · {d.razaAnimal} · {d.sexoAnimal}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          Solicitado por: {sol.usuario?.nombre} {sol.usuario?.apellidos}
                          {sol.usuario?.email ? ` (${sol.usuario.email})` : ''}
                        </p>
                        <p className="text-xs text-gray-400">Fecha: {new Date(sol.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">{sol.estatus}</span>
                    </div>

                    <div className="border-t pt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Asignar arete de exportación
                        <span className="text-gray-400 font-normal ml-1">(dejar vacío para asignar automáticamente del pool)</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={aprobarForm[sol.id] || ''}
                          onChange={e => setAprobarForm(prev => ({...prev, [sol.id]: e.target.value}))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                          <option value="">Asignar automáticamente ({poolDisponibles.length} disponibles)</option>
                          {poolDisponibles.map((a: any) => (
                            <option key={a.id} value={a.numero}>{a.numero}</option>
                          ))}
                        </select>
                        <button onClick={() => handleAprobar(sol.id)}
                          disabled={poolDisponibles.length === 0 && !aprobarForm[sol.id]}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                          <CheckCircle size={16} /> Aprobar
                        </button>
                        <button onClick={() => { setRechazarId(sol.id); setRechazarMotivo(''); }}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                          <XCircle size={16} /> Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modal confirmar eliminar del pool ───────────────────────────────────── */}
      {deletePoolId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Eliminar arete del pool</h3>
            <p className="text-sm text-gray-600 mb-4">¿Eliminar <span className="font-mono font-semibold">{deletePoolId.numero}</span> del pool?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletePoolId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleDeletePool} className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal rechazar exportación ───────────────────────────────────────────── */}
      {rechazarId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Rechazar solicitud de exportación</h3>
            <label className="block text-sm font-medium text-gray-700 mb-2">Motivo del rechazo</label>
            <textarea value={rechazarMotivo} onChange={e => setRechazarMotivo(e.target.value)} rows={3}
              placeholder="Ej: Documentación incompleta, animal no cumple requisitos..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRechazarId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleRechazar} className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AretesPage;
