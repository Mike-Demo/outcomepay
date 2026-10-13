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

/**
 * POST /api/agents/approve — the human gate. Records explicit human approval
 * of a VERIFIED outcome. Required before the policy engine will settle.
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
  const approvalId = await replaceApproval(db, outcomeId, "human");
  await appendLedger(db, outcomeId, "approval.recorded", {
    approver: "human",
    verification_id: verification.id,
  });
  return json({ ok: true, approvalId, approvedAt: new Date().toISOString(), verificationId: verification.id });
});
