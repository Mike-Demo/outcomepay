import { withErrors, json, apiError, InputError } from "../../_core/http";
import { providerById, cachedArtifacts } from "../../_core/agents";
import { llmConfig, LlmNotConfigured } from "../../_core/llm";
import type { Artifact, OutcomeContract } from "../../_core/contracts";
import {
  getDb,
  ensureAgentSchema,
  ensurePolicySchema,
  getOutcome,
  getTeamByOutcome,
  getArtifactsByOutcome,
  replaceArtifacts,
  updateOutcomeStatus,
} from "../../_core/db";
import { appendLedger } from "../../_core/ledger";

/**
 * POST /api/agents/deliver — run one provider's delivery for an outcome.
 * Body: { outcomeId: string, providerId: string }
 * Live when LLM_API_KEY is set; otherwise serves checked-in demo-cache
 * artifacts labeled mode:"cached". Reviewers receive prior artifacts.
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
  const providerId = String(body?.providerId ?? "").trim();
  const feedback = typeof body?.feedback === "string" && body.feedback.trim() ? body.feedback.trim().slice(0, 2000) : undefined;
  if (!outcomeId || !providerId) throw new InputError("missing_id", "Body must include outcomeId and providerId.");

  const def = providerById.get(providerId);
  if (!def) throw new InputError("unknown_provider", `Unknown provider: ${providerId}.`);

  const db = await getDb(env);
  if (!db) throw new InputError("no_database", "Database not configured on this space.");
  await ensureAgentSchema(db);
  await ensurePolicySchema(db);
  const row = await getOutcome(db, outcomeId);
  if (!row) throw new InputError("not_found", "Unknown outcome id.");
  const contract = JSON.parse(row.contract_json) as OutcomeContract;

  const team = await getTeamByOutcome(db, outcomeId);
  const teamIds: string[] = team ? (JSON.parse(team.provider_ids) as string[]) : [];
  if (!teamIds.includes(providerId)) {
    throw new InputError("not_on_team", `${providerId} is not on this outcome's team.`);
  }

  const priorRows = await getArtifactsByOutcome(db, outcomeId);
  const prior: Artifact[] = priorRows.map((a) => ({
    kind: a.kind,
    title: a.title,
    content: a.content,
    mode: a.mode as "live" | "cached",
  }));

  let artifacts: Artifact[];
  try {
    const cfg = llmConfig(env);
    const live = await def.deliverLive(cfg, contract, prior, feedback);
    artifacts = live.map((a) => ({ ...a, mode: "live" as const }));
  } catch (err) {
    if (err instanceof LlmNotConfigured) {
      artifacts = cachedArtifacts(providerId);
    } else {
      throw new InputError("deliver_failed", `Provider ${providerId} failed: ${(err as Error).message}`);
    }
  }
  if (artifacts.length === 0) {
    throw new InputError("no_artifacts", `Provider ${providerId} produced nothing.`);
  }

  await replaceArtifacts(
    db,
    outcomeId,
    providerId,
    artifacts.map((a) => ({ kind: a.kind, title: a.title, content: a.content, mode: a.mode }))
  );
  await appendLedger(db, outcomeId, "artifact.delivered", {
    provider_id: providerId,
    mode: artifacts[0].mode,
    artifacts: artifacts.map((a) => ({ kind: a.kind, title: a.title })),
  });

  // If every team member has delivered, the outcome is DELIVERED.
  const after = await getArtifactsByOutcome(db, outcomeId);
  const deliveredProviders = new Set(after.map((a) => a.provider_id));
  const allDone = teamIds.every((id) => deliveredProviders.has(id));
  if (allDone) await updateOutcomeStatus(db, outcomeId, "DELIVERED");

  return json({
    ok: true,
    providerId,
    mode: artifacts[0].mode,
    artifacts: artifacts.map((a) => ({
      kind: a.kind,
      title: a.title,
      mode: a.mode,
      content: a.content,
    })),
    outcomeStatus: allDone ? "DELIVERED" : row.status,
  });
});
