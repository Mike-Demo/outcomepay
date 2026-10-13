import { withErrors } from "./_core/http";
import { agentIdConfig } from "./_core/agentid";

/**
 * GET /auth — the sign-in page. Humans click through to AgentID; agents
 * follow the authorization with their AgentMail inbox (see llms.txt).
 * Server-rendered HTML so agents can read it without executing JS.
 */
function page(configured: boolean): Response {
  const button = configured
    ? `<a class="btn" href="/auth/login">Continue with AgentID</a>`
    : `<p class="warn">AgentID is not configured on this deployment (missing AGENTID_CLIENT_ID / AGENTID_CLIENT_SECRET).</p>`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in — OutcomePay</title>
<meta name="description" content="Sign in to OutcomePay with AgentID. Agents authorize an AgentMail inbox; humans use the AgentID sign-in page.">
<style>
  :root { --bg:#0b0e14; --panel:#121722; --line:#232c3f; --text:#e8edf5; --muted:#8b96ab; --accent:#7dd3fc; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width:720px; margin:0 auto; padding:48px 24px; }
  h1 { font-size:28px; letter-spacing:-0.02em; margin:0 0 8px; }
  p { line-height:1.6; color:var(--muted); }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:24px; margin:24px 0; }
  .btn { display:inline-block; background:var(--accent); color:#082f49; font-weight:700; padding:12px 22px; border-radius:10px; text-decoration:none; }
  code, pre { background:#1d2637; border:1px solid var(--line); border-radius:8px; }
  code { padding:1px 6px; font-size:13px; }
  pre { padding:14px 16px; overflow-x:auto; font-size:12.5px; line-height:1.6; color:var(--text); }
  a { color:var(--accent); }
  .warn { color:#fca5a5; }
  footer { margin-top:40px; font-size:13px; color:var(--muted); }
</style>
</head>
<body>
<main>
  <header>
    <h1>Sign in to OutcomePay</h1>
    <p>OutcomePay uses <strong>AgentID</strong> (OAuth 2.0 + PKCE, issuer <code>https://auth.agentid.com</code>) so agents and their humans share one identity.</p>
  </header>
  <section class="card">
    <h2>Humans</h2>
    ${button}
    <p>You will be redirected to AgentID to authorize an inbox, then returned here.</p>
  </section>
  <section class="card">
    <h2>Agents</h2>
    <p>Start the same flow — <code>GET /auth/login</code> redirects to the AgentID authorization page. On the waiting page, take the <code>auth_token</code> and authorize your AgentMail inbox:</p>
    <pre>curl -X POST "https://api.agentmail.to/v0/inboxes/$AGENTMAIL_INBOX_ID/authorize" \\
  -H "Authorization: Bearer $AGENTMAIL_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data '{"auth_token":"&lt;from the waiting page&gt;","accept_disclosure":true}'</pre>
    <p>The waiting page then redirects to <code>/auth/callback</code>, which exchanges the code and shows your signed-in identity. For the MCP server (<code>POST /mcp</code>), send your AgentID access token as <code>Authorization: Bearer &lt;token&gt;</code>.</p>
  </section>
  <footer>
    <p>OutcomePay · PayPal AI Hackathon 2026 entry · Sandbox prototype — not a legal escrow service. · <a href="/docs">Docs</a> · <a href="/llms.txt">llms.txt</a> · <a href="/">Command Center</a></p>
  </footer>
</main>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  const origin = new URL(request.url).origin;
  return page(agentIdConfig(env, origin) !== null);
});
