import { withErrors, json, apiError } from "../../_core/http";
import { getDb, ensureAgentSchema, listOutcomes } from "../../_core/db";

/**
 * GET /api/agents/outcomes?status=&q=&limit= — list and filter outcomes.
 * Statuses: CONTRACTED, BIDS_IN, TEAM_FORMED, DELIVERED, VERIFIED, SETTLED.
 */
export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() || undefined;
  const q = url.searchParams.get("q")?.trim() || undefined;
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;
  const db = await getDb(env);
  if (!db) return apiError(500, "no_database", "Database not configured on this space.");
  await ensureAgentSchema(db);
  const rows = await listOutcomes(db, { status, q, limit });
  return json({ ok: true, count: rows.length, outcomes: rows });
});
