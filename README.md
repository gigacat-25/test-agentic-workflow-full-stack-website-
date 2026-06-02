# Dermatology Clinic Management System

A production-ready full-stack application for **Dr. Keshav's Skin, Hair, Cosmetic & Laser Clinic** (Mathikere, Bengaluru). It features a Cloudflare Workers backend coupled with D1 SQLite storage, a patient-facing booking site, and an internal staff dashboard CMS portal.

---

## 🚀 Quick Start (Local Development)

### 1. Install Workspace Dependencies
Ensure all workspace packages are installed from the root directory:
```bash
npm install
```

### 2. Apply Database Migrations
Set up your local SQLite D1 database instance by applying the initial schema migration:
```bash
npm run db:migrate -w worker
```
*This initializes the database tables (`patients`, `appointments`, `feedback`, `follow_ups`, `staff_users`, and `appointment_logs`) and inserts the default admin staff account:*
* **Username/Email**: `admin@skincareclinic.com`
* **Password**: `admin123`

### 3. Spin Up Development Servers
We have set up workspace shortcut commands in the root `package.json` to spin up local development instances:

* **Start Workers API Backend** (Port `8787`):
  ```bash
  npm run dev:worker
  ```
* **Start Public Site** (Port `5173`):
  ```bash
  npm run dev:public
  ```
* **Start Staff Dashboard CMS** (Port `5174`):
  ```bash
  npm run dev:staff
  ```

---

## 🛠️ Verification & Compilation Checks

To run compiler diagnostics and check output bundling across all monorepo workspaces:
```bash
# Typecheck TypeScript files
npm run typecheck

# Bundle production build assets
npm run build
```

---

## ☁️ Deployment to Cloudflare
 
Ensure you are logged in to wrangler (`npx wrangler login`) before deploying.
 
### 1. Create and Migrate Remote Databases (D1)
Create the database and apply the database migrations to the remote D1 instance:
```bash
# Create database
npx wrangler d1 create clinic-db

# Run schema migrations on remote DB
npm run db:migrate:prod -w worker
```
Update your `worker/wrangler.toml` file with your database ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "clinic-db"
database_id = "32eb3255-d8d1-45b0-8796-4345a539438c"
```

### 2. Configure Clerk & Google Gmail OAuth Secrets
Store your credentials securely in Cloudflare using wrangler secrets:
```bash
# Clerk JWKS URL for JWT validation
npx wrangler secret put CLERK_JWKS_URL

# Google OAuth & Gmail API Credentials
npx wrangler secret put GOOGLE_GMAIL_CLIENT_ID
npx wrangler secret put GOOGLE_GMAIL_CLIENT_SECRET
npx wrangler secret put GOOGLE_GMAIL_REFRESH_TOKEN
npx wrangler secret put GOOGLE_GMAIL_SENDER_EMAIL
```

### 3. Deploy Workers API (Backend)
Deploy the API backend to Cloudflare Workers:
```bash
cd worker
npx wrangler deploy
```

### 4. Deploy Frontend Pages (Vite)
Build Vite assets and configure your static hosting environment (e.g. Cloudflare Pages or Vercel). Ensure the `.env` configuration contains:
* `VITE_CLERK_PUBLISHABLE_KEY`: Clerk Publishable Key.
* `VITE_API_BASE`: Deployed Worker URL (e.g., `https://dermatology-clinic-api.thejaswinps.workers.dev`).


---

## 🔄 Phase 2: Cloudflare Workflows Integration Plan

In Phase 2, we will leverage **Cloudflare Workflows** to manage durable, stateful, and time-delayed automation sequences (appointment reminders and post-visit feedback loops).

### 1. Workflow Definitions
Create stateful workflow handlers in `worker/src/workflows/`:
```typescript
import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';

export class AppointmentWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { appointmentId, patientPhone } = event.payload;

    // Step 1: Wait until 24 hours before the appointment
    await step.sleepUntil('wait-for-day-before', event.payload.reminderTime24h);

    // Step 2: Trigger 24-hour reminder notification
    await step.do('send-24h-reminder', async () => {
      // Invoke notificationService.sendReminder(...)
    });

    // Step 3: Wait until 2 hours after the appointment end time
    await step.sleepUntil('wait-for-post-visit', event.payload.feedbackTime);

    // Step 4: Dispatch post-visit feedback request
    await step.do('send-feedback-request', async () => {
      // Invoke notificationService.sendFeedbackRequest(...)
    });
  }
}
```

### 2. Wrangler Configuration
Register the workflow binding in `worker/wrangler.toml`:
```toml
[[workflows]]
name = "appointment-workflow"
binding = "APPOINTMENT_WORKFLOW"
class_name = "AppointmentWorkflow"
```

### 3. Enqueuing Workflows
Whenever an appointment is confirmed in `AppointmentService.confirm`, trigger the workflow execution:
```typescript
await env.APPOINTMENT_WORKFLOW.create({
  id: `appt-${appointment.id}`,
  params: {
    appointmentId: appointment.id,
    patientPhone: patient.phone,
    reminderTime24h: dayBeforeTime,
    feedbackTime: postVisitTime,
  }
});
```
This guarantees that reminders and feedback cycles are reliably processed even during network interruptions.