import { withErrors } from "../_core/http";
import {
  agentIdConfig,
  exchangeCode,
  fetchUserInfo,
  verifyIdToken,
  type UserInfo,
} from "../_core/agentid";

/**
 * GET /auth/callback — the redirect URI registered with AgentID.
 * Validates the state cookie, exchanges the authorization code
 * (client_secret_basic + PKCE), reads the identity from userinfo,
 * best-effort verifies the ID token, and renders the result.
 * This is the page the console test sign-in lands on.
 */

function parseCookies(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

function resultPage(title: string, bodyHtml: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — OutcomePay</title>
<style>
  :root { --bg:#0b0e14; --panel:#121722; --line:#232c3f; --text:#e8edf5; --muted:#8b96ab; --accent:#7dd3fc; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width:720px; margin:0 auto; padding:48px 24px; }
  h1 { font-size:26px; letter-spacing:-0.02em; }
  p { line-height:1.6; color:var(--muted); }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:24px; margin:24px 0; }
  dl { display:grid; grid-template-columns:160px 1fr; gap:8px 16px; margin:0; }
  dt { color:var(--muted); } dd { margin:0; word-break:break-all; }
  a { color:var(--accent); }
  .err { color:#fca5a5; }
</style>
</head>
<body>
<main>
  <h1>${esc(title)}</h1>
  <section class="card">${bodyHtml}</section>
  <p><a href="/">← Command Center</a> · <a href="/docs">Docs</a> · <a href="/auth">Sign in again</a></p>
</main>
</body>
</html>`;
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" });
  const clear = "HttpOnly; Secure; SameSite=Lax; Path=/auth; Max-Age=0";
  headers.append("Set-Cookie", `op_state=; ${clear}`);
  headers.append("Set-Cookie", `op_verifier=; ${clear}`);
  return new Response(html, { status, headers });
}

export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  const url = new URL(request.url);
  const origin = url.origin;
  const cfg = agentIdConfig(env, origin);
  if (!cfg) {
    return resultPage("AgentID not configured", `<p class="err">This deployment is missing AGENTID_CLIENT_ID / AGENTID_CLIENT_SECRET.</p>`, 500);
  }
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return resultPage(
      "Sign-in was not completed",
      `<p class="err">AgentID returned an error: <strong>${esc(oauthError)}</strong>${url.searchParams.get("error_description") ? ` — ${esc(url.searchParams.get("error_description")!)}` : ""}</p>`,
      400
    );
  }
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const cookies = parseCookies(request);
  if (!code || !state || !cookies.op_state || cookies.op_state !== state || !cookies.op_verifier) {
    return resultPage(
      "Sign-in could not be verified",
      `<p class="err">The sign-in state did not match (missing or stale cookies). Start again from <a href="/auth">/auth</a> — note the flow must finish within 10 minutes in the same browser.</p>`,
      400
    );
  }

  let user: UserInfo | null = null;
  let idCheck = "not issued";
  try {
    const tokens = await exchangeCode(cfg, code, cookies.op_verifier);
    if (tokens.id_token) {
      const v = await verifyIdToken(tokens.id_token, cfg);
      idCheck = v.valid ? "signature + claims verified (ES256)" : `unverified (${v.error ?? "unknown"})`;
    }
    user = await fetchUserInfo(tokens.access_token);
  } catch (err) {
    return resultPage(
      "Token exchange failed",
      `<p class="err">${esc((err as Error).message)}</p><p>The authorization code may have expired or already been used. Start again from <a href="/auth">/auth</a>.</p>`,
      502
    );
  }
  if (!user) {
    return resultPage("Identity unavailable", `<p class="err">The token exchange succeeded but the issuer's userinfo endpoint did not return an identity.</p>`, 502);
  }

  const rows: Array<[string, string]> = [
    ["Name", user.name ?? user.preferred_username ?? "—"],
    ["Email", user.email ?? "—"],
    ["Subject (sub)", user.sub],
    ["Actor type", user.actor_type ?? "—"],
  ];
  if (user.owner_name || user.owner_email || user.owner_sub) {
    rows.push(["Owner", user.owner_name ?? user.owner_email ?? String(user.owner_sub)]);
  }
  rows.push(["ID token", idCheck]);
  const dl = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  return resultPage(
    "Signed in with AgentID",
    `<p style="color:var(--text)">Welcome — AgentID issued a token for this identity and OutcomePay verified it with the issuer.</p><dl>${dl}</dl><p>Next: call the MCP server (<code>POST /mcp</code>) with your access token as a Bearer token, or drive the pipeline over the <a href="/docs">REST API</a>.</p>`
  );
});
