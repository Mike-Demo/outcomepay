import { withErrors } from "../_core/http";
import { fetchUserInfo } from "../_core/agentid";

/**
 * GET /agent/identity — the agent_auth identity_endpoint.
 * With a valid AgentID Bearer token: 200 + the validated identity.
 * Without one: 401 + WWW-Authenticate discovery header (RFC 9728 shape),
 * so an agent learns the auth requirements from a single request.
 */

function unauthorized(request: Request): Response {
  const origin = new URL(request.url).origin;
  return new Response(
    JSON.stringify({
      ok: false,
      error: "unauthorized",
      message:
        "Present an AgentID-issued Bearer token. Discover the flow via the protected resource metadata or /auth.md.",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", authorization_uri="https://auth.agentid.com/v0/authorize"`,
      },
    }
  );
}

export const GET = withErrors(async (request: Request) => {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return unauthorized(request);
  let user = null;
  try {
    user = await fetchUserInfo(match[1]);
  } catch {
    user = null;
  }
  if (!user) return unauthorized(request);
  return new Response(
    JSON.stringify({
      ok: true,
      identity: {
        sub: user.sub,
        name: user.name ?? user.preferred_username ?? null,
        email: user.email ?? null,
        email_verified: user.email_verified ?? null,
        actor_type: user.actor_type ?? null,
        owner: user.owner_name ?? user.owner_email ?? user.owner_sub ?? null,
      },
      issuer: "https://auth.agentid.com",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});

export const OPTIONS = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
