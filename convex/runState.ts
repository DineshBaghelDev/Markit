// Shared by Convex functions and the UI. A project in a RUNNING status has server work in progress.
// Background work runs inside one Vercel function (max 300 s), so a running status that has not changed for
// STALE_AFTER_MS means the run died (timeout or crash) and may be restarted.
export const RUNNING_STATUSES = ["discovering", "autopilot_contacts", "autopilot_drafts"];
export const STALE_AFTER_MS = 6 * 60 * 1000;

export const isActiveRun = (status: string, statusAt: number | undefined, now: number) =>
  RUNNING_STATUSES.includes(status) && statusAt !== undefined && now - statusAt < STALE_AFTER_MS;
