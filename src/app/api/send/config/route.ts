import { DAILY_SEND_LIMIT, OPT_OUT_LINE, emailConfig } from "@/lib/server/email";

// Read-only sending setup for the Campaign step. Never returns secrets or the allowlist itself.
export function GET() {
  const { user, pass, allowlist } = emailConfig();
  return Response.json({
    configured: Boolean(user && pass),
    from: user ? user.replace(/^(.).*(@.*)$/, "$1•••$2") : null,
    allowlistSize: allowlist.length,
    dailyLimit: DAILY_SEND_LIMIT,
    optOutLine: OPT_OUT_LINE,
  });
}
