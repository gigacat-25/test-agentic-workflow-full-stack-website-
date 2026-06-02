// ============================================================
// Public API Routes
//
// No authentication required. Used by web forms and external callers.
// ============================================================

import { IRequest } from 'itty-router';
import { AppServices } from '../index';
import { validateRequired, validatePhone, validateEmail, sanitizeString, sanitizePhone } from '../middleware/validation';
import { badRequest } from '../utils/errors';
import { AppointmentSource } from '../db/schema';

export function registerPublicRoutes(router: any, services: AppServices): void {
  const { patientService, appointmentService, availabilityService } = services;

  // ============================================================
  // POST /api/public/appointments/request
  // Called by web form and WhatsApp handler
  // ============================================================
  router.post('/api/public/appointments/request', async (request: IRequest) => {
    const body = (await request.json?.() || {}) as Record<string, any>;

    // Validate required fields
    validateRequired(body, ['name', 'serviceType', 'preferredDate']);

    const name = sanitizeString(body.name as string);
    const phone = body.phone ? sanitizePhone(body.phone as string) : undefined;
    const email = body.email ? (body.email as string).toLowerCase().trim() : undefined;
    const serviceType = (body.serviceType as string).toLowerCase();
    const preferredDate = body.preferredDate as string;
    const preferredTimeRange = body.preferredTimeRange as string || 'morning';
    const notes = body.notes ? sanitizeString(body.notes as string) : undefined;
    const source = (body.source as AppointmentSource) || 'web_form';

    // Validate contact method
    if (!phone && !email) {
      throw badRequest('At least one contact method (phone or email) is required');
    }

    // Validate service type
    const validServices = ['skin', 'hair', 'other'];
    if (!validServices.includes(serviceType)) {
      throw badRequest(`Invalid service type. Must be one of: ${validServices.join(', ')}`);
    }

    // Validate phone format if provided
    if (phone && !validatePhone(phone)) {
      throw badRequest('Invalid phone number format');
    }

    // Validate email format if provided
    if (email && !validateEmail(email)) {
      throw badRequest('Invalid email format');
    }

    // Create or find patient
    const patientData: any = { name };
    if (phone) patientData.phone = phone;
    if (email) patientData.email = email;
    patientData.preferred_channel = phone && email ? 'both' : phone ? 'whatsapp' : 'email';

    const patient = await patientService.create(patientData);

    // Parse time preference
    const timeSlot = availabilityService.parseTimePreference(preferredTimeRange);

    if (!timeSlot) {
      throw badRequest('Could not parse preferred time. Please specify morning, afternoon, evening, or a specific time range (e.g., "10:00-11:00").');
    }

    // Calculate start and end times
    const startTime = new Date(`${preferredDate}T${timeSlot.start}:00`).toISOString();
    const endTime = new Date(`${preferredDate}T${timeSlot.end}:00`).toISOString();

    // Check availability
    const isAvailable = await availabilityService.isSlotAvailable(preferredDate, timeSlot.start, timeSlot.end);

    // Get all available slots for reference
    const availableSlots = await availabilityService.getAvailableSlots(preferredDate, serviceType);

    if (!isAvailable) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'The requested time slot is not available. Please see available slots below.',
          patient: { id: patient.id, name: patient.name },
          availableSlots,
          preferredSlot: timeSlot,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Create the appointment with 'confirmed' status for web forms
    // (WhatsApp flow will use 'requested' and wait for patient confirmation)
    const appointment = await appointmentService.request({
      patientId: patient.id,
      serviceType: serviceType as any,
      startTime,
      endTime,
      source,
      notes,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Appointment request submitted successfully',
        appointment,
        patient: { id: patient.id, name: patient.name, phone: patient.phone, email: patient.email },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // POST /api/public/appointments/confirm
  // Confirm a requested appointment
  // ============================================================
  router.post('/api/public/appointments/confirm', async (request: IRequest) => {
    const body = (await request.json?.() || {}) as Record<string, any>;
    validateRequired(body, ['appointmentId']);

    const appointmentId = body.appointmentId as string;
    const appointment = await appointmentService.confirm(appointmentId);

    // Send notification (fire and forget)
    try {
      const patient = await patientService.findById(appointment.patient_id);
      if (patient) {
        // We'd call notificationService here but it's async — fire and forget
        services.notificationService.sendAppointmentConfirmation(appointment, patient).catch(e => {
          console.error('[Notification] Failed to send confirmation:', e);
        });
      }
    } catch (err) {
      console.error('[Notification] Error sending confirmation:', err);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Appointment confirmed', appointment }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // POST /api/public/appointments/cancel
  // Cancel an appointment
  // ============================================================
  router.post('/api/public/appointments/cancel', async (request: IRequest) => {
    const body = (await request.json?.() || {}) as Record<string, any>;
    validateRequired(body, ['appointmentId']);

    const appointmentId = body.appointmentId as string;
    const appointment = await appointmentService.cancel(appointmentId, body.reason as string);

    // Send notification (fire and forget)
    try {
      const patient = await patientService.findById(appointment.patient_id);
      if (patient) {
        services.notificationService.sendAppointmentCancellation(appointment, patient).catch(e => {
          console.error('[Notification] Failed to send cancellation notice:', e);
        });
      }
    } catch (err) {
      console.error('[Notification] Error sending cancellation notice:', err);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Appointment cancelled', appointment }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // GET /api/public/availability?date=YYYY-MM-DD&serviceType=skin
  // Get available time slots
  // ============================================================
  router.get('/api/public/availability', async (request: IRequest) => {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const serviceType = url.searchParams.get('serviceType') || undefined;

    if (!date) {
      throw badRequest('Date parameter is required (YYYY-MM-DD)');
    }

    const slots = await availabilityService.getAvailableSlots(date, serviceType);

    return new Response(
      JSON.stringify({
        success: true,
        date,
        serviceType: serviceType || 'any',
        slots,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // GET /api/public/health
  // Simple health check
  // ============================================================
  // (Handled at the router level in index.ts)

  // ============================================================
  // GET /api/public/test-email
  // Trigger a test email via the Notification Service
  // ============================================================
  router.get('/api/public/test-email', async (request: IRequest) => {
    const mockPatient = {
      id: 'test-patient-id',
      name: 'Test Patient',
      phone: null,
      email: 'thejaswinps@gmail.com',
      preferred_channel: 'email' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const mockAppointment = {
      id: 'test-appointment-id',
      patient_id: 'test-patient-id',
      doctor_id: null,
      service_type: 'skin' as const,
      status: 'confirmed' as const,
      source: 'web_form' as const,
      start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
      notes: 'Test email run',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await services.notificationService.sendAppointmentConfirmation(mockAppointment, mockPatient);

    return new Response(
      JSON.stringify({ success: true, message: 'Test email triggered to thejaswinps@gmail.com via notificationService' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });
}
