import { withErrors, json, apiError, InputError } from "../../_core/http";
import {
  getDb,
  ensureAgentSchema,
  ensurePolicySchema,
  getOutcome,
  getLatestVerification,
  getArtifactsByOutcome,
  replaceApproval,
} from "../../_core/db";
import { appendLedger } from "../../_core/ledger";
import { identityFromRequest } from "../../_core/agentid";

/**
 * POST /api/agents/approve — the approval gate. Records approval of a
 * VERIFIED outcome; required before the policy engine will settle.
 *
 * IDENTITY-BOUND (Demo's decision after the Copilot validation): the
 * caller must present a verified AgentID identity — an AgentID Bearer
 * access token (agents, MCP, CLI) or the signed browser session set by
 * /auth/callback after a verified sign-in. The recorded approver is
 * derived from that identity (agentid:<email|sub>); a caller-supplied
 * approver string is never trusted. No identity → 401 identity_required.
 * Body: { outcomeId: string }
 */
export const POST = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    throw new InputError("bad_json", "Request body must be JSON.");
  }
  const outcomeId = String(body?.outcomeId ?? "").trim();
  if (!outcomeId) throw new InputError("missing_id", "Body must include outcomeId.");

  const origin = new URL(request.url).origin;
  const identity = await identityFromRequest(request, env, origin);
  if (!identity) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "identity_required",
        message:
          "Approvals are bound to a verified AgentID identity. Send an AgentID access token in the Authorization header, or sign in at /auth in this browser first.",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
          "RateLimit-Limit": "60",
          "RateLimit-Policy": "60;w=60",
        },
      }
    );
  }

  const db = await getDb(env);
  if (!db) throw new InputError("no_database", "Database not configured on this space.");
  await ensureAgentSchema(db);
  await ensurePolicySchema(db);

  const row = await getOutcome(db, outcomeId);
  if (!row) throw new InputError("not_found", "Unknown outcome id.");
  const verification = await getLatestVerification(db, outcomeId);
  if (!verification || verification.overall !== "PASS") {
    throw new InputError("not_verified", "Run verification first — only a PASS outcome can be approved.");
  }
  // Freshness: the PASS must be newer than every artifact, so the human
  // approves the evidence as it currently stands — not an older delivery.
  const artifacts = await getArtifactsByOutcome(db, outcomeId);
  const newestArtifact = Math.max(...artifacts.map((a) => a.created_at), 0);
  if (verification.created_at < newestArtifact) {
    throw new InputError(
      "stale_verification",
      "Artifacts changed after the last verification — re-run verification before approving."
    );
  }
  const approver = identity.approver;
  const approvalId = await replaceApproval(db, outcomeId, approver);
  await appendLedger(db, outcomeId, "approval.recorded", {
    approver,
    via: identity.via,
    verification_id: verification.id,
  });
  return json({
    ok: true,
    approvalId,
    approver,
    via: identity.via,
    approvedAt: new Date().toISOString(),
    verificationId: verification.id,
  });
});
