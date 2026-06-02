import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="section-padding">
        <div className="container hero">
          <div className="hero-content">
            <span className="eyebrow">Dermatology Excellence</span>
            <h1 className="hero-title">Expert Skin Care,<br />Personalized for You</h1>
            <p className="hero-description">
              Get medical and cosmetic skin treatments from board-certified specialists. Book online and get instant availability and confirmation via WhatsApp.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <Link to="/book" className="btn btn-primary">
                Book an Appointment
              </Link>
              <a href="#services" className="btn btn-tertiary">
                Our Services
              </a>
            </div>
          </div>
          <div className="hero-illustration">
            <div className="illustration-box">
              <div className="illustration-shape"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="section-padding bg-cream">
        <div className="container">
          <span className="eyebrow" style={{ textAlign: 'center' }}>What We Treat</span>
          <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>Our Specialized Services</h2>
          <div className="services-grid">
            <div className="card service-card card-hover">
              <div className="service-icon">🩺</div>
              <h3 className="card-title">Dermatology</h3>
              <p>
                Treatment for acne, pigmentation, psoriasis, skin allergies, and minor dermatologic surgeries led by expert clinical care.
              </p>
            </div>
            <div className="card service-card card-hover">
              <div className="service-icon">💇‍♂️</div>
              <h3 className="card-title">Hair & Trichology</h3>
              <p>
                Advanced solutions for hair loss and thinning, hair spas, LLLT (Low-Level Laser Therapy), and hair transplants.
              </p>
            </div>
            <div className="card service-card card-hover">
              <div className="service-icon">✨</div>
              <h3 className="card-title">Aesthetics & Laser</h3>
              <p>
                Modern cosmetic treatments including HydraFacials, safe laser hair removal, and laser skin resurfacing therapies.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Doctor Profile */}
      <section className="section-padding">
        <div className="container doctor-profile">
          <div className="doctor-image-container">
            <div className="doctor-placeholder-photo">👨‍⚕️</div>
          </div>
          <div className="doctor-bio">
            <span className="eyebrow">Expert Dermatologist & Cosmetologist</span>
            <h3>Dr. Keshava M</h3>
            <p className="doctor-subtitle">Dermatologist, Cosmetologist & Trichologist (25+ Years Experience)</p>
            <p className="doctor-text">
              Dr. Keshava M is a highly respected dermatologist, cosmetologist, and trichologist in Bangalore with over two decades of experience. He is dedicated to offering advanced, customized care to every patient.
            </p>
            <p className="doctor-text">
              At his clinic in Mathikere, he integrates advanced laser technology, clinical dermatology, and progressive hair transplant methods to provide outstanding, natural-looking results.
            </p>
            <Link to="/book" className="btn btn-secondary">
              Book Consultation with Dr. Keshav
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section-padding bg-cream">
        <div className="container">
          <span className="eyebrow" style={{ textAlign: 'center' }}>Patient Success</span>
          <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>What Our Patients Say</h2>
          <div className="testimonials-grid">
            <div className="card testimonial-card">
              <div>
                <div className="testimonial-stars">★★★★★</div>
                <p className="testimonial-quote">
                  "Dr. Keshav completely resolved my pigmentation issues. His 25+ years of experience really show. Highly recommended clinic in Mathikere!"
                </p>
              </div>
              <span className="testimonial-author">— Ramesh R.</span>
            </div>
            <div className="card testimonial-card">
              <div>
                <div className="testimonial-stars">★★★★★</div>
                <p className="testimonial-quote">
                  "Outstanding hair spa and LLLT treatment. The hair transplant procedures here are state-of-the-art. Very friendly doctor and staff."
                </p>
              </div>
              <span className="testimonial-author">— Priya K.</span>
            </div>
            <div className="card testimonial-card">
              <div>
                <div className="testimonial-stars">★★★★★</div>
                <p className="testimonial-quote">
                  "I booked a HydraFacial and laser hair removal session online. The scheduling was very smooth, and the results are amazing."
                </p>
              </div>
              <span className="testimonial-author">— Ananya S.</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
