-- 001_initial.sql
-- Initial schema for Dermatology Clinic Management System
-- Migration 1: Create all core tables, indexes, and seed data

-- ============================================================
-- PATIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  preferred_channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK(preferred_channel IN ('whatsapp', 'email', 'both')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_email ON patients(email);

-- ============================================================
-- STAFF USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'receptionist', 'doctor')),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_staff_users_email ON staff_users(email);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  doctor_id TEXT REFERENCES staff_users(id),
  service_type TEXT NOT NULL CHECK(service_type IN ('skin', 'hair', 'other')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK(status IN ('requested', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
  source TEXT NOT NULL CHECK(source IN ('web_form', 'whatsapp', 'staff_manual')),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_start ON appointments(start_time);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_date_status ON appointments(start_time, status);
CREATE INDEX idx_appointments_patient_status ON appointments(patient_id, status);

-- ============================================================
-- FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id),
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  comment TEXT,
  sentiment TEXT DEFAULT 'unknown',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_feedback_appointment ON feedback(appointment_id);

-- ============================================================
-- FOLLOW-UPS
-- ============================================================
CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  reason TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_follow_ups_patient ON follow_ups(patient_id);
CREATE INDEX idx_follow_ups_status ON follow_ups(status);
CREATE INDEX idx_follow_ups_due_date ON follow_ups(due_date);

-- ============================================================
-- APPOINTMENT LOGS (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS appointment_logs (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id),
  action TEXT NOT NULL,
  details TEXT,
  created_by TEXT REFERENCES staff_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_logs_appointment ON appointment_logs(appointment_id);
CREATE INDEX idx_logs_created ON appointment_logs(created_at);

-- ============================================================
-- SEED DATA: Default admin staff user
-- Password: admin123
-- Generated bcrypt hash: $2a$10$ctqBfQhl3MsrxVj2Ju8j/.mhAMHo86l8WOnkvyEs95S5HXrfqKmv6
-- ============================================================
INSERT INTO staff_users (id, name, role, email, password_hash)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Admin User',
  'admin',
  'admin@skincareclinic.com',
  '$2a$10$ctqBfQhl3MsrxVj2Ju8j/.mhAMHo86l8WOnkvyEs95S5HXrfqKmv6'
);
