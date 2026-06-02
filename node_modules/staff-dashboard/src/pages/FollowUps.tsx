import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { getFollowUps, completeFollowUp, FollowUp } from '../api';

export default function FollowUps() {
  const { token } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activeFilter, setActiveFilter] = useState('pending'); // default to pending
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFollowUps = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      // If filter is overdue, fetch pending status and filter client-side or use api query
      const statusArg = activeFilter === 'overdue' ? 'pending' : activeFilter;
      const data = await getFollowUps(token, statusArg);
      
      let filteredData = data;
      if (activeFilter === 'overdue') {
        const now = new Date();
        filteredData = data.filter(f => new Date(f.due_date) < now);
      }
      
      setFollowUps(filteredData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch follow-ups');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowUps();
  }, [activeFilter]);

  const handleComplete = async (id: string) => {
    if (!token) return;
    const notes = prompt('Enter follow-up completion notes (optional):');
    if (notes === null) return; // Prompt cancelled
    try {
      await completeFollowUp(token, id, notes);
      fetchFollowUps();
    } catch (err: any) {
      alert(err.message || 'Failed to complete follow-up');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h2 className="page-title">Follow-up Management</h2>
      </div>

      {/* Filter Tabs */}
      <div className="dashboard-actions">
        <div className="tabs">
          {['all', 'pending', 'overdue', 'completed'].map(f => (
            <button
              key={f}
              className={`tab-btn ${activeFilter === f ? 'active' : ''}`}
              onClick={() => setActiveFilter(f)}
              style={{ textTransform: 'capitalize' }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Error container */}
      {error && <div className="error-container" style={{ margin: '20px 0' }}>{error}</div>}

      {/* Follow-up list card */}
      <div className="table-card">
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--body-mid)' }}>Loading follow-ups...</div>
        ) : followUps.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Follow-up Task</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {followUps.map(f => {
                const dueDate = new Date(f.due_date);
                const dueDateStr = dueDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
                const isOverdue = dueDate < new Date() && f.status === 'pending';

                return (
                  <tr key={f.id}>
                    <td>
                      <Link to={`/patients/${f.patient_id}`} style={{ fontWeight: '600', textDecoration: 'underline' }}>
                        {f.patient_name || 'Patient'}
                      </Link>
                    </td>
                    <td>{f.reason}</td>
                    <td>
                      <strong style={{ color: isOverdue ? 'var(--status-cancelled)' : 'inherit' }}>
                        {dueDateStr}
                      </strong>
                      {isOverdue && <p style={{ fontSize: '11px', color: 'var(--status-cancelled)', fontWeight: '700' }}>OVERDUE</p>}
                    </td>
                    <td>
                      <span className={`status-badge ${f.status}`}>
                        {f.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '14px', maxWidth: '200px' }}>
                      {f.notes || <span style={{ color: 'var(--mute)' }}>None</span>}
                    </td>
                    <td>
                      {f.status === 'pending' ? (
                        <button onClick={() => handleComplete(f.id)} className="btn btn-primary btn-sm">
                          Complete
                        </button>
                      ) : (
                        <span style={{ fontSize: '13px', color: 'var(--body-mid)' }}>Archived</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--body-mid)' }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>📋</span>
            <h3>No follow-ups found</h3>
            <p>There are no follow-up tasks matching the selected filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
