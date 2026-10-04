import { withErrors, json, apiError, InputError } from "../../../_core/http";
import type { OutcomeContract } from "../../../_core/contracts";
import {
  getDb,
  ensureAgentSchema,
  ensurePolicySchema,
  getOutcome,
  getTeamByOutcome,
  getBidsByOutcome,
  getArtifactsByOutcome,
  getLatestVerification,
  getApproval,
  getSettlementByOutcome,
} from "../../../_core/db";
import { appendLedger, getLedger } from "../../../_core/ledger";

/**
 * POST /api/agents/ledger/backfill — one-time migration: rebuild an outcome's
 * hash chain from its existing DB records, in chronological order.
 * Idempotent: skips outcomes that already have ledger entries.
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

  const existing = await getLedger(db, outcomeId);
  if (existing.length > 0) {
    return json({ ok: true, backfilled: false, entries: existing.length });
  }

  const row = await getOutcome(db, outcomeId);
  if (!row) throw new InputError("not_found", "Unknown outcome id.");
  const contract = JSON.parse(row.contract_json) as OutcomeContract;
  let count = 0;

  await appendLedger(db, outcomeId, "outcome.published", {
    goal: contract.goal,
    budget: contract.budget,
    deliverables: contract.deliverables,
    acceptance_tests: contract.acceptance_tests,
  });
  count++;

  const team = await getTeamByOutcome(db, outcomeId);
  if (team) {
    const bids = await getBidsByOutcome(db, outcomeId);
    const rejected = bids.filter((b) => b.decision === "rejected").map((b) => b.provider_id);
    await appendLedger(db, outcomeId, "team.formed", {
      provider_ids: JSON.parse(team.provider_ids),
      total_usd: team.total_usd,
      budget_usd: row.budget_usd,
      rejected,
    });
    count++;
  }

  const artifacts = await getArtifactsByOutcome(db, outcomeId);
  const seenProviders: string[] = [];
  for (const a of artifacts) {
    if (!seenProviders.includes(a.provider_id)) seenProviders.push(a.provider_id);
  }
  for (const pid of seenProviders) {
    const mine = artifacts.filter((a) => a.provider_id === pid);
    await appendLedger(db, outcomeId, "artifact.delivered", {
      provider_id: pid,
      mode: mine[0].mode,
      artifacts: mine.map((a) => ({ kind: a.kind, title: a.title })),
    });
    count++;
  }

  const verification = await getLatestVerification(db, outcomeId);
  if (verification) {
    const checks = JSON.parse(verification.checks_json) as Array<{ id: string; passed: boolean }>;
    await appendLedger(db, outcomeId, "verification.completed", {
      overall: verification.overall,
      checks: checks.map((c) => ({ id: c.id, passed: c.passed })),
    });
    count++;
  }

  const approval = await getApproval(db, outcomeId);
  if (approval) {
    await appendLedger(db, outcomeId, "approval.recorded", { approver: approval.approver });
    count++;
  }

  const settlement = await getSettlementByOutcome(db, outcomeId);
  if (settlement) {
    await appendLedger(db, outcomeId, "settlement.prepared", {
      paypal_order_id: settlement.paypal_order_id,
      amount_usd: settlement.amount_usd,
      allocations: JSON.parse(settlement.allocations_json),
    });
    count++;
    if (settlement.capture_id) {
      await appendLedger(db, outcomeId, "settlement.captured", {
        paypal_order_id: settlement.paypal_order_id,
        authorization_id: settlement.authorization_id,
        capture_id: settlement.capture_id,
        amount_usd: settlement.amount_usd,
      });
      count++;
    }
  }

  return json({ ok: true, backfilled: true, entries: count });
});
