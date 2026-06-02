// ============================================================
// D1 Database client helpers
// ============================================================

/**
 * Cloudflare Worker Environment bindings.
 * Add all D1, R2, KV, and variable bindings here.
 */
export interface Env {
  // D1 Database
  DB: D1Database;

  // R2 Bucket (for future image uploads)
  IMAGES_BUCKET: R2Bucket;

  // Auth
  JWT_SECRET: string;

  // Clinic info
  CLINIC_NAME: string;
  CLINIC_ADDRESS: string;
  CLINIC_PHONE: string;
  CLINIC_EMAIL: string;
  BASE_URL: string;

  // WhatsApp provider
  WHATSAPP_PROVIDER: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_WHATSAPP_FROM?: string;

  // Email provider
  EMAIL_PROVIDER: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

/**
 * Get typed D1 database instance from environment.
 */
export function getDb(env: Env): D1Database {
  return env.DB;
}

/**
 * Generate a UUID v4 using crypto API available in Workers.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get current ISO datetime string.
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Format a Date to YYYY-MM-DD for date-only comparisons.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Type helper for D1 query results
 */
export type QueryResult<T> = {
  results: T[];
  success: boolean;
  error?: string;
  meta?: {
    duration: number;
    changes: number;
    last_row_id: number;
    served_by: string;
  };
};
