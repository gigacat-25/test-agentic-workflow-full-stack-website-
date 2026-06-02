// ============================================================
// Appointment Service
//
// All appointment business logic in one channel-agnostic service.
// Used by web forms, WhatsApp, staff dashboard, and future phone calls.
// ============================================================

import {
  Appointment,
  AppointmentWithPatient,
  CreateAppointmentInput,
  AppointmentStatus,
  AppointmentSource,
} from '../db/schema';
import { generateId, now, getDb } from '../db/client';
import { badRequest, notFound, conflict } from '../utils/errors';
import { AvailabilityService } from './availability.service';

export class AppointmentService {
  private availability: AvailabilityService;

  constructor(private db: D1Database) {
    this.availability = new AvailabilityService(db);
  }

  /**
   * Request a new appointment (status = 'requested').
   * Checks availability before creating.
   */
  async request(data: CreateAppointmentInput): Promise<Appointment> {
    // Validate service type
    const validServices = ['skin', 'hair', 'other'];
    if (!validServices.includes(data.serviceType)) {
      throw badRequest(`Invalid service type. Must be one of: ${validServices.join(', ')}`);
    }

    // Validate source
    const validSources = ['web_form', 'whatsapp', 'staff_manual'];
    if (!validSources.includes(data.source)) {
      throw badRequest(`Invalid source. Must be one of: ${validSources.join(', ')}`);
    }

    // Validate time range
    if (new Date(data.startTime) >= new Date(data.endTime)) {
      throw badRequest('Start time must be before end time');
    }

    // Check availability
    const available = await this.availability.isSlotAvailable(
      data.startTime.split('T')[0],
      data.startTime.split('T')[1] || '00:00',
      data.endTime.split('T')[1] || '23:59',
    );

    if (!available) {
      throw conflict('The requested time slot is no longer available. Please choose another time.');
    }

    const id = generateId();
    const timestamp = now();

    await this.db
      .prepare(
        `INSERT INTO appointments (id, patient_id, doctor_id, service_type, status, source, start_time, end_time, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'requested', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        data.patientId,
        data.doctorId || null,
        data.serviceType,
        data.source,
        data.startTime,
        data.endTime,
        data.notes || null,
        timestamp,
        timestamp,
      )
      .run();

    // Log the action
    await this.logAction(id, 'appointment.requested', 'Appointment requested via ' + data.source);

    return this.getById(id) as Promise<Appointment>;
  }

  /**
   * Confirm an appointment (status = 'confirmed').
   */
  async confirm(appointmentId: string): Promise<Appointment> {
    const appointment = await this.getById(appointmentId);
    if (!appointment) throw notFound('Appointment not found');

    if (appointment.status !== 'requested') {
      throw badRequest(`Cannot confirm appointment with status "${appointment.status}". Only "requested" appointments can be confirmed.`);
    }

    const timestamp = now();
    await this.db
      .prepare('UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?')
      .bind('confirmed', timestamp, appointmentId)
      .run();

    await this.logAction(appointmentId, 'appointment.confirmed', 'Appointment confirmed');

    return this.getById(appointmentId) as Promise<Appointment>;
  }

  /**
   * Cancel an appointment (status = 'cancelled').
   */
  async cancel(appointmentId: string, reason?: string): Promise<Appointment> {
    const appointment = await this.getById(appointmentId);
    if (!appointment) throw notFound('Appointment not found');

    const cancellableStatuses: AppointmentStatus[] = ['requested', 'confirmed', 'checked_in'];
    if (!cancellableStatuses.includes(appointment.status)) {
      throw badRequest(
        `Cannot cancel appointment with status "${appointment.status}". Only ${cancellableStatuses.join(', ')} appointments can be cancelled.`,
      );
    }

    const timestamp = now();
    await this.db
      .prepare('UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?')
      .bind('cancelled', timestamp, appointmentId)
      .run();

    await this.logAction(appointmentId, 'appointment.cancelled', reason || 'Cancelled');

    return this.getById(appointmentId) as Promise<Appointment>;
  }

  /**
   * Check in a patient (status = 'checked_in').
   * Only from 'confirmed' status.
   */
  async checkIn(appointmentId: string, staffUserId?: string): Promise<Appointment> {
    const appointment = await this.getById(appointmentId);
    if (!appointment) throw notFound('Appointment not found');

    if (appointment.status !== 'confirmed') {
      throw badRequest(`Cannot check in appointment with status "${appointment.status}". Only "confirmed" appointments can be checked in.`);
    }

    const timestamp = now();
    await this.db
      .prepare('UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?')
      .bind('checked_in', timestamp, appointmentId)
      .run();

    await this.logAction(appointmentId, 'appointment.checked_in', `Checked in by staff ${staffUserId || 'unknown'}`);

    return this.getById(appointmentId) as Promise<Appointment>;
  }

  /**
   * Complete an appointment (status = 'completed').
   * Only from 'checked_in' status.
   */
  async complete(appointmentId: string, staffUserId?: string): Promise<Appointment> {
    const appointment = await this.getById(appointmentId);
    if (!appointment) throw notFound('Appointment not found');

    if (appointment.status !== 'checked_in') {
      throw badRequest(`Cannot complete appointment with status "${appointment.status}". Only "checked_in" appointments can be completed.`);
    }

    const timestamp = now();
    await this.db
      .prepare('UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?')
      .bind('completed', timestamp, appointmentId)
      .run();

    await this.logAction(appointmentId, 'appointment.completed', `Completed by staff ${staffUserId || 'unknown'}`);

    return this.getById(appointmentId) as Promise<Appointment>;
  }

  /**
   * Mark as no-show (status = 'no_show').
   */
  async noShow(appointmentId: string): Promise<Appointment> {
    const appointment = await this.getById(appointmentId);
    if (!appointment) throw notFound('Appointment not found');

    const timestamp = now();
    await this.db
      .prepare('UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?')
      .bind('no_show', timestamp, appointmentId)
      .run();

    await this.logAction(appointmentId, 'appointment.no_show', 'Patient did not show');

    return this.getById(appointmentId) as Promise<Appointment>;
  }

  /**
   * Get appointments for a specific date, with optional status filter.
   * Joins with patients table to include patient name/phone/email.
   */
  async getByDate(date: string, statusFilter?: string): Promise<AppointmentWithPatient[]> {
    let query = `
      SELECT a.*, p.name as patient_name, p.phone as patient_phone, p.email as patient_email
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE DATE(a.start_time) = DATE(?)
    `;
    const params: unknown[] = [date];

    if (statusFilter) {
      query += ' AND a.status = ?';
      params.push(statusFilter);
    }

    query += ' ORDER BY a.start_time ASC';

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<AppointmentWithPatient>();

    return result.results || [];
  }

  /**
   * Get a single appointment by ID.
   */
  async getById(id: string): Promise<Appointment | null> {
    const result = await this.db
      .prepare('SELECT * FROM appointments WHERE id = ?')
      .bind(id)
      .first<Appointment>();
    return result || null;
  }

  /**
   * Get appointment with patient details.
   */
  async getByIdWithPatient(id: string): Promise<AppointmentWithPatient | null> {
    const result = await this.db
      .prepare(
        `SELECT a.*, p.name as patient_name, p.phone as patient_phone, p.email as patient_email
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         WHERE a.id = ?`,
      )
      .bind(id)
      .first<AppointmentWithPatient>();
    return result || null;
  }

  /**
   * Get all appointments for a specific patient.
   */
  async getByPatientId(patientId: string): Promise<Appointment[]> {
    const result = await this.db
      .prepare(
        'SELECT * FROM appointments WHERE patient_id = ? ORDER BY start_time DESC',
      )
      .bind(patientId)
      .all<Appointment>();

    return result.results || [];
  }

  /**
   * Get upcoming appointment for a patient (next confirmed one).
   */
  async getUpcomingByPatientId(patientId: string): Promise<Appointment | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM appointments
         WHERE patient_id = ? AND status IN ('confirmed', 'checked_in')
         AND start_time > datetime('now')
         ORDER BY start_time ASC
         LIMIT 1`,
      )
      .bind(patientId)
      .first<Appointment>();
    return result || null;
  }

  /**
   * Create an appointment manually (staff creates it).
   */
  async createManual(data: CreateAppointmentInput): Promise<Appointment> {
    return this.request({
      ...data,
      source: 'staff_manual',
    });
  }

  /**
   * Create appointment directly with 'confirmed' status
   * (used by WhatsApp flow when patient confirms proposed time).
   */
  async createConfirmed(data: CreateAppointmentInput): Promise<Appointment> {
    const appointment = await this.request(data);
    return this.confirm(appointment.id);
  }

  /**
   * Log an action for audit trail.
   */
  private async logAction(appointmentId: string, action: string, details?: string, createdBy?: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO appointment_logs (id, appointment_id, action, details, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(generateId(), appointmentId, action, details || null, createdBy || null, now())
      .run();
  }
}
