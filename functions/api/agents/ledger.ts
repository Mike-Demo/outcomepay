import { withErrors, json, apiError, InputError } from "../../_core/http";
import { getDb, ensurePolicySchema } from "../../_core/db";
import { getLedger } from "../../_core/ledger";

/**
 * GET /api/agents/ledger?outcomeId= — the hash-chained audit trail.
 * Public: anyone can read the chain and re-verify it.
 */
export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
  const outcomeId = new URL(request.url).searchParams.get("outcomeId") ?? "";
  if (!outcomeId.trim()) throw new InputError("missing_id", "Query param ?outcomeId=<id> is required.");
  const db = await getDb(env);
  if (!db) throw new InputError("no_database", "Database not configured on this space.");
  await ensurePolicySchema(db);
  const entries = await getLedger(db, outcomeId.trim());
  return json({
    ok: true,
    outcomeId: outcomeId.trim(),
    entries: entries.map((e) => ({
      seq: e.seq,
      kind: e.kind,
      payload: e.payload,
      prev_hash: e.prevHash,
      hash: e.hash,
      created_at: e.createdAt,
    })),
  });
});
