import { withErrors, json } from "./_core/http";
import { fetchUserInfo, type UserInfo } from "./_core/agentid";

/**
 * POST /mcp — OutcomePay MCP server (streamable HTTP, JSON-RPC 2.0).
 * Auth: an AgentID-issued OAuth Bearer token is required. The token is
 * validated against the issuer's userinfo endpoint on every call.
 * Without one: HTTP 401 JSON + WWW-Authenticate pointing at the
 * protected resource metadata (same contract as the agent card).
 * Tools map 1:1 onto the REST pipeline and inherit its policy gates —
 * settlement still requires verification PASS + recorded approval.
 */

const SERVER = { name: "outcomepay", version: "1.1.0" };

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  rest: (args: Record<string, unknown>, ctx: { user: UserInfo }) => {
    method: string;
    path: string;
    body?: Record<string, unknown>;
  };
}

const ID = { outcomeId: { type: "string", description: "The outcome id (out_…)" } };
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
});

const TOOLS: ToolDef[] = [
  {
    name: "publish_outcome",
    description:
      "Buyer agent: publish a goal with a buyer-approved budget (USD, max 10000). Returns the outcome contract.",
    inputSchema: obj(
      { goal: { type: "string" }, budgetUsd: { type: "number" } },
      ["goal"]
    ),
    rest: (a) => ({ method: "POST", path: "/api/agents/outcome", body: { goal: a.goal, budgetUsd: a.budgetUsd } }),
  },
  {
    name: "get_outcome",
    description: "Full state of one outcome: contract, bids, team, artifacts, verification, approval, settlement.",
    inputSchema: obj(ID, ["outcomeId"]),
    rest: (a) => ({ method: "GET", path: `/api/agents/outcome?id=${encodeURIComponent(String(a.outcomeId))}` }),
  },
  {
    name: "list_outcomes",
    description: "List outcomes (newest first), filterable by status, searchable by goal text.",
    inputSchema: obj({ status: { type: "string" }, q: { type: "string" }, limit: { type: "number" } }),
    rest: (a) => {
      const q = new URLSearchParams();
      if (a.status) q.set("status", String(a.status));
      if (a.q) q.set("q", String(a.q));
      if (a.limit) q.set("limit", String(a.limit));
      return { method: "GET", path: `/api/agents/outcomes?${q.toString()}` };
    },
  },
  {
    name: "request_bids",
    description: "The broker solicits structured bids from provider agents; returns every bid with its select/reject decision and reason.",
    inputSchema: obj(ID, ["outcomeId"]),
    rest: (a) => ({ method: "POST", path: "/api/agents/bids", body: { outcomeId: a.outcomeId } }),
  },
  {
    name: "form_team",
    description: "Form the provider team from the selected bids, enforcing the contract budget.",
    inputSchema: obj(ID, ["outcomeId"]),
    rest: (a) => ({ method: "POST", path: "/api/agents/form-team", body: { outcomeId: a.outcomeId } }),
  },
  {
    name: "deliver_artifacts",
    description:
      "Run one provider agent's delivery, producing evidence artifacts. Optional feedback (max 2000 chars) requests a revision.",
    inputSchema: obj(
      { ...ID, providerId: { type: "string" }, feedback: { type: "string" } },
      ["outcomeId", "providerId"]
    ),
    rest: (a) => ({
      method: "POST",
      path: "/api/agents/deliver",
      body: { outcomeId: a.outcomeId, providerId: a.providerId, feedback: a.feedback },
    }),
  },
  {
    name: "verify_outcome",
    description: "Run deterministic acceptance checks plus two independent evaluator agents; stores the PASS/FAIL verdict.",
    inputSchema: obj(ID, ["outcomeId"]),
    rest: (a) => ({ method: "POST", path: "/api/agents/verify", body: { outcomeId: a.outcomeId } }),
  },
  {
    name: "approve_outcome",
    description:
      "Record approval of a freshly verified PASS outcome. The approver is recorded as the authenticated AgentID identity — the human gate still applies: no approval, no settlement.",
    inputSchema: obj(ID, ["outcomeId"]),
    rest: (a, ctx) => ({
      method: "POST",
      path: "/api/agents/approve",
      body: { outcomeId: a.outcomeId, approver: `agentid:${ctx.user.email ?? ctx.user.sub}` },
    }),
  },
  {
    name: "prepare_settlement",
    description: "Create the PayPal AUTHORIZE order for the team total of a verified, approved outcome; returns the buyer approval URL.",
    inputSchema: obj(ID, ["outcomeId"]),
    rest: (a) => ({ method: "POST", path: "/api/agents/prepare-settlement", body: { outcomeId: a.outcomeId } }),
  },
  {
    name: "settle_outcome",
    description:
      "Policy-gated capture: the policy engine re-checks verification PASS, human approval, and buyer authorization, then captures and records the simulated provider allocation.",
    inputSchema: obj(ID, ["outcomeId"]),
    rest: (a) => ({ method: "POST", path: "/api/agents/settle", body: { outcomeId: a.outcomeId } }),
  },
  {
    name: "get_ledger",
    description: "The hash-chained (SHA-256) audit trail for an outcome, in order.",
    inputSchema: obj(ID, ["outcomeId"]),
    rest: (a) => ({ method: "GET", path: `/api/agents/ledger?outcomeId=${encodeURIComponent(String(a.outcomeId))}` }),
  },
  {
    name: "verify_ledger",
    description: "Recompute every hash link in an outcome's audit chain; returns {valid}.",
    inputSchema: obj(ID, ["outcomeId"]),
    rest: (a) => ({ method: "GET", path: `/api/agents/ledger/verify?outcomeId=${encodeURIComponent(String(a.outcomeId))}` }),
  },
  {
    name: "get_receipt",
    description: "The full JSON audit receipt: contract, bids, evidence, checks, approval, PayPal IDs, allocations, hash chain.",
    inputSchema: obj(ID, ["outcomeId"]),
    rest: (a) => ({ method: "GET", path: `/api/agents/receipt?outcomeId=${encodeURIComponent(String(a.outcomeId))}` }),
  },
];

function unauthorized(request: Request): Response {
  const origin = new URL(request.url).origin;
  return new Response(
    JSON.stringify({
      ok: false,
      error: "unauthorized",
      message: "MCP requires an AgentID-issued OAuth Bearer token. See the protected resource metadata.",
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

async function authenticate(request: Request): Promise<UserInfo | null> {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  try {
    return await fetchUserInfo(match[1]);
  } catch {
    return null;
  }
}

function rpcResult(id: unknown, result: unknown): Response {
  return json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: unknown, code: number, message: string): Response {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

async function callTool(
  request: Request,
  id: unknown,
  tool: ToolDef,
  args: Record<string, unknown>,
  user: UserInfo
): Promise<Response> {
  const origin = new URL(request.url).origin;
  const spec = tool.rest(args, { user });
  const res = await fetch(`${origin}${spec.path}`, {
    method: spec.method,
    headers: { "Content-Type": "application/json" },
    body: spec.body !== undefined ? JSON.stringify(spec.body) : undefined,
  });
  const data = (await res.json().catch(() => ({ ok: false, error: "bad_upstream", message: "Upstream returned non-JSON." }))) as Record<string, unknown>;
  return rpcResult(id, {
    content: [{ type: "text", text: JSON.stringify(data) }],
    isError: data.ok === false,
  });
}

async function handle(request: Request): Promise<Response> {
  if (request.method === "GET" || request.method === "DELETE") {
    return unauthorized(request);
  }
  const user = await authenticate(request);
  if (!user) return unauthorized(request);

  let msg: Record<string, unknown>;
  try {
    msg = (await request.json()) as Record<string, unknown>;
  } catch {
    return rpcError(null, -32700, "Parse error: body must be JSON-RPC 2.0.");
  }
  const id = msg.id;
  const method = String(msg.method ?? "");
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize": {
      const params = (msg.params ?? {}) as Record<string, unknown>;
      return rpcResult(id, {
        protocolVersion: typeof params.protocolVersion === "string" ? params.protocolVersion : "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: SERVER,
        instructions:
          "OutcomePay: agents buy verified results, settled by PayPal. Tools mirror the REST pipeline; settlement requires verification PASS plus a recorded approval.",
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, {
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });
    case "tools/call": {
      const params = (msg.params ?? {}) as Record<string, unknown>;
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${String(params.name)}`);
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      return callTool(request, id ?? null, tool, args, user);
    }
    default:
      if (isNotification) return new Response(null, { status: 202 });
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export const POST = withErrors(async (request: Request) => handle(request));
export const GET = withErrors(async (request: Request) => handle(request));
export const DELETE = withErrors(async (request: Request) => handle(request));
