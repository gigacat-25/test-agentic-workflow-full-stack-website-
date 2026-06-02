import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import {
  getAppointments,
  checkInAppointment,
  completeAppointment,
  cancelAppointment,
  confirmAppointment,
  noShowAppointment,
  createAppointmentManually,
  searchPatients,
  Patient,
  Appointment
} from '../api';

export default function Dashboard() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Modal state
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

  // Fetch appointments
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

  // Handle action triggers
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
        if (reason === null) return; // Prompt cancelled
        await cancelAppointment(token, id, reason || 'Cancelled by staff');
      }
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  // Change date helpers
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

  // Search handler
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

  // Modal Create Appointment submit
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setModalError(null);

    if (!modalForm.startTime || !modalForm.endTime) {
      setModalError('Start and end times are required.');
      return;
    }

    if (new Date(modalForm.startTime) >= new Date(modalForm.endTime)) {
      setModalError('Start time must be before end time.');
      return;
    }

    setIsSubmittingModal(true);
    try {
      await createAppointmentManually(token, {
        patientId: modalForm.patientId || undefined,
        name: modalForm.patientId ? undefined : modalForm.name,
        phone: modalForm.patientId ? undefined : modalForm.phone,
        email: modalForm.patientId ? undefined : modalForm.email,
        serviceType: modalForm.serviceType,
        startTime: new Date(modalForm.startTime).toISOString(),
        endTime: new Date(modalForm.endTime).toISOString(),
        notes: modalForm.notes || undefined
      });
      setIsModalOpen(false);
      // Reset form
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

  // Stats calculation
  const totalCount = appointments.length;
  const checkedInCount = appointments.filter(a => a.status === 'checked_in').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;
  const pendingCount = appointments.filter(a => a.status === 'confirmed').length;

  return (
    <div>
      {/* Search and Modal trigger */}
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

      {/* Search results banner */}
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
                      <Link to={`/patients/${p.id}`} className="btn btn-tertiary btn-sm">
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

      {/* Stats Board */}
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

      {/* Date Navigation and Tab filters */}
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

      {/* Error state */}
      {error && <div className="error-container" style={{ margin: '20px 0' }}>{error}</div>}

      {/* Appointments List */}
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => {
                const startTimeStr = new Date(a.start_time).toLocaleTimeString('en-US', {
                  hour: '2-digit', minute: '2-digit'
                });
                return (
                  <tr key={a.id}>
                    <td><strong>{startTimeStr}</strong></td>
                    <td>
                      <Link to={`/patients/${a.patient_id}`} style={{ fontWeight: '600', textDecoration: 'underline' }}>
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

      {/* Manual Appointment Creation Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Book New Appointment</h3>
              <button onClick={() => setIsModalOpen(false)} className="modal-close">×</button>
            </div>
            
            {modalError && <div className="error-container">{modalError}</div>}

            <form onSubmit={handleModalSubmit}>
              {modalForm.patientId ? (
                <div style={{ marginBottom: '16px', backgroundColor: 'var(--canvas-soft)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--body-mid)', display: 'block' }}>Selected Patient</span>
                    <strong>{modalForm.name}</strong>
                  </div>
                  <button type="button" onClick={() => setModalForm(prev => ({ ...prev, patientId: '', name: '' }))} className="btn btn-tertiary btn-sm">Change</button>
                </div>
              ) : (
                <>
                  <div style={{ borderBottom: '1px dashed var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--body-mid)' }}>Create new patient profile</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="m-name">Patient Full Name *</label>
                    <input
                      id="m-name"
                      type="text"
                      className="form-control"
                      value={modalForm.name}
                      onChange={e => setModalForm(prev => ({ ...prev, name: e.target.value }))}
                      required={!modalForm.patientId}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="m-phone">Patient Phone (WhatsApp) *</label>
                    <input
                      id="m-phone"
                      type="tel"
                      className="form-control"
                      value={modalForm.phone}
                      onChange={e => setModalForm(prev => ({ ...prev, phone: e.target.value }))}
                      required={!modalForm.patientId}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="m-email">Patient Email (Optional)</label>
                    <input
                      id="m-email"
                      type="email"
                      className="form-control"
                      value={modalForm.email}
                      onChange={e => setModalForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </>
              )}

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

              <div className="form-group">
                <label className="form-label" htmlFor="m-start">Start Time *</label>
                <input
                  id="m-start"
                  type="datetime-local"
                  className="form-control"
                  value={modalForm.startTime}
                  onChange={e => setModalForm(prev => ({ ...prev, startTime: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="m-end">End Time *</label>
                <input
                  id="m-end"
                  type="datetime-local"
                  className="form-control"
                  value={modalForm.endTime}
                  onChange={e => setModalForm(prev => ({ ...prev, endTime: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="m-notes">Internal Notes (Optional)</label>
                <textarea
                  id="m-notes"
                  className="form-control"
                  placeholder="Aesthetic peel session notes, follow-up directions..."
                  value={modalForm.notes}
                  onChange={e => setModalForm(prev => ({ ...prev, notes: e.target.value }))}
                  style={{ minHeight: '80px' }}
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
