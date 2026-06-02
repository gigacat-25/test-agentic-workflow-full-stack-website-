// ============================================================
// WhatsApp & Email Provider Implementations
//
// These providers use fetch() directly — no external SDKs needed.
// This keeps the Worker bundle small and avoids CommonJS/ESM issues.
// ============================================================

import {
  NotificationChannel,
  WhatsAppResult,
  WhatsAppConfig,
  EmailProvider,
  EmailResult,
  EmailConfig,
} from './types';

// ============================================================
// WhatsApp Providers
// ============================================================

/**
 * Twilio WhatsApp Provider
 * Docs: https://www.twilio.com/docs/whatsapp/api
 */
export class TwilioWhatsAppProvider implements NotificationChannel {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private baseUrl: string;

  constructor(config: WhatsAppConfig['credentials']) {
    this.accountSid = config.accountSid || '';
    this.authToken = config.authToken || '';
    this.fromNumber = config.fromNumber || '';
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`;

    if (!this.accountSid || !this.authToken) {
      console.warn('TwilioWhatsAppProvider: Missing credentials (accountSid or authToken)');
    }
  }

  async sendTextMessage(to: string, text: string): Promise<WhatsAppResult> {
    if (!this.accountSid) {
      console.log(`[Twilio Mock] Would send WhatsApp to ${to}: ${text}`);
      return { messageId: `mock-${Date.now()}`, provider: 'twilio' };
    }

    const url = `${this.baseUrl}/Messages.json`;
    const auth = btoa(`${this.accountSid}:${this.authToken}`);
    const body = new URLSearchParams({
      From: `whatsapp:${this.fromNumber}`,
      To: `whatsapp:${to}`,
      Body: text,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const result = await response.json<any>();

    if (!response.ok) {
      console.error('[Twilio] Failed to send message:', result);
      throw new Error(`Twilio error: ${result.message || response.statusText}`);
    }

    return { messageId: result.sid, provider: 'twilio' };
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    params: Record<string, string>,
  ): Promise<WhatsAppResult> {
    // Twilio Content API: https://www.twilio.com/docs/content
    if (!this.accountSid) {
      console.log(`[Twilio Mock] Would send template "${templateName}" to ${to}`);
      return { messageId: `mock-${Date.now()}`, provider: 'twilio' };
    }

    const url = `${this.baseUrl}/Messages.json`;
    const auth = btoa(`${this.accountSid}:${this.authToken}`);
    const body = new URLSearchParams({
      From: `whatsapp:${this.fromNumber}`,
      To: `whatsapp:${to}`,
      ContentSid: templateName, // Twilio Content SID (e.g., "HXb5b62575e6e4ff6129ad7c8bef1f986e")
      ContentVariables: JSON.stringify(params),
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const result = await response.json<any>();

    if (!response.ok) {
      console.error('[Twilio] Failed to send template:', result);
      throw new Error(`Twilio template error: ${result.message || response.statusText}`);
    }

    return { messageId: result.sid, provider: 'twilio' };
  }
}

/**
 * Meta (WhatsApp Cloud API) Provider
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
export class MetaWhatsAppProvider implements NotificationChannel {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string = 'v21.0';

  constructor(config: WhatsAppConfig['credentials']) {
    this.accessToken = config.accessToken || '';
    this.phoneNumberId = config.phoneNumberId || '';

    if (!this.accessToken || !this.phoneNumberId) {
      console.warn('MetaWhatsAppProvider: Missing credentials (accessToken or phoneNumberId)');
    }
  }

  async sendTextMessage(to: string, text: string): Promise<WhatsAppResult> {
    if (!this.accessToken) {
      console.log(`[Meta Mock] Would send WhatsApp to ${to}: ${text}`);
      return { messageId: `mock-${Date.now()}`, provider: 'meta' };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      }),
    });

    const result = await response.json<any>();

    if (!response.ok) {
      console.error('[Meta] Failed to send message:', result);
      throw new Error(`Meta error: ${result.error?.message || response.statusText}`);
    }

    return { messageId: result.messages?.[0]?.id || 'unknown', provider: 'meta' };
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    params: Record<string, string>,
  ): Promise<WhatsAppResult> {
    if (!this.accessToken) {
      console.log(`[Meta Mock] Would send template "${templateName}" to ${to}`);
      return { messageId: `mock-${Date.now()}`, provider: 'meta' };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    const components = Object.entries(params).map(([key, value]) => ({
      type: 'body' as const,
      parameters: [{ type: 'text' as const, text: value }],
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components,
        },
      }),
    });

    const result = await response.json<any>();

    if (!response.ok) {
      console.error('[Meta] Failed to send template:', result);
      throw new Error(`Meta template error: ${result.error?.message || response.statusText}`);
    }

    return { messageId: result.messages?.[0]?.id || 'unknown', provider: 'meta' };
  }
}

// ============================================================
// WhatsApp Provider Factory
// ============================================================

export function createWhatsAppProvider(config: WhatsAppConfig): NotificationChannel {
  switch (config.provider) {
    case 'twilio':
      return new TwilioWhatsAppProvider(config.credentials);
    case 'meta':
      return new MetaWhatsAppProvider(config.credentials);
    default:
      console.warn(`Unknown WhatsApp provider "${config.provider}". Defaulting to Twilio.`);
      return new TwilioWhatsAppProvider(config.credentials);
  }
}

// ============================================================
// Email Providers
// ============================================================

/**
 * Resend Email Provider
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */
export class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private fromEmail: string;

  constructor(config: EmailConfig['credentials']) {
    this.apiKey = config.apiKey || '';
    this.fromEmail = config.fromEmail || 'noreply@skincareclinic.com';

    if (!this.apiKey) {
      console.warn('ResendEmailProvider: Missing API key');
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
    if (!this.apiKey) {
      console.log(`[Resend Mock] Would send email to ${to}: ${subject}`);
      return { messageId: `mock-${Date.now()}`, provider: 'resend' };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to,
        subject,
        html,
      }),
    });

    const result = await response.json<any>();

    if (!response.ok) {
      console.error('[Resend] Failed to send email:', result);
      throw new Error(`Resend error: ${result.message || response.statusText}`);
    }

    return { messageId: result.id, provider: 'resend' };
  }
}

// ============================================================
// Email Provider Factory
// ============================================================

export function createEmailProvider(config: EmailConfig): EmailProvider {
  switch (config.provider) {
    case 'resend':
      return new ResendEmailProvider(config.credentials);
    case 'sendgrid':
    case 'mailgun':
      console.warn(`Email provider "${config.provider}" not yet implemented. Defaulting to Resend.`);
      return new ResendEmailProvider(config.credentials);
    default:
      console.warn(`Unknown email provider "${config.provider}". Defaulting to Resend.`);
      return new ResendEmailProvider(config.credentials);
  }
}
