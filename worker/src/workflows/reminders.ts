// ============================================================
// Appointment Reminder Workflow
//
// Phase 1: Simple function that can be called from a CRON trigger.
// Phase 2: Convert to Cloudflare Workflows for durable execution.
//
// Cloudflare Workflows Pattern (Phase 2):
// ```
// import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
//
// export class ReminderWorkflow extends WorkflowEntrypoint<Env, Params> {
//   async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
//     const appointments = await step.do('fetch appointments', async () => {
//       return await this.env.DB.prepare(...).all();
//     });
//     for (const apt of appointments) {
//       await step.do(`remind-${apt.id}`, async () => {
//         await this.sendReminder(apt);
//       });
//     }
//   }
// }
// ```
// ============================================================

import { Env } from '../db/client';
import { PatientService } from '../services/patient.service';
import { AppointmentService } from '../services/appointment.service';
import { NotificationService } from '../services/notification.service';
import { createWhatsAppProvider, createEmailProvider } from '../channels/whatsapp';

export class ReminderWorkflow {
  /**
   * Send reminders for tomorrow's appointments.
   * Called by the scheduler (CRON) every morning at 8 AM.
   */
  async processDayBeforeReminders(env: Env): Promise<{ sent: number; failed: number; total: number }> {
    const db = env.DB;
    const patientService = new PatientService(db);
    const appointmentService = new AppointmentService(db);
    const notificationService = this.createNotificationService(env);

    // Calculate tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    // Get confirmed appointments for tomorrow
    const appointments = await appointmentService.getByDate(dateStr, 'confirmed');

    let sent = 0;
    let failed = 0;

    for (const appointment of appointments) {
      try {
        const patient = await patientService.findById(appointment.patient_id);
        if (patient) {
          await notificationService.sendReminder(
            {
              ...appointment,
              doctor_id: appointment.doctor_id || null,
              notes: appointment.notes || null,
            },
            patient,
            'day_before',
          );
          sent++;
        }
      } catch (err) {
        console.error(`[ReminderWorkflow] Failed to send reminder for ${appointment.id}:`, err);
        failed++;
      }
    }

    console.log(`[ReminderWorkflow] Day-before reminders: ${sent} sent, ${failed} failed, ${appointments.length} total`);
    return { sent, failed, total: appointments.length };
  }

  /**
   * Send reminders for appointments happening within the next 2 hours.
   * Called by the scheduler every 2 hours.
   */
  async processHourlyReminders(env: Env): Promise<{ sent: number; failed: number; total: number }> {
    const db = env.DB;
    const patientService = new PatientService(db);
    const appointmentService = new AppointmentService(db);
    const notificationService = this.createNotificationService(env);

    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];

    const appointments = await appointmentService.getByDate(todayStr, 'confirmed');

    // Filter to appointments starting within the next 2 hours
    const upcomingAppointments = appointments.filter(apt => {
      const startTime = new Date(apt.start_time);
      return startTime > now && startTime <= twoHoursLater;
    });

    let sent = 0;
    let failed = 0;

    for (const appointment of upcomingAppointments) {
      try {
        const patient = await patientService.findById(appointment.patient_id);
        if (patient) {
          await notificationService.sendReminder(
            {
              ...appointment,
              doctor_id: appointment.doctor_id || null,
              notes: appointment.notes || null,
            },
            patient,
            'hour_before',
          );
          sent++;
        }
      } catch (err) {
        console.error(`[ReminderWorkflow] Failed to send hourly reminder for ${appointment.id}:`, err);
        failed++;
      }
    }

    console.log(`[ReminderWorkflow] Hourly reminders: ${sent} sent, ${failed} failed, ${upcomingAppointments.length} total`);
    return { sent, failed, total: upcomingAppointments.length };
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
