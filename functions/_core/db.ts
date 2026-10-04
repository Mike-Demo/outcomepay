/**
 * OutcomePay persistence — SpaceFast database.
 * Every PayPal state change is recorded here; the audit receipt (Phase 4)
 * is built from this table.
 */

export interface SpacefastDb {
  prepare(sql: string): { bind(...params: unknown[]): DbStatement };
}

export interface DbStatement {
  all(): Promise<{ results: Record<string, unknown>[] }>;
  first(): Promise<Record<string, unknown> | null>;
  run(): Promise<unknown>;
}

export interface RouteEnv {
  DB: SpacefastDb;
}

export type OrderStatus = "CREATED" | "APPROVED" | "AUTHORIZED" | "CAPTURED" | "CANCELLED" | "FAILED";

export interface OrderRow {
  id: string;
  paypal_order_id: string;
  authorization_id: string | null;
  capture_id: string | null;
  amount_usd: string;
  description: string;
  status: OrderStatus;
  raw_json: string | null;
  created_at: number;
  updated_at: number;
}

const SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS paypal_orders (
    id VARCHAR(64) PRIMARY KEY,
    paypal_order_id VARCHAR(64) NOT NULL,
    authorization_id VARCHAR(64) NULL,
    capture_id VARCHAR(64) NULL,
    amount_usd VARCHAR(16) NOT NULL,
    description VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    raw_json MEDIUMTEXT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    INDEX idx_paypal_order_id (paypal_order_id)
  )`,
];

export async function ensureSchema(db: SpacefastDb): Promise<void> {
  for (const sql of SCHEMA) {
    await db.prepare(sql).bind().run();
  }
}

export function newOrderId(): string {
  return `ord_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function insertOrder(
  db: SpacefastDb,
  o: { paypalOrderId: string; amountUsd: string; description: string; status: OrderStatus; rawJson?: string }
): Promise<string> {
  const id = newOrderId();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO paypal_orders
        (id, paypal_order_id, authorization_id, capture_id, amount_usd, description, status, raw_json, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, o.paypalOrderId, o.amountUsd, o.description, o.status, o.rawJson ?? null, now, now)
    .run();
  return id;
}

export async function getOrderByPaypalId(db: SpacefastDb, paypalOrderId: string): Promise<OrderRow | null> {
  const r = await db
    .prepare(`SELECT * FROM paypal_orders WHERE paypal_order_id = ? LIMIT 1`)
    .bind(paypalOrderId)
    .first();
  return (r as unknown as OrderRow) ?? null;
}

export async function updateOrder(
  db: SpacefastDb,
  paypalOrderId: string,
  patch: { status?: OrderStatus; authorizationId?: string; captureId?: string; rawJson?: string }
): Promise<void> {
  const sets: string[] = ["updated_at = ?"];
  const vals: unknown[] = [Date.now()];
  if (patch.status) {
    sets.push("status = ?");
    vals.push(patch.status);
  }
  if (patch.authorizationId) {
    sets.push("authorization_id = ?");
    vals.push(patch.authorizationId);
  }
  if (patch.captureId) {
    sets.push("capture_id = ?");
    vals.push(patch.captureId);
  }
  if (patch.rawJson !== undefined) {
    sets.push("raw_json = ?");
    vals.push(patch.rawJson);
  }
  vals.push(paypalOrderId);
  await db.prepare(`UPDATE paypal_orders SET ${sets.join(", ")} WHERE paypal_order_id = ?`).bind(...vals).run();
}

/* ---------------- Agent-economy tables ---------------- */

export type OutcomeStatus =
  | "DRAFT"
  | "CONTRACTED"
  | "BIDS_IN"
  | "TEAM_FORMED"
  | "DELIVERED"
  | "VERIFIED"
  | "SETTLED";

export interface OutcomeRow {
  id: string;
  goal: string;
  budget_usd: string;
  contract_json: string;
  status: OutcomeStatus;
  created_at: number;
  updated_at: number;
}

export interface BidRow {
  id: string;
  outcome_id: string;
  provider_id: string;
  capability: string;
  price_usd: string;
  confidence: number;
  evidence_types: string;
  decision: string;
  decision_reason: string | null;
  created_at: number;
}

export interface TeamRow {
  id: string;
  outcome_id: string;
  provider_ids: string;
  total_usd: string;
  created_at: number;
}

export interface ArtifactRow {
  id: string;
  outcome_id: string;
  provider_id: string;
  kind: string;
  title: string;
  content: string;
  mode: string;
  created_at: number;
}

const AGENT_SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS outcomes (
    id VARCHAR(64) PRIMARY KEY,
    goal TEXT NOT NULL,
    budget_usd VARCHAR(16) NOT NULL,
    contract_json MEDIUMTEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    INDEX idx_outcomes_status (status)
  )`,
  `CREATE TABLE IF NOT EXISTS bids (
    id VARCHAR(64) PRIMARY KEY,
    outcome_id VARCHAR(64) NOT NULL,
    provider_id VARCHAR(64) NOT NULL,
    capability VARCHAR(128) NOT NULL,
    price_usd VARCHAR(16) NOT NULL,
    confidence DOUBLE NOT NULL,
    evidence_types TEXT NOT NULL,
    decision VARCHAR(16) NOT NULL,
    decision_reason TEXT NULL,
    created_at BIGINT NOT NULL,
    INDEX idx_bids_outcome (outcome_id)
  )`,
  `CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(64) PRIMARY KEY,
    outcome_id VARCHAR(64) NOT NULL,
    provider_ids TEXT NOT NULL,
    total_usd VARCHAR(16) NOT NULL,
    created_at BIGINT NOT NULL,
    INDEX idx_teams_outcome (outcome_id)
  )`,
  `CREATE TABLE IF NOT EXISTS artifacts (
    id VARCHAR(64) PRIMARY KEY,
    outcome_id VARCHAR(64) NOT NULL,
    provider_id VARCHAR(64) NOT NULL,
    kind VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    mode VARCHAR(16) NOT NULL,
    created_at BIGINT NOT NULL,
    INDEX idx_artifacts_outcome (outcome_id)
  )`,
];

export async function ensureAgentSchema(db: SpacefastDb): Promise<void> {
  for (const sql of AGENT_SCHEMA) {
    await db.prepare(sql).bind().run();
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function insertOutcome(
  db: SpacefastDb,
  o: { goal: string; budgetUsd: string; contractJson: string }
): Promise<string> {
  const id = newId("out");
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO outcomes (id, goal, budget_usd, contract_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'CONTRACTED', ?, ?)`
    )
    .bind(id, o.goal, o.budgetUsd, o.contractJson, now, now)
    .run();
  return id;
}

export async function getOutcome(db: SpacefastDb, id: string): Promise<OutcomeRow | null> {
  const r = await db.prepare(`SELECT * FROM outcomes WHERE id = ? LIMIT 1`).bind(id).first();
  return (r as unknown as OutcomeRow) ?? null;
}

export async function updateOutcomeStatus(db: SpacefastDb, id: string, status: OutcomeStatus): Promise<void> {
  await db
    .prepare(`UPDATE outcomes SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, Date.now(), id)
    .run();
}

export async function replaceBids(
  db: SpacefastDb,
  outcomeId: string,
  bids: Array<{
    provider_id: string;
    capability: string;
    price: number;
    confidence: number;
    evidence_types: string[];
    decision: string;
    decision_reason: string | null;
  }>
): Promise<void> {
  await db.prepare(`DELETE FROM bids WHERE outcome_id = ?`).bind(outcomeId).run();
  const now = Date.now();
  for (const b of bids) {
    await db
      .prepare(
        `INSERT INTO bids (id, outcome_id, provider_id, capability, price_usd, confidence, evidence_types, decision, decision_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        newId("bid"),
        outcomeId,
        b.provider_id,
        b.capability,
        b.price.toFixed(2),
        b.confidence,
        JSON.stringify(b.evidence_types),
        b.decision,
        b.decision_reason,
        now
      )
      .run();
  }
}

export async function getBidsByOutcome(db: SpacefastDb, outcomeId: string): Promise<BidRow[]> {
  const r = await db
    .prepare(`SELECT * FROM bids WHERE outcome_id = ? ORDER BY confidence DESC`)
    .bind(outcomeId)
    .all();
  return (r.results as unknown as BidRow[]) ?? [];
}

export async function insertTeam(
  db: SpacefastDb,
  outcomeId: string,
  providerIds: string[],
  totalUsd: number
): Promise<string> {
  const id = newId("team");
  await db
    .prepare(`INSERT INTO teams (id, outcome_id, provider_ids, total_usd, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, outcomeId, JSON.stringify(providerIds), totalUsd.toFixed(2), Date.now())
    .run();
  return id;
}

export async function getTeamByOutcome(db: SpacefastDb, outcomeId: string): Promise<TeamRow | null> {
  const r = await db
    .prepare(`SELECT * FROM teams WHERE outcome_id = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(outcomeId)
    .first();
  return (r as unknown as TeamRow) ?? null;
}

export async function replaceArtifacts(
  db: SpacefastDb,
  outcomeId: string,
  providerId: string,
  artifacts: Array<{ kind: string; title: string; content: string; mode: string }>
): Promise<void> {
  await db
    .prepare(`DELETE FROM artifacts WHERE outcome_id = ? AND provider_id = ?`)
    .bind(outcomeId, providerId)
    .run();
  const now = Date.now();
  for (const a of artifacts) {
    await db
      .prepare(
        `INSERT INTO artifacts (id, outcome_id, provider_id, kind, title, content, mode, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(newId("art"), outcomeId, providerId, a.kind, a.title, a.content, a.mode, now)
      .run();
  }
}

export async function getArtifactsByOutcome(db: SpacefastDb, outcomeId: string): Promise<ArtifactRow[]> {
  const r = await db
    .prepare(`SELECT * FROM artifacts WHERE outcome_id = ? ORDER BY created_at ASC`)
    .bind(outcomeId)
    .all();
  return (r.results as unknown as ArtifactRow[]) ?? [];
}

/* ---------------- Verification / approvals / settlements ---------------- */

export interface VerificationRow {
  id: string;
  outcome_id: string;
  overall: "PASS" | "FAIL";
  checks_json: string;
  created_at: number;
}

export interface ApprovalRow {
  id: string;
  outcome_id: string;
  approver: string;
  created_at: number;
}

export interface SettlementRow {
  id: string;
  outcome_id: string;
  paypal_order_id: string;
  authorization_id: string | null;
  capture_id: string | null;
  amount_usd: string;
  allocations_json: string;
  created_at: number;
  updated_at: number;
}

const POLICY_SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS verifications (
    id VARCHAR(64) PRIMARY KEY,
    outcome_id VARCHAR(64) NOT NULL,
    overall VARCHAR(8) NOT NULL,
    checks_json MEDIUMTEXT NOT NULL,
    created_at BIGINT NOT NULL,
    INDEX idx_verifications_outcome (outcome_id)
  )`,
  `CREATE TABLE IF NOT EXISTS approvals (
    id VARCHAR(64) PRIMARY KEY,
    outcome_id VARCHAR(64) NOT NULL,
    approver VARCHAR(64) NOT NULL,
    created_at BIGINT NOT NULL,
    INDEX idx_approvals_outcome (outcome_id)
  )`,
  `CREATE TABLE IF NOT EXISTS settlements (
    id VARCHAR(64) PRIMARY KEY,
    outcome_id VARCHAR(64) NOT NULL,
    paypal_order_id VARCHAR(64) NOT NULL,
    authorization_id VARCHAR(64) NULL,
    capture_id VARCHAR(64) NULL,
    amount_usd VARCHAR(16) NOT NULL,
    allocations_json MEDIUMTEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    INDEX idx_settlements_outcome (outcome_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ledger (
    id VARCHAR(64) PRIMARY KEY,
    outcome_id VARCHAR(64) NOT NULL,
    seq BIGINT NOT NULL,
    kind VARCHAR(64) NOT NULL,
    payload_json MEDIUMTEXT NOT NULL,
    prev_hash VARCHAR(128) NOT NULL,
    hash VARCHAR(128) NOT NULL,
    created_at BIGINT NOT NULL,
    INDEX idx_ledger_outcome (outcome_id)
  )`,
];

export async function ensurePolicySchema(db: SpacefastDb): Promise<void> {
  for (const sql of POLICY_SCHEMA) {
    await db.prepare(sql).bind().run();
  }
}

export async function insertVerification(
  db: SpacefastDb,
  outcomeId: string,
  overall: "PASS" | "FAIL",
  checksJson: string
): Promise<string> {
  const id = newId("ver");
  await db
    .prepare(`INSERT INTO verifications (id, outcome_id, overall, checks_json, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, outcomeId, overall, checksJson, Date.now())
    .run();
  return id;
}

export async function getLatestVerification(db: SpacefastDb, outcomeId: string): Promise<VerificationRow | null> {
  const r = await db
    .prepare(`SELECT * FROM verifications WHERE outcome_id = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(outcomeId)
    .first();
  return (r as unknown as VerificationRow) ?? null;
}

export async function replaceApproval(db: SpacefastDb, outcomeId: string, approver: string): Promise<string> {
  await db.prepare(`DELETE FROM approvals WHERE outcome_id = ?`).bind(outcomeId).run();
  const id = newId("appr");
  await db
    .prepare(`INSERT INTO approvals (id, outcome_id, approver, created_at) VALUES (?, ?, ?, ?)`)
    .bind(id, outcomeId, approver, Date.now())
    .run();
  return id;
}

export async function getApproval(db: SpacefastDb, outcomeId: string): Promise<ApprovalRow | null> {
  const r = await db
    .prepare(`SELECT * FROM approvals WHERE outcome_id = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(outcomeId)
    .first();
  return (r as unknown as ApprovalRow) ?? null;
}

export async function insertSettlement(
  db: SpacefastDb,
  outcomeId: string,
  paypalOrderId: string,
  amountUsd: string,
  allocationsJson: string
): Promise<string> {
  const id = newId("stl");
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO settlements (id, outcome_id, paypal_order_id, authorization_id, capture_id, amount_usd, allocations_json, created_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?)`
    )
    .bind(id, outcomeId, paypalOrderId, amountUsd, allocationsJson, now, now)
    .run();
  return id;
}

export async function getSettlementByOutcome(db: SpacefastDb, outcomeId: string): Promise<SettlementRow | null> {
  const r = await db
    .prepare(`SELECT * FROM settlements WHERE outcome_id = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(outcomeId)
    .first();
  return (r as unknown as SettlementRow) ?? null;
}

export async function updateSettlementCapture(
  db: SpacefastDb,
  id: string,
  authorizationId: string,
  captureId: string
): Promise<void> {
  await db
    .prepare(`UPDATE settlements SET authorization_id = ?, capture_id = ?, updated_at = ? WHERE id = ?`)
    .bind(authorizationId, captureId, Date.now(), id)
    .run();
}

/**
 * Best-effort database handle. Returns null when the space has no DB binding
 * (e.g. provisioning lag on a new space) so the API can run stateless —
 * the UI carries the PayPal IDs for the Phase 1 click-through.
 */
export async function getDb(env: Record<string, unknown>): Promise<SpacefastDb | null> {
  const { DB } = env as unknown as RouteEnv;
  if (!DB) return null;
  await ensureSchema(DB);
  return DB;
}
