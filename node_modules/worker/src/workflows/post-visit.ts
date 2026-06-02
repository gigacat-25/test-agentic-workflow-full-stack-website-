// ============================================================
// Post-Visit Feedback Workflow
//
// Phase 1: Simple function that can be called from a CRON trigger.
// Phase 2: Convert to Cloudflare Workflows for durable execution.
// ============================================================

import { Env } from '../db/client';
import { PatientService } from '../services/patient.service';
import { AppointmentService } from '../services/appointment.service';
import { NotificationService } from '../services/notification.service';
import { createWhatsAppProvider, createEmailProvider } from '../channels/whatsapp';

export class PostVisitWorkflow {
  /**
   * Send feedback requests for recently completed appointments.
   * Called by the scheduler every day (e.g. at the end of the day).
   */
  async processFeedbackRequests(env: Env): Promise<{ sent: number; failed: number; total: number }> {
    const db = env.DB;
    const patientService = new PatientService(db);
    const notificationService = this.createNotificationService(env);

    // Query appointments completed at least 2 hours ago that do not have feedback yet
    // D1 SQL query: joins appointments, patients, and left joins feedback to find rows where feedback is missing
    const query = `
      SELECT a.*
      FROM appointments a
      LEFT JOIN feedback f ON a.id = f.appointment_id
      WHERE a.status = 'completed'
      AND f.id IS NULL
      AND datetime(a.end_time) <= datetime('now', '-2 hours')
    `;

    const result = await db.prepare(query).all<any>();
    const completedAppointments = result.results || [];

    let sent = 0;
    let failed = 0;

    for (const appointment of completedAppointments) {
      try {
        const patient = await patientService.findById(appointment.patient_id);
        if (patient) {
          // Send post-visit feedback request
          await notificationService.sendPostVisitFeedback(
            {
              ...appointment,
              doctor_id: appointment.doctor_id || null,
              notes: appointment.notes || null,
            },
            patient,
          );
          sent++;
        }
      } catch (err) {
        console.error(`[PostVisitWorkflow] Failed to send feedback request for appointment ${appointment.id}:`, err);
        failed++;
      }
    }

    console.log(`[PostVisitWorkflow] Feedback requests: ${sent} sent, ${failed} failed, ${completedAppointments.length} total`);
    return { sent, failed, total: completedAppointments.length };
  }

  private createNotificationService(env: Env): NotificationService {
    const whatsappProvider = createWhatsAppProvider({
      provider: env.WHATSAPP_PROVIDER,
      credentials: {
        accountSid: env.TWILIO_ACCOUNT_SID || '',
        authToken: env.TWILIO_AUTH_TOKEN || '',
        fromNumber: env.TWILIO_WHATSAPP_FROM || '',
      },
    });

    const emailProvider = createEmailProvider({
      provider: env.EMAIL_PROVIDER,
      credentials: {
        apiKey: env.RESEND_API_KEY || '',
        fromEmail: env.RESEND_FROM_EMAIL || 'noreply@skincareclinic.com',
      },
    });

    return new NotificationService(
      whatsappProvider,
      emailProvider,
      env.CLINIC_NAME || 'SkinCare Clinic',
      env.CLINIC_ADDRESS || '',
      env.BASE_URL || '',
    );
  }
}
