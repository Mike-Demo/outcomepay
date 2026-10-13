import { withErrors, json, apiError } from "../_core/http";
import { getDb, ensureAgentSchema, listOutcomes } from "../_core/db";

/**
 * GET /api/search?q=&status=&limit= — search outcomes by goal text,
 * optionally filtered by status. Returns the same rows as
 * GET /api/agents/outcomes under a search-shaped envelope.
 */
export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || undefined;
  const status = url.searchParams.get("status")?.trim() || undefined;
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;
  const db = await getDb(env);
  if (!db) return apiError(500, "no_database", "Database not configured on this space.");
  await ensureAgentSchema(db);
  const rows = await listOutcomes(db, { status, q, limit });
  return json({ ok: true, query: { q: q ?? null, status: status ?? null }, count: rows.length, results: rows });
});
