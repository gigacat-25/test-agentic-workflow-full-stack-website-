// ============================================================
// Webhook Routes
//
// Handles incoming webhooks from external services.
// ============================================================

import { IRequest } from 'itty-router';
import { AppServices } from '../index';
import { badRequest } from '../utils/errors';
import { generateId } from '../db/client';

// In-memory conversation state store for WhatsApp.
// In production, use KV for persistence.
const conversationStore = new Map<string, {
  state: string;
  data: Record<string, unknown>;
  expiresAt: number;
}>();

// Conversation states
const CONV_STATES = {
  IDLE: 'IDLE',
  AWAITING_ISSUE: 'AWAITING_ISSUE',
  AWAITING_DATE: 'AWAITING_DATE',
  AWAITING_TIME: 'AWAITING_TIME',
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
  AWAITING_FEEDBACK: 'AWAITING_FEEDBACK',
};

export function registerWebhookRoutes(router: any, services: AppServices): void {
  const { patientService, appointmentService, feedbackService, availabilityService } = services;

  // ============================================================
  // GET /api/webhooks/whatsapp
  // Meta WhatsApp Cloud API webhook verification
  // ============================================================
  router.get('/api/webhooks/whatsapp', async (request: IRequest) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    // Verify token should match your configured webhook verify token
    const expectedToken = 'skincare-clinic-webhook-2024'; // TODO: Move to env var

    if (mode === 'subscribe' && token === expectedToken) {
      return new Response(challenge, { status: 200 });
    }

    return new Response('Verification failed', { status: 403 });
  });

  // ============================================================
  // POST /api/webhooks/whatsapp
  // Handle incoming WhatsApp messages (Twilio & Meta formats)
  // ============================================================
  router.post('/api/webhooks/whatsapp', async (request: IRequest) => {
    let from: string;
    let text: string;
    let messageId: string;

    // Try to parse as JSON body (Meta format)
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('json')) {
      const body = await request.json<any>();

      // Meta WhatsApp Cloud API format
      if (body.entry && body.entry[0]?.changes?.[0]?.value?.messages) {
        const message = body.entry[0].changes[0].value.messages[0];
        from = message.from;
        text = message.text?.body || '';
        messageId = message.id;
      } else if (body.messages) {
        // Alternative Meta format
        const message = body.messages[0];
        from = message.from;
        text = message.text?.body || '';
        messageId = message.id;
      } else {
        return new Response('Unrecognized webhook format', { status: 400 });
      }
    } else {
      // Form-encoded (Twilio format)
      const formData = await request.formData?.() || new FormData();
      from = (formData.get('From') as string || '').replace('whatsapp:', '');
      text = formData.get('Body') as string || '';
      messageId = formData.get('MessageSid') as string || '';
    }

    if (!from || !text) {
      return new Response('Missing from or body', { status: 400 });
    }

    // Process the message through conversation handler
    const reply = await handleWhatsAppMessage(from, text, services);

    // Send reply via WhatsApp provider
    try {
      await services.notificationService['whatsappProvider'].sendTextMessage(from, reply);
    } catch (err) {
      console.error('[Webhook] Failed to send WhatsApp reply:', err);
    }

    // Return 200 OK (Twilio expects this; Meta doesn't care)
    return new Response('OK', { status: 200 });
  });

  // ============================================================
  // POST /api/webhooks/whatsapp/status
  // Delivery status callbacks
  // ============================================================
  router.post('/api/webhooks/whatsapp/status', async (request: IRequest) => {
    // Acknowledge delivery status updates
    // In production, log these for delivery analytics
    return new Response('OK', { status: 200 });
  });

  // ============================================================
  // POST /api/webhooks/email-feedback
  // Feedback submitted via email link
  // ============================================================
  router.post('/api/webhooks/email-feedback', async (request: IRequest) => {
    const body = (await request.json?.() || {}) as Record<string, any>;

    if (!body.appointmentId) {
      throw badRequest('appointmentId is required');
    }

    const feedback = await feedbackService.create({
      appointmentId: body.appointmentId,
      rating: body.rating ? parseInt(body.rating as string, 10) : undefined,
      comment: body.comment as string,
      sentiment: 'unknown',
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Feedback received', feedback }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // GET /api/webhooks/email-feedback (for link-based feedback)
  // ============================================================
  router.get('/api/webhooks/email-feedback', async (request: IRequest) => {
    const url = new URL(request.url);
    const appointmentId = url.searchParams.get('appointmentId');
    const rating = url.searchParams.get('rating');
    const comment = url.searchParams.get('comment');

    if (!appointmentId) {
      return new Response('Missing appointment ID', { status: 400 });
    }

    const feedback = await feedbackService.create({
      appointmentId,
      rating: rating ? parseInt(rating, 10) : undefined,
      comment: comment || undefined,
      sentiment: 'unknown',
    });

    // Return a simple HTML confirmation page
    const html = `<!DOCTYPE html>
    <html>
    <head><title>Feedback Submitted</title>
    <style>body{font-family:sans-serif;max-width:500px;margin:50px auto;padding:20px;text-align:center}
    .success{color:#0D7C66;font-size:48px;margin-bottom:16px}
    </style></head>
    <body>
      <div class="success">✓</div>
      <h1>Thank you for your feedback!</h1>
      <p>We appreciate you taking the time to share your experience.</p>
    </body>
    </html>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  });
}

// ============================================================
// WhatsApp Conversation Handler
// ============================================================

async function handleWhatsAppMessage(
  from: string,
  text: string,
  services: AppServices,
): Promise<string> {
  const { patientService, appointmentService, feedbackService, availabilityService } = services;
  const normalizedText = text.toLowerCase().trim();
  const clinicName = 'SkinCare Clinic'; // TODO: Pass from env

  // Get or create conversation state
  let conv = conversationStore.get(from);
  const now = Date.now();

  // Clean up old conversations
  if (conv && conv.expiresAt < now) {
    conversationStore.delete(from);
    conv = undefined;
  }

  if (!conv) {
    conv = { state: CONV_STATES.IDLE, data: {}, expiresAt: now + 30 * 60 * 1000 }; // 30 min TTL
    conversationStore.set(from, conv);
  }

  // ============================================================
  // State machine for conversation flow
  // ============================================================

  if (conv.state === CONV_STATES.IDLE) {
    // Check for booking intent
    if (/book|appoint|schedule|visit/i.test(normalizedText)) {
      conv.state = CONV_STATES.AWAITING_ISSUE;
      conversationStore.set(from, conv);
      return `Welcome to ${clinicName}! 👋\n\nWhat is the issue you'd like to address?\nReply: SKIN, HAIR, or OTHER`;
    }

    // Check for cancel intent
    if (/cancel|reschedule/i.test(normalizedText)) {
      try {
        const patient = await patientService.findByPhone(from);
        if (!patient) {
          return `I couldn't find an account with this number. To book, reply: BOOK`;
        }
        const upcoming = await services.appointmentService.getUpcomingByPatientId(patient.id);
        if (!upcoming) {
          return `You don't have any upcoming appointments to cancel. To book, reply: BOOK`;
        }
        await services.appointmentService.cancel(upcoming.id, 'Cancelled via WhatsApp');
        // Send notification
        services.notificationService.sendAppointmentCancellation(upcoming, patient).catch(() => {});
        const dateStr = new Date(upcoming.start_time).toLocaleDateString();
        return `✅ Your appointment on ${dateStr} has been cancelled. To book a new one, reply: BOOK`;
      } catch (err: any) {
        return `Sorry, I couldn't cancel your appointment: ${err.message}`;
      }
    }

    // Check for feedback intent
    if (/feedback|review|comment/i.test(normalizedText)) {
      conv.state = CONV_STATES.AWAITING_FEEDBACK;
      conversationStore.set(from, conv);
      return `We'd love to hear about your experience! Please share your feedback. If you'd like to rate us 1-5, include a number in your message.`;
    }

    // Check for numeric rating (direct feedback)
    const numMatch = normalizedText.match(/^(\d)$/);
    if (numMatch && parseInt(numMatch[1]) >= 1 && parseInt(numMatch[1]) <= 5) {
      conv.state = CONV_STATES.AWAITING_FEEDBACK;
      conv.data.rating = parseInt(numMatch[1]);
      conversationStore.set(from, conv);
      return `Thanks for the ${numMatch[1]}-star rating! Would you like to add any comments?`;
    }

    // Default menu
    return `Welcome to ${clinicName}! 🌟\n\nReply:\n• BOOK — Schedule an appointment\n• CANCEL — Cancel a booking\n• FEEDBACK — Leave a review`;
  }

  if (conv.state === CONV_STATES.AWAITING_ISSUE) {
    if (/skin|acne|rash|mole/i.test(normalizedText)) {
      conv.data.serviceType = 'skin';
    } else if (/hair|scalp|bald/i.test(normalizedText)) {
      conv.data.serviceType = 'hair';
    } else if (/other|general|check/i.test(normalizedText)) {
      conv.data.serviceType = 'other';
    } else {
      return `I didn't quite catch that. Please reply with: SKIN, HAIR, or OTHER`;
    }

    conv.state = CONV_STATES.AWAITING_DATE;
    conversationStore.set(from, conv);
    return `Thanks! What date would you prefer? (e.g., "tomorrow", "Monday", or a specific date like "June 15")`;
  }

  if (conv.state === CONV_STATES.AWAITING_DATE) {
    const date = parseDateText(normalizedText);

    if (!date) {
      return `I couldn't understand that date. Please try again (e.g., "tomorrow", "Monday", "June 15", or "2026-06-15")`;
    }

    conv.data.date = date;
    conv.state = CONV_STATES.AWAITING_TIME;
    conversationStore.set(from, conv);
    return `Great! What time works best?\n\n• MORNING (9 AM - 12 PM)\n• AFTERNOON (12 PM - 4 PM)\n• EVENING (4 PM - 6 PM)\n\nOr reply with a specific time like "10:00"`;
  }

  if (conv.state === CONV_STATES.AWAITING_TIME) {
    const timeSlot = availabilityService.parseTimePreference(normalizedText);

    if (!timeSlot) {
      return `I didn't understand that time. Please reply with:\n• MORNING\n• AFTERNOON\n• EVENING\n• Or a specific time like "10:00"`;
    }

    const date = conv.data.date as string;
    const serviceType = conv.data.serviceType as string;

    // Check availability
    const isAvailable = await availabilityService.isSlotAvailable(date, timeSlot.start, timeSlot.end);

    if (!isAvailable) {
      const slots = await availabilityService.getAvailableSlots(date, serviceType);
      if (slots.length === 0) {
        return `Sorry, there are no available slots on that day. Please reply with a different date.`;
      }
      const slotList = slots.map((s: any) => `${s.start} - ${s.end}`).join('\n');
      return `That slot is taken. Available times:\n${slotList}\n\nReply with your preferred time.`;
    }

    conv.data.startTime = `${date}T${timeSlot.start}:00`;
    conv.data.endTime = `${date}T${timeSlot.end}:00`;
    conv.state = CONV_STATES.AWAITING_CONFIRMATION;
    conversationStore.set(from, conv);

    const dateStr = new Date(`${date}T${timeSlot.start}:00`).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    return `We have a slot on ${dateStr} at ${timeSlot.start}! 🎉\n\nDoes that work for you?\nReply: YES to confirm, NO to try a different time.`;
  }

  if (conv.state === CONV_STATES.AWAITING_CONFIRMATION) {
    if (/yes|confirm|sure|ok|yup|yeah|great/i.test(normalizedText)) {
      // Find or create patient
      const patient = await patientService.findOrCreateByPhone(from, conv.data.name as string || 'WhatsApp Patient');

      try {
        const appointment = await services.appointmentService.createConfirmed({
          patientId: patient.id,
          serviceType: (conv.data.serviceType as string) as any || 'skin',
          startTime: conv.data.startTime as string,
          endTime: conv.data.endTime as string,
          source: 'whatsapp',
        });

        // Send confirmation notification
        services.notificationService.sendAppointmentConfirmation(appointment, patient).catch(() => {});

        // Clear conversation
        conversationStore.delete(from);

        const dateStr = new Date(appointment.start_time).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
        });
        const timeStr = new Date(appointment.start_time).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit',
        });

        return `✅ Your appointment is confirmed!\n\n📅 ${dateStr}\n⏰ ${timeStr}\n📍 ${clinicName}\n\nWe'll send you a reminder. Reply CANCEL if you need to reschedule.`;
      } catch (err: any) {
        return `Sorry, something went wrong: ${err.message}. Please try again or call the clinic.`;
      }
    }

    if (/no|different|change|other/i.test(normalizedText)) {
      conv.state = CONV_STATES.AWAITING_TIME;
      conversationStore.set(from, conv);
      return `No problem! What time works better for you?\n\n• MORNING (9 AM - 12 PM)\n• AFTERNOON (12 PM - 4 PM)\n• EVENING (4 PM - 6 PM)`;
    }

    return `Please reply YES to confirm or NO to try a different time.`;
  }

  if (conv.state === CONV_STATES.AWAITING_FEEDBACK) {
    let rating: number | undefined = conv.data.rating as number | undefined;
    let comment: string | undefined;

    // Extract rating from message
    const numMatch = normalizedText.match(/(\d)/);
    if (numMatch) {
      const parsed = parseInt(numMatch[1], 10);
      if (parsed >= 1 && parsed <= 5) {
        rating = parsed;
      }
    }

    // Strip the number from the comment
    comment = text.replace(/\d/g, '').trim() || undefined;

    try {
      const patient = await patientService.findByPhone(from);
      if (patient) {
        const appointments = await services.appointmentService.getByPatientId(patient.id);
        const completedAppts = appointments.filter(a => a.status === 'completed');
        if (completedAppts.length > 0) {
          await feedbackService.create({
            appointmentId: completedAppts[0].id,
            rating,
            comment,
            sentiment: 'unknown',
          });
        }
      }
    } catch (err) {
      console.error('[WhatsApp] Failed to store feedback:', err);
    }

    conversationStore.delete(from);
    return `Thank you for your feedback! We truly appreciate it. 🙏\n\nIf you need anything else, just reply BOOK or CANCEL.`;
  }

  // Fallback
  return `I didn't understand that. Reply:\n• BOOK — Schedule an appointment\n• CANCEL — Cancel a booking\n• FEEDBACK — Leave a review`;
}

// ============================================================
// Date Parsing Helper
// ============================================================

function parseDateText(text: string): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // "today"
  if (/^today$/.test(text)) {
    return formatDate(today);
  }

  // "tomorrow"
  if (/^tomorrow|tmr|tmrw/.test(text)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }

  // Day names: "monday", "tuesday", etc.
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < dayNames.length; i++) {
    if (text.startsWith(dayNames[i])) {
      const targetDay = i; // 0=Sunday
      const currentDay = today.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7; // Next week
      const date = new Date(today);
      date.setDate(date.getDate() + daysUntil);
      return formatDate(date);
    }
  }

  // "next monday", "next tuesday" etc.
  const nextMatch = text.match(/next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
  if (nextMatch) {
    const targetDay = dayNames.indexOf(nextMatch[1]);
    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    daysUntil += 7; // "next" means the one after this week
    const date = new Date(today);
    date.setDate(date.getDate() + daysUntil);
    return formatDate(date);
  }

  // "June 15", "15 June", "Jun 15"
  const dateMatch = text.match(/(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (dateMatch) {
    const monthAbbr = dateMatch[1].substring(0, 3);
    const day = parseInt(dateMatch[2], 10);
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIndex = monthNames.indexOf(monthAbbr.toLowerCase());
    if (monthIndex >= 0) {
      const date = new Date(today.getFullYear(), monthIndex, day);
      if (date >= today) return formatDate(date);
      // Try next year
      date.setFullYear(date.getFullYear() + 1);
      return formatDate(date);
    }
  }

  // "2026-06-15" (ISO format)
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    if (!isNaN(date.getTime())) return formatDate(date);
  }

  // "15/06/2026" or "06/15/2026"
  const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    // Try MM/DD/YYYY
    const date1 = new Date(parseInt(slashMatch[3]), parseInt(slashMatch[1]) - 1, parseInt(slashMatch[2]));
    if (!isNaN(date1.getTime()) && date1 >= today) return formatDate(date1);
    // Try DD/MM/YYYY
    const date2 = new Date(parseInt(slashMatch[3]), parseInt(slashMatch[2]) - 1, parseInt(slashMatch[1]));
    if (!isNaN(date2.getTime())) return formatDate(date2);
  }

  return null;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
