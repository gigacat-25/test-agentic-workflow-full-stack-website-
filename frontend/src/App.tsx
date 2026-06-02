import React from 'react';
import { HashRouter as Router, Routes, Route, Link, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth, ProtectedRoute, DoctorProtectedRoute } from './auth';
import Home from './pages/public/Home';
import BookAppointment from './pages/public/BookAppointment';
import Confirmation from './pages/public/Confirmation';
import StaffLogin from './pages/staff/Login';
import Dashboard from './pages/staff/Dashboard';
import PatientDetail from './pages/staff/PatientDetail';
import FollowUps from './pages/staff/FollowUps';
import DoctorLogin from './pages/doctor/Login';
import DoctorDashboard from './pages/doctor/Dashboard';

// ── Public Site Layout ──

function PublicNavbar() {
  const location = useLocation();

  return (
    <nav className="nav-bar">
      <div className="nav-container">
        <Link to="/" className="logo">
          <span className="logo-icon">🩺</span> Dr. Keshav's Clinic
        </Link>
        <ul className="nav-links">
          <li>
            <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
              Home
            </Link>
          </li>
          <li>
            <Link to="/book" className="btn btn-primary btn-sm">
              Book Appointment
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

function PublicFooter() {
  return (
    <footer className="footer">
      <div className="container footer-container">
        <div className="footer-info">
          <h4>Dr. Keshav's Clinic</h4>
          <p>📍 Above Delight Fast Food, near Mathikere Bus Stop, Mathikere, Bengaluru</p>
          <p>📞 +91 98800 32191 / +91 79751 65380</p>
          <p>✉️ contact@drkeshavsclinic.com</p>
        </div>
        <div className="footer-links">
          <h4>Treatments</h4>
          <ul className="footer-links-list">
            <li><Link to="/">Medical Dermatology</Link></li>
            <li><Link to="/">Cosmetic Treatment</Link></li>
            <li><Link to="/">Hair & Scalp care</Link></li>
          </ul>
        </div>
        <div className="footer-links">
          <h4>Quick Links</h4>
          <ul className="footer-links-list">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/book">Book Online</Link></li>
          </ul>
        </div>
        <div className="footer-links">
          <h4>Clinic Portals</h4>
          <ul className="footer-links-list">
            <li><Link to="/staff/login">Staff Login</Link></li>
            <li><Link to="/doctor/login">Doctor Login</Link></li>
            <li><Link to="/doctor/dashboard">Doctor Dashboard</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Dr. Keshav's Clinic. All rights reserved.</p>
      </div>
    </footer>
  );
}

function PublicLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <PublicNavbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}

// ── Staff Dashboard Layout ──

function StaffLayout() {
  const { staffUser, logout } = useAuth();
  const location = useLocation();

  const isLinkActive = (path: string) => {
    if (path === '/staff/dashboard') {
      return location.pathname === '/staff' || location.pathname === '/staff/dashboard';
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
      <aside className="sidebar">
        <div>
          <div className="sidebar-header">
            <span>🩺</span> Dr. Keshav's Clinic
          </div>
          <ul className="sidebar-menu">
            <li>
              <Link to="/staff/dashboard" className={`sidebar-link ${isLinkActive('/staff/dashboard') ? 'active' : ''}`}>
                📅 Appointments
              </Link>
            </li>
            <li>
              <Link to="/staff/follow-ups" className={`sidebar-link ${isLinkActive('/staff/follow-ups') ? 'active' : ''}`}>
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
          <button onClick={logout} className="btn-logout">Sign Out</button>
        </div>
      </aside>
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

// ── Root App ──

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Routes>
        {/* Public patient-facing routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/book" element={<BookAppointment />} />
          <Route path="/confirmation" element={<Confirmation />} />
        </Route>

        {/* Staff login */}
        <Route path="/staff/login" element={!isAuthenticated ? <StaffLogin /> : <Navigate to="/staff/dashboard" replace />} />

        {/* Staff dashboard routes (protected) */}
        <Route path="/staff" element={<ProtectedRoute><StaffLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/staff/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="patients/:id" element={<PatientDetail />} />
          <Route path="follow-ups" element={<FollowUps />} />
        </Route>

        {/* Doctor routes */}
        <Route path="/doctor/login" element={<DoctorLogin />} />
        <Route path="/doctor/dashboard" element={<DoctorProtectedRoute><DoctorDashboard /></DoctorProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
