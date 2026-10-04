import { withErrors, json, apiError, InputError } from "../../_core/http";
import { getBids, selectTeam, providerById } from "../../_core/agents";
import type { OutcomeContract } from "../../_core/contracts";
import {
  getDb,
  ensureAgentSchema,
  getOutcome,
  replaceBids,
  updateOutcomeStatus,
} from "../../_core/db";

/**
 * POST /api/agents/bids — broker solicits structured bids from provider agents.
 * Body: { outcomeId: string }
 * Returns all bids with the broker's select/reject decisions and reasons.
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
  const row = await getOutcome(db, outcomeId);
  if (!row) throw new InputError("not_found", "Unknown outcome id.");
  const contract = JSON.parse(row.contract_json) as OutcomeContract;

  const bids = getBids(contract);
  const selection = selectTeam(contract, bids);
  const selectedSet = new Set(selection.provider_ids);
  const rejectedById = new Map(selection.rejected.map((r) => [r.provider_id, r.reason]));

  await replaceBids(
    db,
    outcomeId,
    bids.map((b) => ({
      provider_id: b.provider_id,
      capability: b.capability,
      price: b.price,
      confidence: b.confidence,
      evidence_types: b.evidence_types,
      decision: selectedSet.has(b.provider_id) ? "selected" : "rejected",
      decision_reason: rejectedById.get(b.provider_id) ?? null,
    }))
  );
  await updateOutcomeStatus(db, outcomeId, "BIDS_IN");

  return json({
    ok: true,
    bids: bids.map((b) => {
      const def = providerById.get(b.provider_id)!;
      return {
        ...b,
        role: def.role,
        color: def.color,
        blurb: def.blurb,
        decision: selectedSet.has(b.provider_id) ? "selected" : "rejected",
        decision_reason: rejectedById.get(b.provider_id) ?? null,
      };
    }),
    would_select: selection.provider_ids,
    would_total: selection.total,
  });
});
