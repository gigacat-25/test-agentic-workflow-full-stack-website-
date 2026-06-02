const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

// ── Public API types ──

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
  patient_name?: string;
  patient_phone?: string;
  patient_email?: string;
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

// ── Staff API types ──

export interface StaffPatient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  preferred_channel: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  appointment_id: string;
  rating: number | null;
  comment: string | null;
  sentiment: string;
  created_at: string;
}

export interface FollowUp {
  id: string;
  patient_id: string;
  reason: string;
  due_date: string;
  status: string;
  notes: string | null;
  patient_name?: string;
  created_at: string;
}

// ── Public API functions ──

export async function getAvailability(date: string, serviceType: string): Promise<TimeSlot[]> {
  const res = await fetch(`${API_BASE}/api/public/availability?date=${encodeURIComponent(date)}&serviceType=${encodeURIComponent(serviceType)}`);
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch availability');
  }
  return data.slots || [];
}

export async function requestAppointment(input: AppointmentRequestInput): Promise<AppointmentResponse> {
  const res = await fetch(`${API_BASE}/api/public/appointments/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json() as AppointmentResponse;
  if (!res.ok && res.status !== 200) {
    throw new Error(data.error || 'Failed to submit appointment request');
  }
  return data;
}

// ── Staff API functions ──

let tokenGetter: (() => Promise<string | null>) | null = null;

export function setTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

async function fetchWithAuth(url: string, token: string | null, options: RequestInit = {}) {
  let activeToken = token;
  if (tokenGetter) {
    try {
      activeToken = await tokenGetter();
    } catch (err) {
      console.error('Token getter failed, falling back to passed token:', err);
    }
  }
  const headers = new Headers(options.headers || {});
  if (activeToken) {
    headers.set('Authorization', `Bearer ${activeToken}`);
  }
  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.error || 'API Request failed');
  }
  return data;
}

export async function loginStaff(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/staff/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }
  return data;
}

export async function getAppointments(token: string, date: string, status?: string): Promise<Appointment[]> {
  let url = `/api/staff/appointments?date=${encodeURIComponent(date)}`;
  if (status && status !== 'all') {
    url += `&status=${encodeURIComponent(status)}`;
  }
  const data = await fetchWithAuth(url, token);
  return data.appointments || [];
}

export async function checkInAppointment(token: string, id: string): Promise<Appointment> {
  const data = await fetchWithAuth(`/api/staff/appointments/${encodeURIComponent(id)}/check-in`, token, { method: 'POST' });
  return data.appointment;
}

export async function completeAppointment(token: string, id: string): Promise<Appointment> {
  const data = await fetchWithAuth(`/api/staff/appointments/${encodeURIComponent(id)}/complete`, token, { method: 'POST' });
  return data.appointment;
}

export async function cancelAppointment(token: string, id: string, reason: string): Promise<Appointment> {
  const data = await fetchWithAuth(`/api/staff/appointments/${encodeURIComponent(id)}/cancel`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  return data.appointment;
}

export async function noShowAppointment(token: string, id: string): Promise<Appointment> {
  const data = await fetchWithAuth(`/api/staff/appointments/${encodeURIComponent(id)}/no-show`, token, { method: 'POST' });
  return data.appointment;
}

export async function confirmAppointment(token: string, id: string): Promise<Appointment> {
  const data = await fetchWithAuth(`/api/staff/appointments/${encodeURIComponent(id)}/confirm`, token, {
    method: 'POST',
  });
  return data.appointment;
}


export async function getPatientDetail(token: string, id: string): Promise<{
  patient: StaffPatient;
  appointments: Appointment[];
  feedback: Feedback[];
  followUps: FollowUp[];
}> {
  const data = await fetchWithAuth(`/api/staff/patients/${encodeURIComponent(id)}`, token);
  return {
    patient: data.patient,
    appointments: data.appointments || [],
    feedback: data.feedback || [],
    followUps: data.followUps || [],
  };
}

export async function searchPatients(token: string, query: string): Promise<StaffPatient[]> {
  const data = await fetchWithAuth(`/api/staff/patients?q=${encodeURIComponent(query)}`, token);
  return data.patients || [];
}

export async function getFollowUps(token: string, status?: string, type?: string): Promise<FollowUp[]> {
  let url = '/api/staff/follow-ups';
  const params: string[] = [];
  if (status && status !== 'all') params.push(`status=${encodeURIComponent(status)}`);
  if (type) params.push(`type=${encodeURIComponent(type)}`);
  if (params.length > 0) {
    url += '?' + params.join('&');
  }
  const data = await fetchWithAuth(url, token);
  return data.followUps || [];
}

export async function createFollowUp(token: string, data: { patientId: string; reason: string; dueDate: string }): Promise<FollowUp> {
  const response = await fetchWithAuth('/api/staff/follow-ups', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.followUp;
}

export async function completeFollowUp(token: string, id: string, notes?: string): Promise<FollowUp> {
  const response = await fetchWithAuth(`/api/staff/follow-ups/${encodeURIComponent(id)}/complete`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  return response.followUp;
}

export async function createAppointmentManually(token: string, data: {
  patientId?: string;
  name?: string;
  phone?: string;
  email?: string;
  serviceType: string;
  startTime: string;
  endTime: string;
  notes?: string;
}): Promise<Appointment> {
  const response = await fetchWithAuth('/api/staff/appointments', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.appointment;
}

export interface ReceptionistAlert {
  id: string;
  patient_name: string;
  appointment_id: string;
  status: string;
  created_at: string;
}

export async function callNextPatient(token: string, appointmentId: string): Promise<{ success: boolean }> {
  return await fetchWithAuth('/api/staff/alerts/call-next', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointmentId }),
  });
}

export async function getPendingAlerts(token: string): Promise<ReceptionistAlert[]> {
  const data = await fetchWithAuth('/api/staff/alerts/pending', token);
  return data.alerts || [];
}

export async function acknowledgeAlert(token: string, alertId: string): Promise<{ success: boolean }> {
  return await fetchWithAuth(`/api/staff/alerts/${encodeURIComponent(alertId)}/acknowledge`, token, {
    method: 'POST',
  });
}
