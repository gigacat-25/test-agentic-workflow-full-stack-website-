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

/**
 * Gmail OAuth 2.0 Email Provider
 * Docs: https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send
 */
export class GmailEmailProvider implements EmailProvider {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private senderEmail: string;

  constructor(config: EmailConfig['credentials']) {
    this.clientId = config.clientId || '';
    this.clientSecret = config.clientSecret || '';
    this.refreshToken = config.refreshToken || '';
    this.senderEmail = config.senderEmail || '';

    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      console.warn('GmailEmailProvider: Missing Google OAuth credentials');
    }
  }

  private async getAccessToken(): Promise<string> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    const data = await response.json<any>();
    if (!response.ok) {
      console.error('[Gmail OAuth] Token refresh failed:', data);
      throw new Error(`Gmail OAuth token error: ${data.error_description || response.statusText}`);
    }

    return data.access_token;
  }

  async sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
    if (!this.clientId) {
      console.log(`[Gmail Mock] Would send email to ${to}: ${subject}`);
      return { messageId: `mock-${Date.now()}`, provider: 'gmail' };
    }

    const accessToken = await this.getAccessToken();

    // Construct raw MIME email
    const emailLines = [
      `From: ${this.senderEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      html
    ];
    const rawEmail = emailLines.join('\r\n');
    
    // Web-safe base64 encoding (RFC 4648)
    const utf8Bytes = new TextEncoder().encode(rawEmail);
    let binary = '';
    const len = utf8Bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const encodedEmail = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    });

    const result = await response.json<any>();

    if (!response.ok) {
      console.error('[Gmail] Failed to send email:', result);
      throw new Error(`Gmail error: ${result.error?.message || response.statusText}`);
    }

    return { messageId: result.id, provider: 'gmail' };
  }
}

// ============================================================
// Email Provider Factory
// ============================================================

export function createEmailProvider(config: EmailConfig): EmailProvider {
  switch (config.provider) {
    case 'resend':
      return new ResendEmailProvider(config.credentials);
    case 'gmail':
      return new GmailEmailProvider(config.credentials);
    case 'sendgrid':
    case 'mailgun':
      console.warn(`Email provider "${config.provider}" not yet implemented. Defaulting to Resend.`);
      return new ResendEmailProvider(config.credentials);
    default:
      console.warn(`Unknown email provider "${config.provider}". Defaulting to Resend.`);
      return new ResendEmailProvider(config.credentials);
  }
}
