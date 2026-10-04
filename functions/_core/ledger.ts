import type { SpacefastDb } from "./db";
import { newId } from "./db";

/**
 * Tamper-evident audit ledger: hash-chained event log per outcome.
 *
 * Every meaningful event (contract published, team formed, artifact delivered,
 * verification completed, approval recorded, settlement prepared/captured) is
 * appended as an entry containing the SHA-256 of the previous entry's hash.
 * Altering any historical record breaks every later link — the same property
 * that makes blockchains auditable, with no chain, token, wallet, or gas.
 *
 * Verification is public: GET /api/agents/ledger/verify recomputes the chain.
 * Settled ledgers are also exported to ledger/<outcomeId>.json in the public
 * repo, with scripts/verify-ledger.py for offline checking.
 */

export interface LedgerEntry {
  id: string;
  seq: number;
  kind: string;
  payload: unknown;
  prevHash: string;
  hash: string;
  createdAt: number;
}

/** Genesis previous-hash for the first entry of each outcome's chain. */
export const GENESIS_HASH = "0".repeat(64);

/** Deterministic JSON: sorted keys, no whitespace. Mirrors scripts/verify-ledger.py. */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + canonicalize(record[k])).join(",")}}`;
}

export async function sha256hex(input: string): Promise<string> {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) throw new Error("No SubtleCrypto available in this runtime.");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function ledgerHash(prevHash: string, kind: string, payload: unknown): Promise<string> {
  return sha256hex(`${prevHash}|${kind}|${canonicalize(payload)}`);
}

export async function appendLedger(
  db: SpacefastDb,
  outcomeId: string,
  kind: string,
  payload: unknown
): Promise<LedgerEntry> {
  const last = (await db
    .prepare(`SELECT seq, hash FROM ledger WHERE outcome_id = ? ORDER BY seq DESC LIMIT 1`)
    .bind(outcomeId)
    .first()) as { seq: number; hash: string } | null;
  const seq = (last?.seq ?? -1) + 1;
  const prevHash = last?.hash ?? GENESIS_HASH;
  const hash = await ledgerHash(prevHash, kind, payload);
  const id = newId("led");
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO ledger (id, outcome_id, seq, kind, payload_json, prev_hash, hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, outcomeId, seq, kind, JSON.stringify(payload), prevHash, hash, now)
    .run();
  return { id, seq, kind, payload, prevHash, hash, createdAt: now };
}

export async function getLedger(db: SpacefastDb, outcomeId: string): Promise<LedgerEntry[]> {
  const r = await db
    .prepare(`SELECT * FROM ledger WHERE outcome_id = ? ORDER BY seq ASC`)
    .bind(outcomeId)
    .all();
  return ((r.results ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    seq: Number(row.seq),
    kind: String(row.kind),
    payload: JSON.parse(String(row.payload_json)),
    prevHash: String(row.prev_hash),
    hash: String(row.hash),
    createdAt: Number(row.created_at),
  }));
}

export interface LedgerCheck {
  seq: number;
  kind: string;
  hash: string;
  ok: boolean;
}

/** Recompute every link. Returns per-entry results + overall validity. */
export async function verifyLedger(
  db: SpacefastDb,
  outcomeId: string
): Promise<{ valid: boolean; entries: LedgerCheck[] }> {
  const entries = await getLedger(db, outcomeId);
  const checks: LedgerCheck[] = [];
  let prev = GENESIS_HASH;
  let valid = true;
  for (const e of entries) {
    const recomputed = await ledgerHash(prev, e.kind, e.payload);
    const ok = recomputed === e.hash && e.prevHash === prev;
    if (!ok) valid = false;
    checks.push({ seq: e.seq, kind: e.kind, hash: e.hash, ok });
    prev = e.hash;
  }
  return { valid, entries: checks };
}
