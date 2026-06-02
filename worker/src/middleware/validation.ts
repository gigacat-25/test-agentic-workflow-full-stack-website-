// ============================================================
// Input validation helpers
// ============================================================

import { badRequest } from '../utils/errors';

/**
 * Validate that all required fields are present and non-empty.
 * Returns list of missing field names.
 * Throws AppError(400) if any are missing.
 */
export function validateRequired(body: Record<string, unknown>, fields: string[]): void {
  const missing: string[] = [];
  for (const field of fields) {
    const value = body[field];
    if (value === undefined || value === null || value === '') {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    throw badRequest(`Missing required fields: ${missing.join(', ')}`, { missing });
  }
}

/**
 * Validate that start_time is before end_time.
 */
export function validateDateRange(start: string, end: string): boolean {
  return new Date(start) < new Date(end);
}

/**
 * Basic phone number validation.
 * Accepts: +1234567890, 1234567890, with optional spaces/dashes.
 */
export function validatePhone(phone: string): boolean {
  // Allow: +1-555-123-4567, +15551234567, 555-123-4567, 5551234567
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^\+?\d{7,15}$/.test(cleaned);
}

/**
 * Basic email validation.
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate date string is a valid ISO date (YYYY-MM-DD or ISO datetime).
 */
export function validateDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validate time string is in HH:MM format (24-hour).
 */
export function validateTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/**
 * Sanitize a string: trim whitespace, collapse multiple spaces.
 * Does NOT strip HTML for simplicity — the frontend does that.
 * Use with caution; this is not a security boundary.
 */
export function sanitizeString(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/**
 * Sanitize phone number: remove non-digit characters except leading +.
 */
export function sanitizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // Ensure only digits and optional leading +
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.slice(1).replace(/\D/g, '');
  }
  return cleaned.replace(/\D/g, '');
}
