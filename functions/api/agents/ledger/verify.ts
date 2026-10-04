import { withErrors, json, apiError, InputError } from "../../../_core/http";
import { getDb, ensurePolicySchema } from "../../../_core/db";
import { verifyLedger } from "../../../_core/ledger";

/**
 * GET /api/agents/ledger/verify?outcomeId= — recompute every hash link.
 * Public trust endpoint: { valid: true } means the audit trail is intact.
 */
export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
  const outcomeId = new URL(request.url).searchParams.get("outcomeId") ?? "";
  if (!outcomeId.trim()) throw new InputError("missing_id", "Query param ?outcomeId=<id> is required.");
  const db = await getDb(env);
  if (!db) throw new InputError("no_database", "Database not configured on this space.");
  await ensurePolicySchema(db);
  const result = await verifyLedger(db, outcomeId.trim());
  return json({ ok: true, outcomeId: outcomeId.trim(), valid: result.valid, entries: result.entries });
});
