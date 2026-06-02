// ============================================================
// TypeScript types matching D1 database schema
// All IDs are UUID v4 strings
// All datetime fields are ISO 8601 strings (compatible with D1)
// ============================================================

// -----------------------------------------------------------------
// Enums / Constants
// -----------------------------------------------------------------
export const ServiceType = {
  SKIN: 'skin',
  HAIR: 'hair',
  OTHER: 'other',
} as const;
export type ServiceType = (typeof ServiceType)[keyof typeof ServiceType];

export const AppointmentStatus = {
  REQUESTED: 'requested',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const AppointmentSource = {
  WEB_FORM: 'web_form',
  WHATSAPP: 'whatsapp',
  STAFF_MANUAL: 'staff_manual',
} as const;
export type AppointmentSource = (typeof AppointmentSource)[keyof typeof AppointmentSource];

export const FollowUpStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type FollowUpStatus = (typeof FollowUpStatus)[keyof typeof FollowUpStatus];

export const StaffRole = {
  ADMIN: 'admin',
  RECEPTIONIST: 'receptionist',
  DOCTOR: 'doctor',
} as const;
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];

export const PreferredChannel = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  BOTH: 'both',
} as const;
export type PreferredChannel = (typeof PreferredChannel)[keyof typeof PreferredChannel];

// -----------------------------------------------------------------
// Main Table Types
// -----------------------------------------------------------------
export interface Patient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  preferred_channel: PreferredChannel;
  created_at: string;
  updated_at: string;
}

export interface StaffUser {
  id: string;
  name: string;
  role: StaffRole;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  service_type: ServiceType;
  status: AppointmentStatus;
  source: AppointmentSource;
  start_time: string;
  end_time: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
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
  status: FollowUpStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentLog {
  id: string;
  appointment_id: string;
  action: string;
  details: string | null;
  created_by: string | null;
  created_at: string;
}

// -----------------------------------------------------------------
// API Payload Types
// -----------------------------------------------------------------
export interface AppointmentRequestInput {
  name: string;
  phone?: string;
  email?: string;
  serviceType: ServiceType;
  preferredDate: string;
  preferredTimeRange: string;
  notes?: string;
  source?: AppointmentSource;
}

export interface AppointmentConfirmInput {
  appointmentId: string;
}

export interface AppointmentCancelInput {
  appointmentId: string;
}

export interface CreateAppointmentInput {
  patientId: string;
  doctorId?: string;
  serviceType: ServiceType;
  startTime: string;
  endTime: string;
  source: AppointmentSource;
  notes?: string;
}

export interface CreatePatientInput {
  name: string;
  phone?: string;
  email?: string;
  preferred_channel?: PreferredChannel;
}

export interface CreateFeedbackInput {
  appointmentId: string;
  rating?: number;
  comment?: string;
  sentiment?: string;
}

export interface CreateFollowUpInput {
  patientId: string;
  reason: string;
  dueDate: string;
}

export interface CompleteFollowUpInput {
  notes?: string;
}

export interface StaffLoginInput {
  email: string;
  password: string;
}

export interface TimeSlot {
  start: string;
  end: string;
}

// -----------------------------------------------------------------
// Response Types
// -----------------------------------------------------------------
export interface AppointmentWithPatient extends Appointment {
  patient_name?: string;
  patient_phone?: string;
  patient_email?: string;
}

export interface PatientWithHistory extends Patient {
  appointments?: Appointment[];
  feedback?: Feedback[];
  followUps?: FollowUp[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// -----------------------------------------------------------------
// JWT Payload
// -----------------------------------------------------------------
export interface JwtPayload {
  sub: string;       // staff user ID
  role: StaffRole;
  iat: number;
  exp: number;
}
