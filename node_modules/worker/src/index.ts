// ============================================================
// Dermatology Clinic API — Cloudflare Worker Entry Point
// ============================================================
//
// This worker serves as the API backend for the clinic management
// system. It uses itty-router for lightweight request routing.
//
// Route structure:
//   /api/public/*   — No auth required (booking, availability)
//   /api/staff/*    — JWT auth required (dashboard operations)
//   /api/webhooks/* — Provider webhooks (WhatsApp, email)
//
// ============================================================

import { Router, IRequest, error, json } from 'itty-router';
import { AppError } from './utils/errors';
import { Env } from './db/client';
import { registerPublicRoutes } from './routes/public';
import { registerStaffRoutes } from './routes/staff';
import { registerWebhookRoutes } from './routes/webhooks';
import { ReminderWorkflow } from './workflows/reminders';
import { PostVisitWorkflow } from './workflows/post-visit';

// Re-export Workflow classes — Cloudflare requires these named exports
// to register the workflow bindings defined in wrangler.toml
export { ReminderWorkflow, PostVisitWorkflow };

// -----------------------------------------------------------------
// CORS headers for all responses
// -----------------------------------------------------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * Wrap a Response with CORS headers.
 */
function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Create a JSON response with CORS headers.
 */
function jsonResponse(data: unknown, status: number = 200): Response {
  const body = JSON.stringify(data);
  const headers = new Headers({
    'Content-Type': 'application/json;charset=UTF-8',
    ...corsHeaders,
  });
  return new Response(body, { status, headers });
}

// -----------------------------------------------------------------
// Request types for itty-router
// -----------------------------------------------------------------
export interface RequestWithStaff extends IRequest {
  staffUser?: {
    id: string;
    role: string;
  };
}

// -----------------------------------------------------------------
// Main fetch handler
// -----------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const router = Router();

      // CORS preflight
      router.options('*', () => {
        return new Response(null, { status: 204, headers: corsHeaders });
      });

      // Health check
      router.get('/api/health', () => {
        return jsonResponse({ success: true, message: 'OK', timestamp: new Date().toISOString() });
      });

      // Initialize services for this request
      // (Service instances are lightweight — created per request for isolation)
      const services = createServices(env);

      // Register route handlers with services
      registerPublicRoutes(router, services);
      registerStaffRoutes(router, services, env);
      registerWebhookRoutes(router, services);

      // Handle the request
      const response = await router.fetch(request, env, ctx);
      if (!response) {
        return jsonResponse({ success: false, error: 'Not found', code: 'NOT_FOUND' }, 404);
      }
      return withCors(response);
    } catch (err) {
      if (err instanceof AppError) {
        return jsonResponse(err.toJSON(), err.statusCode);
      }
      console.error('Unhandled error:', err);
      return jsonResponse(
        { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
        500,
      );
    }
  },

  // Scheduled (CRON) handler — triggers Cloudflare Workflows for
  // durable, retryable execution of reminders and feedback requests.
  //
  // CRON schedule (wrangler.toml):
  //   "0 8 * * *"    = 8 AM UTC daily  — day-before reminders + post-visit feedback
  //   "0 */2 * * *"  = every 2 hours   — hour-before reminders
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const hour = new Date(event.scheduledTime).getUTCHours();
    const triggeredAt = new Date(event.scheduledTime).toISOString();

    if (hour === 8) {
      // 8 AM UTC daily: send day-before reminders + post-visit feedback
      ctx.waitUntil(
        env.REMINDER_WORKFLOW.create({
          params: { reminderType: 'day_before' },
        }),
      );
      ctx.waitUntil(
        env.POST_VISIT_WORKFLOW.create({
          params: { triggeredAt },
        }),
      );
    } else {
      // Every 2 hours: send hour-before reminders
      ctx.waitUntil(
        env.REMINDER_WORKFLOW.create({
          params: { reminderType: 'hour_before' },
        }),
      );
    }
  },
};

// -----------------------------------------------------------------
// Service factory — creates all service instances for a request
// -----------------------------------------------------------------
import { PatientService } from './services/patient.service';
import { AppointmentService } from './services/appointment.service';
import { AvailabilityService } from './services/availability.service';
import { FeedbackService } from './services/feedback.service';
import { FollowUpService } from './services/follow-up.service';
import { NotificationService } from './services/notification.service';
import { createWhatsAppProvider, createEmailProvider } from './channels/whatsapp';

export interface AppServices {
  patientService: PatientService;
  appointmentService: AppointmentService;
  availabilityService: AvailabilityService;
  feedbackService: FeedbackService;
  followUpService: FollowUpService;
  notificationService: NotificationService;
}

function createServices(env: Env): AppServices {
  const db = env.DB;

  const patientService = new PatientService(db);
  const appointmentService = new AppointmentService(db);
  const availabilityService = new AvailabilityService(db);
  const feedbackService = new FeedbackService(db);
  const followUpService = new FollowUpService(db);

  // Channel providers
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
      clientId: env.GOOGLE_GMAIL_CLIENT_ID || '',
      clientSecret: env.GOOGLE_GMAIL_CLIENT_SECRET || '',
      refreshToken: env.GOOGLE_GMAIL_REFRESH_TOKEN || '',
      senderEmail: env.GOOGLE_GMAIL_SENDER_EMAIL || '',
    },
  });

  const notificationService = new NotificationService(
    whatsappProvider,
    emailProvider,
    env.CLINIC_NAME,
    env.CLINIC_ADDRESS,
    env.BASE_URL,
  );

  return {
    patientService,
    appointmentService,
    availabilityService,
    feedbackService,
    followUpService,
    notificationService,
  };
}
