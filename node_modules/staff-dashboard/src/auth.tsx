import React, { createContext, useContext, useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface StaffUser {
  id: string;
  name: string;
  role: string;
  email: string;
}

interface AuthContextType {
  staffUser: StaffUser | null;
  token: string | null;
  login: (token: string, user: StaffUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for token and user
    const savedToken = localStorage.getItem('staff_token');
    const savedUser = localStorage.getItem('staff_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setStaffUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Failed to parse saved user', err);
        localStorage.removeItem('staff_token');
        localStorage.removeItem('staff_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, user: StaffUser) => {
    setToken(newToken);
    setStaffUser(user);
    localStorage.setItem('staff_token', newToken);
    localStorage.setItem('staff_user', JSON.stringify(user));
  };

  const logout = () => {
    setToken(null);
    setStaffUser(null);
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ staffUser, token, login, logout, isAuthenticated, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--canvas-soft)' }}>
        <p style={{ fontSize: '18px', fontWeight: '600' }}>Loading Session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
