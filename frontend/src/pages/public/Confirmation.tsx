import React from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';

export default function Confirmation() {
  const location = useLocation();
  const state = location.state as any;

  if (!state || !state.appointment) {
    return <Navigate to="/" replace />;
  }

  const { appointment, patient } = state;

  const dateStr = new Date(appointment.start_time).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeStr = new Date(appointment.start_time).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <section className="section-padding">
      <div className="container">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <h2 className="success-title">Request Submitted!</h2>
          <p>
            Thank you for choosing Dr. Keshav's Clinic. We have received your appointment request.
          </p>

          <div className="success-details">
            <div className="success-details-row">
              <span className="success-details-label">Patient Name:</span>
              <span className="success-details-val">{patient?.name}</span>
            </div>
            <div className="success-details-row">
              <span className="success-details-label">Phone Number:</span>
              <span className="success-details-val">{patient?.phone}</span>
            </div>
            <div className="success-details-row">
              <span className="success-details-label">Preferred Date:</span>
              <span className="success-details-val">{dateStr}</span>
            </div>
            <div className="success-details-row">
              <span className="success-details-label">Estimated Time:</span>
              <span className="success-details-val">{timeStr}</span>
            </div>
            <div className="success-details-row">
              <span className="success-details-label">Category:</span>
              <span className="success-details-val" style={{ textTransform: 'capitalize' }}>
                {appointment?.service_type}
              </span>
            </div>
            <div className="success-details-row">
              <span className="success-details-label">Status:</span>
              <span className="success-details-val" style={{ color: 'var(--primary)', fontWeight: '600' }}>
                {appointment?.status === 'requested' ? 'Pending Confirmation' : 'Confirmed'}
              </span>
            </div>
          </div>

          <p style={{ fontSize: '16px', color: 'var(--body-mid)', marginBottom: 'var(--space-xl)' }}>
            💬 We have sent a confirmation request to your phone number via WhatsApp. Please reply to the WhatsApp message to verify your booking or reschedule.
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
            <Link to="/" className="btn btn-secondary">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
