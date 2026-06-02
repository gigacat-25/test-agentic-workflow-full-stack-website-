// ============================================================
// Notification Service
//
// Dispatches notifications via the appropriate channel(s) based on
// the patient's preferred_channel. All business logic is channel-agnostic;
// this service decides which channel provider to use.
//
// In Phase 2, these methods will be triggered by Cloudflare Workflows.
// ============================================================

import { Appointment, Patient, FollowUp } from '../db/schema';
import { NotificationChannel, EmailProvider, NotificationChannelType } from '../channels/types';

export class NotificationService {
  constructor(
    private whatsappProvider: NotificationChannel,
    private emailProvider: EmailProvider,
    private clinicName: string,
    private clinicAddress: string,
    private baseUrl: string,
  ) {}

  /**
   * Determine which channels to send to based on patient preference.
   */
  private getChannels(patient: Patient): NotificationChannelType[] {
    const channels: NotificationChannelType[] = [];
    const pref = patient.preferred_channel;

    if (pref === 'whatsapp' || pref === 'both') {
      if (patient.phone) channels.push('whatsapp');
    }
    if (pref === 'email' || pref === 'both') {
      if (patient.email) channels.push('email');
    }
    // Default to WhatsApp if patient has a phone but no preference set
    if (channels.length === 0 && patient.phone) {
      channels.push('whatsapp');
    }

    return channels;
  }

  /**
   * Send appointment confirmation notification.
   */
  async sendAppointmentConfirmation(appointment: Appointment, patient: Patient): Promise<void> {
    const dateStr = new Date(appointment.start_time).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const timeStr = new Date(appointment.start_time).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });

    const channels = this.getChannels(patient);

    for (const channel of channels) {
      try {
        if (channel === 'whatsapp' && patient.phone) {
          await this.whatsappProvider.sendTextMessage(
            patient.phone,
            `✅ Your appointment at ${this.clinicName} is confirmed!\n\n📅 ${dateStr}\n⏰ ${timeStr}\n📍 ${this.clinicAddress}\n\nReply CANCEL if you need to reschedule.`,
          );
        }
        if (channel === 'email' && patient.email) {
          const html = this.buildEmailHtml(
            'Appointment Confirmed',
            `<h2>Your appointment is confirmed</h2>
             <p><strong>Date:</strong> ${dateStr}</p>
             <p><strong>Time:</strong> ${timeStr}</p>
             <p><strong>Location:</strong> ${this.clinicAddress}</p>
             <p><strong>Service:</strong> ${appointment.service_type}</p>
             <hr>
             <p>Need to cancel? <a href="${this.baseUrl}/api/public/appointments/cancel?appointmentId=${appointment.id}">Click here to cancel</a></p>`,
          );
          await this.emailProvider.sendEmail(patient.email, `Appointment Confirmed - ${this.clinicName}`, html);
        }
      } catch (err) {
        console.error(`[Notification] Failed to send ${channel} to ${patient.id}:`, err);
      }
    }
  }

  /**
   * Send appointment cancellation notification.
   */
  async sendAppointmentCancellation(appointment: Appointment, patient: Patient): Promise<void> {
    const dateStr = new Date(appointment.start_time).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const timeStr = new Date(appointment.start_time).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });

    const channels = this.getChannels(patient);

    for (const channel of channels) {
      try {
        if (channel === 'whatsapp' && patient.phone) {
          await this.whatsappProvider.sendTextMessage(
            patient.phone,
            `❌ Your appointment at ${this.clinicName} on ${dateStr} at ${timeStr} has been cancelled.\n\nTo reschedule, reply BOOK.`,
          );
        }
        if (channel === 'email' && patient.email) {
          const html = this.buildEmailHtml(
            'Appointment Cancelled',
            `<h2>Your appointment has been cancelled</h2>
             <p><strong>Date:</strong> ${dateStr}</p>
             <p><strong>Time:</strong> ${timeStr}</p>
             <hr>
             <p>To book a new appointment, visit our website or reply to this email.</p>`,
          );
          await this.emailProvider.sendEmail(patient.email, `Appointment Cancelled - ${this.clinicName}`, html);
        }
      } catch (err) {
        console.error(`[Notification] Failed to send cancellation ${channel}:`, err);
      }
    }
  }

  /**
   * Send appointment reminder (24h before or 2h before).
   */
  async sendReminder(appointment: Appointment, patient: Patient, type: 'day_before' | 'hour_before' = 'day_before'): Promise<void> {
    const dateStr = new Date(appointment.start_time).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const timeStr = new Date(appointment.start_time).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });

    const channels = this.getChannels(patient);
    const isHourBefore = type === 'hour_before';
    const prefix = isHourBefore ? '⏰ Reminder' : '📅 Reminder';
    const timeMsg = isHourBefore
      ? `Your appointment is in about an hour!`
      : `You have an appointment tomorrow`;

    for (const channel of channels) {
      try {
        if (channel === 'whatsapp' && patient.phone) {
          await this.whatsappProvider.sendTextMessage(
            patient.phone,
            `${prefix}\n\n${timeMsg}\n\n📅 ${dateStr}\n⏰ ${timeStr}\n📍 ${this.clinicAddress}\n\nReply CANCEL to reschedule.`,
          );
        }
        if (channel === 'email' && patient.email) {
          const html = this.buildEmailHtml(
            'Appointment Reminder',
            `<h2>${timeMsg}</h2>
             <p><strong>Date:</strong> ${dateStr}</p>
             <p><strong>Time:</strong> ${timeStr}</p>
             <p><strong>Location:</strong> ${this.clinicAddress}</p>
             <hr>
             <p>Need to cancel? <a href="${this.baseUrl}/api/public/appointments/cancel?appointmentId=${appointment.id}">Click here</a></p>`,
          );
          await this.emailProvider.sendEmail(patient.email, `Appointment Reminder - ${this.clinicName}`, html);
        }
      } catch (err) {
        console.error(`[Notification] Failed to send reminder ${channel}:`, err);
      }
    }
  }

  /**
   * Send post-visit feedback request.
   */
  async sendPostVisitFeedback(appointment: Appointment, patient: Patient): Promise<void> {
    const channels = this.getChannels(patient);

    for (const channel of channels) {
      try {
        if (channel === 'whatsapp' && patient.phone) {
          await this.whatsappProvider.sendTextMessage(
            patient.phone,
            `💬 How was your visit to ${this.clinicName} today?\n\nReply with your feedback. If you'd like to leave a rating, include a number 1-5.`,
          );
        }
        if (channel === 'email' && patient.email) {
          const html = this.buildEmailHtml(
            'How was your visit?',
            `<h2>We'd love your feedback!</h2>
             <p>Thank you for visiting ${this.clinicName}.</p>
             <p>Please take a moment to share your experience:</p>
             <p><a href="${this.baseUrl}/feedback?appointmentId=${appointment.id}" style="display:inline-block;padding:12px 24px;background:#0D7C66;color:white;text-decoration:none;border-radius:6px;">Leave Feedback</a></p>
             <hr>
             <p>Or reply to this email with your thoughts.</p>`,
          );
          await this.emailProvider.sendEmail(patient.email, `How was your visit? - ${this.clinicName}`, html);
        }
      } catch (err) {
        console.error(`[Notification] Failed to send feedback request ${channel}:`, err);
      }
    }
  }

  /**
   * Send follow-up reminder.
   */
  async sendFollowUpReminder(followUp: FollowUp, patient: Patient): Promise<void> {
    const dueDate = new Date(followUp.due_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const channels = this.getChannels(patient);

    for (const channel of channels) {
      try {
        if (channel === 'whatsapp' && patient.phone) {
          await this.whatsappProvider.sendTextMessage(
            patient.phone,
            `📋 Follow-up Reminder\n\nDear ${patient.name},\n\nThis is a reminder about your follow-up for: ${followUp.reason}\n\nDue: ${dueDate}\n\nPlease contact the clinic to schedule.`,
          );
        }
        if (channel === 'email' && patient.email) {
          const html = this.buildEmailHtml(
            'Follow-up Reminder',
            `<h2>Follow-up Reminder</h2>
             <p>Dear ${patient.name},</p>
             <p><strong>Reason:</strong> ${followUp.reason}</p>
             <p><strong>Due Date:</strong> ${dueDate}</p>
             <hr>
             <p>Please contact the clinic to schedule your follow-up appointment.</p>`,
          );
          await this.emailProvider.sendEmail(patient.email, `Follow-up Reminder - ${this.clinicName}`, html);
        }
      } catch (err) {
        console.error(`[Notification] Failed to send follow-up reminder ${channel}:`, err);
      }
    }
  }

  /**
   * Build a basic HTML email template.
   */
  private buildEmailHtml(title: string, bodyHtml: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0D7C66; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">${this.clinicName}</h1>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
          ${bodyHtml}
        </div>
        <div style="text-align: center; color: #636E72; font-size: 12px; margin-top: 16px;">
          <p>${this.clinicName} | ${this.clinicAddress}</p>
        </div>
      </body>
      </html>
    `.trim();
  }
}
