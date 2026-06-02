import React from 'react';
import { HashRouter as Router, Routes, Route, Link, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth, ProtectedRoute } from './auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PatientDetail from './pages/PatientDetail';
import FollowUps from './pages/FollowUps';

function Layout() {
  const { staffUser, logout } = useAuth();
  const location = useLocation();

  const isLinkActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-header">
            <span>🩺</span> Dr. Keshav's Clinic
          </div>
          <ul className="sidebar-menu">
            <li>
              <Link to="/dashboard" className={`sidebar-link ${isLinkActive('/dashboard') ? 'active' : ''}`}>
                📅 Appointments
              </Link>
            </li>
            <li>
              <Link to="/follow-ups" className={`sidebar-link ${isLinkActive('/follow-ups') ? 'active' : ''}`}>
                📋 Follow-ups
              </Link>
            </li>
          </ul>
        </div>

        <div className="sidebar-user">
          <div className="user-info">
            <p className="user-name">{staffUser?.name || 'Staff User'}</p>
            <p className="user-role">{staffUser?.role || 'User'}</p>
          </div>
          <button onClick={logout} className="btn-logout">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="page-header" style={{ marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--body-mid)' }}>Dermatology CMS</span>
            <p style={{ fontSize: '15px', color: 'var(--body)' }}>📅 {todayStr}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', backgroundColor: 'var(--border)', padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontWeight: '500' }}>
              👤 {staffUser?.name} ({staffUser?.role})
            </span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="patients/:id" element={<PatientDetail />} />
          <Route path="follow-ups" element={<FollowUps />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
