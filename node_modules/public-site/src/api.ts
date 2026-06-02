export interface TimeSlot {
  start: string;
  end: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  service_type: string;
  status: string;
  source: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface AppointmentRequestInput {
  name: string;
  phone: string;
  email?: string;
  serviceType: string;
  preferredDate: string;
  preferredTimeRange: string;
  notes?: string;
}

export interface AppointmentResponse {
  success: boolean;
  message?: string;
  appointment?: Appointment;
  patient?: Patient;
  availableSlots?: TimeSlot[];
  preferredSlot?: TimeSlot;
  error?: string;
}

const API_BASE = '';

/**
 * Fetch available time slots for a given date and service type.
 */
export async function getAvailability(date: string, serviceType: string): Promise<TimeSlot[]> {
  const res = await fetch(`${API_BASE}/api/public/availability?date=${encodeURIComponent(date)}&serviceType=${encodeURIComponent(serviceType)}`);
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch availability');
  }
  return data.slots || [];
}

/**
 * Submit an appointment request.
 */
export async function requestAppointment(input: AppointmentRequestInput): Promise<AppointmentResponse> {
  const res = await fetch(`${API_BASE}/api/public/appointments/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const data = await res.json() as AppointmentResponse;
  
  // Note: D1 returns 200 with availableSlots if slot is taken, which is success=true in API schema but needs careful handling in UI.
  if (!res.ok && res.status !== 200) {
    throw new Error(data.error || 'Failed to submit appointment request');
  }
  return data;
}
