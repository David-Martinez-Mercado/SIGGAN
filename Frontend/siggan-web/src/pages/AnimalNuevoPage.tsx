import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAnimal, getUPPs } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Save } from 'lucide-react';

const RAZAS = ['Hereford', 'Angus', 'Charolais', 'Simmental', 'Brahman', 'Beefmaster', 'Brangus', 'Criollo', 'Holstein', 'Suizo'];
const COLORES = ['Negro', 'Rojo', 'Blanco', 'Pinto', 'Bayo', 'Colorado', 'Hosco', 'Gris', 'Amarillo', 'Manchado'];

const AnimalNuevoPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [upps, setUpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    nombre: '',
    raza: '',
    sexo: '',
    fechaNacimiento: '',
    color: '',
    peso: '',
    proposito: '',
    uppId: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const uppRes = await getUPPs();
        setUpps(uppRes.data);
      } catch (e) {
        console.error(e);
      }
    };
    loadData();
  }, []);

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
        peso: form.peso ? parseFloat(form.peso) : undefined,
        nombre: form.nombre || undefined,
        color: form.color || undefined,
        proposito: form.proposito || undefined,
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
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Características</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input name="nombre" value={form.nombre} onChange={handleChange}
                  placeholder="Nombre del animal" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Raza *</label>
                <select name="raza" value={form.raza} onChange={handleChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="">Seleccionar...</option>
                  {RAZAS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sexo *</label>
                <select name="sexo" value={form.sexo} onChange={handleChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="">Seleccionar...</option>
                  <option value="MACHO">Macho</option>
                  <option value="HEMBRA">Hembra</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Nacimiento *</label>
                <input type="date" name="fechaNacimiento" value={form.fechaNacimiento} onChange={handleChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <select name="color" value={form.color} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="">Seleccionar...</option>
                  {COLORES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
                <input type="number" step="0.1" name="peso" value={form.peso} onChange={handleChange}
                  placeholder="450.5" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Ubicación y Propósito</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UPP *</label>
                <select name="uppId" value={form.uppId} onChange={handleChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="">Seleccionar UPP...</option>
                  {upps.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.nombre} ({u.claveUPP}) — {u.municipio}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Propósito</label>
                <select name="proposito" value={form.proposito} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
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

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              <strong>Asignación automática:</strong> Al registrar, el sistema asignará automáticamente un arete nacional único, un tag RFID
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
