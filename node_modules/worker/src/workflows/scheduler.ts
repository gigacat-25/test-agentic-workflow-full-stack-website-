// ============================================================
// Scheduler / CRON Trigger Handler
//
// Receives scheduled triggers from Cloudflare Workers CRON triggers
// and dispatches to appropriate background workflows.
// ============================================================

import { Env } from '../db/client';
import { ReminderWorkflow } from './reminders';
import { PostVisitWorkflow } from './post-visit';

export class SchedulerHandler {
  /**
   * Main CRON trigger entry point.
   */
  async handleScheduledEvent(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[Scheduler] Triggered: cron="${event.cron}", scheduledTime=${event.scheduledTime}`);

    const reminders = new ReminderWorkflow();
    const postVisit = new PostVisitWorkflow();

    // Use ctx.waitUntil to let operations run in the background after returning
    ctx.waitUntil(
      Promise.allSettled([
        // Run daily day-before reminders
        (async () => {
          try {
            console.log('[Scheduler] Running processDayBeforeReminders...');
            await reminders.processDayBeforeReminders(env);
          } catch (err) {
            console.error('[Scheduler] Error in processDayBeforeReminders:', err);
          }
        })(),

        // Run hourly reminders (next 2 hours)
        (async () => {
          try {
            console.log('[Scheduler] Running processHourlyReminders...');
            await reminders.processHourlyReminders(env);
          } catch (err) {
            console.error('[Scheduler] Error in processHourlyReminders:', err);
          }
        })(),

        // Run daily post-visit feedback requests
        (async () => {
          try {
            console.log('[Scheduler] Running processFeedbackRequests...');
            await postVisit.processFeedbackRequests(env);
          } catch (err) {
            console.error('[Scheduler] Error in processFeedbackRequests:', err);
          }
        })(),
      ]).then(results => {
        console.log('[Scheduler] All tasks completed.', results);
      })
    );
  }
}
