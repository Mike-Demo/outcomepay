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
