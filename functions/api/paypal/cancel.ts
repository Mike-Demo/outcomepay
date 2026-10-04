import { withErrors, apiError } from "../../_core/http";
import { publicBaseUrl } from "../../_core/paypal";

/** GET /api/paypal/cancel — buyer cancelled at PayPal; 302 back to the UI. */
export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const base = publicBaseUrl(env as Record<string, unknown>);
  return new Response(null, {
    status: 302,
    headers: { Location: `${base}/?paypal_cancelled=1&paypal_order=${encodeURIComponent(token)}` },
  });
});
