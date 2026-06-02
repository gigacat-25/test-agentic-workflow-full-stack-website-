import React from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import BookAppointment from './pages/BookAppointment';
import Confirmation from './pages/Confirmation';

function Navbar() {
  const location = useLocation();

  return (
    <nav className="nav-bar">
      <div className="nav-container">
        <Link to="/" className="logo">
          <span className="logo-icon">✨</span> SkinCare Clinic
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

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-container">
        <div className="footer-info">
          <h4>SkinCare Clinic</h4>
          <p>📍 123 Medical Drive, Suite 200, Cityville, ST 12345</p>
          <p>📞 +1 (555) 123-4567</p>
          <p>✉️ hello@skincareclinic.com</p>
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
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} SkinCare Clinic. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <Router>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/book" element={<BookAppointment />} />
            <Route path="/confirmation" element={<Confirmation />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}
