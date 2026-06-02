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
              <h3 className="card-title">Skin Treatments</h3>
              <p>
                Professional care for acne, eczema, psoriasis, rosacea, moles, and skin cancer screenings. Board-certified dermatology solutions.
              </p>
            </div>
            <div className="card service-card card-hover">
              <div className="service-icon">💇‍♀️</div>
              <h3 className="card-title">Hair & Scalp Care</h3>
              <p>
                Comprehensive evaluation and treatments for hair loss, thinning, scalp infections, alopecia, and restorative therapies.
              </p>
            </div>
            <div className="card service-card card-hover">
              <div className="service-icon">✨</div>
              <h3 className="card-title">Aesthetic Care</h3>
              <p>
                Advanced cosmetic treatments including chemical peels, microneedling, anti-aging therapies, and custom skincare consultations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Doctor Profile */}
      <section className="section-padding">
        <div className="container doctor-profile">
          <div className="doctor-image-container">
            <div className="doctor-placeholder-photo">👩‍⚕️</div>
          </div>
          <div className="doctor-bio">
            <span className="eyebrow">Expert Dermatologist</span>
            <h3>Dr. Sarah Chen, MD, FAAD</h3>
            <p className="doctor-subtitle">Board-Certified Dermatologist & Medical Director</p>
            <p className="doctor-text">
              Dr. Sarah Chen has over 15 years of experience delivering clinical excellence in medical and cosmetic dermatology. She completed her residency at Stanford University and is dedicated to helping patients achieve healthy, beautiful skin.
            </p>
            <p className="doctor-text">
              At SkinCare Clinic, she integrates the latest medical advances with personalized aesthetic plans to deliver outstanding, natural-looking results.
            </p>
            <Link to="/book" className="btn btn-secondary">
              Book Consultation with Dr. Chen
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
                  "Dr. Chen completely resolved my cystic acne when other treatments failed. The WhatsApp booking flow was also incredibly simple and fast!"
                </p>
              </div>
              <span className="testimonial-author">— Michael R.</span>
            </div>
            <div className="card testimonial-card">
              <div>
                <div className="testimonial-stars">★★★★★</div>
                <p className="testimonial-quote">
                  "Outstanding aesthetic results! Dr. Chen is very professional and explains every treatment plan in detail. The clinic design is warm and welcoming."
                </p>
              </div>
              <span className="testimonial-author">— Elena K.</span>
            </div>
            <div className="card testimonial-card">
              <div>
                <div className="testimonial-stars">★★★★★</div>
                <p className="testimonial-quote">
                  "I was able to schedule a skin checkup same-day through WhatsApp. Very efficient staff and excellent patient service."
                </p>
              </div>
              <span className="testimonial-author">— David L.</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
