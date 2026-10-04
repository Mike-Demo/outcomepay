import { InputError } from "./http";

/**
 * PayPal payment spine — raw Orders REST API (server-side).
 *
 * Deliberate choice (see docs/DECISIONS.md): the @paypal/agent-toolkit
 * hardcodes `intent: "CAPTURE"` in its create_order payload, but OutcomePay
 * needs AUTHORIZE on team formation and a policy-gated capture after
 * verification. Raw REST gives exact control over the money path.
 *
 * Sandbox only. The policy engine (Phase 3) will be the sole caller of
 * authorize/capture — never an LLM directly.
 */

export interface PaypalEnv {
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_ENVIRONMENT?: string;
  PUBLIC_BASE_URL?: string;
  [key: string]: unknown;
}

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api-m.paypal.com";

function envVal(routeEnv: Record<string, unknown>, key: string): string | undefined {
  const v = routeEnv[key];
  if (typeof v === "string" && v.length > 0) return v;
  if (
    typeof process !== "undefined" &&
    process.env &&
    typeof process.env[key] === "string" &&
    (process.env[key] as string).length > 0
  ) {
    return process.env[key];
  }
  return undefined;
}

export interface PaypalConfig {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  baseUrl: string;
  publicBaseUrl: string;
}

/** Public base URL without requiring PayPal credentials (for redirects). */
export function publicBaseUrl(routeEnv: Record<string, unknown>): string {
  return envVal(routeEnv, "PUBLIC_BASE_URL") ?? "http://localhost:3000";
}

/** Resolve + validate PayPal config. Throws InputError when creds are missing. */
export function paypalConfig(routeEnv: Record<string, unknown>): PaypalConfig {
  const clientId = envVal(routeEnv, "PAYPAL_CLIENT_ID");
  const clientSecret = envVal(routeEnv, "PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new InputError(
      "paypal_not_configured",
      "PayPal sandbox credentials are not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET on the space (sf env) or in .env.local for local dev."
    );
  }
  const environment = (envVal(routeEnv, "PAYPAL_ENVIRONMENT") ?? "SANDBOX").toUpperCase();
  const sandbox = environment !== "LIVE";
  return {
    clientId,
    clientSecret,
    sandbox,
    baseUrl: sandbox ? SANDBOX_BASE : LIVE_BASE,
    publicBaseUrl: publicBaseUrl(routeEnv),
  };
}

let cachedToken: { token: string; expiresAt: number; key: string } | null = null;

/** Runtime-safe base64 (Node Buffer or web btoa). */
function toBase64(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s).toString("base64");
  return btoa(
    encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  );
}

/** Client-credentials OAuth → bearer token, cached until near expiry. */
export async function getAccessToken(cfg: PaypalConfig): Promise<string> {
  const key = `${cfg.sandbox ? "sb" : "live"}:${cfg.clientId}`;
  if (cachedToken && cachedToken.key === key && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(`${cfg.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${toBase64(`${cfg.clientId}:${cfg.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal token request failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000, key };
  return cachedToken.token;
}

async function paypalFetch(cfg: PaypalConfig, path: string, init: RequestInit = {}): Promise<any> {
  const token = await getAccessToken(cfg);
  const res = await fetch(`${cfg.baseUrl}${path}`, {
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
  amountUsd: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreatedOrder {
  id: string;
  status: string;
  approveUrl: string;
  raw: unknown;
}

/**
 * Create an order with intent=AUTHORIZE — the buyer's budget commitment.
 * After the buyer approves, call authorizePaypalOrder(); capture the
 * resulting authorization with capturePaypalAuthorization() once the
 * policy engine (Phase 3) gives the green light.
 */
export async function createPaypalOrder(cfg: PaypalConfig, input: CreateOrderInput): Promise<CreatedOrder> {
  const data = await paypalFetch(cfg, "/v2/checkout/orders", {
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
          experience_context: { return_url: input.returnUrl, cancel_url: input.cancelUrl },
        },
      },
    }),
  });
  const links = (data.links ?? []) as Array<{ rel: string; href: string }>;
  const approveUrl =
    links.find((l) => l.rel === "approve")?.href ?? links.find((l) => l.rel === "payer-action")?.href;
  if (!approveUrl) throw new Error("PayPal order response had no approve link");
  return { id: data.id, status: data.status, approveUrl, raw: data };
}

export async function getPaypalOrder(cfg: PaypalConfig, orderId: string): Promise<any> {
  return paypalFetch(cfg, `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

export async function authorizePaypalOrder(
  cfg: PaypalConfig,
  orderId: string
): Promise<{ authorizationId: string; status: string; raw: unknown }> {
  const data = await paypalFetch(cfg, `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
    method: "POST",
    body: "{}",
  });
  const auth = data.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) throw new Error("PayPal authorize response had no authorization");
  return { authorizationId: auth.id, status: auth.status, raw: data };
}

export async function capturePaypalAuthorization(
  cfg: PaypalConfig,
  authorizationId: string
): Promise<{ captureId: string; status: string; raw: unknown }> {
  const data = await paypalFetch(cfg, `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`, {
    method: "POST",
    body: "{}",
  });
  if (!data?.id) throw new Error("PayPal capture response had no capture id");
  return { captureId: data.id, status: data.status, raw: data };
}
