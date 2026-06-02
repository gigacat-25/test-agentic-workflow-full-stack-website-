import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth as useClerkAuth, useUser as useClerkUser } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router-dom';
import { setTokenGetter } from './api';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export interface StaffUser {
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
  const clerkAuth = useClerkAuth();
  const clerkUser = useClerkUser();

  const isAuthLoaded = clerkAuth.isLoaded;
  const isSignedIn = clerkAuth.isSignedIn;
  const getToken = clerkAuth.getToken;
  const signOut = clerkAuth.signOut;

  const isUserLoaded = clerkUser.isLoaded;
  const user = clerkUser.user;

  const [token, setToken] = useState<string | null>(null);
  const [fetchingToken, setFetchingToken] = useState(true);

  // Local JWT / password-based login states
  const [localToken, setLocalToken] = useState<string | null>(() => localStorage.getItem('staff_token'));
  const [localUser, setLocalUser] = useState<StaffUser | null>(() => {
    const saved = localStorage.getItem('staff_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    setTokenGetter(async () => {
      try {
        if (isSignedIn) {
          return await getToken();
        }
        return localStorage.getItem('staff_token');
      } catch (err) {
        console.error('Clerk getToken failed:', err);
        return localStorage.getItem('staff_token');
      }
    });
  }, [getToken, isSignedIn]);

  useEffect(() => {
    async function updateToken() {
      if (isSignedIn) {
        try {
          const jwt = await getToken();
          setToken(jwt);
        } catch (err) {
          console.error('Failed to pre-fetch Clerk token:', err);
          setToken(null);
        }
      } else {
        setToken(null);
      }
      setFetchingToken(false);
    }
    updateToken();
  }, [isSignedIn, getToken]);

  const isLoading = PUBLISHABLE_KEY ? (!isAuthLoaded || !isUserLoaded || fetchingToken) : false;
  const isAuthenticated = (!!isSignedIn && !!token) || (!!localToken && !!localUser);

  const staffUser: StaffUser | null = isSignedIn && user ? {
    id: user.id,
    name: user.fullName || user.username || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Staff Member',
    role: user.primaryEmailAddress?.emailAddress?.toLowerCase().trim() === 'thejaswinp6@gmail.com'
      ? 'doctor'
      : (user.publicMetadata?.role as string) || 'receptionist',
    email: user.primaryEmailAddress?.emailAddress || '',
  } : localUser;

  const login = (jwt: string, sUser: StaffUser) => {
    localStorage.setItem('staff_token', jwt);
    localStorage.setItem('staff_user', JSON.stringify(sUser));
    setLocalToken(jwt);
    setLocalUser(sUser);
  };

  const logout = async () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
    setLocalToken(null);
    setLocalUser(null);
    if (isSignedIn) {
      await signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ staffUser, token: isSignedIn ? token : localToken, login, logout, isAuthenticated, isLoading }}>
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
    return <Navigate to="/staff/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export function DoctorProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, staffUser, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--canvas-soft)' }}>
        <p style={{ fontSize: '18px', fontWeight: '600' }}>Loading Session...</p>
      </div>
    );
  }

  if (!isAuthenticated || staffUser?.role !== 'doctor') {
    return <Navigate to="/doctor/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
