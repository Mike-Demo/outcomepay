import { withErrors, apiError } from "../../_core/http";
import { paypalConfig, getPaypalOrder, publicBaseUrl } from "../../_core/paypal";
import { getDb, getOrderByPaypalId, updateOrder } from "../../_core/db";

/**
 * GET /api/paypal/return — PayPal redirects the buyer here after approval
 * (?token=<paypal-order-id>). Best-effort status sync, then 302 to the
 * command center with the order id in the query string.
 */
export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (token) {
    try {
      const db = await getDb(env);
      const row = db ? await getOrderByPaypalId(db, token) : null;
      if (row && row.status === "CREATED") {
        const cfg = paypalConfig(env);
        const live = await getPaypalOrder(cfg, token);
        if (live.status === "APPROVED") {
          await updateOrder(db!, token, { status: "APPROVED", rawJson: JSON.stringify(live) });
        }
      }
    } catch {
      // best effort — the UI refresh will pick up the real state
    }
  }
  const base = publicBaseUrl(env as Record<string, unknown>);
  return new Response(null, {
    status: 302,
    headers: { Location: `${base}/?paypal_order=${encodeURIComponent(token)}` },
  });
});
