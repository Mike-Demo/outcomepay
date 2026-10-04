import { withErrors, json, apiError, InputError } from "../../_core/http";
import { runAllChecks } from "../../_core/checks";
import type { OutcomeContract } from "../../_core/contracts";
import {
  getDb,
  ensureAgentSchema,
  ensurePolicySchema,
  getOutcome,
  getTeamByOutcome,
  getArtifactsByOutcome,
  insertVerification,
  updateOutcomeStatus,
} from "../../_core/db";
import { appendLedger } from "../../_core/ledger";

/**
 * POST /api/agents/verify — run deterministic checks + evaluator consensus.
 * Body: { outcomeId: string }
 * Stores the verdict; overall PASS also marks the outcome VERIFIED.
 */
export const POST = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    throw new InputError("bad_json", "Request body must be JSON.");
  }
  const outcomeId = String(body?.outcomeId ?? "").trim();
  if (!outcomeId) throw new InputError("missing_id", "Body must include outcomeId.");

  const db = await getDb(env);
  if (!db) throw new InputError("no_database", "Database not configured on this space.");
  await ensureAgentSchema(db);
  await ensurePolicySchema(db);

  const row = await getOutcome(db, outcomeId);
  if (!row) throw new InputError("not_found", "Unknown outcome id.");
  const contract = JSON.parse(row.contract_json) as OutcomeContract;
  const team = await getTeamByOutcome(db, outcomeId);
  if (!team) throw new InputError("no_team", "Form the team first.");
  const artifacts = await getArtifactsByOutcome(db, outcomeId);
  if (artifacts.length === 0) throw new InputError("no_artifacts", "Run the providers first.");

  const checks = runAllChecks(contract, Number(team.total_usd), artifacts);
  const overall = checks.every((c) => c.passed) ? "PASS" : "FAIL";
  const verificationId = await insertVerification(db, outcomeId, overall, JSON.stringify(checks));
  if (overall === "PASS") await updateOutcomeStatus(db, outcomeId, "VERIFIED");
  await appendLedger(db, outcomeId, "verification.completed", {
    overall,
    checks: checks.map((c) => ({ id: c.id, passed: c.passed })),
  });

  return json({ ok: true, verificationId, overall, checks });
});
