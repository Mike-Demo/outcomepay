import { withErrors, json, apiError, InputError } from "../../_core/http";
import { paypalConfig, capturePaypalAuthorization } from "../../_core/paypal";
import { getDb, getOrderByPaypalId, updateOrder, getSettlementByPaypalRef, ensurePolicySchema } from "../../_core/db";

/**
 * POST /api/paypal/capture — capture the authorization (release the money).
 * Body: { orderId: "<paypal-order-id>", authorizationId: "<auth-id>" }
 * The authorizationId may come from the DB row or be passed explicitly
 * (the UI carries it when no database binding is available).
 *
 * POLICY GATE (Phase 3+): orders that belong to an agent settlement are
 * refused here — settlement captures happen only through the policy engine
 * (POST /api/agents/settle), which re-verifies evidence and requires a
 * recorded human approval first. This route serves standalone harness
 * orders only.
 */
export const POST = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    throw new InputError("bad_json", "Request body must be JSON.");
  }
  const orderId = String(body?.orderId ?? "").trim();
  let authorizationId = String(body?.authorizationId ?? "").trim();

  const db = await getDb(env);
  if (!authorizationId && db && orderId) {
    const row = await getOrderByPaypalId(db, orderId);
    authorizationId = row?.authorization_id ?? "";
  }
  if (!authorizationId) {
    throw new InputError("not_authorized", "Authorize this order before capturing (authorizationId required).");
  }

  // Policy gate: settlement orders/authorization capture only via the policy engine.
  if (db) {
    await ensurePolicySchema(db);
    const settlement = await getSettlementByPaypalRef(db, {
      orderId: orderId || undefined,
      authorizationId,
    });
    if (settlement) {
      throw new InputError(
        "policy_gated",
        "This order belongs to an agent settlement. Capture is policy-gated: use POST /api/agents/settle."
      );
    }
  }

  const cfg = paypalConfig(env);
  let cap: { captureId: string; status: string; raw: unknown };
  try {
    cap = await capturePaypalAuthorization(cfg, authorizationId);
  } catch (err) {
    throw new InputError("paypal_error", `PayPal capture failed: ${(err as Error).message}`);
  }

  if (db && orderId) {
    const row = await getOrderByPaypalId(db, orderId);
    if (row) {
      await updateOrder(db, orderId, { status: "CAPTURED", captureId: cap.captureId, rawJson: JSON.stringify(cap.raw) });
    }
  }
  return json({ ok: true, orderId: orderId || null, captureId: cap.captureId, status: "CAPTURED" });
});
