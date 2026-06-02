// ============================================================
// Channel abstraction interfaces
//
// These interfaces decouple business logic from specific
// messaging/email providers. To add a new provider, implement
// the interface and register it in the factory function.
// ============================================================

// -----------------------------------------------------------------
// WhatsApp/Text Message Channel
// -----------------------------------------------------------------
export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template';
  body?: string;
  templateName?: string;
  templateParams?: Record<string, string>;
}

export interface WhatsAppResult {
  messageId: string;
  provider: string;
}

export interface NotificationChannel {
  /**
   * Send a plain text message via WhatsApp.
   */
  sendTextMessage(to: string, text: string): Promise<WhatsAppResult>;

  /**
   * Send a template message (pre-approved by Meta/Twilio).
   * Useful for appointment reminders, confirmations, etc.
   */
  sendTemplateMessage?(
    to: string,
    templateName: string,
    params: Record<string, string>,
  ): Promise<WhatsAppResult>;
}

// -----------------------------------------------------------------
// Email Channel
// -----------------------------------------------------------------
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailResult {
  messageId: string;
  provider: string;
}

export interface EmailProvider {
  sendEmail(to: string, subject: string, html: string): Promise<EmailResult>;
}

// -----------------------------------------------------------------
// Provider Configuration
// -----------------------------------------------------------------
export type WhatsAppProviderType = 'twilio' | 'meta';
export type EmailProviderType = 'resend' | 'sendgrid' | 'mailgun' | 'gmail';

export interface WhatsAppConfig {
  provider: WhatsAppProviderType | string;
  credentials: {
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
    accessToken?: string;
    phoneNumberId?: string;
    [key: string]: string | undefined;
  };
}

export interface EmailConfig {
  provider: EmailProviderType | string;
  credentials: {
    apiKey?: string;
    fromEmail?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    senderEmail?: string;
    [key: string]: string | undefined;
  };
}

// -----------------------------------------------------------------
// Channel dispatch types
// -----------------------------------------------------------------
export type NotificationChannelType = 'whatsapp' | 'email' | 'both';
