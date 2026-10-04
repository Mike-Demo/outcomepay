import { withErrors, json, apiError, InputError } from "../../_core/http";
import {
  paypalConfig,
  getPaypalOrder,
  authorizePaypalOrder,
  capturePaypalOrder,
} from "../../_core/paypal";
import { runAllChecks } from "../../_core/checks";
import type { OutcomeContract } from "../../_core/contracts";
import {
  getDb,
  ensureAgentSchema,
  ensurePolicySchema,
  getOutcome,
  getTeamByOutcome,
  getArtifactsByOutcome,
  getLatestVerification,
  getApproval,
  getSettlementByOutcome,
  updateSettlementCapture,
  insertVerification,
  updateOutcomeStatus,
  insertOrder,
  updateOrder,
} from "../../_core/db";

/**
 * POST /api/agents/settle — the deterministic policy engine. The ONLY path
 * that captures a settlement payment. Enforces, in order:
 *   1. verification PASS, fresh (newer than every artifact)
 *   2. human approval recorded
 *   3. PayPal order APPROVED or AUTHORIZED (authorizes if needed)
 *   4. capture
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
  const contract = JSON.parse(row.contract_json) as OutcomeContract;
  const team = await getTeamByOutcome(db, outcomeId);
  if (!team) throw new InputError("no_team", "Form the team first.");
  const artifacts = await getArtifactsByOutcome(db, outcomeId);
  const settlement = await getSettlementByOutcome(db, outcomeId);
  if (!settlement) throw new InputError("no_settlement", "Prepare the settlement order first.");
  if (settlement.capture_id) throw new InputError("already_settled", "This outcome is already settled.");

  // 1. Verification must be PASS and fresher than every artifact.
  const newestArtifact = Math.max(...artifacts.map((a) => a.created_at), 0);
  let verification = await getLatestVerification(db, outcomeId);
  if (!verification || verification.overall !== "PASS" || verification.created_at < newestArtifact) {
    const checks = runAllChecks(contract, Number(team.total_usd), artifacts);
    const overall = checks.every((c) => c.passed) ? "PASS" : "FAIL";
    await insertVerification(db, outcomeId, overall, JSON.stringify(checks));
    verification = await getLatestVerification(db, outcomeId);
    if (overall !== "PASS") {
      throw new InputError(
        "verification_failed",
        `Policy engine re-verified and the outcome FAILS: ${checks.filter((c) => !c.passed).map((c) => c.id).join(", ")}. Payment blocked.`
      );
    }
  }

  // 2. Human approval is mandatory.
  const approval = await getApproval(db, outcomeId);
  if (!approval) throw new InputError("not_approved", "Human approval is required before settlement.");

  // 3 + 4. PayPal: authorize if needed, then capture (policy is the only caller).
  const cfg = paypalConfig(env);
  let order;
  try {
    order = await getPaypalOrder(cfg, settlement.paypal_order_id);
  } catch (err) {
    throw new InputError("paypal_error", `Could not read PayPal order: ${(err as Error).message}`);
  }
  const status = String(order?.status ?? "").toUpperCase();
  let authorizationId = settlement.authorization_id;
  if (status === "APPROVED" && !authorizationId) {
    try {
      const auth = await authorizePaypalOrder(cfg, settlement.paypal_order_id);
      authorizationId = auth.authorizationId;
    } catch (err) {
      throw new InputError("paypal_error", `Policy authorize failed: ${(err as Error).message}`);
    }
  } else if (status !== "AUTHORIZED" && status !== "APPROVED") {
    throw new InputError("not_authorized", `PayPal order is ${status} — buyer approval required before settlement.`);
  }
  let captured;
  try {
    captured = await capturePaypalOrder(env, settlement.paypal_order_id);
  } catch (err) {
    throw new InputError("paypal_error", `Policy capture failed: ${(err as Error).message}`);
  }

  await updateSettlementCapture(db, settlement.id, captured.authorizationId, captured.captureId);
  await updateOutcomeStatus(db, outcomeId, "SETTLED");
  // Mirror into the paypal_orders ledger for the Phase 1 harness.
  try {
    const existing = await db
      .prepare(`SELECT id FROM paypal_orders WHERE paypal_order_id = ? LIMIT 1`)
      .bind(settlement.paypal_order_id)
      .first();
    if (!existing) {
      await insertOrder(db, {
        paypalOrderId: settlement.paypal_order_id,
        amountUsd: settlement.amount_usd,
        description: `OutcomePay settlement for ${outcomeId}`,
        status: "CREATED",
      });
    }
    await updateOrder(db, settlement.paypal_order_id, {
      status: "CAPTURED",
      authorizationId: captured.authorizationId,
      captureId: captured.captureId,
    });
  } catch {
    /* ledger mirror is best-effort */
  }

  const checks = JSON.parse(verification!.checks_json) as Array<{ id: string; passed: boolean; detail: string }>;
  return json({
    ok: true,
    receipt: {
      outcomeId,
      paypalOrderId: settlement.paypal_order_id,
      authorizationId: captured.authorizationId,
      captureId: captured.captureId,
      amountUsd: settlement.amount_usd,
      allocations: JSON.parse(settlement.allocations_json),
      allocations_note: "Simulated internal ledger — not a PayPal payout.",
      verification: checks.map((c) => ({ id: c.id, passed: c.passed })),
      approvedAt: new Date(approval.created_at).toISOString(),
      settledAt: new Date().toISOString(),
    },
  });
});
