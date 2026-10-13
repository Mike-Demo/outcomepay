import { withErrors, json } from "../_core/http";
import {
  agentIdConfig,
  readCookie,
  verifySessionValue,
  SESSION_COOKIE,
} from "../_core/agentid";

/**
 * GET /auth/session — who is this browser signed in as?
 * Reads the signed session cookie set by /auth/callback after a verified
 * AgentID sign-in. The Command Center uses it to gate the approve button:
 * no session, no approval (approvals are identity-bound).
 */
export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  const origin = new URL(request.url).origin;
  const cfg = agentIdConfig(env, origin);
  if (!cfg) return json({ signed_in: false });
  const raw = readCookie(request, SESSION_COOKIE);
  const s = raw ? await verifySessionValue(raw, cfg.clientSecret) : null;
  if (!s) return json({ signed_in: false });
  return json({
    signed_in: true,
    sub: s.sub,
    email: s.email ?? null,
    name: s.name ?? null,
    actor_type: s.actor_type ?? null,
    approver: `agentid:${s.email ?? s.sub}`,
  });
});
