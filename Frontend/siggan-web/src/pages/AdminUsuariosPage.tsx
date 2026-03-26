import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { UserCheck, UserX, Users, Clock, Shield, ShieldAlert, Search, RefreshCw, Plus, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const estatusColors: Record<string, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-700',
  ACTIVO: 'bg-green-100 text-green-700',
  SUSPENDIDO_TEMPORAL: 'bg-orange-100 text-orange-700',
  SUSPENDIDO_DEFINITIVO: 'bg-red-100 text-red-700',
};
const rolColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  MVZ: 'bg-emerald-100 text-emerald-700',
  PRODUCTOR: 'bg-gray-100 text-gray-700',
};

const AdminUsuariosPage: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'pendientes' | 'todos' | 'crear'>('pendientes');
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');
  const [buscar, setBuscar] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Crear admin
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newApellidos, setNewApellidos] = useState('');
  const [newTel, setNewTel] = useState('');

  // Suspender modal
  const [suspendModal, setSuspendModal] = useState<{ id: string; nombre: string } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [tipoSusp, setTipoSusp] = useState<'TEMPORAL' | 'DEFINITIVO'>('TEMPORAL');

  const fetchPendientes = async () => {
    try { const r = await api.get('/admin/pendientes'); setPendientes(r.data.pendientes || []); } catch {}
  };
  const fetchUsuarios = async () => {
    try {
      const params: any = {};
      if (filtroRol) params.rol = filtroRol;
      if (filtroEstatus) params.estatus = filtroEstatus;
      if (buscar) params.buscar = buscar;
      const r = await api.get('/admin/usuarios', { params });
      setUsuarios(r.data.usuarios || []);
    } catch {}
  };

  useEffect(() => { fetchPendientes(); fetchUsuarios(); }, []);
  useEffect(() => { fetchUsuarios(); }, [filtroRol, filtroEstatus]);

  const aprobar = async (id: string) => {
    setMsg(''); setError('');
    try {
      const r = await api.post(`/admin/usuarios/${id}/aprobar`);
      setMsg(r.data.mensaje);
      fetchPendientes(); fetchUsuarios();
    } catch (e: any) { setError(e.response?.data?.error || 'Error'); }
  };

  const suspender = async () => {
    if (!suspendModal) return;
    if (motivo.length < 10) { setError('Motivo mínimo 10 caracteres'); return; }
    setMsg(''); setError('');
    try {
      const r = await api.post(`/admin/usuarios/${suspendModal.id}/suspender`, { motivo, tipo: tipoSusp });
      setMsg(r.data.mensaje);
      setSuspendModal(null); setMotivo(''); setTipoSusp('TEMPORAL');
      fetchPendientes(); fetchUsuarios();
    } catch (e: any) { setError(e.response?.data?.error || 'Error'); }
  };

  const reactivar = async (id: string) => {
    setMsg(''); setError('');
    try {
      const r = await api.post(`/admin/usuarios/${id}/reactivar`);
      setMsg(r.data.mensaje);
      fetchUsuarios();
    } catch (e: any) { setError(e.response?.data?.error || 'Error'); }
  };

  const crearAdmin = async () => {
    if (!newEmail || !newPass || !newNombre || !newApellidos) { setError('Todos los campos obligatorios'); return; }
    setMsg(''); setError('');
    try {
      const r = await api.post('/admin/crear-admin', { email: newEmail, password: newPass, nombre: newNombre, apellidos: newApellidos, telefono: newTel });
      setMsg(r.data.mensaje);
      setNewEmail(''); setNewPass(''); setNewNombre(''); setNewApellidos(''); setNewTel('');
      fetchUsuarios();
    } catch (e: any) { setError(e.response?.data?.error || 'Error'); }
  };

  const eliminarAdmin = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar (suspender definitivamente) a ${nombre}?`)) return;
    try {
      const r = await api.delete(`/admin/admins/${id}`);
      setMsg(r.data.mensaje);
      fetchUsuarios();
    } catch (e: any) { setError(e.response?.data?.error || 'Error'); }
  };

  const UserCard = ({ u, showActions = true }: { u: any; showActions?: boolean }) => {
    const isExpanded = expanded === u.id;
    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(isExpanded ? null : u.id)}>
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
            {u.nombre?.[0]}{u.apellidos?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{u.nombre} {u.apellidos}</p>
            <p className="text-xs text-gray-500">{u.email}</p>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rolColors[u.rol] || 'bg-gray-100'}`}>{u.rol}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${estatusColors[u.estatus] || 'bg-gray-100'}`}>{u.estatus}</span>
          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>

        {isExpanded && (
          <div className="border-t px-4 py-3 bg-gray-50 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {u.telefono && <div><span className="text-gray-500 text-xs">Teléfono</span><p>{u.telefono}</p></div>}
              {u.rfc && <div><span className="text-gray-500 text-xs">RFC</span><p className="font-mono text-xs">{u.rfc}</p></div>}
              {u.curp && <div><span className="text-gray-500 text-xs">CURP</span><p className="font-mono text-xs">{u.curp}</p></div>}
              {u.municipio && <div><span className="text-gray-500 text-xs">Municipio</span><p>{u.municipio}</p></div>}
              {u.cedulaProfesional && <div><span className="text-gray-500 text-xs">Cédula</span><p>{u.cedulaProfesional}</p></div>}
              {u.credencialSenasica && <div><span className="text-gray-500 text-xs">SENASICA</span><p>{u.credencialSenasica}</p></div>}
              {u.ddr && <div><span className="text-gray-500 text-xs">DDR</span><p>{u.ddr}</p></div>}
              <div><span className="text-gray-500 text-xs">Registrado</span><p>{new Date(u.createdAt).toLocaleDateString('es-MX')}</p></div>
              {u.motivoSuspension && <div className="md:col-span-3"><span className="text-gray-500 text-xs">Motivo suspensión</span><p className="text-red-600 text-xs">{u.motivoSuspension}</p></div>}
            </div>

            {u.documentos?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Documentos ({u.documentos.length})</p>
                <div className="flex flex-wrap gap-2">
                  {u.documentos.map((d: any) => (
                    <a key={d.id} href={`http://localhost:3001/api/documentos/ver/${d.id}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 px-2 py-1 bg-white border rounded text-xs hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition"
                      title={`Ver: ${d.nombreArchivo}`}>
                      <FileText size={12} className="text-blue-500" /> {d.tipo.replace(/_/g, ' ')}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {showActions && (
              <div className="flex gap-2 pt-2 border-t">
                {u.estatus === 'PENDIENTE' && (
                  <button onClick={() => aprobar(u.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">
                    <UserCheck size={14} /> Aprobar
                  </button>
                )}
                {(u.estatus === 'ACTIVO' || u.estatus === 'PENDIENTE') && !u.esPrimario && (
                  <button onClick={() => setSuspendModal({ id: u.id, nombre: `${u.nombre} ${u.apellidos}` })} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700">
                    <UserX size={14} /> Suspender
                  </button>
                )}
                {u.estatus === 'SUSPENDIDO_TEMPORAL' && (
                  <button onClick={() => reactivar(u.id)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">
                    <RefreshCw size={14} /> Reactivar
                  </button>
                )}
                {(u.rol === 'ADMIN' || u.rol === 'SUPER_ADMIN') && !u.esPrimario && user?.esPrimario && (
                  <button onClick={() => eliminarAdmin(u.id, u.nombre)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs hover:bg-gray-900">
                    <UserX size={14} /> Eliminar Admin
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">👥 Administración de Usuarios</h1>
        <p className="text-gray-500 text-sm mt-1">Aprobar registros, suspender y gestionar cuentas</p>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{msg}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => { setTab('pendientes'); fetchPendientes(); }} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${tab === 'pendientes' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Clock size={16} /> Pendientes {pendientes.length > 0 && <span className="bg-white/30 px-1.5 rounded-full text-xs">{pendientes.length}</span>}
        </button>
        <button onClick={() => { setTab('todos'); fetchUsuarios(); }} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${tab === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Users size={16} /> Todos los usuarios
        </button>
        {(user?.esSuperAdmin || user?.rol === 'SUPER_ADMIN') && (
          <button onClick={() => setTab('crear')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${tab === 'crear' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <Plus size={16} /> Crear Admin
          </button>
        )}
      </div>

      {/* PENDIENTES */}
      {tab === 'pendientes' && (
        <div className="space-y-3">
          {pendientes.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
              <UserCheck size={48} className="mx-auto mb-3 text-gray-300" />
              <p>No hay usuarios pendientes de aprobación</p>
            </div>
          ) : pendientes.map(u => <UserCard key={u.id} u={u} />)}
        </div>
      )}

      {/* TODOS */}
      {tab === 'todos' && (
        <div>
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search size={16} className="text-gray-400" />
              <input value={buscar} onChange={e => setBuscar(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchUsuarios()} placeholder="Buscar por nombre, email, CURP..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none" />
              <button onClick={fetchUsuarios} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">Buscar</button>
            </div>
            <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">Todos los roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="MVZ">MVZ</option>
              <option value="PRODUCTOR">Productor</option>
            </select>
            <select value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">Todos los estatus</option>
              <option value="ACTIVO">Activo</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="SUSPENDIDO_TEMPORAL">Suspendido temporal</option>
              <option value="SUSPENDIDO_DEFINITIVO">Suspendido definitivo</option>
            </select>
          </div>
          <div className="space-y-2">
            {usuarios.map(u => <UserCard key={u.id} u={u} />)}
          </div>
          {usuarios.length === 0 && <p className="text-gray-400 text-center py-8">No se encontraron usuarios</p>}
        </div>
      )}

      {/* CREAR ADMIN */}
      {tab === 'crear' && (
        <div className="bg-white rounded-xl shadow-sm border p-6 max-w-lg">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><ShieldAlert size={20} className="text-purple-600" /> Crear nuevo administrador</h3>
          <p className="text-sm text-gray-500 mb-4">El admin se activará automáticamente.</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label><input value={newNombre} onChange={e => setNewNombre(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Apellidos *</label><input value={newApellidos} onChange={e => setNewApellidos(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Email *</label><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Contraseña *</label><input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label><input value={newTel} onChange={e => setNewTel(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none" /></div>
            <button onClick={crearAdmin} className="w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">Crear Admin</button>
          </div>
        </div>
      )}

      {/* Modal de suspensión */}
      {suspendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Suspender a {suspendModal.nombre}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de suspensión *</label>
                <div className="flex gap-3">
                  <button onClick={() => setTipoSusp('TEMPORAL')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 ${tipoSusp === 'TEMPORAL' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200'}`}>Temporal</button>
                  <button onClick={() => setTipoSusp('DEFINITIVO')} className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 ${tipoSusp === 'DEFINITIVO' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'}`}>Definitivo</button>
                </div>
                {tipoSusp === 'DEFINITIVO' && <p className="text-xs text-red-500 mt-1">⚠️ La suspensión definitiva NO se puede revertir</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Motivo * (mín. 10 caracteres)</label>
                <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none" placeholder="Explica el motivo de la suspensión..." />
                <p className="text-xs text-gray-400 text-right">{motivo.length}/10 mín.</p>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => { setSuspendModal(null); setMotivo(''); setError(''); }} className="flex-1 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button onClick={suspender} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Confirmar suspensión</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminUsuariosPage;
