"use client";

/** Shared fetch helper + view types for the agent console. */

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string } & T;
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

export interface ContractView {
  contract_version: string;
  goal: string;
  budget: number;
  currency: string;
  deliverables: string[];
  acceptance_tests: string[];
  payment_policy: { human_approval_required: boolean; capture_after_verification: boolean; approval_threshold_usd?: number };
}

export interface BidView {
  provider_id: string;
  role: string;
  capability: string;
  price: number;
  confidence: number;
  delivery: string;
  evidence_types: string[];
  blurb: string;
  color: string;
  decision: "selected" | "rejected";
  decision_reason: string | null;
}

export interface TeamMember {
  id: string;
  role: string;
  capability: string;
  price: number;
  color: string;
}

export interface TeamView {
  id: string;
  provider_ids: string[];
  total_usd: string;
  budget_usd: string;
  rejected: Array<{ provider_id: string; reason: string }>;
  members: TeamMember[];
}

export interface ArtifactView {
  kind: string;
  title: string;
  mode: "live" | "cached";
  content: string;
  provider_id: string;
}

export interface CheckView {
  id: string;
  passed: boolean;
  detail: string;
}

export interface VerificationView {
  id: string;
  overall: "PASS" | "FAIL";
  checks: CheckView[];
  created_at: number;
}

export interface OutcomeStateView {
  outcome: {
    id: string;
    goal: string;
    budgetUsd: string;
    contract: ContractView;
    status: string;
  };
  bids: BidView[];
  team: {
    provider_ids: string[];
    total_usd: string;
  } | null;
  artifacts: ArtifactView[];
  verification: VerificationView | null;
  approval: { id: string; approver: string; created_at: number } | null;
  settlement: {
    id: string;
    paypal_order_id: string;
    authorization_id: string | null;
    capture_id: string | null;
    amount_usd: string;
    allocations: Array<{ provider_id: string; role: string; amount_usd: string }>;
  } | null;
  ledger: { count: number; head: string | null };
}
