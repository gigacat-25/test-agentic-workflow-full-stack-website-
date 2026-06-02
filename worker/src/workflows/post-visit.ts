// ============================================================
// Post-Visit Feedback Workflow — Cloudflare Workflows
//
// Uses WorkflowEntrypoint for durable, retryable execution.
// Sends feedback request messages to patients whose appointments
// were completed ≥ 2 hours ago and have no feedback yet.
//
// Bindings required in wrangler.toml:
//   [[workflows]]
//   binding = "POST_VISIT_WORKFLOW"
//   name = "post-visit-workflow"
//   class_name = "PostVisitWorkflow"
// ============================================================

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { Env } from '../db/client';
import { NotificationService } from '../services/notification.service';
import { createWhatsAppProvider, createEmailProvider } from '../channels/whatsapp';

// No extra params needed — always processes all pending feedback
export interface PostVisitParams {
  appointmentId?: string;
  triggeredAt?: string; // ISO timestamp, for logging
}

export class PostVisitWorkflow extends WorkflowEntrypoint<Env, PostVisitParams> {
  async run(event: WorkflowEvent<PostVisitParams>, step: WorkflowStep) {
    const { appointmentId } = event.payload;

    if (appointmentId) {
      console.log(`[PostVisitWorkflow] Starting 2-hour delay for appointment ${appointmentId}`);

      // Sleep for 2 hours (Workflows handle sleeping durably)
      await step.sleep('wait-2-hours', '2 hours');

      // Fetch appointment and check if feedback was already submitted or if appointment was cancelled/changed
      const appointment = await step.do('check-appointment-status', async () => {
        const appt = await this.env.DB.prepare(
          `SELECT a.*, f.id as feedback_id
           FROM appointments a
           LEFT JOIN feedback f ON a.id = f.appointment_id
           WHERE a.id = ?`,
        )
          .bind(appointmentId)
          .first<any>();
        return appt;
      });

      if (!appointment) {
        console.log(`[PostVisitWorkflow] Appointment ${appointmentId} not found. Exiting.`);
        return { success: false, reason: 'not_found' };
      }

      if (appointment.status !== 'completed') {
        console.log(`[PostVisitWorkflow] Appointment ${appointmentId} status is ${appointment.status}, not completed. Exiting.`);
        return { success: false, reason: 'not_completed' };
      }

      if (appointment.feedback_id) {
        console.log(`[PostVisitWorkflow] Appointment ${appointmentId} already has feedback. Exiting.`);
        return { success: false, reason: 'feedback_already_exists' };
      }

      // Send the feedback request
      const result = await step.do(
        `send-feedback-${appointmentId}`,
        { retries: { limit: 3, delay: '15 seconds', backoff: 'exponential' } },
        async () => {
          const patient = await this.env.DB.prepare(
            'SELECT * FROM patients WHERE id = ?',
          )
            .bind(appointment.patient_id)
            .first<any>();

          if (!patient) return { ok: false, reason: 'patient_not_found' };

          const notificationService = this.createNotificationService();
          await notificationService.sendPostVisitFeedback(
            {
              ...appointment,
              doctor_id: appointment.doctor_id ?? null,
              notes: appointment.notes ?? null,
            },
            patient,
          );

          return { ok: true };
        },
      );

      return { success: result.ok, sent: result.ok ? 1 : 0 };
    }

    const triggeredAt = event.payload.triggeredAt ?? new Date().toISOString();

    // ── Step 1: Find completed appointments with no feedback ──
    const appointments = await step.do('fetch-pending-feedback', async () => {
      const result = await this.env.DB.prepare(
        `SELECT a.*
         FROM appointments a
         LEFT JOIN feedback f ON a.id = f.appointment_id
         WHERE a.status = 'completed'
           AND f.id IS NULL
           AND datetime(a.end_time) <= datetime('now', '-2 hours')
         ORDER BY a.end_time DESC
         LIMIT 100`,
      ).all<any>();

      return result.results || [];
    });

    if (appointments.length === 0) {
      console.log(`[PostVisitWorkflow] No pending feedback requests at ${triggeredAt}`);
      return { sent: 0, failed: 0, total: 0 };
    }

    // ── Step 2: Send feedback request for each appointment ────
    let sent = 0;
    let failed = 0;

    for (const appointment of appointments) {
      const result = await step.do(
        `send-feedback-${appointment.id}`,
        { retries: { limit: 3, delay: '15 seconds', backoff: 'exponential' } },
        async () => {
          const patient = await this.env.DB.prepare(
            'SELECT * FROM patients WHERE id = ?',
          )
            .bind(appointment.patient_id)
            .first<any>();

          if (!patient) return { ok: false, reason: 'patient_not_found' };

          const notificationService = this.createNotificationService();
          await notificationService.sendPostVisitFeedback(
            {
              ...appointment,
              doctor_id: appointment.doctor_id ?? null,
              notes: appointment.notes ?? null,
            },
            patient,
          );

          return { ok: true };
        },
      );

      if (result.ok) {
        sent++;
      } else {
        failed++;
        console.warn(
          `[PostVisitWorkflow] Skipped feedback for ${appointment.id}: ${result.reason}`,
        );
      }
    }

    console.log(
      `[PostVisitWorkflow] Feedback: ${sent} sent, ${failed} failed, ${appointments.length} total`,
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
