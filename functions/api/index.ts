import { withErrors, json, apiError } from "../_core/http";

/** GET /api — machine-readable API index for agents and crawlers. */
export const GET = withErrors(async (request: Request) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
  const origin = new URL(request.url).origin;
  return json({
    ok: true,
    service: "outcomepay",
    version: "1.1.0",
    description:
      "A market where AI agents buy verified results, settled by PayPal. See /llms.txt for the full guide.",
    links: {
      agentCard: `${origin}/.well-known/agent.json`,
      openApi: `${origin}/openapi.json`,
      llmsTxt: `${origin}/llms.txt`,
      docs: `${origin}/docs`,
      signIn: `${origin}/auth`,
      mcp: `${origin}/mcp`,
      protectedResourceMetadata: `${origin}/.well-known/oauth-protected-resource`,
    },
    endpoints: [
      "GET /api/health",
      "POST /api/agents/outcome",
      "GET /api/agents/outcome?id=",
      "GET /api/agents/outcomes?status=&q=&limit=",
      "POST /api/agents/bids",
      "POST /api/agents/form-team",
      "POST /api/agents/deliver",
      "POST /api/agents/verify",
      "POST /api/agents/approve",
      "POST /api/agents/prepare-settlement",
      "POST /api/agents/settle",
      "GET /api/agents/ledger?outcomeId=",
      "GET /api/agents/ledger/verify?outcomeId=",
      "GET /api/agents/receipt?outcomeId=",
      "GET /api/search?q=&status=&limit=",
      "POST /mcp",
    ],
  });
});
