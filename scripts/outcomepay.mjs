#!/usr/bin/env node
/**
 * OutcomePay CLI — drive the agent market from a terminal.
 * Zero dependencies (Node 18+ global fetch). Talks to the public REST API
 * and the MCP server; writes send an Idempotency-Key automatically.
 *
 * Usage:
 *   outcomepay health
 *   outcomepay outcome create --goal "..." [--budget 40]
 *   outcomepay outcome get <outcomeId>
 *   outcomepay outcomes [--status SETTLED] [--q text] [--limit 20]
 *   outcomepay search --q text [--status ...]
 *   outcomepay bids <outcomeId>
 *   outcomepay team <outcomeId>
 *   outcomepay deliver <outcomeId> <providerId> [--feedback "..."]
 *   outcomepay verify <outcomeId>
 *   outcomepay approve <outcomeId>          (needs OUTCOMEPAY_MCP_TOKEN — approvals are identity-bound)
 *   outcomepay prepare <outcomeId>
 *   outcomepay settle <outcomeId>
 *   outcomepay run <outcomeId>            bids -> team -> deliver all -> verify
 *   outcomepay ledger <outcomeId>
 *   outcomepay ledger verify <outcomeId>
 *   outcomepay receipt <outcomeId>
 *   outcomepay auth                       print the AgentID sign-in URL
 *   outcomepay mcp tools                  (needs OUTCOMEPAY_MCP_TOKEN)
 *   outcomepay mcp call <tool> '<json>'   (needs OUTCOMEPAY_MCP_TOKEN)
 *
 * Env: OUTCOMEPAY_BASE_URL (default https://outcomepay.view.fast)
 */
import { randomUUID } from "node:crypto";

const BASE = (process.env.OUTCOMEPAY_BASE_URL ?? "https://outcomepay.view.fast").replace(/\/$/, "");

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (method === "POST") headers["Idempotency-Key"] = randomUUID();
  // Approvals are identity-bound: send the AgentID access token when present.
  if (path === "/api/agents/approve" && process.env.OUTCOMEPAY_MCP_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.OUTCOMEPAY_MCP_TOKEN}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!data) fail(`${method} ${path} -> HTTP ${res.status} (non-JSON response)`);
  // Any non-2xx is a failure, whatever the body shape — an edge error
  // (e.g. a 502 problem document) may carry no `ok` field at all, and a
  // step that actually committed server-side must not print as success
  // NOR as a clean failure: the caller re-checks state before retrying.
  if (!res.ok) {
    fail(
      `${method} ${path} -> HTTP ${res.status}: ` +
        `${data.message ?? data.detail ?? data.title ?? data.error ?? "request failed"}` +
        ` (if this was a write, re-check state before retrying — it may have committed)`
    );
  }
  if (data.ok === false) fail(`${data.error ?? "error"}: ${data.message ?? `HTTP ${res.status}`}`);
  return data;
}

function print(data) {
  console.log(JSON.stringify(data, null, 2));
}

function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function mcp(rpc) {
  const token = process.env.OUTCOMEPAY_MCP_TOKEN;
  if (!token) fail("OUTCOMEPAY_MCP_TOKEN is not set — MCP requires an AgentID Bearer token.");
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(rpc),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401) fail("unauthorized: the MCP token was rejected by AgentID userinfo validation.");
  if (!data) fail(`MCP -> HTTP ${res.status} (non-JSON response)`);
  if (data.error) fail(`JSON-RPC ${data.error.code}: ${data.error.message}`);
  if (!res.ok) fail(`MCP -> HTTP ${res.status}: ${data.detail ?? data.title ?? "request failed"}`);
  return data.result;
}

async function main() {
  const [cmd, sub, ...rest] = process.argv.slice(2);
  const args = [sub, ...rest].filter((a) => a !== undefined);

  switch (cmd) {
    case "health":
      return print(await api("GET", "/api/health"));
    case "outcome": {
      if (sub === "create") {
        const goal = flag(args, "--goal");
        if (!goal) fail('outcome create needs --goal "..."');
        const budget = flag(args, "--budget");
        return print(
          await api("POST", "/api/agents/outcome", {
            goal,
            budgetUsd: budget !== undefined ? Number(budget) : undefined,
          })
        );
      }
      if (sub === "get") {
        if (!rest[0]) fail("outcome get needs an outcomeId");
        return print(await api("GET", `/api/agents/outcome?id=${encodeURIComponent(rest[0])}`));
      }
      return fail("outcome subcommands: create | get");
    }
    case "outcomes": {
      const q = new URLSearchParams();
      if (flag(args, "--status")) q.set("status", flag(args, "--status"));
      if (flag(args, "--q")) q.set("q", flag(args, "--q"));
      if (flag(args, "--limit")) q.set("limit", flag(args, "--limit"));
      return print(await api("GET", `/api/agents/outcomes?${q}`));
    }
    case "search": {
      const q = new URLSearchParams();
      if (flag(args, "--q")) q.set("q", flag(args, "--q"));
      if (flag(args, "--status")) q.set("status", flag(args, "--status"));
      return print(await api("GET", `/api/search?${q}`));
    }
    case "bids":
      if (!sub) fail("bids needs an outcomeId");
      return print(await api("POST", "/api/agents/bids", { outcomeId: sub }));
    case "team":
      if (!sub) fail("team needs an outcomeId");
      return print(await api("POST", "/api/agents/form-team", { outcomeId: sub }));
    case "deliver": {
      if (!sub || !rest[0]) fail("deliver needs <outcomeId> <providerId>");
      return print(
        await api("POST", "/api/agents/deliver", {
          outcomeId: sub,
          providerId: rest[0],
          feedback: flag(args, "--feedback"),
        })
      );
    }
    case "verify":
      if (!sub) fail("verify needs an outcomeId");
      return print(await api("POST", "/api/agents/verify", { outcomeId: sub }));
    case "approve": {
      if (!sub) fail("approve needs an outcomeId");
      return print(
        await api("POST", "/api/agents/approve", { outcomeId: sub })
      );
    }
    case "prepare":
      if (!sub) fail("prepare needs an outcomeId");
      return print(await api("POST", "/api/agents/prepare-settlement", { outcomeId: sub }));
    case "settle":
      if (!sub) fail("settle needs an outcomeId");
      return print(await api("POST", "/api/agents/settle", { outcomeId: sub }));
    case "run": {
      if (!sub) fail("run needs an outcomeId");
      console.error("→ bids");
      print(await api("POST", "/api/agents/bids", { outcomeId: sub }));
      console.error("→ form team");
      const team = await api("POST", "/api/agents/form-team", { outcomeId: sub });
      print(team);
      const state = await api("GET", `/api/agents/outcome?id=${encodeURIComponent(sub)}`);
      const providers = state.team?.provider_ids ?? team.team?.provider_ids ?? [];
      if (!providers.length) fail("no team provider ids found — cannot run deliveries");
      for (const providerId of providers) {
        console.error(`→ deliver ${providerId}`);
        print(await api("POST", "/api/agents/deliver", { outcomeId: sub, providerId }));
      }
      console.error("→ verify");
      return print(await api("POST", "/api/agents/verify", { outcomeId: sub }));
    }
    case "ledger": {
      if (sub === "verify") {
        if (!rest[0]) fail("ledger verify needs an outcomeId");
        return print(await api("GET", `/api/agents/ledger/verify?outcomeId=${encodeURIComponent(rest[0])}`));
      }
      if (!sub) fail("ledger needs an outcomeId (or: ledger verify <outcomeId>)");
      return print(await api("GET", `/api/agents/ledger?outcomeId=${encodeURIComponent(sub)}`));
    }
    case "receipt":
      if (!sub) fail("receipt needs an outcomeId");
      return print(await api("GET", `/api/agents/receipt?outcomeId=${encodeURIComponent(sub)}`));
    case "auth":
      console.log(`Sign in with AgentID: ${BASE}/auth`);
      console.log("Agents: follow the redirect from /auth/login and authorize your AgentMail inbox");
      console.log("against the waiting page's auth_token (see /llms.txt). MCP calls need the");
      console.log("resulting access token in OUTCOMEPAY_MCP_TOKEN. The same token authorizes");
      console.log("`outcomepay approve` — approvals are recorded as your AgentID identity.");
      return;
    case "mcp": {
      if (sub === "tools") {
        const result = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" });
        return print(result);
      }
      if (sub === "call") {
        const tool = rest[0];
        if (!tool) fail("mcp call needs a tool name");
        let toolArgs = {};
        if (rest[1]) {
          try { toolArgs = JSON.parse(rest[1]); } catch { fail("mcp call arguments must be JSON"); }
        }
        const result = await mcp({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: tool, arguments: toolArgs },
        });
        const text = result?.content?.[0]?.text;
        if (text) {
          try { return print(JSON.parse(text)); } catch { return console.log(text); }
        }
        return print(result);
      }
      return fail("mcp subcommands: tools | call <tool> '<json>'");
    }
    default:
      console.log("OutcomePay CLI — see the header of this file or /llms.txt for usage.");
      console.log("Commands: health, outcome, outcomes, search, bids, team, deliver, verify,");
      console.log("approve, prepare, settle, run, ledger, receipt, auth, mcp");
      if (cmd) process.exit(1);
  }
}

main().catch((err) => fail(err.message));
