import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { SignIn } from '@clerk/clerk-react';
import { useAuth } from '../../auth';
import { loginStaff } from '../../api';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function DoctorLogin() {
  const { login, logout, isAuthenticated, staffUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle already authenticated sessions to avoid redirect loops
  if (isAuthenticated) {
    if (staffUser?.role === 'doctor') {
      return <Navigate to="/doctor/dashboard" replace />;
    } else {
      return (
        <div className="login-page" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
          <div className="login-card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: '40px', borderRadius: '16px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <div className="login-logo" style={{ color: '#fca5a5', display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
              <span>⚠️</span> Access Denied
            </div>
            <p style={{ color: '#e2e8f0', fontSize: '15px', marginBottom: '24px', lineHeight: '1.6' }}>
              You are signed in as <strong>{staffUser?.name || staffUser?.email}</strong>.
              <br /><br />
              This area is restricted to doctors. Your current role is <strong>{staffUser?.role || 'staff'}</strong>.
            </p>
            <button
              onClick={logout}
              className="btn"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#ef4444', color: '#fff', fontWeight: '600', border: 'none', cursor: 'pointer', fontSize: '15px' }}
            >
              Sign Out & Try Doctor Account
            </button>
            <div style={{ marginTop: '20px' }}>
              <a href="/#" style={{ color: '#a855f7', fontSize: '14px', textDecoration: 'none', fontWeight: '500' }}>Back to Home</a>
            </div>
          </div>
        </div>
      );
    }
  }

  if (PUBLISHABLE_KEY) {
    return (
      <div className="login-page" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="login-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'none', backgroundColor: 'transparent' }}>
          <div className="login-logo" style={{ marginBottom: '8px', color: '#c084fc', display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '24px', fontWeight: 'bold' }}>
            <span>🩺</span> Dr. Keshav's Clinic
          </div>
          <div style={{ color: '#a855f7', textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: '11px', fontWeight: '700', marginBottom: '24px' }}>
            Doctor Portal
          </div>
          <SignIn routing="virtual" fallbackRedirectUrl="/doctor/dashboard" signUpUrl="" />
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await loginStaff(email, password);
      if (response.staffUser.role !== 'doctor') {
        setError('Access Denied: This login is reserved for clinical doctors only.');
        return;
      }
      login(response.token, response.staffUser);
      navigate('/doctor/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div className="login-card" style={{ border: '1px solid rgba(168, 85, 247, 0.2)', backgroundColor: 'rgba(15, 23, 42, 0.85)', padding: '40px', borderRadius: '16px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(12px)' }}>
        <div className="login-logo" style={{ color: '#c084fc', display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
          <span>🩺</span> Dr. Keshav's Clinic
        </div>
        <div style={{ textAlign: 'center', color: '#a855f7', textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: '11px', fontWeight: '700', marginBottom: '24px' }}>
          Doctor portal
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: '28px', fontSize: '22px', color: '#f1f5f9', fontWeight: '600' }}>Clinical Sign In</h2>

        {error && <div className="error-container" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="email" style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>Doctor Email</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="thejaswinp6@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isSubmitting}
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', borderColor: 'rgba(168, 85, 247, 0.3)', borderRadius: '8px', padding: '10px 14px' }}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="password" style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isSubmitting}
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', borderColor: 'rgba(168, 85, 247, 0.3)', borderRadius: '8px', padding: '10px 14px' }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#a855f7', color: '#fff', fontWeight: '600', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', fontSize: '15px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Authenticating...' : 'Access Clinical Dashboard'}
          </button>
        </form>

        <p style={{ marginTop: '28px', fontSize: '12px', color: '#94a3b8', textAlign: 'center', lineHeight: '1.5' }}>
          This login session is secure and monitored for compliance. Restricted to clinical staff only.
        </p>
      </div>
    </div>
  );
}
