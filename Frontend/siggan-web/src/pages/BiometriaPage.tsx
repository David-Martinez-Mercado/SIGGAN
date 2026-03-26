import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Eye, Scan, QrCode, CheckCircle, XCircle, Search, Download, Fingerprint, Activity, Upload, Camera, X, Trash2, AlertTriangle, Shield, Info } from 'lucide-react';

const BiometriaPage: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'iris' | 'qr' | 'admin'>('iris');
  const [animales, setAnimales] = useState<any[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<any>(null);
  const [irisStatus, setIrisStatus] = useState<any>(null);
  const [qrData, setQrData] = useState<any>(null);
  const [modo, setModo] = useState<'simulado' | 'real'>('simulado');
  const [imagenBase64, setImagenBase64] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [registros, setRegistros] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const fetchAnimales = async () => {
    try { const res = await api.get('/animales?limit=100'); setAnimales(res.data.data || []); } catch {}
  };
  const fetchStatus = async () => {
    try { const st = await api.get('/biometria/iris/status'); setIrisStatus(st.data); } catch { setIrisStatus({ status: 'offline' }); }
  };
  const fetchRegistros = async () => {
    try { const r = await api.get('/biometria/iris/registros'); setRegistros(r.data.registros || []); } catch {}
  };

  useEffect(() => { fetchAnimales(); fetchStatus(); }, []);
  useEffect(() => {
    if ((msg || error) && alertRef.current) alertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [msg, error]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const b = reader.result as string; setImagenBase64(b); setPreviewUrl(b); };
    reader.readAsDataURL(file);
  };

  const limpiarImagen = () => { setImagenBase64(null); setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const registrarIris = async () => {
    if (!selectedAnimal) return;
    if (modo === 'real' && !imagenBase64) { setError('Sube una foto del iris primero'); return; }
    setLoading(true); setMsg(''); setError(''); setResultado(null);
    try {
      const body: any = { animalId: selectedAnimal, modo };
      if (modo === 'real' && imagenBase64) body.imagenBase64 = imagenBase64;
      const res = await api.post('/biometria/iris/registrar', body);
      setResultado(res.data);
      setMsg(`Iris registrado exitosamente (modo ${modo})`);
      fetchAnimales();
    } catch (err: any) {
      const d = err.response?.data;
      if (d?.duplicado) {
        setResultado({ duplicado: true, ...d });
        setError('IRIS DUPLICADO — Ya existe en otro animal');
      } else if (d?.validacion_ia) {
        setResultado({ validacionFallida: true, ...d });
        setError(d.error);
      } else {
        setError(d?.error || 'Error al registrar');
      }
    }
    finally { setLoading(false); }
  };

  const verificarIris = async () => {
    if (!selectedAnimal) return;
    if (modo === 'real' && !imagenBase64) { setError('Sube una foto del iris primero'); return; }
    setLoading(true); setMsg(''); setError(''); setResultado(null);
    try {
      const body: any = { animalId: selectedAnimal, modo };
      if (modo === 'real' && imagenBase64) body.imagenBase64 = imagenBase64;
      const res = await api.post('/biometria/iris/verificar', body);
      setResultado(res.data);
      const v = res.data.verificacion;
      if (v.match) setMsg(`MATCH — Identidad confirmada (${v.confianza.toFixed(1)}% confianza)`);
      else setError(`${v.resultado} — La iris NO coincide con este animal`);
    } catch (err: any) {
      const d = err.response?.data;
      if (d?.validacion_ia) setResultado({ validacionFallida: true, ...d });
      setError(d?.error || 'Error al verificar');
    }
    finally { setLoading(false); }
  };

  const resetAll = async () => {
    if (!window.confirm('¿Eliminar TODOS los registros de iris? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete('/biometria/iris/reset');
      setMsg('Todos los registros de iris eliminados');
      setResultado(null);
      fetchAnimales();
      fetchRegistros();
    } catch { setError('Error al resetear'); }
  };

  const resetOne = async (animalId: string) => {
    if (!window.confirm('¿Eliminar iris de este animal?')) return;
    try {
      await api.delete(`/biometria/iris/reset/${animalId}`);
      setMsg('Iris eliminado');
      fetchAnimales();
      fetchRegistros();
    } catch { setError('Error'); }
  };

  const generarQR = async () => {
    if (!selectedAnimal) return;
    setLoading(true); setQrData(null); setMsg(''); setError('');
    try { const res = await api.get(`/biometria/qr/${selectedAnimal}`); setQrData(res.data); } catch (err: any) { setError(err.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  const descargarQR = () => {
    if (!qrData?.qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `QR_${qrData.animal}.png`;
    link.href = qrData.qrDataUrl;
    link.click();
  };

  const animalSel = animales.find(a => a.id === selectedAnimal);

  // Componente para mostrar info completa de un animal
  const AnimalInfoCard = ({ data, title, variant }: { data: any; title: string; variant: 'danger' | 'info' | 'success' }) => {
    if (!data) return null;
    const colors = { danger: 'border-red-300 bg-red-50', info: 'border-blue-300 bg-blue-50', success: 'border-green-300 bg-green-50' };
    return (
      <div className={`border-2 rounded-lg p-4 ${colors[variant]} mb-4`}>
        <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
          {variant === 'danger' && <AlertTriangle size={16} className="text-red-600" />}
          {variant === 'info' && <Info size={16} className="text-blue-600" />}
          {variant === 'success' && <Shield size={16} className="text-green-600" />}
          {title}
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500 text-xs">Arete</span><p className="font-mono font-bold">{data.arete}</p></div>
          {data.nombre && <div><span className="text-gray-500 text-xs">Nombre</span><p className="font-medium">{data.nombre}</p></div>}
          <div><span className="text-gray-500 text-xs">Raza</span><p>{data.raza}</p></div>
          <div><span className="text-gray-500 text-xs">Sexo</span><p>{data.sexo === 'MACHO' ? '♂ Macho' : '♀ Hembra'}</p></div>
          {data.peso && <div><span className="text-gray-500 text-xs">Peso</span><p>{data.peso} kg</p></div>}
          <div><span className="text-gray-500 text-xs">Estatus</span><p className={`font-medium ${data.estatusSanitario === 'SANO' ? 'text-green-700' : 'text-red-700'}`}>{data.estatusSanitario}</p></div>
        </div>
        {data.propietario && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Propietario</p>
            <p className="font-medium text-sm">{data.propietario.nombre}</p>
            <p className="text-xs text-gray-500">{data.propietario.municipio} • {data.propietario.telefono || 'Sin teléfono'}</p>
          </div>
        )}
        {data.upp && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">UPP</p>
            <p className="text-sm">{data.upp.nombre} ({data.upp.claveUPP})</p>
          </div>
        )}
        {data.eventosSanitarios?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Últimos eventos sanitarios</p>
            {data.eventosSanitarios.slice(0, 3).map((ev: any, i: number) => (
              <div key={i} className="text-xs flex justify-between py-0.5">
                <span>{ev.tipo.replace(/_/g, ' ')}</span>
                <span className="text-gray-400">{new Date(ev.fecha).toLocaleDateString('es-MX')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔐 Biometría & Trazabilidad</h1>
          <p className="text-gray-500 text-sm mt-1">Identificación por iris con IA y códigos QR</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${irisStatus?.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-500">IA: {irisStatus?.status === 'ok' ? `Activo (${irisStatus.iris_registrados} iris)` : 'Offline'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setTab('iris')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${tab === 'iris' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Fingerprint size={16} /> Biometría
        </button>
        <button onClick={() => setTab('qr')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${tab === 'qr' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <QrCode size={16} /> QR
        </button>
        <button onClick={() => { setTab('admin'); fetchRegistros(); }} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${tab === 'admin' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Trash2 size={16} /> Administrar Iris
        </button>
      </div>

      {/* Selector de animal (iris y qr) */}
      {tab !== 'admin' && (
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar animal</label>
          <select value={selectedAnimal} onChange={e => { setSelectedAnimal(e.target.value); setResultado(null); setQrData(null); setMsg(''); setError(''); limpiarImagen(); }}
            className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none">
            <option value="">— Seleccionar animal —</option>
            {animales.map(a => (
              <option key={a.id} value={a.id}>{a.areteNacional} — {a.nombre || a.raza} ({a.sexo}) {a.irisHash ? '🔒' : ''}</option>
            ))}
          </select>
          {animalSel && (
            <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
              <span><strong>{animalSel.nombre || 'Sin nombre'}</strong> — {animalSel.raza}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${animalSel.irisHash ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>
                {animalSel.irisHash ? '🔒 Iris registrado' : 'Sin iris'}
              </span>
            </div>
          )}
        </div>
      )}

      <div ref={alertRef}>
        {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2"><CheckCircle size={16} /> {msg}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2"><XCircle size={16} /> {error}</div>}
      </div>

      {/* ==================== IRIS TAB ==================== */}
      {tab === 'iris' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Modo */}
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Modo de captura</h3>
              <div className="flex gap-3">
                <button onClick={() => { setModo('simulado'); limpiarImagen(); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border-2 transition ${modo === 'simulado' ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500'}`}>
                  <Camera size={16} /> Simulado
                </button>
                <button onClick={() => setModo('real')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border-2 transition ${modo === 'real' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>
                  <Upload size={16} /> Foto real
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {modo === 'simulado' ? 'Genera imagen IR sintética para pruebas.' : 'Sube foto real del ojo. La IA valida y procesa.'}
              </p>
            </div>

            {/* Imagen */}
            <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{modo === 'simulado' ? 'Iris simulado' : 'Foto real'}</h3>
              {modo === 'simulado' ? (
                selectedAnimal ? (
                  <img src={`http://localhost:3001/api/biometria/iris/demo/${selectedAnimal}`} alt="Iris" className="w-48 h-48 mx-auto rounded-full border-4 border-violet-200 shadow-lg object-cover" />
                ) : <div className="py-8 text-gray-400 text-sm">Selecciona un animal</div>
              ) : (
                <div>
                  {previewUrl ? (
                    <div className="relative inline-block">
                      <img src={previewUrl} alt="Iris" className="w-48 h-48 mx-auto rounded-full border-4 border-emerald-200 shadow-lg object-cover" />
                      <button onClick={limpiarImagen} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"><X size={14} /></button>
                    </div>
                  ) : (
                    <div onClick={() => fileInputRef.current?.click()}
                      className="w-48 h-48 mx-auto rounded-full border-4 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition">
                      <Upload size={24} className="text-gray-400 mb-2" />
                      <p className="text-xs text-gray-500">Click para subir</p>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="bg-white rounded-xl shadow-sm border p-5 space-y-3">
              <button onClick={registrarIris} disabled={!selectedAnimal || loading || (modo === 'real' && !imagenBase64)}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50 transition">
                <Eye size={18} /> {loading ? 'Procesando...' : 'Registrar Iris'}
              </button>
              <button onClick={verificarIris} disabled={!selectedAnimal || loading || (modo === 'real' && !imagenBase64)}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                <Scan size={18} /> {loading ? 'Verificando...' : 'Verificar Identidad'}
              </button>
              {modo === 'real' && !imagenBase64 && <p className="text-xs text-amber-600 text-center">Sube una foto primero</p>}
            </div>

            {/* Pipeline IA */}
            <div className="bg-gray-50 rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Activity size={16} className="text-violet-600" /> Pipeline de IA</h3>
              <div className="space-y-1.5 text-xs text-gray-600">
                {['Validación: ¿es un ojo?', 'CLAHE + redimensión 1000px', 'Hough Circles (pupila)', 'Recorte iris → 128×128', 'CNN 5 bloques + atención', 'Embedding 128 dims (ArcFace)', 'Similitud coseno + unicidad'].map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-[9px]">{i + 1}</span>{s}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Panel de resultados */}
          <div>
            {resultado ? (
              <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Resultado</h3>

                {/* DUPLICADO */}
                {resultado.duplicado && (
                  <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                    <p className="font-bold text-red-700 text-lg mb-2">⛔ IRIS DUPLICADO</p>
                    <p className="text-sm text-red-600 mb-3">{resultado.mensaje}</p>
                    <div className="p-3 bg-red-100 rounded mb-3">
                      <p className="text-xs font-bold text-red-800 uppercase mb-1">⚠️ Acción requerida</p>
                      <p className="text-sm text-red-700">Contacte a un administrador del sistema. Este iris ya pertenece a otro animal registrado.</p>
                    </div>
                    {resultado.info_animal_existente && (
                      <AnimalInfoCard data={resultado.info_animal_existente} title="Animal con esta iris registrada (dueño real)" variant="danger" />
                    )}
                  </div>
                )}

                {/* VALIDACIÓN FALLIDA */}
                {resultado.validacionFallida && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-bold text-red-700 mb-2">⚠️ Imagen rechazada por IA</p>
                    {resultado.validacion_ia?.scores && (
                      <div className="space-y-1.5 mb-3">
                        {Object.entries(resultado.validacion_ia.scores as Record<string, number>).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-28 truncate">{k.replace(/_/g, ' ')}</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div className={`h-2 rounded-full ${v > 0.5 ? 'bg-green-400' : v > 0.25 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${Math.max(3, v * 100)}%` }} />
                            </div>
                            <span className="text-xs font-mono w-10 text-right">{(v * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {resultado.sugerencias && (
                      <div className="p-2 bg-amber-50 rounded text-xs text-amber-700">
                        {resultado.sugerencias.map((s: string, i: number) => <p key={i}>• {s}</p>)}
                      </div>
                    )}
                  </div>
                )}

                {/* ALERTA DE FRAUDE */}
                {resultado.alerta_fraude && (
                  <div className={`p-4 border-2 rounded-lg ${resultado.alerta_fraude.tipo === 'IRIS_NO_COINCIDE' ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-300'}`}>
                    <p className="font-bold text-lg mb-2">
                      {resultado.alerta_fraude.tipo === 'IRIS_NO_COINCIDE' ? '🚨 POSIBLE SUPLANTACIÓN' : '⚠️ IRIS NO RECONOCIDA'}
                    </p>
                    <p className="text-sm mb-3">{resultado.alerta_fraude.mensaje}</p>
                    {resultado.alerta_fraude.accion_requerida === 'CONTACTAR_AUTORIDAD' && (
                      <div className="p-3 bg-red-100 border border-red-300 rounded mb-3">
                        <p className="text-sm font-bold text-red-800">Contacte inmediatamente a una autoridad del sistema</p>
                      </div>
                    )}
                    {resultado.alerta_fraude.info_animal_real && (
                      <AnimalInfoCard data={resultado.alerta_fraude.info_animal_real} title="Animal REAL al que pertenece esta iris" variant="danger" />
                    )}
                  </div>
                )}

                {/* INFO ANIMAL SOLICITADO (verificación exitosa) */}
                {resultado.info_animal_solicitado && resultado.verificacion?.match && (
                  <AnimalInfoCard data={resultado.info_animal_solicitado} title="Información del animal verificado" variant="success" />
                )}

                {/* Validación exitosa (real) */}
                {resultado.validacion_ia && !resultado.validacionFallida && !resultado.duplicado && resultado.validacion_ia.modo !== 'simulado_skip' && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600" />
                    <span className="text-sm text-green-700">Validada como iris ({resultado.validacion_ia.confidence?.toFixed(1)}%)</span>
                  </div>
                )}

                {/* Hash */}
                {resultado.irisHash && (
                  <div className="p-3 bg-violet-50 rounded-lg">
                    <p className="text-xs text-gray-500">Hash biométrico</p>
                    <p className="font-mono text-xs text-violet-700 break-all">{resultado.irisHash}</p>
                  </div>
                )}

                {/* Verificación result */}
                {resultado.verificacion && (
                  <div className={`p-4 rounded-lg border ${resultado.verificacion.match ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {resultado.verificacion.match ? <CheckCircle size={20} className="text-green-600" /> : <XCircle size={20} className="text-red-600" />}
                      <span className="font-bold text-lg">{resultado.verificacion.resultado}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                      <div className={`h-2.5 rounded-full ${resultado.verificacion.match ? 'bg-green-500' : 'bg-red-400'}`}
                        style={{ width: `${Math.max(5, resultado.verificacion.confianza)}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500 text-xs">Confianza</span><p className="font-bold">{resultado.verificacion.confianza?.toFixed(1)}%</p></div>
                      <div><span className="text-gray-500 text-xs">Similitud</span><p className="font-mono">{(resultado.verificacion.similitud ?? resultado.verificacion.distancia_hamming)?.toFixed(4)}</p></div>
                    </div>
                  </div>
                )}

                {/* Detalles técnicos */}
                {resultado.codeBits && (
                  <div className="text-sm space-y-1 pt-3 border-t">
                    <div className="flex justify-between"><span className="text-gray-500">Código</span><span>{resultado.codeBits} bits ({resultado.bitsActivos} activos)</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Modo</span><span>{resultado.modo === 'real' ? '📷 Real' : '🎮 Simulado'}</span></div>
                  </div>
                )}
              </div>
            ) : selectedAnimal ? (
              <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">
                <Fingerprint size={48} className="mx-auto mb-3 text-gray-300" />
                <p>Selecciona una acción</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ==================== QR TAB ==================== */}
      {tab === 'qr' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Generar Código QR</h3>
            <p className="text-sm text-gray-500 mb-4">El QR enlaza a la página pública de trazabilidad del animal.</p>
            <button onClick={generarQR} disabled={!selectedAnimal || loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50">
              <QrCode size={18} /> {loading ? 'Generando...' : 'Generar QR'}
            </button>
          </div>
          {qrData && (
            <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{qrData.animal}</h3>
              <img src={qrData.qrDataUrl} alt="QR" className="w-64 h-64 mx-auto border rounded-lg shadow-sm" />
              <p className="text-xs text-gray-400 mt-3 break-all">{qrData.url}</p>
              <div className="flex gap-2 mt-4 justify-center">
                <button onClick={descargarQR} className="flex items-center gap-1 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm"><Download size={14} /> PNG</button>
                <a href={qrData.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"><Search size={14} /> Ver</a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== ADMIN TAB ==================== */}
      {tab === 'admin' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Registros de Iris Activos ({registros.length})</h3>
              <button onClick={resetAll} disabled={registros.length === 0}
                className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                <Trash2 size={14} /> Borrar todos
              </button>
            </div>

            {registros.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No hay iris registrados</p>
            ) : (
              <div className="space-y-2">
                {registros.map((r: any) => (
                  <div key={r.animal_id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <img src={`http://localhost:3001/api/biometria/iris/demo/${r.animal_id}`} alt="" className="w-12 h-12 rounded-full border-2 border-violet-200 object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{r.animal?.areteNacional || r.animal_id}</p>
                      <p className="text-xs text-gray-500">
                        {r.animal?.nombre || r.animal?.raza} — {r.animal?.propietario ? `${r.animal.propietario.nombre} ${r.animal.propietario.apellidos}` : 'Sin propietario'}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono">{r.iris_hash?.slice(0, 24)}... • {r.modo} • {r.registrado_at ? new Date(r.registrado_at).toLocaleString('es-MX') : ''}</p>
                    </div>
                    <button onClick={() => resetOne(r.animal_id)} className="text-red-500 hover:text-red-700 p-2" title="Eliminar iris">
                      <Trash2 size={16} />
                    </button>
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
export default BiometriaPage;
