import React, { useEffect, useState } from 'react';
import { AlertTriangle, Shield, ShieldOff, Send, CheckCircle, XCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const severidadColor: Record<string, string> = {
  ALTA:  'bg-red-100 text-red-700 border-red-200',
  MEDIA: 'bg-amber-100 text-amber-700 border-amber-200',
  BAJA:  'bg-blue-100 text-blue-700 border-blue-200',
};

const CuarentenaPage: React.FC = () => {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'ADMIN' || user?.rol === 'SUPER_ADMIN';

  const [upps, setUpps] = useState<any[]>([]);
  const [mvzLista, setMvzLista] = useState<any[]>([]);
  const [investigacion, setInvestigacion] = useState<any>(null);
  const [misAlertas, setMisAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [expandVendidos, setExpandVendidos] = useState(true);
  const [expandComprados, setExpandComprados] = useState(true);

  // Modal acción
  const [accionModal, setAccionModal] = useState<{ uppId: string; uppNombre: string; direccion: 'venta' | 'compra' } | null>(null);
  const [accionSeleccionada, setAccionSeleccionada] = useState('');
  const [accionMvzId, setAccionMvzId] = useState('');
  const [accionNotas, setAccionNotas] = useState('');
  const [savingAccion, setSavingAccion] = useState(false);

  // Modal activar cuarentena
  const [activarModal, setActivarModal] = useState<any>(null);
  const [motivoCuarentena, setMotivoCuarentena] = useState('');

  useEffect(() => {
    if (esAdmin) {
      api.get('/formularios/all-upps').then(r => setUpps(r.data || [])).catch(console.error);
      api.get('/generar-documentos/mvz-lista').then(r => setMvzLista(r.data || [])).catch(console.error);
    } else {
      api.get('/cuarentena/mis-alertas').then(r => setMisAlertas(r.data || [])).catch(console.error);
    }
  }, [esAdmin]);

  const investigar = async (uppId: string) => {
    setLoading(true); setMsg(''); setError(''); setInvestigacion(null);
    try {
      const r = await api.get(`/cuarentena/investigar/${uppId}`);
      setInvestigacion(r.data);
    } catch (e: any) { setError(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  const activarCuarentena = async () => {
    if (!activarModal) return;
    setLoading(true); setMsg(''); setError('');
    try {
      const r = await api.post(`/cuarentena/activar/${activarModal.id}`, { motivo: motivoCuarentena });
      setMsg(`✅ ${r.data.message}`);
      setInvestigacion(r.data);
      setActivarModal(null); setMotivoCuarentena('');
      // Refrescar lista de UPPs
      const uppr = await api.get('/formularios/all-upps');
      setUpps(uppr.data || []);
    } catch (e: any) { setError(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  const levantarCuarentena = async (uppId: string) => {
    setLoading(true); setMsg(''); setError('');
    try {
      const r = await api.post(`/cuarentena/levantar/${uppId}`);
      setMsg(`✅ ${r.data.message}`);
      if (investigacion?.upp?.id === uppId) setInvestigacion((prev: any) => ({ ...prev, upp: { ...prev.upp, estatusSanitario: 'LIBRE' } }));
      const uppr = await api.get('/formularios/all-upps');
      setUpps(uppr.data || []);
    } catch (e: any) { setError(e.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  const ejecutarAccion = async () => {
    if (!accionModal || !accionSeleccionada) return;
    setSavingAccion(true); setMsg(''); setError('');
    try {
      const r = await api.post('/cuarentena/accion', {
        uppOrigenId: investigacion?.upp?.id,
        uppAfectadaId: accionModal.uppId,
        accion: accionSeleccionada,
        mvzUsuarioId: accionMvzId || undefined,
        notas: accionNotas || undefined,
      });
      setMsg(`✅ ${r.data.message}`);
      setAccionModal(null); setAccionSeleccionada(''); setAccionMvzId(''); setAccionNotas('');
    } catch (e: any) { setError(e.response?.data?.error || 'Error'); }
    finally { setSavingAccion(false); }
  };

  // ── Vista PRODUCTOR: solo mis alertas ────────────────────────────────────
  if (!esAdmin) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <AlertTriangle className="text-amber-500" size={24} /> Alertas de Cuarentena
        </h1>
        <p className="text-gray-500 text-sm mb-6">Notificaciones relacionadas con cuarentenas que afectan a tus animales o ranchos.</p>
        {misAlertas.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <Shield className="mx-auto text-green-400 mb-2" size={40} />
            <p className="text-green-700 font-medium">Sin alertas de cuarentena</p>
            <p className="text-green-600 text-sm mt-1">Todos tus animales y ranchos están libres de cuarentenas activas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {misAlertas.map((al: any) => (
              <div key={al.id} className={`border rounded-xl p-4 ${severidadColor[al.severidad] || severidadColor.MEDIA}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{al.mensaje}</p>
                    <div className="flex gap-3 mt-1.5 text-xs opacity-70">
                      {al.animal && <span>Animal: <strong>{al.animal.areteNacional}</strong> — {al.animal.upp?.nombre}</span>}
                      <span>{new Date(al.timestamp).toLocaleDateString('es-MX', { dateStyle: 'medium' })}</span>
                    </div>
                  </div>
                  {!al.leida && <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full font-medium">Nueva</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Vista ADMIN ──────────────────────────────────────────────────────────
  const uppsCuarentena = upps.filter((u: any) => u.estatusSanitario === 'EN_CUARENTENA');
  const uppsLibres     = upps.filter((u: any) => u.estatusSanitario !== 'EN_CUARENTENA');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="text-amber-500" size={24} /> Gestión de Cuarentenas
        </h1>
        <p className="text-gray-500 text-sm mt-1">Investiga movimientos de animales y toma acciones ante brotes sanitarios.</p>
      </div>

      {msg   && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{msg}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─ Panel izquierdo: selección de UPP ─ */}
        <div className="lg:col-span-1 space-y-4">
          {/* UPPs en cuarentena */}
          {uppsCuarentena.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h2 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-1.5">
                <ShieldOff size={15} /> En Cuarentena ({uppsCuarentena.length})
              </h2>
              <div className="space-y-1.5">
                {uppsCuarentena.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <button onClick={() => investigar(u.id)}
                      className={`flex-1 text-left px-3 py-2 rounded-lg text-xs font-medium transition ${investigacion?.upp?.id === u.id ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-100 border border-red-200'}`}>
                      {u.nombre} <span className="opacity-60">({u.claveUPP})</span>
                    </button>
                    <button onClick={() => levantarCuarentena(u.id)} title="Levantar cuarentena"
                      className="p-1.5 rounded-lg bg-white border border-red-200 text-red-500 hover:bg-red-50" disabled={loading}>
                      <CheckCircle size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UPPs libres */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
              <Shield size={15} /> Ranchos ({uppsLibres.length})
            </h2>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {uppsLibres.map((u: any) => (
                <div key={u.id} className="flex items-center gap-2">
                  <button onClick={() => investigar(u.id)}
                    className={`flex-1 text-left px-3 py-2 rounded-lg text-xs transition ${investigacion?.upp?.id === u.id ? 'bg-emerald-600 text-white font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
                    {u.nombre} <span className="opacity-50">({u.claveUPP})</span>
                  </button>
                  <button onClick={() => { setActivarModal(u); setMotivoCuarentena(''); }} title="Poner en cuarentena"
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300">
                    <AlertTriangle size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─ Panel derecho: investigación ─ */}
        <div className="lg:col-span-2">
          {loading && !investigacion && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">Cargando...</div>
          )}
          {!investigacion && !loading && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <Shield size={40} className="mx-auto mb-3 text-gray-300" />
              Selecciona un rancho para investigar sus movimientos de animales
            </div>
          )}

          {investigacion && (
            <div className="space-y-4">
              {/* Header UPP */}
              <div className={`rounded-xl p-4 border ${investigacion.upp.estatusSanitario === 'EN_CUARENTENA' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{investigacion.upp.nombre}</h2>
                    <p className="text-sm text-gray-500">{investigacion.upp.claveUPP} — {investigacion.upp.municipio}, {investigacion.upp.estado}</p>
                    <p className="text-sm text-gray-600 mt-0.5">Propietario: {investigacion.upp.propietario?.nombre} {investigacion.upp.propietario?.apellidos}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${investigacion.upp.estatusSanitario === 'EN_CUARENTENA' ? 'bg-red-600 text-white' : 'bg-green-100 text-green-700'}`}>
                      {investigacion.upp.estatusSanitario}
                    </span>
                    {investigacion.upp.estatusSanitario !== 'EN_CUARENTENA' && (
                      <button onClick={() => { setActivarModal(investigacion.upp); setMotivoCuarentena(''); }}
                        className="block mt-2 text-xs text-amber-600 hover:text-amber-800 font-medium">
                        ⚠ Poner en cuarentena
                      </button>
                    )}
                    {investigacion.upp.estatusSanitario === 'EN_CUARENTENA' && (
                      <button onClick={() => levantarCuarentena(investigacion.upp.id)} disabled={loading}
                        className="block mt-2 text-xs text-green-600 hover:text-green-800 font-medium">
                        ✓ Levantar cuarentena
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Animales VENDIDOS desde este rancho */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandVendidos(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-100">
                  <span className="text-sm font-bold text-orange-700 flex items-center gap-2">
                    <Send size={14} /> Animales VENDIDOS desde este rancho ({investigacion.vendidos.length})
                  </span>
                  {expandVendidos ? <ChevronUp size={16} className="text-orange-500" /> : <ChevronDown size={16} className="text-orange-500" />}
                </button>
                {expandVendidos && (
                  investigacion.vendidos.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-6">Sin ventas registradas</p>
                    : <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50"><tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Arete</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Raza</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Comprador</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Rancho destino</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Días</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Acción</th>
                          </tr></thead>
                          <tbody className="divide-y divide-gray-50">
                            {investigacion.vendidos.map((v: any) => (
                              <tr key={v.formularioId} className="hover:bg-orange-50/30">
                                <td className="px-4 py-2 font-mono text-emerald-600 font-medium">{v.areteAnimal}</td>
                                <td className="px-4 py-2 text-gray-600">{v.razaAnimal}</td>
                                <td className="px-4 py-2"><div>{v.compradorNombre}</div><div className="text-xs text-gray-400">{v.compradorEmail}</div></td>
                                <td className="px-4 py-2"><div className="font-medium">{v.compradorRancho || '—'}</div><div className="text-xs text-gray-400">{v.compradorClaveUPP}</div></td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${v.diasTranscurridos <= 21 ? 'bg-red-100 text-red-700' : v.diasTranscurridos <= 60 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {v.diasTranscurridos}d
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  {v.compradorUPPId && (
                                    <button onClick={() => { setAccionModal({ uppId: v.compradorUPPId, uppNombre: v.compradorRancho || v.compradorNombre, direccion: 'venta' }); setAccionSeleccionada(''); setAccionMvzId(''); setAccionNotas(''); }}
                                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2 py-0.5 rounded">
                                      Decidir
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

              {/* Animales COMPRADOS e introducidos a este rancho */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandComprados(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100">
                  <span className="text-sm font-bold text-blue-700 flex items-center gap-2">
                    <Send size={14} className="rotate-180" /> Animales COMPRADOS e introducidos ({investigacion.comprados.length})
                  </span>
                  {expandComprados ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} className="text-blue-500" />}
                </button>
                {expandComprados && (
                  investigacion.comprados.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-6">Sin compras registradas</p>
                    : <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50"><tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Arete</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Raza</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Vendedor</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Rancho origen</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Días</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Acción</th>
                          </tr></thead>
                          <tbody className="divide-y divide-gray-50">
                            {investigacion.comprados.map((c: any) => (
                              <tr key={c.formularioId} className="hover:bg-blue-50/30">
                                <td className="px-4 py-2 font-mono text-emerald-600 font-medium">{c.areteAnimal}</td>
                                <td className="px-4 py-2 text-gray-600">{c.razaAnimal}</td>
                                <td className="px-4 py-2"><div>{c.vendedorNombre}</div><div className="text-xs text-gray-400">{c.vendedorEmail}</div></td>
                                <td className="px-4 py-2"><div className="font-medium">{c.vendedorRancho}</div><div className="text-xs text-gray-400">{c.vendedorClaveUPP}</div></td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${c.diasTranscurridos <= 21 ? 'bg-red-100 text-red-700' : c.diasTranscurridos <= 60 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {c.diasTranscurridos}d
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <button onClick={() => {
                                    // Investigar el rancho origen
                                    const uppOrigen = upps.find((u: any) => u.claveUPP === c.vendedorClaveUPP);
                                    if (uppOrigen) investigar(uppOrigen.id);
                                    else setMsg(`Busca el rancho "${c.vendedorRancho}" (${c.vendedorClaveUPP}) en la lista para investigarlo`);
                                  }} className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 px-2 py-0.5 rounded">
                                    Investigar origen
                                  </button>
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
        </div>
      </div>

      {/* ── MODAL: Confirmar cuarentena ── */}
      {activarModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setActivarModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h3 className="text-lg font-bold text-red-700 flex items-center gap-2"><ShieldOff size={18} /> Activar Cuarentena</h3>
              <button onClick={() => setActivarModal(null)}><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Se pondrá en <strong>CUARENTENA</strong> el rancho <strong>"{activarModal.nombre}"</strong> y todos sus animales activos cambiarán a estado CUARENTENADO. Se generarán alertas en el sistema.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de la cuarentena *</label>
            <textarea value={motivoCuarentena} onChange={e => setMotivoCuarentena(e.target.value)} rows={3}
              placeholder="Ej. Caso positivo de brucelosis detectado, brote de tuberculosis bovina..." className="w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setActivarModal(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={activarCuarentena} disabled={loading || !motivoCuarentena.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                <ShieldOff size={14} /> {loading ? 'Activando...' : 'Activar cuarentena'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Acción sobre rancho relacionado ── */}
      {accionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAccionModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-1">
              <h3 className="text-lg font-bold text-gray-900">Acción preventiva</h3>
              <button onClick={() => setAccionModal(null)}><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Rancho relacionado: <strong>{accionModal.uppNombre}</strong></p>

            <label className="block text-sm font-medium text-gray-700 mb-2">¿Qué se hará con este rancho?</label>
            <div className="space-y-2 mb-4">
              {[
                { val: 'poner_cuarentena', label: '🔴 Poner en cuarentena', desc: 'Marca el rancho y sus animales como cuarentenados' },
                { val: 'enviar_mvz',       label: '🩺 Enviar MVZ a hacer estudios', desc: 'Notifica al propietario que se enviará un veterinario' },
                { val: 'nada',             label: '✅ Sin acción (solo notificar)', desc: 'Informa al propietario que no se requiere acción' },
              ].map(op => (
                <label key={op.val} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${accionSeleccionada === op.val ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="accion" value={op.val} checked={accionSeleccionada === op.val} onChange={() => setAccionSeleccionada(op.val)} className="mt-0.5" />
                  <div><div className="text-sm font-medium">{op.label}</div><div className="text-xs text-gray-500">{op.desc}</div></div>
                </label>
              ))}
            </div>

            {accionSeleccionada === 'enviar_mvz' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">MVZ que se enviará</label>
                <select value={accionMvzId} onChange={e => setAccionMvzId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="">Seleccionar MVZ (opcional)</option>
                  {mvzLista.map((m: any) => <option key={m.id} value={m.id}>{m.nombre} {m.apellidos}</option>)}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
              <input value={accionNotas} onChange={e => setAccionNotas(e.target.value)} placeholder="Instrucciones, plazos, etc." className="w-full px-3 py-2 border rounded-lg text-sm outline-none" />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setAccionModal(null)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={ejecutarAccion} disabled={savingAccion || !accionSeleccionada}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                <CheckCircle size={14} /> {savingAccion ? 'Guardando...' : 'Aplicar acción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuarentenaPage;
