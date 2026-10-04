import { withErrors, json, apiError, InputError } from "../../_core/http";
import { getBids, selectTeam, providerById } from "../../_core/agents";
import type { OutcomeContract, ProviderBid } from "../../_core/contracts";
import {
  getDb,
  ensureAgentSchema,
  getOutcome,
  getBidsByOutcome,
  insertTeam,
  updateOutcomeStatus,
} from "../../_core/db";

/**
 * POST /api/agents/form-team — broker forms the provider team.
 * Body: { outcomeId: string }
 * Enforces budget; records the team. (Phase 3 wires this to PayPal AUTHORIZE.)
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

  const stored = await getBidsByOutcome(db, outcomeId);
  if (stored.length === 0) {
    throw new InputError("no_bids", "Request bids first (POST /api/agents/bids).");
  }
  const bids: ProviderBid[] = stored.map((b) => ({
    provider_id: b.provider_id,
    capability: b.capability,
    price: Number(b.price_usd),
    delivery: "immediate",
    confidence: b.confidence,
    evidence_types: JSON.parse(b.evidence_types),
  }));

  const selection = selectTeam(contract, bids);
  if (selection.total > contract.budget) {
    throw new InputError(
      "over_budget",
      `Cheapest covering team costs $${selection.total.toFixed(2)} — over the $${contract.budget.toFixed(2)} budget.`
    );
  }
  const uncovered = contract.deliverables.filter(
    (d) => !selection.provider_ids.some((id) => providerById.get(id)!.deliverables.includes(d))
  );
  if (uncovered.length > 0) {
    throw new InputError("uncovered", `No provider covers: ${uncovered.join(", ")}`);
  }

  const teamId = await insertTeam(db, outcomeId, selection.provider_ids, selection.total);
  await updateOutcomeStatus(db, outcomeId, "TEAM_FORMED");
  return json({
    ok: true,
    team: {
      id: teamId,
      provider_ids: selection.provider_ids,
      total_usd: selection.total.toFixed(2),
      budget_usd: contract.budget.toFixed(2),
      rejected: selection.rejected,
      members: selection.provider_ids.map((id) => {
        const def = providerById.get(id)!;
        return { id: def.id, role: def.role, capability: def.capability, price: def.price, color: def.color };
      }),
    },
  });
});
