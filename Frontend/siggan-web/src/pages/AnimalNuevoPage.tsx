import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAnimal, getUPPs, getAnimales } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Save } from 'lucide-react';

const RAZAS = ['Hereford', 'Angus', 'Charolais', 'Simmental', 'Brahman', 'Beefmaster', 'Brangus', 'Criollo', 'Holstein', 'Suizo'];
const COLORES = ['Negro', 'Rojo', 'Blanco', 'Pinto', 'Bayo', 'Colorado', 'Hosco', 'Gris', 'Amarillo', 'Manchado'];
const TIPOS_PARTO = ['Natural', 'Inducido', 'Cesárea', 'Distócico'];

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

const AnimalNuevoPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [upps, setUpps] = useState<any[]>([]);
  const [hembras, setHembras] = useState<any[]>([]);
  const [madreArete, setMadreArete] = useState('');
  const [madreSeleccionada, setMadreSeleccionada] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    // Básicos
    nombre: '',
    raza: '',
    sexo: '',
    fechaNacimiento: '',
    horaNacimiento: '',
    color: '',
    pesoNacimiento: '',
    peso: '',
    condicionCorporal: '',
    proposito: '',
    uppId: '',
    // Genealogía
    madreId: '',
    areteNacionalPadre: '',
    razaPadre: '',
    tipoParto: '',
    esGemelar: '',
    numCriaCamada: '',
  });

  useEffect(() => {
    getUPPs().then(r => setUpps(r.data)).catch(console.error);
    getAnimales({ limit: 500 }).then(r => {
      const todas = r.data?.data || r.data || [];
      setHembras(todas.filter((a: any) => a.sexo === 'HEMBRA'));
    }).catch(console.error);
  }, []);

  const handleMadreInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMadreArete(val);
    const match = hembras.find(h => h.areteNacional === val.trim());
    if (match) {
      setMadreSeleccionada(match);
      setForm(prev => ({ ...prev, madreId: match.id }));
    } else {
      setMadreSeleccionada(null);
      setForm(prev => ({ ...prev, madreId: '' }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data: any = {
        ...form,
        pesoNacimiento:   form.pesoNacimiento    ? parseFloat(form.pesoNacimiento)   : undefined,
        peso:             form.peso             ? parseFloat(form.peso)             : undefined,
        condicionCorporal: form.condicionCorporal ? parseFloat(form.condicionCorporal) : undefined,
        numCriaCamada:    form.numCriaCamada     ? parseInt(form.numCriaCamada)       : undefined,
        esGemelar:        form.esGemelar !== ''  ? form.esGemelar === 'true'          : undefined,
        nombre:           form.nombre            || undefined,
        color:            form.color             || undefined,
        proposito:        form.proposito         || undefined,
        horaNacimiento:   form.horaNacimiento     || undefined,
        madreId:          form.madreId            || undefined,
        areteNacionalPadre: form.areteNacionalPadre || undefined,
        razaPadre:        form.razaPadre          || undefined,
        tipoParto:        form.tipoParto          || undefined,
      };
      const res = await createAnimal(data);
      setSuccess(`Animal registrado. Arete: ${res.data.areteNacional} | RFID: ${res.data.rfidTag}${res.data.areteExportacion ? ` | Exportación: ${res.data.areteExportacion}` : ''}`);
      setTimeout(() => navigate(`/animales/${res.data.id}`), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/animales')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={18} /> Volver
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Registrar Nuevo Animal</h1>
        <p className="text-sm text-gray-500 mb-6">El arete nacional, RFID y arete de exportación se asignan automáticamente por el sistema.</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── SECCIÓN 1: Identificación ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Características</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Nombre</label>
                <input name="nombre" value={form.nombre} onChange={handleChange}
                  placeholder="Nombre del animal" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Raza *</label>
                <select name="raza" value={form.raza} onChange={handleChange} required className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {RAZAS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Sexo *</label>
                <select name="sexo" value={form.sexo} onChange={handleChange} required className={inputCls}>
                  <option value="">Seleccionar...</option>
                  <option value="MACHO">Macho</option>
                  <option value="HEMBRA">Hembra</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Fecha de Nacimiento *</label>
                <input type="date" name="fechaNacimiento" value={form.fechaNacimiento} onChange={handleChange} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Hora de Nacimiento</label>
                <input type="time" name="horaNacimiento" value={form.horaNacimiento} onChange={handleChange} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Color</label>
                <select name="color" value={form.color} onChange={handleChange} className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {COLORES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Peso al Nacer (kg) — máx. 60</label>
                <input type="number" step="0.1" min="0" max="60" name="pesoNacimiento" value={form.pesoNacimiento} onChange={handleChange}
                  placeholder="ej. 35.5" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Peso Actual (kg)</label>
                <input type="number" step="0.5" name="peso" value={form.peso} onChange={handleChange}
                  placeholder="ej. 450" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Condición Corporal (1–5)</label>
                <input type="number" step="0.5" min="1" max="5" name="condicionCorporal" value={form.condicionCorporal} onChange={handleChange}
                  placeholder="ej. 3.5" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── SECCIÓN 2: Ubicación y Propósito ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Ubicación y Propósito</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>UPP *</label>
                <select name="uppId" value={form.uppId} onChange={handleChange} required className={inputCls}>
                  <option value="">Seleccionar UPP...</option>
                  {upps.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.nombre} ({u.claveUPP}) — {u.municipio}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Propósito</label>
                <select name="proposito" value={form.proposito} onChange={handleChange} className={inputCls}>
                  <option value="">Seleccionar...</option>
                  <option value="Cría">Cría</option>
                  <option value="Engorda">Engorda</option>
                  <option value="Leche">Leche</option>
                  <option value="Exportación">Exportación</option>
                </select>
                {form.proposito === 'Exportación' && (
                  <p className="text-xs text-blue-600 mt-1">Se asignará un arete de exportación automáticamente</p>
                )}
              </div>
            </div>
          </div>

          {/* ── SECCIÓN 3: Genealogía ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Genealogía y Parto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Madre */}
              <div>
                <label className={labelCls}>Arete de la Madre</label>
                <input
                  list="hembras-list"
                  value={madreArete}
                  onChange={handleMadreInput}
                  placeholder="Buscar por arete..."
                  className={inputCls}
                />
                <datalist id="hembras-list">
                  {hembras.map(h => (
                    <option key={h.id} value={h.areteNacional}>{h.areteNacional} — {h.raza} {h.nombre ? `(${h.nombre})` : ''}</option>
                  ))}
                </datalist>
                {madreSeleccionada && (
                  <p className="text-xs text-emerald-600 mt-1">✓ Madre: {madreSeleccionada.nombre || madreSeleccionada.areteNacional}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Raza de la Madre</label>
                <input
                  value={madreSeleccionada?.raza || ''}
                  readOnly
                  placeholder="Se llena al seleccionar madre"
                  className={`${inputCls} bg-gray-50 text-gray-500`}
                />
              </div>
              {/* Padre */}
              <div>
                <label className={labelCls}>Arete del Padre</label>
                <input name="areteNacionalPadre" value={form.areteNacionalPadre} onChange={handleChange}
                  placeholder="Núm. arete del padre" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Raza del Padre</label>
                <select name="razaPadre" value={form.razaPadre} onChange={handleChange} className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {RAZAS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tipo de Parto</label>
                <select name="tipoParto" value={form.tipoParto} onChange={handleChange} className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {TIPOS_PARTO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>¿Es gemelar?</label>
                <select name="esGemelar" value={form.esGemelar} onChange={handleChange} className={inputCls}>
                  <option value="">No especificado</option>
                  <option value="false">No</option>
                  <option value="true">Sí</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Núm. Cría en Camada</label>
                <input type="number" min="1" name="numCriaCamada" value={form.numCriaCamada} onChange={handleChange}
                  placeholder="ej. 1" className={inputCls} />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              <strong>Asignación automática:</strong> Al registrar, el sistema asignará un arete nacional único y un tag RFID
              {form.proposito === 'Exportación' ? ' y un arete de exportación (azul)' : ''}.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => navigate('/animales')}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
              <Save size={18} />
              {loading ? 'Guardando...' : 'Registrar Animal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AnimalNuevoPage;
