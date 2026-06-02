import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import {
  getAppointments,
  checkInAppointment,
  completeAppointment,
  createFollowUp,
  callNextPatient,
  Appointment,
  FollowUp
} from '../../api';

export default function DoctorDashboard() {
  const { token, logout, staffUser } = useAuth();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Follow-up modal states
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [followUpReason, setFollowUpReason] = useState('');
  const [followUpInterval, setFollowUpInterval] = useState('7');
  const [customDays, setCustomDays] = useState('14');
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);
  const [followUpSuccessMsg, setFollowUpSuccessMsg] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchAppointments = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      // Get all appointments for selected date
      const data = await getAppointments(token, selectedDate, 'all');
      setAppointments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load clinic schedule.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate, token]);

  const handleCallNext = async (appointment: Appointment) => {
    if (!token) return;
    try {
      await callNextPatient(token, appointment.id);
      setSuccessToast(`Alert sent to staff to let in ${appointment.patient_name}!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to call the next patient.');
    }
  };

  const handleStatusChange = async (id: string, action: 'check-in' | 'complete') => {
    if (!token) return;
    try {
      if (action === 'check-in') {
        await checkInAppointment(token, id);
      } else if (action === 'complete') {
        await completeAppointment(token, id);
      }
      fetchAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to update appointment status.');
    }
  };

  const handleOpenFollowUpModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setFollowUpReason('');
    setFollowUpInterval('7');
    setFollowUpSuccessMsg(null);
    setFollowUpError(null);
    setIsFollowUpModalOpen(true);
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedAppointment) return;

    const days = followUpInterval === 'custom' ? parseInt(customDays, 10) : parseInt(followUpInterval, 10);
    if (isNaN(days) || days <= 0) {
      setFollowUpError('Please enter a valid number of days.');
      return;
    }

    // Calculate due date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const dueDateStr = targetDate.toISOString().split('T')[0];

    setIsSubmittingFollowUp(true);
    setFollowUpError(null);
    try {
      await createFollowUp(token, {
        patientId: selectedAppointment.patient_id,
        reason: followUpReason.trim(),
        dueDate: dueDateStr,
      });

      setFollowUpSuccessMsg(`Successfully scheduled staff follow-up for this patient in ${days} days (${targetDate.toLocaleDateString()})!`);
      setTimeout(() => {
        setIsFollowUpModalOpen(false);
      }, 2000);
    } catch (err: any) {
      setFollowUpError(err.message || 'Failed to create follow-up task.');
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  // Stats calculation
  const totalCount = appointments.length;
  const waitingCount = appointments.filter(a => a.status === 'checked_in').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;
  const pendingCount = appointments.filter(a => a.status === 'confirmed' || a.status === 'requested').length;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'requested': return { backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d' };
      case 'confirmed': return { backgroundColor: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd' };
      case 'checked_in': return { backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontWeight: 'bold' };
      case 'completed': return { backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' };
      case 'cancelled': return { backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' };
      default: return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const getIntervalDays = () => {
    return followUpInterval === 'custom' ? parseInt(customDays, 10) : parseInt(followUpInterval, 10);
  };

  const calculatedDueDateStr = () => {
    const days = getIntervalDays();
    if (isNaN(days) || days <= 0) return 'Invalid days';
    const target = new Date();
    target.setDate(target.getDate() + days);
    return target.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc' }}>
      {/* Sidebar */}
      <aside className="sidebar" style={{ width: '260px', backgroundColor: '#1e1b4b', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid rgba(168, 85, 247, 0.2)' }}>
        <div>
          <div className="sidebar-header" style={{ color: '#c084fc', borderBottom: '1px solid rgba(168, 85, 247, 0.1)', padding: '24px 20px', fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🩺</span> Doctor Portal
          </div>
          <ul className="sidebar-menu" style={{ padding: '20px 10px', listStyle: 'none' }}>
            <li style={{ marginBottom: '8px' }}>
              <button className="sidebar-link active" style={{ width: '100%', textAlign: 'left', border: 'none', background: 'rgba(168, 85, 247, 0.15)', color: '#e9d5ff', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>
                📅 Today's Patients
              </button>
            </li>
          </ul>
        </div>
        <div className="sidebar-user" style={{ padding: '20px', borderTop: '1px solid rgba(168, 85, 247, 0.1)', backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
          <div className="user-info" style={{ marginBottom: '16px' }}>
            <p className="user-name" style={{ fontWeight: 'bold', fontSize: '15px', color: '#f3e8ff', margin: '0 0 4px 0' }}>{staffUser?.name || 'Dr. Keshav'}</p>
            <p className="user-role" style={{ fontSize: '12px', color: '#c084fc', textTransform: 'uppercase', fontWeight: '600', margin: 0 }}>{staffUser?.role || 'Doctor'}</p>
          </div>
          <button onClick={() => { logout(); navigate('/doctor/login'); }} className="btn-logout" style={{ width: '100%', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '8px', borderRadius: '6px', cursor: 'pointer', transition: 'background-color 0.2s' }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px' }}>
          <div>
            <span style={{ color: '#a855f7', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>Clinical Workspace</span>
            <h1 style={{ fontSize: '28px', color: '#ffffff', margin: '4px 0 0 0', fontWeight: 'bold' }}>Consultation Dashboard</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Selected Date:</span>
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ width: '160px', padding: '8px 12px', backgroundColor: '#1e293b', color: '#f8fafc', borderColor: '#334155', borderRadius: '8px' }}
            />
            <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="btn" style={{ padding: '8px 16px', backgroundColor: '#334155', color: '#f8fafc', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Today</button>
          </div>
        </header>

        {successToast && (
          <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔔</span> {successToast}
          </div>
        )}

        {error && <div className="error-container" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>{error}</div>}

        {/* Stats Grid */}
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div className="stat-card" style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <span className="stat-label" style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>Total Patients Today</span>
            <span className="stat-value" style={{ fontSize: '32px', fontWeight: 'bold', color: '#f8fafc' }}>{totalCount}</span>
          </div>
          <div className="stat-card" style={{ backgroundColor: '#1e293b', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <span className="stat-label" style={{ color: '#4ade80', fontSize: '13px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>Waiting in Room (Checked In)</span>
            <span className="stat-value" style={{ fontSize: '32px', fontWeight: 'bold', color: '#4ade80' }}>{waitingCount}</span>
          </div>
          <div className="stat-card" style={{ backgroundColor: '#1e293b', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <span className="stat-label" style={{ color: '#c084fc', fontSize: '13px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>Pending/Scheduled</span>
            <span className="stat-value" style={{ fontSize: '32px', fontWeight: 'bold', color: '#c084fc' }}>{pendingCount}</span>
          </div>
          <div className="stat-card" style={{ backgroundColor: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <span className="stat-label" style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>Completed Consultations</span>
            <span className="stat-value" style={{ fontSize: '32px', fontWeight: 'bold', color: '#94a3b8' }}>{completedCount}</span>
          </div>
        </div>

        {/* Patient Queue */}
        <div className="table-card" style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '18px', margin: 0, fontWeight: '600' }}>Patient Queue</h3>
            <button onClick={fetchAppointments} className="btn" style={{ background: 'none', border: 'none', color: '#c084fc', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>🔄 Refresh Queue</button>
          </div>
          {isLoading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading today's clinical queue...</div>
          ) : appointments.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '16px 24px' }}>Time Slot</th>
                    <th style={{ padding: '16px 24px' }}>Patient Details</th>
                    <th style={{ padding: '16px 24px' }}>Treatment</th>
                    <th style={{ padding: '16px 24px' }}>Status</th>
                    <th style={{ padding: '16px 24px' }}>Contact Options</th>
                    <th style={{ padding: '16px 24px' }}>Clinical Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(appt => {
                    const cleanPhone = appt.patient_phone ? appt.patient_phone.replace(/[^\d]/g, '') : '';
                    const timeStr = `${new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(appt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                    return (
                      <tr key={appt.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ padding: '20px 24px', fontWeight: '600', color: '#c084fc' }}>
                          ⏰ {timeStr}
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                          <strong style={{ fontSize: '16px', color: '#f8fafc', display: 'block' }}>{appt.patient_name}</strong>
                          {appt.notes && <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '4px', fontStyle: 'italic' }}>📝 Notes: {appt.notes}</span>}
                        </td>
                        <td style={{ padding: '20px 24px', textTransform: 'capitalize' }}>
                          <span style={{ fontSize: '14px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '4px' }}>{appt.service_type}</span>
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                          <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '20px', textTransform: 'capitalize', display: 'inline-block', ...getStatusStyle(appt.status) }}>
                            {appt.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                          {appt.patient_phone ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <a
                                href={`tel:${appt.patient_phone}`}
                                className="btn"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#0284c7', color: '#ffffff', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}
                              >
                                📞 Call Client
                              </a>
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#16a34a', color: '#ffffff', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}
                              >
                                💬 WhatsApp
                              </a>
                            </div>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '13px' }}>No Phone Number</span>
                          )}
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {appt.status === 'confirmed' && (
                              <button
                                onClick={() => handleStatusChange(appt.id, 'check-in')}
                                className="btn"
                                style={{ padding: '6px 12px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                              >
                                Check In
                              </button>
                            )}
                            {appt.status === 'checked_in' && (
                              <>
                                <button
                                  onClick={() => handleCallNext(appt)}
                                  className="btn"
                                  style={{ padding: '6px 12px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                                >
                                  🔔 Call Next
                                </button>
                                <button
                                  onClick={() => handleStatusChange(appt.id, 'complete')}
                                  className="btn"
                                  style={{ padding: '6px 12px', backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                                >
                                  Complete Visit
                                </button>
                              </>
                            )}
                            {appt.status !== 'cancelled' && (
                              <button
                                onClick={() => handleOpenFollowUpModal(appt)}
                                className="btn"
                                style={{ padding: '6px 12px', backgroundColor: '#334155', color: '#e2e8f0', border: '1px solid #475569', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                              >
                                ➕ Schedule Follow-Up
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
              No appointments scheduled for {new Date(selectedDate).toLocaleDateString(undefined, { dateStyle: 'long' })}.
            </div>
          )}
        </div>
      </main>

      {/* Follow-Up Modal */}
      {isFollowUpModalOpen && selectedAppointment && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid rgba(168, 85, 247, 0.3)', width: '100%', maxWidth: '500px', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#ffffff' }}>➕ Schedule Patient Follow-Up</h3>
              <button onClick={() => setIsFollowUpModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>

            <form onSubmit={handleFollowUpSubmit} style={{ padding: '24px' }}>
              {followUpSuccessMsg && (
                <div style={{ backgroundColor: 'rgba(22, 163, 74, 0.15)', color: '#4ade80', border: '1px solid rgba(22, 163, 74, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
                  {followUpSuccessMsg}
                </div>
              )}
              {followUpError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
                  {followUpError}
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Patient Name</span>
                <strong style={{ fontSize: '16px', color: '#ffffff' }}>{selectedAppointment.patient_name}</strong>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" htmlFor="f-reason" style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>Follow-up Reason / Clinical Notes *</label>
                <textarea
                  id="f-reason"
                  className="form-control"
                  placeholder="E.g., Review treatment response to acne gel; adjust peel strength..."
                  required
                  value={followUpReason}
                  onChange={e => setFollowUpReason(e.target.value)}
                  style={{ backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155', borderRadius: '8px', padding: '10px 12px', minHeight: '80px', width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className="form-label" htmlFor="f-interval" style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>Follow-up In *</label>
                  <select
                    id="f-interval"
                    className="form-control"
                    value={followUpInterval}
                    onChange={e => setFollowUpInterval(e.target.value)}
                    style={{ backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155', borderRadius: '8px', padding: '10px 12px', width: '100%' }}
                  >
                    <option value="3">3 Days</option>
                    <option value="7">1 Week (7 Days)</option>
                    <option value="10">10 Days</option>
                    <option value="14">2 Weeks (14 Days)</option>
                    <option value="21">3 Weeks (21 Days)</option>
                    <option value="30">1 Month (30 Days)</option>
                    <option value="custom">Custom Days</option>
                  </select>
                </div>
                {followUpInterval === 'custom' && (
                  <div>
                    <label className="form-label" htmlFor="f-custom" style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>Custom Days *</label>
                    <input
                      id="f-custom"
                      type="number"
                      min="1"
                      className="form-control"
                      value={customDays}
                      onChange={e => setCustomDays(e.target.value)}
                      style={{ backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155', borderRadius: '8px', padding: '10px 12px', width: '100%' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '24px', backgroundColor: '#0f172a', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.1)' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Calculated Staff Action Date</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#c084fc' }}>
                  📅 {calculatedDueDateStr()}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(false)}
                  className="btn"
                  style={{ padding: '10px 18px', backgroundColor: '#334155', color: '#e2e8f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                  disabled={isSubmittingFollowUp}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ padding: '10px 18px', backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                  disabled={isSubmittingFollowUp || !followUpReason.trim()}
                >
                  {isSubmittingFollowUp ? 'Scheduling...' : 'Schedule Follow-Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
