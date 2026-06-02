// ============================================================
// Follow-Up Service
//
// Manages patient follow-ups — created by doctors, tracked by staff.
// Channel-agnostic; alerts can be sent via WhatsApp/email.
// ============================================================

import { FollowUp, CreateFollowUpInput, CompleteFollowUpInput } from '../db/schema';
import { generateId, now } from '../db/client';
import { badRequest, notFound } from '../utils/errors';

export class FollowUpService {
  constructor(private db: D1Database) {}

  /**
   * Create a new follow-up.
   */
  async create(data: CreateFollowUpInput): Promise<FollowUp> {
    if (!data.reason || data.reason.trim().length === 0) {
      throw badRequest('Follow-up reason is required');
    }

    // Validate due date is valid
    const dueDate = new Date(data.dueDate);
    if (isNaN(dueDate.getTime())) {
      throw badRequest('Invalid due date');
    }

    const id = generateId();
    const timestamp = now();

    await this.db
      .prepare(
        `INSERT INTO follow_ups (id, patient_id, reason, due_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .bind(id, data.patientId, data.reason.trim(), dueDate.toISOString(), timestamp, timestamp)
      .run();

    return this.getById(id) as Promise<FollowUp>;
  }

  /**
   * Get follow-ups by status.
   */
  async getByStatus(status: string): Promise<(FollowUp & { patient_name: string; patient_phone: string })[]> {
    const result = await this.db
      .prepare(
        `SELECT fu.*, p.name as patient_name, p.phone as patient_phone
         FROM follow_ups fu
         JOIN patients p ON fu.patient_id = p.id
         WHERE fu.status = ?
         ORDER BY fu.due_date ASC`,
      )
      .bind(status)
      .all<FollowUp & { patient_name: string; patient_phone: string }>();

    return result.results || [];
  }

  /**
   * Get overdue follow-ups (due_date < now AND status = 'pending').
   */
  async getOverdue(): Promise<(FollowUp & { patient_name: string; patient_phone: string })[]> {
    const result = await this.db
      .prepare(
        `SELECT fu.*, p.name as patient_name, p.phone as patient_phone
         FROM follow_ups fu
         JOIN patients p ON fu.patient_id = p.id
         WHERE fu.status = 'pending' AND fu.due_date < datetime('now')
         ORDER BY fu.due_date ASC`,
      )
      .all<FollowUp & { patient_name: string; patient_phone: string }>();

    return result.results || [];
  }

  /**
   * Get upcoming follow-ups (due_date between now and N days from now).
   */
  async getUpcoming(days: number = 7): Promise<(FollowUp & { patient_name: string; patient_phone: string })[]> {
    const result = await this.db
      .prepare(
        `SELECT fu.*, p.name as patient_name, p.phone as patient_phone
         FROM follow_ups fu
         JOIN patients p ON fu.patient_id = p.id
         WHERE fu.status = 'pending'
         AND fu.due_date >= datetime('now')
         AND fu.due_date <= datetime('now', '+?' || ' days')
         ORDER BY fu.due_date ASC`,
      )
      .bind(days)
      .all<FollowUp & { patient_name: string; patient_phone: string }>();

    return result.results || [];
  }

  /**
   * Get all follow-ups with optional status filter.
   * Supports 'overdue' and 'upcoming' as special status values.
   */
  async getAll(status?: string, type?: string): Promise<(FollowUp & { patient_name: string; patient_phone: string })[]> {
    if (type === 'overdue') return this.getOverdue();
    if (type === 'upcoming') return this.getUpcoming();

    if (status) return this.getByStatus(status);

    // Return all, ordered by due date
    const result = await this.db
      .prepare(
        `SELECT fu.*, p.name as patient_name, p.phone as patient_phone
         FROM follow_ups fu
         JOIN patients p ON fu.patient_id = p.id
         ORDER BY fu.status ASC, fu.due_date ASC`,
      )
      .all<FollowUp & { patient_name: string; patient_phone: string }>();

    return result.results || [];
  }

  /**
   * Get follow-ups for a specific patient.
   */
  async getByPatientId(patientId: string): Promise<FollowUp[]> {
    const result = await this.db
      .prepare(
        'SELECT * FROM follow_ups WHERE patient_id = ? ORDER BY due_date DESC',
      )
      .bind(patientId)
      .all<FollowUp>();

    return result.results || [];
  }

  /**
   * Complete a follow-up with optional notes.
   */
  async complete(id: string, input?: CompleteFollowUpInput): Promise<FollowUp> {
    const followUp = await this.getById(id);
    if (!followUp) throw notFound('Follow-up not found');

    if (followUp.status === 'completed') {
      throw badRequest('Follow-up is already completed');
    }

    const timestamp = now();
    const notes = input?.notes || followUp.notes;

    await this.db
      .prepare('UPDATE follow_ups SET status = ?, notes = ?, updated_at = ? WHERE id = ?')
      .bind('completed', notes, timestamp, id)
      .run();

    return this.getById(id) as Promise<FollowUp>;
  }

  /**
   * Get a single follow-up by ID.
   */
  async getById(id: string): Promise<FollowUp | null> {
    const result = await this.db
      .prepare('SELECT * FROM follow_ups WHERE id = ?')
      .bind(id)
      .first<FollowUp>();
    return result || null;
  }
}
