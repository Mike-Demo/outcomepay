"use client";

/**
 * WebMCP (Model Context Protocol for the web) registration.
 * When the browser exposes navigator.modelContext, register OutcomePay's
 * read tools so browser agents can call them natively. No-op elsewhere.
 */
import { useEffect } from "react";

const BASE = "";

async function callApi(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

export default function WebMcp() {
  useEffect(() => {
    const mc = (navigator as unknown as { modelContext?: unknown }).modelContext as
      | { registerTool?: (tool: unknown) => void }
      | undefined;
    if (!mc || typeof mc.registerTool !== "function") return;
    const tools = [
      {
        name: "outcomepay_get_outcome",
        description:
          "Get the full state of an OutcomePay outcome: contract, bids, team, artifacts, verification, approval, settlement.",
        inputSchema: {
          type: "object",
          properties: { outcomeId: { type: "string" } },
          required: ["outcomeId"],
        },
        execute: async (args: { outcomeId: string }) =>
          callApi(`/api/agents/outcome?id=${encodeURIComponent(args.outcomeId)}`),
      },
      {
        name: "outcomepay_list_outcomes",
        description: "List recent OutcomePay outcomes, optionally filtered by status.",
        inputSchema: {
          type: "object",
          properties: { status: { type: "string" }, limit: { type: "number" } },
        },
        execute: async (args: { status?: string; limit?: number }) => {
          const q = new URLSearchParams();
          if (args.status) q.set("status", args.status);
          if (args.limit) q.set("limit", String(args.limit));
          return callApi(`/api/agents/outcomes?${q.toString()}`);
        },
      },
      {
        name: "outcomepay_verify_ledger",
        description:
          "Recompute the hash chain of an outcome's audit ledger and report whether it is intact.",
        inputSchema: {
          type: "object",
          properties: { outcomeId: { type: "string" } },
          required: ["outcomeId"],
        },
        execute: async (args: { outcomeId: string }) =>
          callApi(`/api/agents/ledger/verify?outcomeId=${encodeURIComponent(args.outcomeId)}`),
      },
    ];
    for (const tool of tools) {
      try {
        mc.registerTool(tool);
      } catch {
        /* duplicate or unsupported — ignore */
      }
    }
  }, []);
  return null;
}
