# Roadmap — Dermatology Clinic Management System

## Milestone 1: MVP — Core Booking, Dashboard & Automation

**Goal:** Production-ready web app + backend for a small dermatology clinic. Support website marketing pages, online appointment requests, staff dashboard (CMS), and WhatsApp+email automation.

### Phase 01: Foundation (project setup, DB, config)

**Goal:** Project structure, tooling config, D1 database schema + migrations, core TypeScript types, and Worker entry point.

**Requirements:**
- [FOUND-01] Create monorepo with worker/ and frontend/ directories
- [FOUND-02] Configure wrangler.toml with D1, R2, and env bindings
- [FOUND-03] Write D1 migration SQL (patients, appointments, feedback, follow_ups, staff_users, appointment_logs)
- [FOUND-04] Define TypeScript types/interfaces matching DB schema
- [FOUND-05] Set up Worker entry point with request routing

**Plans:** 2 plans

---

### Phase 02: Core Business Logic (services, channel abstraction)

**Goal:** Channel-agnostic business logic services (appointment, patient, feedback, follow-up, availability). Notification dispatcher that routes to WhatsApp/Email via abstract interfaces.

**Requirements:**
- [CORE-01] Implement PatientService (create, find, update)
- [CORE-02] Implement AppointmentService (request, confirm, cancel, complete, check-in, list)
- [CORE-03] Implement AvailabilityService (check slot availability)
- [CORE-04] Implement FeedbackService (create, list)
- [CORE-05] Implement FollowUpService (create, list, complete)
- [CORE-06] Define Channel interface and implement WhatsApp + Email providers
- [CORE-07] Implement NotificationService with channel dispatch

**Plans:** 2 plans

---

### Phase 03: API Routes

**Goal:** All REST API endpoints — public, staff, and webhook routes — with validation and error handling.

**Requirements:**
- [API-01] POST /api/public/appointments/request
- [API-02] POST /api/public/appointments/confirm
- [API-03] POST /api/webhooks/whatsapp
- [API-04] POST /api/webhooks/email-feedback
- [API-05] GET /api/staff/appointments?date=
- [API-06] POST /api/staff/appointments (create manually)
- [API-07] POST /api/staff/appointments/:id/check-in
- [API-08] POST /api/staff/appointments/:id/complete
- [API-09] GET /api/staff/patients/:id
- [API-10] GET /api/staff/follow-ups
- [API-11] POST /api/staff/follow-ups
- [API-12] POST /api/staff/follow-ups/:id/complete
- [API-13] Staff auth middleware (JWT-based)

**Plans:** 2 plans

---

### Phase 04: Public Website Frontend

**Goal:** Landing page with hero, services, doctor profile, testimonials, and appointment request form. SPA deployed on Cloudflare Pages.

**Requirements:**
- [WEB-01] Landing page with clinic branding (hero, services, testimonials)
- [WEB-02] Appointment request form with validation
- [WEB-03] Confirmation/success screen after submission
- [WEB-04] Responsive design (mobile-first)
- [WEB-05] Deployable to Cloudflare Pages

**Plans:** 2 plans

---

### Phase 05: Staff Dashboard Frontend

**Goal:** Protected SPA for clinic staff — today's appointments, patient details, follow-up management. Basic JWT login.

**Requirements:**
- [DASH-01] Login screen with email/password
- [DASH-02] Today's appointments list with status filter
- [DASH-03] Check-in and Complete action buttons
- [DASH-04] Patient detail page (info + history)
- [DASH-05] Follow-ups tab (list, complete, add notes)
- [DASH-06] Responsive dashboard layout

**Plans:** 2 plans

---

### Phase 06: Automation & Workflows

**Goal:** WhatsApp/Email channel integrations wired up. Stubs for Cloudflare Workflows (reminders, post-visit feedback). Conversation logic for WhatsApp booking flow.

**Requirements:**
- [AUTO-01] WhatsApp webhook message parser/conversation router
- [AUTO-02] Email notification sender integration
- [AUTO-03] Post-visit feedback trigger mechanism (stub)
- [AUTO-04] Appointment reminder mechanism (stub)
- [AUTO-05] Workflows interface definitions for Phase 2

**Plans:** 1 plan

---

## Phase Dependency Graph

```
Phase 01 (Foundation) ──┐
                        ├──> Phase 02 (Core Services) ──> Phase 03 (API Routes) ──┐
Phase 04 (Public Web) ──┘                                                         │
                                                                                  ├──> Phase 06 (Automation)
Phase 05 (Staff Dash) ────────────────────────────────────────────────────────────┘
```

Phases 01-03 are backend (sequential dependency).
Phases 04-05 are frontend (parallel, depend on Phase 01 structure + Phase 03 API).
Phase 06 depends on all preceding phases.

## Future Milestones (Post-MVP)

- Milestone 2: Phone call automation (Retell AI integration)
- Milestone 3: AI sentiment analysis on feedback
- Milestone 4: Image uploads (R2), before/after photos
- Milestone 5: Multi-doctor scheduling, advanced analytics
