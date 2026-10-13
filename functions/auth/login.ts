import { withErrors, apiError } from "../_core/http";
import { agentIdConfig, buildAuthorizeUrl, randomB64url } from "../_core/agentid";

/**
 * GET /auth/login — start the AgentID authorization-code flow.
 * Sets state + PKCE verifier cookies (HttpOnly, /auth scoped), then 302s
 * to the issuer. Agents land on the issuer waiting page and authorize an
 * AgentMail inbox; humans use the issuer's sign-in link.
 */
export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  const origin = new URL(request.url).origin;
  const cfg = agentIdConfig(env, origin);
  if (!cfg) {
    return apiError(500, "agentid_not_configured", "AgentID credentials are not set on this space.");
  }
  const state = randomB64url(16);
  const verifier = randomB64url(32);
  const url = await buildAuthorizeUrl(cfg, state, verifier);
  const cookieAttrs = "HttpOnly; Secure; SameSite=Lax; Path=/auth; Max-Age=600";
  const headers = new Headers();
  headers.set("Location", url);
  headers.append("Set-Cookie", `op_state=${state}; ${cookieAttrs}`);
  headers.append("Set-Cookie", `op_verifier=${verifier}; ${cookieAttrs}`);
  return new Response(null, { status: 302, headers });
});
