import { withErrors, json, apiError, InputError } from "../../_core/http";
import type { OutcomeContract } from "../../_core/contracts";
import {
  getDb,
  ensureAgentSchema,
  ensurePolicySchema,
  getOutcome,
  getBidsByOutcome,
  getTeamByOutcome,
  getArtifactsByOutcome,
  getLatestVerification,
  getApproval,
  getSettlementByOutcome,
} from "../../_core/db";
import { getLedger } from "../../_core/ledger";

/**
 * GET /api/agents/receipt?outcomeId= — the complete audit receipt as JSON.
 * Intent, contract, bids + selection rationale, evidence, checks, human
 * approval event, PayPal IDs, provider allocations, and the hash chain.
 * This is what the "Download receipt" button saves.
 */
export const GET = withErrors(async (request: Request, env: Record<string, unknown>) => {
  if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
  const outcomeId = new URL(request.url).searchParams.get("outcomeId") ?? "";
  if (!outcomeId.trim()) throw new InputError("missing_id", "Query param ?outcomeId=<id> is required.");
  const db = await getDb(env);
  if (!db) throw new InputError("no_database", "Database not configured on this space.");
  await ensureAgentSchema(db);
  await ensurePolicySchema(db);
  const id = outcomeId.trim();

  const row = await getOutcome(db, id);
  if (!row) throw new InputError("not_found", "Unknown outcome id.");
  const contract = JSON.parse(row.contract_json) as OutcomeContract;
  const [bids, team, artifacts, verification, approval, settlement, ledger] = await Promise.all([
    getBidsByOutcome(db, id),
    getTeamByOutcome(db, id),
    getArtifactsByOutcome(db, id),
    getLatestVerification(db, id),
    getApproval(db, id),
    getSettlementByOutcome(db, id),
    getLedger(db, id),
  ]);

  return json({
    ok: true,
    receipt: {
      generated_at: new Date().toISOString(),
      project: "OutcomePay — PayPal AI Hackathon 2026 entry",
      notice: "Sandbox prototype — not a legal escrow service.",
      outcome: {
        id: row.id,
        goal: row.goal,
        status: row.status,
        contract,
      },
      bidding: {
        bids: bids.map((b) => ({
          provider_id: b.provider_id,
          capability: b.capability,
          price_usd: b.price_usd,
          confidence: b.confidence,
          decision: b.decision,
          decision_reason: b.decision_reason,
        })),
      },
      team: team
        ? { provider_ids: JSON.parse(team.provider_ids), total_usd: team.total_usd }
        : null,
      evidence: {
        artifacts: artifacts.map((a) => ({
          provider_id: a.provider_id,
          kind: a.kind,
          title: a.title,
          mode: a.mode,
          content: a.content,
        })),
      },
      verification: verification
        ? {
            overall: verification.overall,
            checks: JSON.parse(verification.checks_json),
            created_at: new Date(verification.created_at).toISOString(),
          }
        : null,
      human_approval: approval
        ? { approver: approval.approver, approved_at: new Date(approval.created_at).toISOString() }
        : null,
      paypal: settlement
        ? {
            order_id: settlement.paypal_order_id,
            authorization_id: settlement.authorization_id,
            capture_id: settlement.capture_id,
            amount_usd: settlement.amount_usd,
            environment: "sandbox",
          }
        : null,
      provider_allocations: settlement ? JSON.parse(settlement.allocations_json) : null,
      allocations_note: "Simulated internal ledger — not a PayPal payout.",
      audit_ledger: {
        entries: ledger.map((e) => ({
          seq: e.seq,
          kind: e.kind,
          payload: e.payload,
          prev_hash: e.prevHash,
          hash: e.hash,
          created_at: new Date(e.createdAt).toISOString(),
        })),
        verify_offline: "python3 scripts/verify-ledger.py ledger/<outcomeId>.json",
      },
    },
  });
});
