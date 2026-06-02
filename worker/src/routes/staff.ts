// ============================================================
// Staff API Routes
//
// JWT-authenticated endpoints for the staff dashboard.
// ============================================================

import { IRequest } from 'itty-router';
import bcrypt from 'bcryptjs';
import { AppServices, RequestWithStaff } from '../index';
import { createAuthMiddleware, generateToken } from '../middleware/auth';
import { validateRequired } from '../middleware/validation';
import { badRequest, unauthorized } from '../utils/errors';
import { StaffRole } from '../db/schema';
import { generateId } from '../db/client';

export function registerStaffRoutes(router: any, services: AppServices, jwtSecret: string): void {
  const { patientService, appointmentService, followUpService, feedbackService } = services;
  const { withAuth, withRoles } = createAuthMiddleware(jwtSecret);

  // ============================================================
  // POST /api/staff/auth/login
  // ============================================================
  router.post('/api/staff/auth/login', async (request: IRequest) => {
    const body = (await request.json?.() || {}) as Record<string, any>;
    validateRequired(body, ['email', 'password']);

    const email = (body.email as string).toLowerCase().trim();
    const password = body.password as string;

    // Find staff user by email
    const db = (request as any).env?.DB;
    // We need DB access — in itty-router, env is passed as second arg
    const env = (request as any).env;
    if (!env?.DB) {
      throw unauthorized('Database not available');
    }

    const staffUser = (await env.DB
      .prepare('SELECT * FROM staff_users WHERE email = ?')
      .bind(email)
      .first()) as any;

    if (!staffUser) {
      throw unauthorized('Invalid email or password');
    }

    // Compare password
    const isValid = bcrypt.compareSync(password, staffUser.password_hash);
    if (!isValid) {
      throw unauthorized('Invalid email or password');
    }

    // Generate JWT
    const token = await generateToken(
      { staffUserId: staffUser.id, role: staffUser.role as StaffRole },
      jwtSecret,
    );

    return new Response(
      JSON.stringify({
        success: true,
        token,
        staffUser: {
          id: staffUser.id,
          name: staffUser.name,
          role: staffUser.role,
          email: staffUser.email,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // GET /api/staff/appointments?date=YYYY-MM-DD&status=confirmed
  // ============================================================
  router.get('/api/staff/appointments', withAuth, async (request: any) => {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const status = url.searchParams.get('status') || undefined;

    const appointments = await appointmentService.getByDate(date, status);

    return new Response(
      JSON.stringify({ success: true, appointments, date }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // POST /api/staff/appointments
  // Staff creates an appointment manually
  // ============================================================
  router.post('/api/staff/appointments', withAuth, async (request: any) => {
    const body = (await request.json?.() || {}) as Record<string, any>;
    validateRequired(body, ['serviceType', 'startTime', 'endTime']);

    let patientId = body.patientId as string;

    // If no patientId but patient info provided, create patient
    if (!patientId && (body.name || body.phone || body.email)) {
      const patient = await patientService.create({
        name: body.name || 'Unknown',
        phone: body.phone,
        email: body.email,
      });
      patientId = patient.id;
    }

    if (!patientId) {
      throw badRequest('Either patientId or patient info (name, phone, email) must be provided');
    }

    const appointment = await appointmentService.createManual({
      patientId,
      doctorId: body.doctorId,
      serviceType: body.serviceType,
      startTime: body.startTime,
      endTime: body.endTime,
      source: 'staff_manual',
      notes: body.notes,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Appointment created', appointment }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // POST /api/staff/appointments/:id/check-in
  // ============================================================
  router.post('/api/staff/appointments/:id/check-in', withAuth, async (request: any) => {
    const appointmentId = request.params?.id;
    if (!appointmentId) throw badRequest('Appointment ID required');

    const staffUserId = request.staffUser?.id;
    const appointment = await appointmentService.checkIn(appointmentId, staffUserId);

    return new Response(
      JSON.stringify({ success: true, message: 'Patient checked in', appointment }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // POST /api/staff/appointments/:id/complete
  // ============================================================
  router.post('/api/staff/appointments/:id/complete', withAuth, async (request: any) => {
    const appointmentId = request.params?.id;
    if (!appointmentId) throw badRequest('Appointment ID required');

    const staffUserId = request.staffUser?.id;
    const appointment = await appointmentService.complete(appointmentId, staffUserId);

    return new Response(
      JSON.stringify({ success: true, message: 'Appointment completed', appointment }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // POST /api/staff/appointments/:id/cancel
  // ============================================================
  router.post('/api/staff/appointments/:id/cancel', withAuth, async (request: any) => {
    const appointmentId = request.params?.id;
    if (!appointmentId) throw badRequest('Appointment ID required');

    const body = (await request.json?.() || {}) as Record<string, any>;
    const appointment = await appointmentService.cancel(appointmentId, body.reason as string);

    return new Response(
      JSON.stringify({ success: true, message: 'Appointment cancelled', appointment }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // POST /api/staff/appointments/:id/no-show
  // ============================================================
  router.post('/api/staff/appointments/:id/no-show', withAuth, async (request: any) => {
    const appointmentId = request.params?.id;
    if (!appointmentId) throw badRequest('Appointment ID required');

    const appointment = await appointmentService.noShow(appointmentId);

    return new Response(
      JSON.stringify({ success: true, message: 'Marked as no-show', appointment }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // GET /api/staff/patients/:id
  // ============================================================
  router.get('/api/staff/patients/:id', withAuth, async (request: any) => {
    const patientId = request.params?.id;
    if (!patientId) throw badRequest('Patient ID required');

    const patient = await patientService.findById(patientId);
    if (!patient) {
      return new Response(
        JSON.stringify({ success: false, error: 'Patient not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const appointments = await appointmentService.getByPatientId(patientId);
    const feedback = await feedbackService.getByPatientId(patientId);
    const followUps = await followUpService.getByPatientId(patientId);

    return new Response(
      JSON.stringify({
        success: true,
        patient,
        appointments,
        feedback,
        followUps,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // GET /api/staff/patients?q=search
  // ============================================================
  router.get('/api/staff/patients', withAuth, async (request: any) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';

    const patients = query
      ? await patientService.search(query)
      : [];

    return new Response(
      JSON.stringify({ success: true, patients }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // GET /api/staff/follow-ups?status=pending&type=overdue
  // ============================================================
  router.get('/api/staff/follow-ups', withAuth, async (request: any) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || undefined;
    const type = url.searchParams.get('type') || undefined;

    const followUps = await followUpService.getAll(status, type);

    return new Response(
      JSON.stringify({ success: true, followUps }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // POST /api/staff/follow-ups
  // ============================================================
  router.post('/api/staff/follow-ups', withAuth, async (request: any) => {
    const body = (await request.json?.() || {}) as Record<string, any>;
    validateRequired(body, ['patientId', 'reason', 'dueDate']);

    const followUp = await followUpService.create({
      patientId: body.patientId,
      reason: body.reason,
      dueDate: body.dueDate,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Follow-up created', followUp }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  });

  // ============================================================
  // POST /api/staff/follow-ups/:id/complete
  // ============================================================
  router.post('/api/staff/follow-ups/:id/complete', withAuth, async (request: any) => {
    const followUpId = request.params?.id;
    if (!followUpId) throw badRequest('Follow-up ID required');

    const body = (await request.json?.() || {}) as Record<string, any>;
    const followUp = await followUpService.complete(followUpId, { notes: body.notes as string });

    return new Response(
      JSON.stringify({ success: true, message: 'Follow-up completed', followUp }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });
}
