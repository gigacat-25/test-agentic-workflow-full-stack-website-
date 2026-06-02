// ============================================================
// Feedback Service
//
// Stores and retrieves patient feedback for completed appointments.
// Channel-agnostic — feedback can come from WhatsApp, email links, or web.
// ============================================================

import { Feedback, CreateFeedbackInput, AppointmentWithPatient } from '../db/schema';
import { generateId, now } from '../db/client';
import { badRequest, notFound } from '../utils/errors';

export class FeedbackService {
  constructor(private db: D1Database) {}

  /**
   * Create feedback for an appointment.
   * Validates that the appointment exists.
   */
  async create(data: CreateFeedbackInput): Promise<Feedback> {
    // Validate rating range
    if (data.rating !== undefined && data.rating !== null) {
      if (data.rating < 1 || data.rating > 5) {
        throw badRequest('Rating must be between 1 and 5');
      }
    }

    // Check if feedback already exists for this appointment
    const existing = await this.getByAppointment(data.appointmentId);
    if (existing) {
      // Update existing feedback instead
      return this.update(existing.id, {
        rating: data.rating,
        comment: data.comment,
        sentiment: data.sentiment,
      });
    }

    const id = generateId();
    const timestamp = now();

    await this.db
      .prepare(
        `INSERT INTO feedback (id, appointment_id, rating, comment, sentiment, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        data.appointmentId,
        data.rating ?? null,
        data.comment || null,
        data.sentiment || 'unknown',
        timestamp,
      )
      .run();

    return this.getById(id) as Promise<Feedback>;
  }

  /**
   * Get feedback by appointment ID.
   */
  async getByAppointment(appointmentId: string): Promise<Feedback | null> {
    const result = await this.db
      .prepare('SELECT * FROM feedback WHERE appointment_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(appointmentId)
      .first<Feedback>();
    return result || null;
  }

  /**
   * Get all feedback for a specific patient (via appointment join).
   */
  async getByPatientId(patientId: string): Promise<(Feedback & { service_type: string; appointment_date: string })[]> {
    const result = await this.db
      .prepare(
        `SELECT f.*, a.service_type, a.start_time as appointment_date
         FROM feedback f
         JOIN appointments a ON f.appointment_id = a.id
         WHERE a.patient_id = ?
         ORDER BY f.created_at DESC`,
      )
      .bind(patientId)
      .all<Feedback & { service_type: string; appointment_date: string }>();

    return result.results || [];
  }

  /**
   * Get feedback by ID.
   */
  async getById(id: string): Promise<Feedback | null> {
    const result = await this.db
      .prepare('SELECT * FROM feedback WHERE id = ?')
      .bind(id)
      .first<Feedback>();
    return result || null;
  }

  /**
   * Update existing feedback.
   */
  async update(
    id: string,
    data: Partial<Pick<Feedback, 'rating' | 'comment' | 'sentiment'>>,
  ): Promise<Feedback> {
    const feedback = await this.getById(id);
    if (!feedback) throw notFound('Feedback not found');

    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.rating !== undefined) { fields.push('rating = ?'); values.push(data.rating); }
    if (data.comment !== undefined) { fields.push('comment = ?'); values.push(data.comment); }
    if (data.sentiment !== undefined) { fields.push('sentiment = ?'); values.push(data.sentiment); }

    if (fields.length === 0) return feedback;

    values.push(id);

    await this.db
      .prepare(`UPDATE feedback SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return this.getById(id) as Promise<Feedback>;
  }

  /**
   * Check if feedback has been requested for an appointment (no feedback exists).
   * Used by the post-visit workflow to avoid double-sending.
   */
  async hasFeedback(appointmentId: string): Promise<boolean> {
    const feedback = await this.getByAppointment(appointmentId);
    return feedback !== null;
  }
}
