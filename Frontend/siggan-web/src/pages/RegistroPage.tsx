import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, Upload, X, FileText, Eye, EyeOff } from 'lucide-react';

const API = 'http://localhost:3001/api';
const municipiosDurango = ['Canatlán','Canelas','Coneto de Comonfort','Cuencamé','Durango','El Oro','Gómez Palacio','Guadalupe Victoria','Guanaceví','Hidalgo','Indé','Lerdo','Mapimí','Mezquital','Nombre de Dios','Nuevo Ideal','Ocampo','Pánuco de Coronado','Peñón Blanco','Poanas','Pueblo Nuevo','Rodeo','San Bernardo','San Dimas','San Juan de Guadalupe','San Juan del Río','San Luis del Cordero','San Pedro del Gallo','Santa Clara','Santiago Papasquiaro','Súchil','Tamazula','Tepehuanes','Tlahualilo','Topia','Vicente Guerrero'];

interface DocFile { file: File | null; name: string; }

const RegistroPage: React.FC = () => {
  const [tipoRegistro, setTipoRegistro] = useState<'agricultor' | 'medico' | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rfc, setRfc] = useState('');
  const [curp, setCurp] = useState('');
  const [direccion, setDireccion] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [estado, setEstado] = useState('Durango');
  const [cedula, setCedula] = useState('');
  const [credSenasica, setCredSenasica] = useState('');
  const [vigencia, setVigencia] = useState('');
  const [ddr, setDdr] = useState('');

  const [docs, setDocs] = useState<Record<string, DocFile>>({
    INE: { file: null, name: '' }, EFIRMA_CER: { file: null, name: '' }, EFIRMA_KEY: { file: null, name: '' },
    REGISTRO_SAT: { file: null, name: '' }, DOCUMENTO_PROPIEDAD: { file: null, name: '' }, RECIBO_COMPROBANTE: { file: null, name: '' },
    CREDENCIAL_SENASICA: { file: null, name: '' }, CEDULA_PROFESIONAL: { file: null, name: '' },
  });
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileChange = (tipo: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setDocs(prev => ({ ...prev, [tipo]: { file, name: file.name } }));
  };
  const removeFile = (tipo: string) => {
    setDocs(prev => ({ ...prev, [tipo]: { file: null, name: '' } }));
    if (fileRefs.current[tipo]) fileRefs.current[tipo]!.value = '';
  };

  const docsRequeridos = tipoRegistro === 'agricultor'
    ? ['INE', 'EFIRMA_CER', 'EFIRMA_KEY', 'REGISTRO_SAT', 'DOCUMENTO_PROPIEDAD', 'RECIBO_COMPROBANTE']
    : ['INE', 'EFIRMA_CER', 'EFIRMA_KEY', 'CREDENCIAL_SENASICA', 'CEDULA_PROFESIONAL'];

  const docLabels: Record<string, string> = {
    INE: 'Identificación oficial (INE)', EFIRMA_CER: 'E.firma — Archivo .cer', EFIRMA_KEY: 'E.firma — Archivo .key',
    REGISTRO_SAT: 'Constancia de Situación Fiscal (SAT)', DOCUMENTO_PROPIEDAD: 'Documento de propiedad',
    RECIBO_COMPROBANTE: 'Comprobante de domicilio (agua/luz/predial)',
    CREDENCIAL_SENASICA: 'Credencial SENASICA', CEDULA_PROFESIONAL: 'Cédula Profesional',
  };
  const docAccept: Record<string, string> = {
    INE: '.pdf,.jpg,.jpeg,.png', EFIRMA_CER: '.cer', EFIRMA_KEY: '.key',
    REGISTRO_SAT: '.pdf,.jpg,.jpeg,.png', DOCUMENTO_PROPIEDAD: '.pdf,.jpg,.jpeg,.png',
    RECIBO_COMPROBANTE: '.pdf,.jpg,.jpeg,.png', CREDENCIAL_SENASICA: '.pdf,.jpg,.jpeg,.png', CEDULA_PROFESIONAL: '.pdf,.jpg,.jpeg,.png',
  };

  const validateStep2 = () => {
    if (!nombre || !apellidos || !email || !password || !telefono || !rfc) return 'Todos los campos son obligatorios';
    if (password.length < 6) return 'Contraseña mínimo 6 caracteres';
    if (password !== confirmPass) return 'Las contraseñas no coinciden';
    if (rfc.length < 12) return 'RFC mínimo 12 caracteres';
    if (tipoRegistro === 'agricultor' && (!curp || !direccion || !municipio)) return 'CURP, dirección y municipio obligatorios';
    if (tipoRegistro === 'agricultor' && curp.length !== 18) return 'CURP debe tener 18 caracteres';
    if (tipoRegistro === 'medico' && (!cedula || !credSenasica || !vigencia || !ddr)) return 'Cédula, SENASICA, vigencia y DDR obligatorios';
    return null;
  };
  const validateStep3 = () => {
    const f = docsRequeridos.filter(d => !docs[d].file);
    return f.length > 0 ? `Falta: ${f.map(d => docLabels[d]).join(', ')}` : null;
  };

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const endpoint = tipoRegistro === 'agricultor' ? '/auth/registro/agricultor' : '/auth/registro/medico';
      const body: any = { email, password, nombre, apellidos, telefono, rfc };
      if (tipoRegistro === 'agricultor') Object.assign(body, { curp, direccion, municipio, estado });
      else Object.assign(body, { cedulaProfesional: cedula, credencialSenasica: credSenasica, vigenciaCredencial: vigencia, ddr });

      const res = await axios.post(`${API}${endpoint}`, body);
      const uid = res.data.usuario.id;
      for (const tipo of docsRequeridos) {
        if (docs[tipo].file) {
          const fd = new FormData();
          fd.append('archivo', docs[tipo].file!);
          fd.append('tipo', tipo);
          await axios.post(`${API}/documentos/upload/${uid}`, fd);
        }
      }
      setSuccess(true); setStep(4);
    } catch (err: any) { setError(err.response?.data?.error || 'Error al registrar'); }
    finally { setLoading(false); }
  };

  if (step === 1) return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 via-emerald-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8"><h1 className="text-4xl font-bold text-white mb-2">🐄 SIGGAN</h1><p className="text-emerald-300">Registro de usuario</p></div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">¿Cómo deseas registrarte?</h2>
          <p className="text-sm text-gray-500 mb-6 text-center">Selecciona tu rol</p>
          <div className="space-y-4">
            <button onClick={() => { setTipoRegistro('agricultor'); setStep(2); }} className="w-full p-5 border-2 rounded-xl text-left hover:border-emerald-500 hover:bg-emerald-50 transition">
              <div className="flex items-center gap-4"><span className="text-3xl">🌾</span><div><p className="font-bold text-gray-800">Agricultor / Productor</p><p className="text-xs text-gray-500">Propietario de ganado bovino</p></div></div>
            </button>
            <button onClick={() => { setTipoRegistro('medico'); setStep(2); }} className="w-full p-5 border-2 rounded-xl text-left hover:border-blue-500 hover:bg-blue-50 transition">
              <div className="flex items-center gap-4"><span className="text-3xl">🩺</span><div><p className="font-bold text-gray-800">Médico Veterinario</p><p className="text-xs text-gray-500">MVZ con cédula profesional</p></div></div>
            </button>
          </div>
          <div className="mt-6 text-center"><Link to="/login" className="text-emerald-600 hover:underline text-sm">← Volver al login</Link></div>
        </div>
      </div>
    </div>
  );

  if (step === 4 && success) return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 via-emerald-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <CheckCircle size={64} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Registro exitoso!</h2>
          <p className="text-gray-600 mb-6">Tu cuenta está <strong>pendiente de aprobación</strong> por un administrador.</p>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 mb-6">
            <p className="font-bold mb-1">⏳ Estado: PENDIENTE</p>
            <p>Un administrador revisará tus datos y documentos.</p>
          </div>
          <Link to="/login" className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700">Ir al Login</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 via-emerald-900 to-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white">🐄 SIGGAN</h1>
          <p className="text-emerald-300 text-sm">Registro: {tipoRegistro === 'agricultor' ? '🌾 Agricultor' : '🩺 MVZ'}</p>
        </div>
        <div className="flex items-center justify-center gap-4 mb-6">
          {['Tipo', 'Datos', 'Documentos'].map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step > i+1 ? 'bg-emerald-500 text-white' : step === i+1 ? 'bg-white text-emerald-700' : 'bg-white/20 text-white/50'}`}>{i+1}</div>
              <span className={`text-xs ${step === i+1 ? 'text-white' : 'text-white/50'}`}>{l}</span>
              {i < 2 && <div className={`w-8 h-0.5 ${step > i+1 ? 'bg-emerald-400' : 'bg-white/20'}`} />}
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

          {step === 2 && (<div>
            <h3 className="text-lg font-bold text-gray-800 mb-4">Datos personales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre(s) *</label><input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Apellidos *</label><input value={apellidos} onChange={e => setApellidos(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Email *</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono *</label><input value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Contraseña *</label><div className="relative"><input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400 pr-10" /><button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-2.5 text-gray-400">{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Confirmar contraseña *</label><input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">RFC *</label><input value={rfc} onChange={e => setRfc(e.target.value.toUpperCase())} maxLength={13} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400 uppercase" /></div>
              {tipoRegistro === 'agricultor' && (<>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">CURP *</label><input value={curp} onChange={e => setCurp(e.target.value.toUpperCase())} maxLength={18} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400 uppercase" /></div>
                <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Dirección *</label><input value={direccion} onChange={e => setDireccion(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Municipio *</label><select value={municipio} onChange={e => setMunicipio(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-400"><option value="">Seleccionar...</option>{municipiosDurango.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Estado</label><input value={estado} onChange={e => setEstado(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none bg-gray-50" /></div>
              </>)}
              {tipoRegistro === 'medico' && (<>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">No. Cédula Profesional *</label><input value={cedula} onChange={e => setCedula(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">No. Credencial SENASICA *</label><input value={credSenasica} onChange={e => setCredSenasica(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Vigencia credencial *</label><input type="date" value={vigencia} onChange={e => setVigencia(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">D.D.R. *</label><input value={ddr} onChange={e => setDdr(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" placeholder="DDR 01 Durango" /></div>
              </>)}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setStep(1); setTipoRegistro(null); }} className="px-6 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Atrás</button>
              <button onClick={() => { const e = validateStep2(); if (e) setError(e); else { setError(''); setStep(3); }}} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700">Siguiente: Documentos →</button>
            </div>
          </div>)}

          {step === 3 && (<div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Documentos requeridos</h3>
            <p className="text-sm text-gray-500 mb-4">PDF, JPG, PNG (máx. 10MB). E.firma: .cer y .key</p>
            <div className="space-y-3">
              {docsRequeridos.map(tipo => (
                <div key={tipo} className={`p-4 border-2 rounded-lg ${docs[tipo].file ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">{docLabels[tipo]}</p>
                      {docs[tipo].file ? (<div className="flex items-center gap-2 mt-1"><FileText size={14} className="text-green-600" /><span className="text-xs text-green-700">{docs[tipo].name}</span><span className="text-[10px] text-gray-400">({(docs[tipo].file!.size / 1024).toFixed(0)} KB)</span></div>) : (<p className="text-xs text-red-400 mt-0.5">Obligatorio</p>)}
                    </div>
                    <div className="flex items-center gap-2">
                      {docs[tipo].file && <button onClick={() => removeFile(tipo)} className="text-red-400 hover:text-red-600"><X size={16} /></button>}
                      <button onClick={() => fileRefs.current[tipo]?.click()} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${docs[tipo].file ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Upload size={12} /> {docs[tipo].file ? 'Cambiar' : 'Subir'}</button>
                    </div>
                  </div>
                  <input ref={(el) => { fileRefs.current[tipo] = el; }} type="file" accept={docAccept[tipo]} onChange={e => handleFileChange(tipo, e)} className="hidden" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)} className="px-6 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Atrás</button>
              <button onClick={() => { const e = validateStep3(); if (e) setError(e); else { setError(''); handleSubmit(); }}} disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">{loading ? 'Registrando...' : 'Completar Registro'}</button>
            </div>
          </div>)}
        </div>
        <div className="text-center mt-4"><Link to="/login" className="text-white/60 hover:text-white text-sm">← Volver al login</Link></div>
      </div>
    </div>
  );
};
export default RegistroPage;
