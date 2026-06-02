import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvailability, requestAppointment, TimeSlot } from '../../api';

const getTimeOfDay = (timeRange: string): 'morning' | 'afternoon' | 'evening' | null => {
  if (timeRange === 'morning' || timeRange === 'afternoon' || timeRange === 'evening') {
    return timeRange;
  }
  const match = timeRange.match(/^(\d{1,2}):\d{2}/);
  if (match) {
    const startHour = parseInt(match[1], 10);
    if (startHour >= 9 && startHour < 12) return 'morning';
    if (startHour >= 12 && startHour < 16) return 'afternoon';
    if (startHour >= 16 && startHour < 18) return 'evening';
  }
  return null;
};

export default function BookAppointment() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    serviceType: 'skin',
    preferredDate: '',
    preferredTimeRange: 'morning',
    notes: '',
  });

  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotTakenAlert, setSlotTakenAlert] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (formData.preferredDate) {
      const fetchSlots = async () => {
        setIsLoadingSlots(true);
        setError(null);
        try {
          const slots = await getAvailability(formData.preferredDate, formData.serviceType);
          setAvailableSlots(slots);
        } catch (err: any) {
          console.error(err);
          setError('Failed to fetch available slots. Please try again.');
        } finally {
          setIsLoadingSlots(false);
        }
      };
      fetchSlots();
    }
  }, [formData.preferredDate, formData.serviceType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'preferredDate' || name === 'preferredTimeRange' || name === 'serviceType') {
      setSlotTakenAlert(null);
    }
  };

  const handleTimeRangeSelect = (range: string) => {
    setFormData(prev => ({ ...prev, preferredTimeRange: range }));
    setSlotTakenAlert(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSlotTakenAlert(null);

    if (formData.name.trim().length < 2) {
      setError('Please enter a valid name (at least 2 characters).');
      return;
    }

    const phoneRegex = /^\+?\d{7,15}$/;
    const cleanPhone = formData.phone.replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      setError('Please enter a valid phone number (7-15 digits, optional +).');
      return;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!formData.preferredDate) {
      setError('Please select a date.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await requestAppointment({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        serviceType: formData.serviceType,
        preferredDate: formData.preferredDate,
        preferredTimeRange: formData.preferredTimeRange,
        notes: formData.notes || undefined,
      });

      if (response.success && response.appointment) {
        navigate('/confirmation', {
          state: {
            appointment: response.appointment,
            patient: response.patient,
          },
        });
      } else if (response.availableSlots) {
        setAvailableSlots(response.availableSlots);
        setSlotTakenAlert(response.message || 'The preferred time is not available. Please pick one of the available times shown below.');
      } else {
        setError(response.error || 'Something went wrong. Please check your inputs.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit appointment request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeTimeOfDay = getTimeOfDay(formData.preferredTimeRange) || 'morning';

  const filteredSlots = availableSlots.filter(slot => {
    const match = slot.start.match(/^(\d{1,2}):\d{2}/);
    if (match) {
      const startHour = parseInt(match[1], 10);
      if (activeTimeOfDay === 'morning') return startHour >= 9 && startHour < 12;
      if (activeTimeOfDay === 'afternoon') return startHour >= 12 && startHour < 16;
      if (activeTimeOfDay === 'evening') return startHour >= 16 && startHour < 18;
    }
    return true;
  });

  return (
    <section className="section-padding">
      <div className="container">
        <span className="eyebrow" style={{ textAlign: 'center' }}>Book Online</span>
        <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>Request an Appointment</h2>

        <div className="form-card">
          {error && <div className="error-summary">{error}</div>}
          {slotTakenAlert && <div className="error-summary" style={{ backgroundColor: 'rgba(255, 79, 0, 0.08)', borderColor: 'var(--primary)', color: 'var(--primary)' }}>{slotTakenAlert}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Full Name *</label>
              <input
                id="name"
                name="name"
                type="text"
                className="form-control"
                placeholder="John Doe"
                required
                value={formData.name}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="phone">Phone Number (WhatsApp) *</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="form-control"
                  placeholder="+1 (555) 123-4567"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address (Optional)</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="form-control"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="serviceType">Treatment Category *</label>
                <select
                  id="serviceType"
                  name="serviceType"
                  className="form-control"
                  value={formData.serviceType}
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  <option value="skin">Skin Treatments (Acne, Eczema, Screenings)</option>
                  <option value="hair">Hair & Scalp (Hair Loss, Scalp issues)</option>
                  <option value="other">Aesthetic Procedures (Peels, Cosmetic)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="preferredDate">Preferred Date *</label>
                <input
                  id="preferredDate"
                  name="preferredDate"
                  type="date"
                  className="form-control"
                  min={todayStr}
                  required
                  value={formData.preferredDate}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Preferred Time of Day *</label>
              <div className="time-slots-grid">
                <button
                  type="button"
                  className={`time-slot-btn ${activeTimeOfDay === 'morning' ? 'active' : ''}`}
                  onClick={() => handleTimeRangeSelect('morning')}
                  disabled={isSubmitting}
                >
                  Morning (9 AM - 12 PM)
                </button>
                <button
                  type="button"
                  className={`time-slot-btn ${activeTimeOfDay === 'afternoon' ? 'active' : ''}`}
                  onClick={() => handleTimeRangeSelect('afternoon')}
                  disabled={isSubmitting}
                >
                  Afternoon (12 PM - 4 PM)
                </button>
                <button
                  type="button"
                  className={`time-slot-btn ${activeTimeOfDay === 'evening' ? 'active' : ''}`}
                  onClick={() => handleTimeRangeSelect('evening')}
                  disabled={isSubmitting}
                >
                  Evening (4 PM - 6 PM)
                </button>
              </div>
            </div>

            {formData.preferredDate && (
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Available Open Slots ({activeTimeOfDay}) *</span>
                  {isLoadingSlots && <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--body-mid)' }}>Checking availability...</span>}
                </label>
                <div style={{ backgroundColor: 'var(--canvas-soft)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--mute)' }}>
                  {isLoadingSlots ? (
                    <p style={{ fontSize: '15px', color: 'var(--body-mid)' }}>Loading slots...</p>
                  ) : filteredSlots.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                      {filteredSlots.map((slot, index) => {
                        const slotStr = `${slot.start}-${slot.end}`;
                        const isSelected = formData.preferredTimeRange === slotStr;
                        return (
                          <button
                            key={index}
                            type="button"
                            className={`time-slot-btn ${isSelected ? 'active' : ''}`}
                            onClick={() => setFormData(prev => ({ ...prev, preferredTimeRange: slotStr }))}
                            style={{
                              flex: '1 0 calc(50% - 8px)',
                              maxWidth: 'calc(50% - 8px)',
                              padding: '12px',
                              fontSize: '14px',
                              textAlign: 'center',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span>⏰</span> {slot.start} - {slot.end}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize: '15px', color: 'var(--body-mid)' }}>
                      No available slots in the {activeTimeOfDay} on this date. Please select another time of day or try a different date!
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="notes">Describe your concerns or symptoms (Optional)</label>
              <textarea
                id="notes"
                name="notes"
                className="form-control"
                placeholder="Please describe what you would like to address (e.g. acne breakout, skin checkup)..."
                value={formData.notes}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'var(--space-md)' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting Request...' : 'Submit Appointment Request'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
