import { withErrors, json, apiError, InputError } from "../../_core/http";
import { paypalConfig, createPaypalOrder } from "../../_core/paypal";
import { getDb, insertOrder } from "../../_core/db";

/**
 * POST /api/paypal/create-order — create a PayPal order with intent=AUTHORIZE.
 * Body: { amountUsd: "40.00", description: "..." }
 * Returns the PayPal order id + buyer approval URL. The row is persisted when
 * a database binding is available; otherwise the call is stateless.
 */
export const POST = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    throw new InputError("bad_json", "Request body must be JSON.");
  }
  const amountRaw = String(body?.amountUsd ?? "").trim();
  const description = String(body?.description ?? "OutcomePay order").slice(0, 120) || "OutcomePay order";
  if (!/^\d+(\.\d{1,2})?$/.test(amountRaw) || Number(amountRaw) <= 0) {
    throw new InputError("bad_amount", 'amountUsd must be a positive amount like "40.00".');
  }
  const amountUsd = Number(amountRaw).toFixed(2);

  const cfg = paypalConfig(env);
  const created = await createPaypalOrder(cfg, {
    amountUsd,
    description,
    returnUrl: `${cfg.publicBaseUrl}/api/paypal/return`,
    cancelUrl: `${cfg.publicBaseUrl}/api/paypal/cancel`,
  });

  let id: string | null = null;
  const db = await getDb(env);
  if (db) {
    id = await insertOrder(db, {
      paypalOrderId: created.id,
      amountUsd,
      description,
      status: "CREATED",
      rawJson: JSON.stringify(created.raw),
    });
  }
  return json({
    ok: true,
    order: {
      id,
      paypalOrderId: created.id,
      approveUrl: created.approveUrl,
      status: "CREATED",
      amountUsd,
      description,
      persisted: db !== null,
    },
  });
});
