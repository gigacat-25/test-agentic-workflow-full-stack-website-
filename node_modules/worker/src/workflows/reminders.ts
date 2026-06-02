// ============================================================
// Appointment Reminder Workflow — Cloudflare Workflows
//
// Uses WorkflowEntrypoint for durable, retryable execution.
// Each step is checkpointed; Cloudflare re-runs only failed
// steps on retry — no double-sends.
//
// Bindings required in wrangler.toml:
//   [[workflows]]
//   binding = "REMINDER_WORKFLOW"
//   name = "reminder-workflow"
//   class_name = "ReminderWorkflow"
// ============================================================

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { Env } from '../db/client';
import { NotificationService } from '../services/notification.service';
import { createWhatsAppProvider, createEmailProvider } from '../channels/whatsapp';

// Parameters passed when triggering the workflow
export interface ReminderParams {
  /** "day_before" or "hour_before" */
  reminderType: 'day_before' | 'hour_before';
}

export class ReminderWorkflow extends WorkflowEntrypoint<Env, ReminderParams> {
  async run(event: WorkflowEvent<ReminderParams>, step: WorkflowStep) {
    const { reminderType } = event.payload;

    // ── Step 1: Fetch appointments to remind ──────────────────
    const appointments = await step.do('fetch-appointments', async () => {
      let dateStr: string;

      if (reminderType === 'day_before') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateStr = tomorrow.toISOString().split('T')[0];
      } else {
        dateStr = new Date().toISOString().split('T')[0];
      }

      const result = await this.env.DB.prepare(
        `SELECT * FROM appointments
         WHERE date(start_time) = ?
           AND status = 'confirmed'
         ORDER BY start_time ASC`,
      )
        .bind(dateStr)
        .all<any>();

      return result.results || [];
    });

    if (appointments.length === 0) {
      console.log(`[ReminderWorkflow] No ${reminderType} reminders to send`);
      return { sent: 0, failed: 0, total: 0 };
    }

    // ── Step 2: Send each reminder in its own durable step ────
    let sent = 0;
    let failed = 0;

    for (const appointment of appointments) {
      const result = await step.do(
        `send-reminder-${appointment.id}`,
        { retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' } },
        async () => {
          const patientResult = await this.env.DB.prepare(
            'SELECT * FROM patients WHERE id = ?',
          )
            .bind(appointment.patient_id)
            .first<any>();

          if (!patientResult) return { ok: false, reason: 'patient_not_found' };

          const notificationService = this.createNotificationService();
          await notificationService.sendReminder(
            {
              ...appointment,
              doctor_id: appointment.doctor_id ?? null,
              notes: appointment.notes ?? null,
            },
            patientResult,
            reminderType,
          );

          return { ok: true };
        },
      );

      if (result.ok) {
        sent++;
      } else {
        failed++;
        console.warn(`[ReminderWorkflow] Skipped reminder for ${appointment.id}: ${result.reason}`);
      }
    }

    console.log(
      `[ReminderWorkflow] ${reminderType}: ${sent} sent, ${failed} failed, ${appointments.length} total`,
    );
    return { sent, failed, total: appointments.length };
  }

  // ── Notification service factory ──────────────────────────
  private createNotificationService(): NotificationService {
    const whatsappProvider = createWhatsAppProvider({
      provider: this.env.WHATSAPP_PROVIDER,
      credentials: {
        accountSid: this.env.TWILIO_ACCOUNT_SID || '',
        authToken: this.env.TWILIO_AUTH_TOKEN || '',
        fromNumber: this.env.TWILIO_WHATSAPP_FROM || '',
      },
    });

    const emailProvider = createEmailProvider({
      provider: this.env.EMAIL_PROVIDER,
      credentials: {
        apiKey: this.env.RESEND_API_KEY || '',
        fromEmail: this.env.RESEND_FROM_EMAIL || 'noreply@skincareclinic.com',
        clientId: this.env.GOOGLE_GMAIL_CLIENT_ID || '',
        clientSecret: this.env.GOOGLE_GMAIL_CLIENT_SECRET || '',
        refreshToken: this.env.GOOGLE_GMAIL_REFRESH_TOKEN || '',
        senderEmail: this.env.GOOGLE_GMAIL_SENDER_EMAIL || '',
      },
    });

    return new NotificationService(
      whatsappProvider,
      emailProvider,
      this.env.CLINIC_NAME || 'SkinCare Clinic',
      this.env.CLINIC_ADDRESS || '',
      this.env.BASE_URL || '',
    );
  }
}
