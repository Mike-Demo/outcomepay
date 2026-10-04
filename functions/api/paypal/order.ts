import { withErrors, json, apiError, InputError } from "../../_core/http";
import { paypalConfig, getPaypalOrder } from "../../_core/paypal";
import { getDb, getOrderByPaypalId, updateOrder } from "../../_core/db";

/**
 * GET /api/paypal/order?id=<paypal-order-id> — merged local + live status.
 * The local row (when a DB binding exists) is promoted CREATED → APPROVED
 * when PayPal reports approval.
 */
export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
  const paypalId = new URL(request.url).searchParams.get("id");
  if (!paypalId) throw new InputError("missing_id", "Query param ?id=<paypal-order-id> is required.");

  const cfg = paypalConfig(env);
  let live: any = null;
  try {
    live = await getPaypalOrder(cfg, paypalId);
  } catch (err) {
    throw new InputError("paypal_error", `PayPal lookup failed: ${(err as Error).message}`);
  }

  const db = await getDb(env);
  let row = db ? await getOrderByPaypalId(db, paypalId) : null;
  let status = row?.status ?? "CREATED";
  if (live.status === "APPROVED" && status === "CREATED") {
    status = "APPROVED";
    if (db && row) await updateOrder(db, paypalId, { status, rawJson: JSON.stringify(live) });
  } else if (row) {
    status = row.status;
  }
  return json({
    ok: true,
    order: {
      id: row?.id ?? null,
      paypalOrderId: paypalId,
      authorizationId: row?.authorization_id ?? null,
      captureId: row?.capture_id ?? null,
      amountUsd: row?.amount_usd ?? null,
      description: row?.description ?? null,
      status,
      paypalStatus: live.status,
      persisted: db !== null,
    },
  });
});
