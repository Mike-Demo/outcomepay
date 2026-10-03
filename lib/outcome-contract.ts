/**
 * Outcome contract types + the golden-scenario example.
 * Mirrors contracts/outcome-contract.schema.json (contract_version "1.0").
 */

export interface PaymentPolicy {
  human_approval_required: boolean;
  capture_after_verification: boolean;
  /** Amounts above this always require explicit human approval. */
  approval_threshold_usd?: number;
}

export interface OutcomeContract {
  contract_version: "1.0";
  goal: string;
  budget: number;
  currency: "USD";
  deliverables: string[];
  acceptance_tests: string[];
  payment_policy: PaymentPolicy;
  expires_at?: string;
}

export interface ProviderBid {
  provider_id: string;
  capability: string;
  price: number;
  delivery: string;
  confidence: number;
  evidence_types: string[];
}

/** The golden scenario: Spanish launch kit for TidyLedger, budget $40. */
export const GOLDEN_SCENARIO_CONTRACT: OutcomeContract = {
  contract_version: "1.0",
  goal: "Create and validate a Spanish launch kit for the TidyLedger open-source project",
  budget: 40,
  currency: "USD",
  deliverables: ["translated_copy", "landing_page", "localization_report"],
  payment_policy: {
    human_approval_required: true,
    capture_after_verification: true,
    approval_threshold_usd: 25,
  },
  acceptance_tests: [
    "required_sections_present",
    "no_untranslated_strings",
    "accessibility_score_gte_80",
    "evaluator_consensus_gte_80",
  ],
};
