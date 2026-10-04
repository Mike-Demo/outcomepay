import { withErrors, json, apiError, InputError } from "../../_core/http";
import { paypalConfig, createPaypalOrder } from "../../_core/paypal";
import { providerById } from "../../_core/agents";
import type { OutcomeContract } from "../../_core/contracts";
import {
  getDb,
  ensureAgentSchema,
  ensurePolicySchema,
  getOutcome,
  getTeamByOutcome,
  getLatestVerification,
  getApproval,
  insertSettlement,
  getSettlementByOutcome,
} from "../../_core/db";

/**
 * POST /api/agents/prepare-settlement — create the PayPal AUTHORIZE order for
 * the team's total. Policy: only for a verified + human-approved outcome.
 * Body: { outcomeId: string }
 * Returns the PayPal approve URL for the buyer.
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
  const contract = JSON.parse(row.contract_json) as OutcomeContract;

  const verification = await getLatestVerification(db, outcomeId);
  if (!verification || verification.overall !== "PASS") {
    throw new InputError("not_verified", "Verification must PASS before a settlement order can be created.");
  }
  const approval = await getApproval(db, outcomeId);
  if (!approval) {
    throw new InputError("not_approved", "Human approval is required before creating the settlement order.");
  }
  const existing = await getSettlementByOutcome(db, outcomeId);
  if (existing && !existing.capture_id) {
    throw new InputError("already_prepared", "A settlement order already exists for this outcome.");
  }

  const team = await getTeamByOutcome(db, outcomeId);
  if (!team) throw new InputError("no_team", "Form the team first.");
  const teamIds = JSON.parse(team.provider_ids) as string[];
  const amountUsd = Number(team.total_usd).toFixed(2);

  // Simulated internal provider allocation ledger (not a PayPal payout).
  const allocations = teamIds.map((id) => {
    const def = providerById.get(id)!;
    return { provider_id: id, role: def.role, amount_usd: def.price.toFixed(2) };
  });

  const cfg = paypalConfig(env);
  const base = String(env["PUBLIC_BASE_URL"] ?? "http://localhost:3000").replace(/\/$/, "");
  let created;
  try {
    created = await createPaypalOrder(cfg, {
      amountUsd,
      description: `OutcomePay settlement: ${contract.goal.slice(0, 80)}`,
      returnUrl: `${base}/api/paypal/return`,
      cancelUrl: `${base}/api/paypal/cancel`,
    });
  } catch (err) {
    throw new InputError("paypal_error", `PayPal order creation failed: ${(err as Error).message}`);
  }

  await insertSettlement(db, outcomeId, created.id, amountUsd, JSON.stringify(allocations));
  return json({
    ok: true,
    paypalOrderId: created.id,
    approveUrl: created.approveUrl,
    amountUsd,
    allocations,
  });
});
