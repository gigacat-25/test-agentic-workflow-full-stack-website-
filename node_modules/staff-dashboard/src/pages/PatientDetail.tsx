import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth';
import {
  getPatientDetail,
  createFollowUp,
  completeFollowUp,
  Patient,
  Appointment,
  Feedback,
  FollowUp
} from '../api';

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  
  const [activeSubTab, setActiveSubTab] = useState<'appointments' | 'feedback' | 'followups'>('appointments');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Follow-up state
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    reason: '',
    dueDate: ''
  });

  const fetchDetail = async () => {
    if (!token || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getPatientDetail(token, id);
      setPatient(data.patient);
      setAppointments(data.appointments);
      setFeedback(data.feedback);
      setFollowUps(data.followUps);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch patient detail');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id) return;
    setFollowUpError(null);

    if (!followUpForm.reason || !followUpForm.dueDate) {
      setFollowUpError('Please fill in all required fields.');
      return;
    }

    setIsSubmittingFollowUp(true);
    try {
      await createFollowUp(token, {
        patientId: id,
        reason: followUpForm.reason,
        dueDate: followUpForm.dueDate
      });
      setIsFollowUpModalOpen(false);
      setFollowUpForm({ reason: '', dueDate: '' });
      fetchDetail();
    } catch (err: any) {
      setFollowUpError(err.message || 'Failed to create follow-up');
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    if (!token) return;
    const notes = prompt('Enter follow-up completion notes (optional):');
    if (notes === null) return; // Prompt cancelled
    try {
      await completeFollowUp(token, followUpId, notes);
      fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to complete follow-up');
    }
  };

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--body-mid)' }}>Loading patient record...</div>;
  }

  if (error || !patient) {
    return (
      <div className="error-container" style={{ margin: '20px 0' }}>
        {error || 'Patient record not found.'}
        <br />
        <Link to="/dashboard" className="btn btn-tertiary btn-sm" style={{ marginTop: '12px' }}>Back to Dashboard</Link>
      </div>
    );
  }

  const createdDateStr = new Date(patient.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/dashboard" style={{ color: 'var(--body-mid)', fontSize: '14px', fontWeight: '500' }}>
          &larr; Back to Appointments Schedule
        </Link>
      </div>

      <div className="patient-profile-grid">
        {/* Sidebar patient card */}
        <aside className="patient-sidebar-card">
          <div className="patient-avatar">👤</div>
          <h2 className="patient-name">{patient.name}</h2>
          <span style={{ fontSize: '13px', backgroundColor: 'var(--border)', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '700' }}>
            ID: {patient.id.slice(0, 8)}
          </span>

          <ul className="patient-meta-list">
            <li className="patient-meta-item">
              <span className="patient-meta-label">Phone (WhatsApp)</span>
              <span className="patient-meta-val">{patient.phone || '—'}</span>
            </li>
            <li className="patient-meta-item">
              <span className="patient-meta-label">Email Address</span>
              <span className="patient-meta-val">{patient.email || '—'}</span>
            </li>
            <li className="patient-meta-item">
              <span className="patient-meta-label">Notification Channels</span>
              <span className="patient-meta-val" style={{ textTransform: 'capitalize' }}>{patient.preferred_channel}</span>
            </li>
            <li className="patient-meta-item">
              <span className="patient-meta-label">Member Since</span>
              <span className="patient-meta-val">{createdDateStr}</span>
            </li>
          </ul>

          <button onClick={() => setIsFollowUpModalOpen(true)} className="btn btn-secondary" style={{ width: '100%', fontSize: '14px' }}>
            📋 Add Follow-up Task
          </button>
        </aside>

        {/* Details and History section */}
        <section className="table-card" style={{ padding: '24px' }}>
          <div className="tabs-panel">
            <button
              className={`tab-nav-btn ${activeSubTab === 'appointments' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('appointments')}
            >
              Visits & Bookings ({appointments.length})
            </button>
            <button
              className={`tab-nav-btn ${activeSubTab === 'feedback' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('feedback')}
            >
              Patient Feedback ({feedback.length})
            </button>
            <button
              className={`tab-nav-btn ${activeSubTab === 'followups' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('followups')}
            >
              Follow-up Action Plan ({followUps.length})
            </button>
          </div>

          {/* Visit History Tab */}
          {activeSubTab === 'appointments' && (
            <div>
              {appointments.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date / Time</th>
                      <th>Treatment</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map(a => {
                      const dateStr = new Date(a.start_time).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      });
                      const timeStr = new Date(a.start_time).toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit'
                      });
                      return (
                        <tr key={a.id}>
                          <td>
                            <strong>{dateStr}</strong>
                            <p style={{ fontSize: '12px', color: 'var(--body-mid)' }}>{timeStr}</p>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{a.service_type}</td>
                          <td>
                            <span className={`status-badge ${a.status}`}>
                              {a.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ textTransform: 'capitalize', fontSize: '13px' }}>{a.source.replace('_', ' ')}</td>
                          <td style={{ fontSize: '14px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.notes || <span style={{ color: 'var(--mute)' }}>None</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--body-mid)' }}>No appointment history.</div>
              )}
            </div>
          )}

          {/* Feedback Tab */}
          {activeSubTab === 'feedback' && (
            <div className="feedback-list">
              {feedback.length > 0 ? (
                feedback.map(f => {
                  const dateStr = new Date(f.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                  });
                  return (
                    <div key={f.id} className="feedback-card">
                      <div className="feedback-header">
                        <div className="feedback-meta">
                          <span className="feedback-stars">{'★'.repeat(f.rating || 0)}{'☆'.repeat(5 - (f.rating || 0))}</span>
                          <span className="feedback-date">{dateStr}</span>
                        </div>
                        <span className={`sentiment-tag ${f.sentiment || 'neutral'}`}>
                          {f.sentiment || 'unknown'}
                        </span>
                      </div>
                      <p className="feedback-comment">
                        {f.comment || <span style={{ color: 'var(--mute)', fontStyle: 'italic' }}>No comment provided</span>}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--body-mid)' }}>No feedback reviews submitted.</div>
              )}
            </div>
          )}

          {/* Followups Tab */}
          {activeSubTab === 'followups' && (
            <div>
              {followUps.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Due Date</th>
                      <th>Follow-up Reason</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {followUps.map(f => {
                      const dueDateStr = new Date(f.due_date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      });
                      const isOverdue = new Date(f.due_date) < new Date() && f.status === 'pending';
                      return (
                        <tr key={f.id}>
                          <td>
                            <strong style={{ color: isOverdue ? 'var(--status-cancelled)' : 'inherit' }}>
                              {dueDateStr}
                            </strong>
                            {isOverdue && <p style={{ fontSize: '11px', color: 'var(--status-cancelled)', fontWeight: '700' }}>OVERDUE</p>}
                          </td>
                          <td>{f.reason}</td>
                          <td>
                            <span className={`status-badge ${f.status}`}>
                              {f.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '14px', maxWidth: '180px' }}>
                            {f.notes || <span style={{ color: 'var(--mute)' }}>None</span>}
                          </td>
                          <td>
                            {f.status === 'pending' ? (
                              <button onClick={() => handleCompleteFollowUp(f.id)} className="btn btn-primary btn-sm">
                                Complete
                              </button>
                            ) : (
                              <span style={{ fontSize: '13px', color: 'var(--body-mid)' }}>Finished</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--body-mid)' }}>No follow-up action plan registered.</div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Follow-up Creation Modal */}
      {isFollowUpModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Create Follow-up Action</h3>
              <button onClick={() => setIsFollowUpModalOpen(false)} className="modal-close">×</button>
            </div>

            {followUpError && <div className="error-container">{followUpError}</div>}

            <form onSubmit={handleCreateFollowUp}>
              <div className="form-group">
                <label className="form-label" htmlFor="f-reason">Reason / Task *</label>
                <input
                  id="f-reason"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Check skin peeling progress after chemical peel"
                  value={followUpForm.reason}
                  onChange={e => setFollowUpForm(prev => ({ ...prev, reason: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="f-duedate">Due Date *</label>
                <input
                  id="f-duedate"
                  type="date"
                  className="form-control"
                  value={followUpForm.dueDate}
                  onChange={e => setFollowUpForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsFollowUpModalOpen(false)} className="btn btn-tertiary" disabled={isSubmittingFollowUp}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingFollowUp}>
                  {isSubmittingFollowUp ? 'Creating...' : 'Create Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
