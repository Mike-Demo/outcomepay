/**
 * PayPal payment spine — raw Orders REST API.
 *
 * Deliberate choice (see docs/DECISIONS.md): the @paypal/agent-toolkit
 * hardcodes `intent: "CAPTURE"` in its create_order payload, but OutcomePay
 * needs AUTHORIZE on team formation and a policy-gated capture after
 * verification. Raw REST gives exact control over the money path.
 *
 * Sandbox only. The policy engine (Phase 3) is the sole caller of
 * authorizeOrder/captureAuthorization — never an LLM directly.
 */

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api-m.paypal.com";

function baseUrl(): string {
  return (process.env.PAYPAL_ENVIRONMENT ?? "SANDBOX").toUpperCase() === "LIVE"
    ? LIVE_BASE
    : SANDBOX_BASE;
}

function credentials(): { id: string; secret: string } {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET — copy .env.sample to .env.local and fill them in."
    );
  }
  return { id, secret };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Client-credentials OAuth → bearer token (cached until near expiry). */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const { id, secret } = credentials();
  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal token request failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

async function paypalFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PayPal ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

export interface CreateOrderInput {
  /** e.g. "40.00" */
  amountUsd: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreatedOrder {
  id: string;
  status: string;
  /** URL the buyer visits to approve the order. */
  approveUrl: string;
}

/**
 * Create an order with intent=AUTHORIZE — the buyer's budget commitment.
 * After the buyer approves, call authorizeOrder(), then captureAuthorization()
 * once verification passes.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const data = await paypalFetch("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "AUTHORIZE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: input.amountUsd },
          description: input.description,
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    }),
  });
  const links = (data.links ?? []) as Array<{ rel: string; href: string }>;
  const approveUrl =
    links.find((l) => l.rel === "approve")?.href ??
    links.find((l) => l.rel === "payer-action")?.href;
  if (!approveUrl) throw new Error("PayPal order response had no approve link");
  return { id: data.id, status: data.status, approveUrl };
}

export async function getOrder(orderId: string): Promise<any> {
  return paypalFetch(`/v2/checkout/orders/${orderId}`);
}

/**
 * Authorize an approved order. Returns the authorization id — the held
 * budget the policy engine may later capture (or let expire).
 */
export async function authorizeOrder(orderId: string): Promise<{ authorizationId: string; status: string }> {
  const data = await paypalFetch(`/v2/checkout/orders/${orderId}/authorize`, {
    method: "POST",
    body: "{}",
  });
  const auth =
    data.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) throw new Error("PayPal authorize response had no authorization");
  return { authorizationId: auth.id, status: auth.status };
}

/** Capture a previously created authorization — the policy engine's final call. */
export async function captureAuthorization(authorizationId: string): Promise<any> {
  return paypalFetch(`/v2/payments/authorizations/${authorizationId}/capture`, {
    method: "POST",
    body: "{}",
  });
}
