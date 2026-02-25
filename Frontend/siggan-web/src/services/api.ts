import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('siggan_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('siggan_token');
      localStorage.removeItem('siggan_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (email: string, password: string) => api.post('/auth/login', { email, password });
export const register = (data: any) => api.post('/auth/register', data);

// Animales
export const getAnimales = (params?: any) => api.get('/animales', { params });
export const getAnimal = (id: string) => api.get(`/animales/${id}`);
export const getAnimalPorArete = (arete: string) => api.get(`/animales/arete/${arete}`);
export const createAnimal = (data: any) => api.post('/animales', data);
export const updateAnimal = (id: string, data: any) => api.put(`/animales/${id}`, data);
export const cambiarProposito = (id: string, proposito: string) => api.put(`/animales/${id}/proposito`, { proposito });
export const deleteAnimal = (id: string) => api.delete(`/animales/${id}`);

// Propietarios
export const getPropietarios = (params?: any) => api.get('/propietarios', { params });
export const getPropietario = (id: string) => api.get(`/propietarios/${id}`);
export const createPropietario = (data: any) => api.post('/propietarios', data);

// UPPs
export const getUPPs = (params?: any) => api.get('/upps', { params });
export const getUPP = (id: string) => api.get(`/upps/${id}`);
export const createUPP = (data: any) => api.post('/upps', data);

// Eventos
export const getEventos = (params?: any) => api.get('/eventos', { params });
export const getEventosAnimal = (animalId: string) => api.get(`/eventos/animal/${animalId}`);
export const getReactores = () => api.get('/eventos/reactores/lista');
export const createEvento = (data: any) => api.post('/eventos', data);
export const createEventoLote = (data: any) => api.post('/eventos/lote', data);

// Aretes
export const getHistorialAretes = (animalId: string) => api.get(`/aretes/animal/${animalId}`);
export const transferirAnimal = (data: any) => api.post('/aretes/transferir', data);

// Búsqueda
export const busquedaGlobal = (q: string) => api.get('/busqueda', { params: { q } });
export const busquedaHistorial = (arete: string) => api.get(`/busqueda/historial/${arete}`);
export const estadisticasMunicipio = () => api.get('/busqueda/estadisticas/municipio');
export const estadisticasRazas = () => api.get('/busqueda/estadisticas/razas');

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats');

export default api;
