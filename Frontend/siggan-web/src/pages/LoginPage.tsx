import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally { setLoading(false); }
  };

  const fillCredentials = (e: string, p: string) => { setEmail(e); setPassword(p); setError(''); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 via-emerald-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">🐄 SIGGAN</h1>
          <p className="text-emerald-300 text-sm">Sistema Integral de Gestión Ganadera</p>
          <p className="text-emerald-400/60 text-xs mt-1">Durango, México</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Iniciar Sesión</h2>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <Link to="/registro" className="text-emerald-600 hover:underline text-sm font-medium">
              ¿No tienes cuenta? Regístrate aquí
            </Link>
          </div>
        </div>

        <div className="mt-6 bg-white/10 backdrop-blur rounded-xl p-4">
          <p className="text-emerald-300 text-xs font-semibold mb-2 text-center">Credenciales de prueba</p>
          <div className="space-y-1">
            {[
              { email: 'superadmin@siggan.mx', pass: 'super123', rol: 'SUPER_ADMIN Primario' },
              { email: 'admin@siggan.mx', pass: 'admin123', rol: 'ADMIN' },
              { email: 'mvz@siggan.mx', pass: 'mvz123', rol: 'MVZ' },
              { email: 'juan@email.com', pass: 'prod123', rol: 'PRODUCTOR' },
              { email: 'maria@email.com', pass: 'prod123', rol: 'PRODUCTOR' },
              { email: 'pendiente@email.com', pass: 'pend123', rol: 'PENDIENTE' },
            ].map(c => (
              <button key={c.email} onClick={() => fillCredentials(c.email, c.pass)}
                className="w-full flex items-center justify-between text-left px-3 py-1.5 rounded hover:bg-white/10 transition text-xs">
                <span className="text-white/80 font-mono">{c.email}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  c.rol.includes('SUPER') ? 'bg-purple-500/30 text-purple-200' :
                  c.rol === 'ADMIN' ? 'bg-blue-500/30 text-blue-200' :
                  c.rol === 'MVZ' ? 'bg-emerald-500/30 text-emerald-200' :
                  c.rol === 'PENDIENTE' ? 'bg-yellow-500/30 text-yellow-200' :
                  'bg-gray-500/30 text-gray-200'
                }`}>{c.rol}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default LoginPage;
