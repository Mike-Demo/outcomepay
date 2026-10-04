import { withErrors, json, apiError, InputError } from "../../_core/http";
import { buildContract } from "../../_core/agents";
import {
  getDb,
  ensureAgentSchema,
  insertOutcome,
  getOutcome,
  getBidsByOutcome,
  getTeamByOutcome,
  getArtifactsByOutcome,
} from "../../_core/db";

/**
 * POST /api/agents/outcome — buyer agent: goal + budget → outcome contract.
 * Body: { goal: string, budgetUsd?: number }
 *
 * GET /api/agents/outcome?id= — full state: contract, bids, team, artifacts.
 */
async function createOutcome(request: Request, env: Record<string, unknown>) {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    throw new InputError("bad_json", "Request body must be JSON.");
  }
  const goal = String(body?.goal ?? "").trim();
  if (!goal) throw new InputError("missing_goal", "Body must include a goal.");
  const budgetUsd = body?.budgetUsd !== undefined ? Number(body.budgetUsd) : undefined;
  if (budgetUsd !== undefined && !(budgetUsd > 0)) {
    throw new InputError("bad_budget", "budgetUsd must be a positive number.");
  }

  const contract = buildContract(goal, budgetUsd);
  const db = await getDb(env);
  if (!db) throw new InputError("no_database", "Database not configured on this space.");
  await ensureAgentSchema(db);
  const id = await insertOutcome(db, {
    goal: contract.goal,
    budgetUsd: contract.budget.toFixed(2),
    contractJson: JSON.stringify(contract),
  });
  return json({ ok: true, outcome: { id, contract, status: "CONTRACTED" } });
}

async function getState(request: Request, env: Record<string, unknown>) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new InputError("missing_id", "Query param ?id=<outcome-id> is required.");
  const db = await getDb(env);
  if (!db) throw new InputError("no_database", "Database not configured on this space.");
  await ensureAgentSchema(db);
  const row = await getOutcome(db, id);
  if (!row) throw new InputError("not_found", "Unknown outcome id.");
  const [bids, team, artifacts] = await Promise.all([
    getBidsByOutcome(db, id),
    getTeamByOutcome(db, id),
    getArtifactsByOutcome(db, id),
  ]);
  return json({
    ok: true,
    outcome: {
      id: row.id,
      goal: row.goal,
      budgetUsd: row.budget_usd,
      contract: JSON.parse(row.contract_json),
      status: row.status,
    },
    bids: bids.map((b) => ({
      provider_id: b.provider_id,
      capability: b.capability,
      price: Number(b.price_usd),
      confidence: b.confidence,
      evidence_types: JSON.parse(b.evidence_types),
      decision: b.decision,
      decision_reason: b.decision_reason,
    })),
    team: team
      ? { id: team.id, provider_ids: JSON.parse(team.provider_ids), total_usd: team.total_usd }
      : null,
    artifacts: artifacts.map((a) => ({
      id: a.id,
      provider_id: a.provider_id,
      kind: a.kind,
      title: a.title,
      mode: a.mode,
      content: a.content,
    })),
  });
}

export const POST = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
  return createOutcome(request, env);
});

export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
  return getState(request, env);
});
