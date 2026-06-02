const API_BASE = '';

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

// Global fetch helper that attaches Auth token
async function fetchWithAuth(url: string, token: string | null, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.error || 'API Request failed');
  }
  return data;
}

export async function loginStaff(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/staff/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }
  return data; // { token, staffUser }
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
  const data = await fetchWithAuth(`/api/staff/appointments/${encodeURIComponent(id)}/check-in`, token, {
    method: 'POST',
  });
  return data.appointment;
}

export async function completeAppointment(token: string, id: string): Promise<Appointment> {
  const data = await fetchWithAuth(`/api/staff/appointments/${encodeURIComponent(id)}/complete`, token, {
    method: 'POST',
  });
  return data.appointment;
}

export async function cancelAppointment(token: string, id: string, reason: string): Promise<Appointment> {
  const data = await fetchWithAuth(`/api/staff/appointments/${encodeURIComponent(id)}/cancel`, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  return data.appointment;
}

export async function noShowAppointment(token: string, id: string): Promise<Appointment> {
  const data = await fetchWithAuth(`/api/staff/appointments/${encodeURIComponent(id)}/no-show`, token, {
    method: 'POST',
  });
  return data.appointment;
}

export async function confirmAppointment(token: string, id: string): Promise<Appointment> {
  // Confirm endpoint is under public but we can call it from dashboard
  const data = await fetchWithAuth(`/api/public/appointments/confirm`, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ appointmentId: id }),
  });
  return data.appointment;
}

export async function getPatientDetail(token: string, id: string): Promise<{
  patient: Patient;
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

export async function searchPatients(token: string, query: string): Promise<Patient[]> {
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
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.followUp;
}

export async function completeFollowUp(token: string, id: string, notes?: string): Promise<FollowUp> {
  const response = await fetchWithAuth(`/api/staff/follow-ups/${encodeURIComponent(id)}/complete`, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.appointment;
}
