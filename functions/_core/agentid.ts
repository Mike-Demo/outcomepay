/**
 * AgentID (https://auth.agentid.com) OAuth 2.0 / OIDC client helpers.
 * Credentials come from space env vars AGENTID_CLIENT_ID / AGENTID_CLIENT_SECRET
 * (set via `sf env set`, never committed). Flow: authorization code + PKCE
 * (S256), token exchange with client_secret_basic, identity via userinfo,
 * with strict ES256 ID-token verification against the issuer JWKS.
 * Approvals are identity-bound: identityFromRequest resolves a verified
 * AgentID identity from a Bearer access token or the browser session
 * cookie the callback sets after a verified sign-in.
 */

export const AGENTID_ISSUER = "https://auth.agentid.com";
const AUTHORIZE_URL = `${AGENTID_ISSUER}/v0/authorize`;
const TOKEN_URL = `${AGENTID_ISSUER}/v0/token`;
const USERINFO_URL = `${AGENTID_ISSUER}/v0/userinfo`;
const JWKS_URL = `${AGENTID_ISSUER}/v0/jwks.json`;

export interface AgentIdConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function agentIdConfig(
  env: Record<string, unknown>,
  origin: string
): AgentIdConfig | null {
  const clientId = typeof env.AGENTID_CLIENT_ID === "string" ? env.AGENTID_CLIENT_ID : "";
  const clientSecret =
    typeof env.AGENTID_CLIENT_SECRET === "string" ? env.AGENTID_CLIENT_SECRET : "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri: `${origin}/auth/callback` };
}

/* ---------- base64url / crypto helpers ---------- */

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecodeToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomB64url(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return b64urlEncode(bytes);
}

export async function sha256B64url(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return b64urlEncode(new Uint8Array(digest));
}

/* ---------- OIDC flow ---------- */

export async function buildAuthorizeUrl(
  cfg: AgentIdConfig,
  state: string,
  codeVerifier: string
): Promise<string> {
  const challenge = await sha256B64url(codeVerifier);
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export interface TokenResponse {
  access_token: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

export async function exchangeCode(
  cfg: AgentIdConfig,
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const basic = btoa(`${cfg.clientId}:${cfg.clientSecret}`);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    code_verifier: codeVerifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: body.toString(),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !data?.access_token) {
    const err = typeof data?.error === "string" ? data.error : `http_${res.status}`;
    throw new Error(`token_exchange_failed:${err}`);
  }
  return data as unknown as TokenResponse;
}

export interface UserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  actor_type?: string;
  owner_sub?: string;
  owner_name?: string;
  owner_email?: string;
  [key: string]: unknown;
}

/** Validate an access token by asking the issuer who it belongs to. */
export async function fetchUserInfo(accessToken: string): Promise<UserInfo | null> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as UserInfo | null;
}

/* ---------- ID token verification (best effort, ES256 via JWKS) ---------- */

let jwksCache: { keys: Array<Record<string, unknown>>; at: number } | null = null;

async function getJwks(): Promise<Array<Record<string, unknown>>> {
  if (jwksCache && Date.now() - jwksCache.at < 10 * 60 * 1000) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error("jwks_fetch_failed");
  const data = (await res.json()) as { keys: Array<Record<string, unknown>> };
  jwksCache = { keys: data.keys ?? [], at: Date.now() };
  return jwksCache.keys;
}

export async function verifyIdToken(
  idToken: string,
  cfg: AgentIdConfig
): Promise<{ valid: boolean; claims?: Record<string, unknown>; error?: string }> {
  try {
    const [h, p, s] = idToken.split(".");
    if (!h || !p || !s) return { valid: false, error: "malformed" };
    const header = JSON.parse(new TextDecoder().decode(b64urlDecodeToBytes(h))) as {
      alg?: string;
      kid?: string;
    };
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecodeToBytes(p))) as Record<
      string,
      unknown
    >;
    if (header.alg !== "ES256") return { valid: false, error: "unexpected_alg" };
    if (claims.iss !== AGENTID_ISSUER) return { valid: false, error: "bad_issuer" };
    if (claims.aud !== cfg.clientId) return { valid: false, error: "bad_audience" };
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now())
      return { valid: false, error: "expired_or_missing_exp" };
    const keys = await getJwks();
    // The key must be selected by kid; never fall back to an arbitrary key.
    const jwk = header.kid ? keys.find((k) => k.kid === header.kid) : undefined;
    if (!jwk) return { valid: false, error: "no_jwk" };
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk as JsonWebKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      b64urlDecodeToBytes(s) as BufferSource,
      new TextEncoder().encode(`${h}.${p}`)
    );
    return ok ? { valid: true, claims } : { valid: false, error: "bad_signature" };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

/* ---------- Browser sessions + request identity (identity-bound approvals) ---------- */

export const SESSION_COOKIE = "op_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface SessionIdentity {
  sub: string;
  email?: string;
  name?: string;
  actor_type?: string;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Mint the session cookie value after a verified sign-in. The payload is
 *  HMAC-SHA256-signed with the AgentID client secret (server-side only). */
export async function createSessionValue(user: UserInfo, secret: string): Promise<string> {
  const payload = {
    sub: user.sub,
    email: user.email,
    name: user.name ?? user.preferred_username,
    actor_type: user.actor_type,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verifySessionValue(
  value: string,
  secret: string
): Promise<SessionIdentity | null> {
  try {
    const [body, sig] = value.split(".");
    if (!body || !sig) return null;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecodeToBytes(sig) as BufferSource,
      new TextEncoder().encode(body)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecodeToBytes(body))) as {
      sub?: unknown;
      exp?: unknown;
      email?: string;
      name?: string;
      actor_type?: string;
    };
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      actor_type: payload.actor_type,
    };
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return part.slice(idx + 1).trim();
      }
    }
  }
  return null;
}

export interface RequestIdentity {
  /** The value recorded as the approval's approver: agentid:<email|sub>. */
  approver: string;
  sub: string;
  email?: string;
  name?: string;
  actor_type?: string;
  via: "bearer" | "session";
}

/**
 * Resolve the caller's verified AgentID identity: an AgentID Bearer access
 * token (validated at the issuer's userinfo endpoint — agents, MCP, CLI)
 * or the signed browser session cookie (the Command Center after /auth).
 * A presented-but-invalid Bearer does NOT fall through to the cookie.
 */
export async function identityFromRequest(
  request: Request,
  env: Record<string, unknown>,
  origin: string
): Promise<RequestIdentity | null> {
  const cfg = agentIdConfig(env, origin);
  if (!cfg) return null;
  const auth = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (match) {
    const user = await fetchUserInfo(match[1]).catch(() => null);
    if (!user) return null;
    return {
      approver: `agentid:${user.email ?? user.sub}`,
      sub: user.sub,
      email: user.email,
      name: user.name ?? user.preferred_username,
      actor_type: user.actor_type,
      via: "bearer",
    };
  }
  const cookie = readCookie(request, SESSION_COOKIE);
  if (cookie) {
    const s = await verifySessionValue(cookie, cfg.clientSecret);
    if (s) {
      return {
        approver: `agentid:${s.email ?? s.sub}`,
        sub: s.sub,
        email: s.email,
        name: s.name,
        actor_type: s.actor_type,
        via: "session",
      };
    }
  }
  return null;
}
