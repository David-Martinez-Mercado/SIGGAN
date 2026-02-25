import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as loginApi } from '../services/api';

interface User {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  rol: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('siggan_token');
    const savedUser = localStorage.getItem('siggan_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await loginApi(email, password);
    const { usuario, token: newToken } = res.data;
    localStorage.setItem('siggan_token', newToken);
    localStorage.setItem('siggan_user', JSON.stringify(usuario));
    setToken(newToken);
    setUser(usuario);
  };

  const logout = () => {
    localStorage.removeItem('siggan_token');
    localStorage.removeItem('siggan_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
