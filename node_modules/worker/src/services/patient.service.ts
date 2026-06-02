// ============================================================
// Patient Service
//
// Channel-agnostic patient CRUD operations.
// Used by all channels: web form, WhatsApp, staff manual, and future phone calls.
// ============================================================

import {
  Patient,
  CreatePatientInput,
  PreferredChannel,
} from '../db/schema';
import { generateId, now, formatDate } from '../db/client';
import { badRequest, notFound } from '../utils/errors';

export class PatientService {
  constructor(private db: D1Database) {}

  /**
   * Create a new patient. Validates at least one contact method.
   * Checks for duplicates by phone or email.
   */
  async create(data: CreatePatientInput): Promise<Patient> {
    if (!data.phone && !data.email) {
      throw badRequest('At least one contact method (phone or email) is required');
    }

    // Check for existing patient by phone
    if (data.phone) {
      const existing = await this.findByPhone(data.phone);
      if (existing) {
        // Update existing patient's info if new data provided
        return this.update(existing.id, {
          name: data.name,
          email: data.email || existing.email,
          preferred_channel: data.preferred_channel || existing.preferred_channel,
        });
      }
    }

    // Check for existing patient by email
    if (data.email) {
      const existing = await this.findByEmail(data.email);
      if (existing) {
        return this.update(existing.id, {
          name: data.name,
          phone: data.phone || existing.phone,
          preferred_channel: data.preferred_channel || existing.preferred_channel,
        });
      }
    }

    const id = generateId();
    const timestamp = now();
    const channel = data.preferred_channel || (data.phone ? 'whatsapp' : 'email') as PreferredChannel;

    await this.db
      .prepare(
        `INSERT INTO patients (id, name, phone, email, preferred_channel, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, data.name, data.phone || null, data.email || null, channel, timestamp, timestamp)
      .run();

    return this.findById(id) as Promise<Patient>;
  }

  /**
   * Find a patient by phone number.
   */
  async findByPhone(phone: string): Promise<Patient | null> {
    // Normalize phone for lookup
    const normalized = phone.replace(/[\s\-\(\)]/g, '');
    const result = await this.db
      .prepare('SELECT * FROM patients WHERE REPLACE(REPLACE(REPLACE(phone, \' \', \'\'), \'-\', \'\'), \'(\', \'\') = ?')
      .bind(normalized)
      .first<Patient>();
    return result || null;
  }

  /**
   * Find a patient by email.
   */
  async findByEmail(email: string): Promise<Patient | null> {
    const result = await this.db
      .prepare('SELECT * FROM patients WHERE email = ?')
      .bind(email.toLowerCase().trim())
      .first<Patient>();
    return result || null;
  }

  /**
   * Find a patient by ID.
   */
  async findById(id: string): Promise<Patient | null> {
    const result = await this.db
      .prepare('SELECT * FROM patients WHERE id = ?')
      .bind(id)
      .first<Patient>();
    return result || null;
  }

  /**
   * Find or create a patient by phone number.
   */
  async findOrCreateByPhone(phone: string, name?: string): Promise<Patient> {
    const existing = await this.findByPhone(phone);
    if (existing) return existing;

    return this.create({
      name: name || 'Unknown Patient',
      phone,
      preferred_channel: 'whatsapp',
    });
  }

  /**
   * Update patient fields.
   */
  async update(
    id: string,
    data: Partial<Pick<Patient, 'name' | 'phone' | 'email' | 'preferred_channel'>>,
  ): Promise<Patient> {
    const patient = await this.findById(id);
    if (!patient) throw notFound('Patient not found');

    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
    if (data.preferred_channel !== undefined) { fields.push('preferred_channel = ?'); values.push(data.preferred_channel); }

    if (fields.length === 0) return patient;

    fields.push('updated_at = ?');
    values.push(now());
    values.push(id);

    await this.db
      .prepare(`UPDATE patients SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return this.findById(id) as Promise<Patient>;
  }

  /**
   * Search patients by name or phone.
   */
  async search(query: string): Promise<Patient[]> {
    const searchTerm = `%${query}%`;
    const result = await this.db
      .prepare(
        `SELECT * FROM patients
         WHERE name LIKE ? OR phone LIKE ?
         ORDER BY created_at DESC
         LIMIT 20`,
      )
      .bind(searchTerm, searchTerm)
      .all<Patient>();

    return result.results || [];
  }
}
