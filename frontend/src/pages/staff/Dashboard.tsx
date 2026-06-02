import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth';
import {
  getAppointments,
  checkInAppointment,
  completeAppointment,
  cancelAppointment,
  confirmAppointment,
  noShowAppointment,
  createAppointmentManually,
  searchPatients,
  getPendingAlerts,
  acknowledgeAlert,
  StaffPatient,
  Appointment,
  ReceptionistAlert
} from '../../api';

export default function Dashboard() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<ReceptionistAlert | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StaffPatient[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);
  const [modalForm, setModalForm] = useState({
    patientId: '',
    name: '',
    phone: '',
    email: '',
    serviceType: 'skin',
    startTime: '',
    endTime: '',
    notes: ''
  });

  // Optimized Modal States
  const [isExistingPatient, setIsExistingPatient] = useState(false);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState<StaffPatient[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState(selectedDate);
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [appointmentDuration, setAppointmentDuration] = useState('20');

  const fetchAppointments = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAppointments(token, selectedDate, activeTab);
      setAppointments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch appointments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate, activeTab]);

  useEffect(() => {
    if (!token) return;

    const checkAlerts = async () => {
      try {
        const alerts = await getPendingAlerts(token);
        if (alerts.length > 0) {
          setActiveAlert(alerts[0]);
        } else {
          setActiveAlert(null);
        }
      } catch (err) {
        console.error('Failed to fetch receptionist alerts:', err);
      }
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    if (!token) return;
    try {
      await acknowledgeAlert(token, alertId);
      setActiveAlert(null);
      fetchAppointments();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      setAppointmentDate(selectedDate);
      if (modalForm.patientId) {
        setIsExistingPatient(true);
      } else {
        setIsExistingPatient(false);
      }
      setPatientQuery('');
      setPatientSuggestions([]);
    }
  }, [isModalOpen, selectedDate, modalForm.patientId]);

  const handleAction = async (id: string, actionType: 'confirm' | 'check-in' | 'complete' | 'cancel' | 'no-show') => {
    if (!token) return;
    try {
      if (actionType === 'confirm') {
        await confirmAppointment(token, id);
      } else if (actionType === 'check-in') {
        await checkInAppointment(token, id);
      } else if (actionType === 'complete') {
        await completeAppointment(token, id);
      } else if (actionType === 'no-show') {
        await noShowAppointment(token, id);
      } else if (actionType === 'cancel') {
        const reason = prompt('Please enter cancellation reason:');
        if (reason === null) return;
        await cancelAppointment(token, id, reason || 'Cancelled by staff');
      }
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchPatients(token, searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePatientSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPatientQuery(val);
    if (!token) return;
    if (val.trim().length >= 2) {
      setIsSearchingSuggestions(true);
      try {
        const results = await searchPatients(token, val);
        setPatientSuggestions(results);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingSuggestions(false);
      }
    } else {
      setPatientSuggestions([]);
    }
  };

  const handleSelectPatient = (patient: StaffPatient) => {
    setModalForm(prev => ({
      ...prev,
      patientId: patient.id,
      name: patient.name,
      phone: patient.phone || '',
      email: patient.email || ''
    }));
    setPatientQuery('');
    setPatientSuggestions([]);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setModalError(null);

    if (!appointmentDate || !appointmentTime) {
      setModalError('Date and Start Time are required.');
      return;
    }

    // Combine date and time
    const startObj = new Date(`${appointmentDate}T${appointmentTime}`);
    if (isNaN(startObj.getTime())) {
      setModalError('Please enter a valid Date and Start Time.');
      return;
    }

    const endObj = new Date(startObj.getTime() + parseInt(appointmentDuration, 10) * 60 * 1000);
    const startTimeISO = startObj.toISOString();
    const endTimeISO = endObj.toISOString();

    setIsSubmittingModal(true);
    try {
      await createAppointmentManually(token, {
        patientId: isExistingPatient && modalForm.patientId ? modalForm.patientId : undefined,
        name: isExistingPatient ? undefined : modalForm.name,
        phone: isExistingPatient ? undefined : modalForm.phone,
        email: isExistingPatient ? undefined : modalForm.email,
        serviceType: modalForm.serviceType,
        startTime: startTimeISO,
        endTime: endTimeISO,
        notes: modalForm.notes || undefined
      });
      setIsModalOpen(false);
      setModalForm({
        patientId: '',
        name: '',
        phone: '',
        email: '',
        serviceType: 'skin',
        startTime: '',
        endTime: '',
        notes: ''
      });
      fetchAppointments();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create appointment');
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const totalCount = appointments.length;
  const checkedInCount = appointments.filter(a => a.status === 'checked_in').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;
  const pendingCount = appointments.filter(a => a.status === 'confirmed').length;

  return (
    <div>
      {activeAlert && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          backgroundColor: '#ffffff',
          color: 'var(--ink)',
          border: '2px solid var(--primary)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          zIndex: 9999,
          maxWidth: '380px',
          width: 'calc(100% - 48px)',
          animation: 'pop 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🔔</span>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 6px 0', color: 'var(--primary)', fontWeight: '700', fontSize: '16px', letterSpacing: '0.5px' }}>NEXT CUSTOMER</h4>
              <p style={{ margin: 0, fontSize: '15px', color: 'var(--body)', lineHeight: '1.4' }}>
                Please let in patient <strong>{activeAlert.patient_name}</strong> to see the doctor!
              </p>
              <button
                onClick={() => handleAcknowledgeAlert(activeAlert.id)}
                className="btn btn-primary"
                style={{ marginTop: '16px', width: '100%', padding: '10px', fontWeight: '600' }}
              >
                Okay, Let In
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '400px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search patients by name or phone..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) setSearchResults([]);
            }}
          />
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>

        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          + New Appointment
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="table-card" style={{ marginBottom: '30px', border: '1px solid var(--primary)' }}>
          <div style={{ backgroundColor: 'rgba(255, 79, 0, 0.05)', padding: '12px 24px', borderBottom: '1px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '700', color: 'var(--primary)' }}>🔍 Patient Search Results ({searchResults.length})</span>
            <button onClick={() => setSearchResults([])} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--primary)' }}>×</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Preferred Notification</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.phone || '—'}</td>
                  <td>{p.email || '—'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.preferred_channel}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link to={`/staff/patients/${p.id}`} className="btn btn-tertiary btn-sm">
                        View Profile
                      </Link>
                      <button
                        onClick={() => {
                          setModalForm(prev => ({ ...prev, patientId: p.id, name: p.name }));
                          setIsModalOpen(true);
                        }}
                        className="btn btn-primary btn-sm"
                      >
                        Book
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Scheduled</span>
          <span className="stat-value">{totalCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Confirmed (Pending)</span>
          <span className="stat-value" style={{ color: 'var(--status-confirmed)' }}>{pendingCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Checked In (Arrived)</span>
          <span className="stat-value" style={{ color: 'var(--status-checked-in)' }}>{checkedInCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Completed Visits</span>
          <span className="stat-value" style={{ color: 'var(--status-completed)' }}>{completedCount}</span>
        </div>
      </div>

      <div className="dashboard-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handlePrevDay} className="btn btn-tertiary btn-sm">◀</button>
          <input
            type="date"
            className="form-control"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ width: '160px', padding: '6px 12px' }}
          />
          <button onClick={handleNextDay} className="btn btn-tertiary btn-sm">▶</button>
          <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="btn btn-tertiary btn-sm">Today</button>
        </div>

        <div className="tabs">
          {['all', 'requested', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'].map(t => (
            <button
              key={t}
              className={`tab-btn ${activeTab === t ? 'active' : ''}`}
              onClick={() => setActiveTab(t)}
              style={{ textTransform: 'capitalize' }}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-container" style={{ margin: '20px 0' }}>{error}</div>}

      <div className="table-card">
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--body-mid)' }}>Loading today's schedule...</div>
        ) : appointments.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Patient</th>
                <th>Treatment</th>
                <th>Status</th>
                <th>Source</th>
                <th>Contact Options</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => {
                const startTimeStr = new Date(a.start_time).toLocaleTimeString('en-US', {
                  hour: '2-digit', minute: '2-digit'
                });
                const cleanPhone = a.patient_phone ? a.patient_phone.replace(/[^\d]/g, '') : '';
                return (
                  <tr key={a.id}>
                    <td><strong>{startTimeStr}</strong></td>
                    <td>
                      <Link to={`/staff/patients/${a.patient_id}`} style={{ fontWeight: '600', textDecoration: 'underline' }}>
                        {a.patient_name || 'Unknown Patient'}
                      </Link>
                      <p style={{ fontSize: '12px', color: 'var(--body-mid)' }}>{a.patient_phone || 'No phone'}</p>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {a.service_type}
                    </td>
                    <td>
                      <span className={`status-badge ${a.status}`}>
                        {a.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize', fontSize: '13px' }}>
                      {a.source.replace('_', ' ')}
                    </td>
                    <td>
                      {a.patient_phone ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <a
                            href={`tel:${a.patient_phone}`}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#0284c7', color: '#ffffff', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: '600', border: 'none' }}
                          >
                            📞 Call Client
                          </a>
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-primary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#16a34a', color: '#ffffff', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: '600', border: 'none' }}
                          >
                            💬 WhatsApp
                          </a>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--body-mid)', fontSize: '13px' }}>No Phone</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {a.status === 'requested' && (
                          <>
                            <button onClick={() => handleAction(a.id, 'confirm')} className="btn btn-primary btn-sm">Confirm</button>
                            <button onClick={() => handleAction(a.id, 'cancel')} className="btn btn-tertiary btn-sm" style={{ color: 'var(--status-cancelled)', borderColor: 'var(--status-cancelled)' }}>Cancel</button>
                          </>
                        )}
                        {a.status === 'confirmed' && (
                          <>
                            <button onClick={() => handleAction(a.id, 'check-in')} className="btn btn-primary btn-sm" style={{ backgroundColor: 'var(--status-checked-in)' }}>Check In</button>
                            <button onClick={() => handleAction(a.id, 'no-show')} className="btn btn-tertiary btn-sm">No Show</button>
                            <button onClick={() => handleAction(a.id, 'cancel')} className="btn btn-tertiary btn-sm" style={{ color: 'var(--status-cancelled)', borderColor: 'var(--status-cancelled)' }}>Cancel</button>
                          </>
                        )}
                        {a.status === 'checked_in' && (
                          <>
                            <button onClick={() => handleAction(a.id, 'complete')} className="btn btn-primary btn-sm" style={{ backgroundColor: 'var(--status-completed)' }}>Complete</button>
                          </>
                        )}
                        {['completed', 'cancelled', 'no_show'].includes(a.status) && (
                          <span style={{ fontSize: '13px', color: 'var(--body-mid)' }}>Archived</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--body-mid)' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>📅</span>
            <h3>No appointments scheduled</h3>
            <p>There are no appointments on this date matching the selected filter.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Book New Appointment</h3>
              <button onClick={() => setIsModalOpen(false)} className="modal-close">×</button>
            </div>

            {modalError && <div className="error-container">{modalError}</div>}

            <form onSubmit={handleModalSubmit}>
              {/* Segmented control for New vs Existing Patient */}
              {!modalForm.patientId && (
                <div className="segment-control">
                  <button
                    type="button"
                    className={`segment-btn ${!isExistingPatient ? 'active' : ''}`}
                    onClick={() => {
                      setIsExistingPatient(false);
                      setModalForm(prev => ({ ...prev, patientId: '', name: '', phone: '', email: '' }));
                    }}
                  >
                    New Patient
                  </button>
                  <button
                    type="button"
                    className={`segment-btn ${isExistingPatient ? 'active' : ''}`}
                    onClick={() => {
                      setIsExistingPatient(true);
                      setModalForm(prev => ({ ...prev, patientId: '', name: '', phone: '', email: '' }));
                    }}
                  >
                    Existing Patient
                  </button>
                </div>
              )}

              {/* Patient Profile Fields */}
              {isExistingPatient ? (
                modalForm.patientId ? (
                  <div style={{ marginBottom: '16px', backgroundColor: 'var(--canvas-soft)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--body-mid)', display: 'block' }}>Selected Patient</span>
                      <strong>{modalForm.name}</strong>
                      <p style={{ fontSize: '12px', color: 'var(--body-mid)', margin: 0 }}>{modalForm.phone || 'No phone'} | {modalForm.email || 'No email'}</p>
                    </div>
                    <button type="button" onClick={() => setModalForm(prev => ({ ...prev, patientId: '', name: '', phone: '', email: '' }))} className="btn btn-tertiary btn-sm">Change</button>
                  </div>
                ) : (
                  <div className="form-group" style={{ position: 'relative', marginBottom: '24px' }}>
                    <label className="form-label" htmlFor="m-search-existing">Search Patient (Name or Phone) *</label>
                    <input
                      id="m-search-existing"
                      type="text"
                      className="form-control"
                      placeholder="Type to search..."
                      value={patientQuery}
                      onChange={handlePatientSearchChange}
                      required={isExistingPatient && !modalForm.patientId}
                    />
                    {isSearchingSuggestions && <span style={{ position: 'absolute', right: '12px', top: '38px', fontSize: '12px', color: 'var(--body-mid)' }}>Searching...</span>}
                    {patientSuggestions.length > 0 && (
                      <ul className="suggestions-box">
                        {patientSuggestions.map(p => (
                          <li key={p.id} className="suggestion-item" onClick={() => handleSelectPatient(p)}>
                            <div>
                              <span className="suggestion-name">{p.name}</span>
                              <div className="suggestion-phone">{p.phone || 'No phone'}</div>
                            </div>
                            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Select →</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="m-name">Patient Full Name *</label>
                    <input
                      id="m-name"
                      type="text"
                      className="form-control"
                      placeholder="Jane Doe"
                      value={modalForm.name}
                      onChange={e => setModalForm(prev => ({ ...prev, name: e.target.value }))}
                      required={!isExistingPatient}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="m-phone">Phone (WhatsApp) *</label>
                      <input
                        id="m-phone"
                        type="tel"
                        className="form-control"
                        placeholder="+91 98800 32191"
                        value={modalForm.phone}
                        onChange={e => setModalForm(prev => ({ ...prev, phone: e.target.value }))}
                        required={!isExistingPatient}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="m-email">Email (Optional)</label>
                      <input
                        id="m-email"
                        type="email"
                        className="form-control"
                        placeholder="jane@example.com"
                        value={modalForm.email}
                        onChange={e => setModalForm(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Service Type */}
              <div className="form-group">
                <label className="form-label" htmlFor="m-service">Treatment Category *</label>
                <select
                  id="m-service"
                  className="form-control"
                  value={modalForm.serviceType}
                  onChange={e => setModalForm(prev => ({ ...prev, serviceType: e.target.value }))}
                >
                  <option value="skin">Skin Treatments</option>
                  <option value="hair">Hair & Scalp Care</option>
                  <option value="other">Aesthetic Procedures</option>
                </select>
              </div>

              {/* Date, Time, Duration Grid (3 Columns) */}
              <div className="form-row">
                <div className="form-group" style={{ flex: '1.5' }}>
                  <label className="form-label" htmlFor="m-date">Appointment Date *</label>
                  <input
                    id="m-date"
                    type="date"
                    className="form-control"
                    value={appointmentDate}
                    onChange={e => setAppointmentDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="m-time">Start Time *</label>
                  <input
                    id="m-time"
                    type="time"
                    className="form-control"
                    value={appointmentTime}
                    onChange={e => setAppointmentTime(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="m-duration">Duration *</label>
                  <select
                    id="m-duration"
                    className="form-control"
                    value={appointmentDuration}
                    onChange={e => setAppointmentDuration(e.target.value)}
                  >
                    <option value="20">20 min (Default)</option>
                    <option value="30">30 min</option>
                    <option value="40">40 min</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label" htmlFor="m-notes">Internal Notes (Optional)</label>
                <textarea
                  id="m-notes"
                  className="form-control"
                  placeholder="Aesthetic peel session notes, follow-up directions..."
                  value={modalForm.notes}
                  onChange={e => setModalForm(prev => ({ ...prev, notes: e.target.value }))}
                  style={{ minHeight: '60px' }}
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-tertiary" disabled={isSubmittingModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingModal}>
                  {isSubmittingModal ? 'Booking...' : 'Book Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
