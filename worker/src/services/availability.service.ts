// ============================================================
// Availability Service
//
// Checks appointment availability and generates available time slots.
// Business hours configurable via constants.
// ============================================================

import { TimeSlot } from '../db/schema';
import { formatDate } from '../db/client';

// Business hours configuration
const BUSINESS_HOURS = {
  start: 9,   // 9:00 AM
  end: 17,    // 5:00 PM
  slotDurationMinutes: 60,
  timezone: 'America/New_York', // Configurable per clinic location
};

// Days of the week the clinic is open (0=Sunday, 6=Saturday)
const OPEN_DAYS = [1, 2, 3, 4, 5]; // Monday through Friday

export class AvailabilityService {
  constructor(private db: D1Database) {}

  /**
   * Check if a specific time slot is available.
   * Returns true if no conflicting appointments exist.
   */
  async isSlotAvailable(
    date: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string,
  ): Promise<boolean> {
    // Convert dates to comparable ISO strings
    const start = new Date(`${date}T${startTime}`).toISOString();
    const end = new Date(`${date}T${endTime}`).toISOString();

    let query = `
      SELECT COUNT(*) as count FROM appointments
      WHERE status NOT IN ('cancelled', 'no_show')
      AND start_time < ? AND end_time > ?
    `;
    const params: unknown[] = [end, start];

    if (excludeAppointmentId) {
      query += ' AND id != ?';
      params.push(excludeAppointmentId);
    }

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .first<{ count: number }>();

    return result ? result.count === 0 : true;
  }

  /**
   * Get all available time slots for a given date and service type.
   * Returns array of { start, end } ISO strings that are free.
   */
  async getAvailableSlots(date: string, serviceType?: string): Promise<TimeSlot[]> {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getUTCDay(); // or use getDay() with timezone adjustment

    // Check if clinic is open on this day
    if (!OPEN_DAYS.includes(dayOfWeek)) {
      return []; // Clinic closed on weekends
    }

    const slots = this.generateTimeSlots(date);
    const available: TimeSlot[] = [];

    for (const slot of slots) {
      const isAvailable = await this.isSlotAvailable(date, slot.start, slot.end);
      if (isAvailable) {
        available.push(slot);
      }
    }

    return available;
  }

  /**
   * Generate all possible time slots for a given date based on business hours.
   */
  generateTimeSlots(date: string): TimeSlot[] {
    const slots: TimeSlot[] = [];

    for (let hour = BUSINESS_HOURS.start; hour < BUSINESS_HOURS.end; hour += 1) {
      // Skip lunch hour (12:00-13:00) if needed
      // if (hour === 12) continue;

      const start = `${hour.toString().padStart(2, '0')}:00`;
      const end = `${(hour + 1).toString().padStart(2, '0')}:00`;
      slots.push({ start, end });
    }

    return slots;
  }

  /**
   * Parse a time range string like "morning", "9-12", "afternoon", etc.
   * into a specific { start, end } time slot.
   */
  parseTimePreference(preference: string): { start: string; end: string } | null {
    const lower = preference.toLowerCase().trim();

    if (lower.includes('morning') || lower.includes('9-12') || lower === 'morning') {
      return { start: '09:00', end: '12:00' };
    }
    if (lower.includes('afternoon') || lower.includes('12-4') || lower.includes('12-16')) {
      return { start: '12:00', end: '16:00' };
    }
    if (lower.includes('evening') || lower.includes('4-6') || lower.includes('16-18')) {
      return { start: '16:00', end: '18:00' };
    }

    // Try to parse direct time format like "14:00-15:00"
    const match = lower.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (match) {
      return { start: match[1], end: match[2] };
    }

    // Try to parse single hour like "10:00" (assume 1-hour slot)
    const singleMatch = lower.match(/(\d{1,2}):(\d{2})/);
    if (singleMatch) {
      const hour = parseInt(singleMatch[1], 10);
      const minute = singleMatch[2];
      const endHour = hour + 1;
      return {
        start: `${hour.toString().padStart(2, '0')}:${minute}`,
        end: `${endHour.toString().padStart(2, '0')}:${minute}`,
      };
    }

    return null;
  }
}
