import { withErrors, json, apiError, InputError } from "../../_core/http";
import { paypalConfig, authorizePaypalOrder } from "../../_core/paypal";
import { getDb, getOrderByPaypalId, updateOrder } from "../../_core/db";

/**
 * POST /api/paypal/authorize — authorize an APPROVED order (hold the budget).
 * Body: { orderId: "<paypal-order-id>" }
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
  if (!orderId) throw new InputError("missing_id", "Body must include orderId.");

  const cfg = paypalConfig(env);
  let auth: { authorizationId: string; status: string; raw: unknown };
  try {
    auth = await authorizePaypalOrder(cfg, orderId);
  } catch (err) {
    throw new InputError("paypal_error", `PayPal authorize failed: ${(err as Error).message}`);
  }

  const db = await getDb(env);
  if (db) {
    const row = await getOrderByPaypalId(db, orderId);
    if (row) {
      await updateOrder(db, orderId, {
        status: "AUTHORIZED",
        authorizationId: auth.authorizationId,
        rawJson: JSON.stringify(auth.raw),
      });
    }
  }
  return json({ ok: true, orderId, authorizationId: auth.authorizationId, status: "AUTHORIZED" });
});
