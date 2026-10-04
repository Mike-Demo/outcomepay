import type { Artifact, OutcomeContract, ProviderBid, TeamSelection } from "./contracts";
import { llmJson, type LlmConfig } from "./llm";
import { DEMO_CACHE } from "./cache";

/**
 * The agent network: buyer agent (goal → contract), provider agents
 * (bidding + delivery), broker (team formation). All orchestration is
 * deterministic code over structured JSON; LLMs are used only inside
 * provider deliverLive() for the creative work.
 */

export interface ProviderDef {
  id: string;
  role: string;
  capability: string;
  color: string;
  price: number;
  confidence: number;
  delivery: string;
  evidenceTypes: string[];
  blurb: string;
  /** Contract deliverables this provider can cover. */
  deliverables: string[];
  deliverLive(cfg: LlmConfig, contract: OutcomeContract, prior: Artifact[]): Promise<Omit<Artifact, "mode">[]>;
}

/** Source strings for the TidyLedger demo target (mirror demo-target/src/ledger.py). */
const TIDYLEDGER_STRINGS: Record<string, string> = {
  welcome: "Welcome to TidyLedger!",
  prompt_amount: "Enter amount: ",
  prompt_note: "Enter a note: ",
  income_added: "Income recorded.",
  expense_added: "Expense recorded.",
  invalid_amount: "That doesn't look like a number — try again.",
  monthly_summary: "Monthly summary",
  total_income: "Total income",
  total_expenses: "Total expenses",
  balance: "Balance",
  no_entries: "No entries yet this month.",
  goodbye: "Goodbye! Your ledger is saved.",
  help: "Commands: add-income, add-expense, summary, quit",
  unknown_command: "Unknown command. Type 'help'.",
  saved: "Ledger saved.",
};

const TIDYLEDGER_README = `# TidyLedger

A tiny command-line budgeting tool. Track income and expenses from your
terminal and print a monthly summary.

## Commands

- \`add-income\` — record income
- \`add-expense\` — record an expense
- \`summary\` — print the monthly summary
- \`quit\` — save and exit

## Install

\`\`\`
pip install tidyledger
tidyledger
\`\`\`
`;

export const PROVIDERS: ProviderDef[] = [
  {
    id: "localizer-01",
    role: "Localization specialist",
    capability: "es-US localization",
    color: "#86efac",
    price: 12,
    confidence: 0.91,
    delivery: "immediate",
    evidenceTypes: ["artifact", "glossary_report"],
    blurb: "Human-quality es-US translation of UI strings and docs.",
    deliverables: ["translated_copy"],
    deliverLive: async (cfg) => {
      const data = await llmJson(
        cfg,
        "You are a professional es-US software localizer. Translate naturally for US Spanish speakers. Keep CLI command names (add-income, add-expense, summary, quit) untranslated.",
        `Translate these TidyLedger UI strings to es-US Spanish and produce a Spanish README. Return JSON {"strings": {key: translated}, "readme_es": "full Spanish markdown README"}.\n\nStrings:\n${JSON.stringify(TIDYLEDGER_STRINGS, null, 1)}\n\nREADME:\n${TIDYLEDGER_README}`
      );
      return [
        { kind: "translated_copy", title: "TidyLedger UI strings (es-US)", content: JSON.stringify(data.strings, null, 2) },
        { kind: "translated_copy", title: "TidyLedger README (es-US)", content: String(data.readme_es) },
      ];
    },
  },
  {
    id: "pagebuilder-01",
    role: "Landing page builder",
    capability: "localized page generation",
    color: "#7dd3fc",
    price: 14,
    confidence: 0.88,
    delivery: "immediate",
    evidenceTypes: ["artifact"],
    blurb: "Generates a complete localized launch page from the product brief.",
    deliverables: ["landing_page"],
    deliverLive: async (cfg) => {
      const data = await llmJson(
        cfg,
        "You are a landing-page copywriter and front-end developer writing for US Spanish speakers.",
        `Create a Spanish (es-US) launch landing page for TidyLedger, a tiny fictional command-line budgeting tool for developers. Return JSON {"html": "complete standalone HTML"}. Requirements: hero with headline + subhead + download CTA, three feature blocks, a short "how it works" section, and a footer noting TidyLedger is a fictional demo project. All copy in Spanish. Single file, inline CSS, no external assets, accessible markup (lang="es", labels, alt text).`
      );
      return [{ kind: "landing_page", title: "TidyLedger launch page (es-US)", content: String(data.html) }];
    },
  },
  {
    id: "researcher-01",
    role: "Market researcher",
    capability: "developer-community research",
    color: "#c4b5fd",
    price: 5,
    confidence: 0.84,
    delivery: "immediate",
    evidenceTypes: ["artifact", "sources_list"],
    blurb: "Researches where Spanish-speaking developers gather and how to reach them.",
    deliverables: ["launch_brief"],
    deliverLive: async (cfg) => {
      const data = await llmJson(
        cfg,
        "You are a developer-relations researcher. Be practical and specific, no hype.",
        `Write a concise market brief (markdown) for launching TidyLedger — a tiny fictional CLI budgeting tool for developers — to Spanish-speaking developer communities in the US and Latin America. Return JSON {"brief_md": "..."}. Cover: 3-5 communities or channels with why each fits, localization pitfalls for dev tools in Spanish, and a 2-week launch checklist. Under 600 words.`
      );
      return [{ kind: "launch_brief", title: "Launch brief: Spanish-speaking developers", content: String(data.brief_md) }];
    },
  },
  {
    id: "reviewer-a",
    role: "Quality reviewer A",
    capability: "localization QA",
    color: "#fca5a5",
    price: 3,
    confidence: 0.9,
    delivery: "immediate",
    evidenceTypes: ["quality_report"],
    blurb: "Independent reviewer: checks translation completeness and claim fidelity.",
    deliverables: ["quality_report"],
    deliverLive: async (cfg, _contract, prior) => {
      const data = await llmJson(
        cfg,
        "You are an independent localization QA reviewer. Be strict but fair.",
        `Review these Spanish (es-US) launch-kit artifacts for TidyLedger against: no_untranslated_strings, required_sections_present. Return JSON {"score": 0-100, "passed": boolean, "findings": ["..."], "report_md": "short markdown report"}. Score below 80 fails.\n\nArtifacts:\n${prior.map((a) => `### ${a.title}\n${a.content.slice(0, 5000)}`).join("\n\n")}`
      );
      return [
        {
          kind: "quality_report",
          title: "Quality review A — localization QA",
          content: `${data.report_md}\n\n**Score: ${data.score}/100 — ${data.passed ? "PASS" : "FAIL"}**`,
        },
      ];
    },
  },
  {
    id: "reviewer-b",
    role: "Quality reviewer B",
    capability: "launch readiness review",
    color: "#fdba74",
    price: 3,
    confidence: 0.89,
    delivery: "immediate",
    evidenceTypes: ["quality_report"],
    blurb: "Independent reviewer: scores cultural fit and launch readiness.",
    deliverables: ["quality_report"],
    deliverLive: async (cfg, _contract, prior) => {
      const data = await llmJson(
        cfg,
        "You are an independent launch-readiness reviewer focused on cultural fit for US Spanish speakers.",
        `Review these Spanish (es-US) launch-kit artifacts for TidyLedger for cultural appropriateness, naturalness, and launch readiness. Return JSON {"score": 0-100, "passed": boolean, "findings": ["..."], "report_md": "short markdown report"}. Score below 80 fails.\n\nArtifacts:\n${prior.map((a) => `### ${a.title}\n${a.content.slice(0, 5000)}`).join("\n\n")}`
      );
      return [
        {
          kind: "quality_report",
          title: "Quality review B — launch readiness",
          content: `${data.report_md}\n\n**Score: ${data.score}/100 — ${data.passed ? "PASS" : "FAIL"}**`,
        },
      ];
    },
  },
  // --- Decoy providers: they bid, the broker rejects them (visible in the UI).
  {
    id: "localizer-02",
    role: "Localization specialist",
    capability: "es-US localization",
    color: "#86efac",
    price: 18,
    confidence: 0.62,
    delivery: "24h",
    evidenceTypes: ["artifact"],
    blurb: "Generalist translator, slower turnaround.",
    deliverables: ["translated_copy"],
    deliverLive: async () => {
      throw new Error("localizer-02 never delivers: it loses the bid.");
    },
  },
  {
    id: "pagebuilder-02",
    role: "Landing page builder",
    capability: "localized page generation",
    color: "#7dd3fd",
    price: 22,
    confidence: 0.7,
    delivery: "24h",
    evidenceTypes: ["artifact"],
    blurb: "Premium studio, premium price.",
    deliverables: ["landing_page"],
    deliverLive: async () => {
      throw new Error("pagebuilder-02 never delivers: it loses the bid.");
    },
  },
  {
    id: "quickmt-01",
    role: "Machine-translation API",
    capability: "bulk machine translation",
    color: "#94a3b8",
    price: 4,
    confidence: 0.41,
    delivery: "immediate",
    evidenceTypes: ["artifact"],
    blurb: "Raw machine translation, no human post-editing.",
    deliverables: ["translated_copy"],
    deliverLive: async () => {
      throw new Error("quickmt-01 never delivers: it loses the bid.");
    },
  },
];

export const providerById = new Map(PROVIDERS.map((p) => [p.id, p]));

/* ---------------- Buyer agent: goal → outcome contract ---------------- */

const TESTS_FOR: Record<string, string[]> = {
  translated_copy: ["no_untranslated_strings", "required_sections_present"],
  landing_page: ["required_sections_present", "accessibility_score_gte_80"],
  launch_brief: ["required_sections_present"],
  quality_report: ["evaluator_consensus_gte_80"],
};

export function buildContract(goal: string, budgetUsd?: number): OutcomeContract {
  const text = goal.toLowerCase();
  let budget = budgetUsd && budgetUsd > 0 ? budgetUsd : 40;
  if ((!budgetUsd || budgetUsd <= 0) && /\$\s?(\d+(?:\.\d{1,2})?)|budget\D{0,12}(\d+(?:\.\d{1,2})?)|under\D{0,12}(\d+(?:\.\d{1,2})?)/.test(text)) {
    const m = text.match(/\$?\s?(\d+(?:\.\d{1,2})?)/);
    if (m) budget = Number(m[1]);
  }

  const deliverables: string[] = [];
  if (/translat|spanish|espa[ñn]ol|locali[sz]/.test(text)) deliverables.push("translated_copy");
  // "launch kit" implies the full kit: a landing page plus a launch brief
  if (/landing|launch/.test(text)) deliverables.push("landing_page");
  if (/research|market|audience|communit|brief|\bkit\b/.test(text)) deliverables.push("launch_brief");
  if (/review|quality|check|validat/.test(text)) deliverables.push("quality_report");
  if (deliverables.length === 0) {
    deliverables.push("translated_copy", "landing_page", "launch_brief", "quality_report");
  }

  const acceptance_tests = [...new Set(deliverables.flatMap((d) => TESTS_FOR[d] ?? []))];
  return {
    contract_version: "1.0",
    goal: goal.trim().slice(0, 500),
    budget,
    currency: "USD",
    deliverables,
    acceptance_tests,
    payment_policy: {
      human_approval_required: true,
      capture_after_verification: true,
      approval_threshold_usd: 25,
    },
  };
}

/* ---------------- Broker: bidding + team formation ---------------- */

export function getBids(contract: OutcomeContract): ProviderBid[] {
  return PROVIDERS.filter((p) => p.deliverables.some((d) => contract.deliverables.includes(d))).map((p) => ({
    provider_id: p.id,
    capability: p.capability,
    price: p.price,
    delivery: p.delivery,
    confidence: p.confidence,
    evidence_types: p.evidenceTypes,
  }));
}

export function selectTeam(contract: OutcomeContract, bids: ProviderBid[]): TeamSelection {
  const byDeliverable = new Map<string, ProviderBid[]>();
  for (const d of contract.deliverables) byDeliverable.set(d, []);
  for (const bid of bids) {
    const def = providerById.get(bid.provider_id);
    if (!def) continue;
    for (const d of def.deliverables) {
      if (byDeliverable.has(d)) byDeliverable.get(d)!.push(bid);
    }
  }

  const selected: ProviderBid[] = [];
  const used = new Set<string>();
  // quality_report always gets two independent providers (product rule:
  // verification requires independent reviewers); others get one.
  const WANT_TWO = new Set(["quality_report"]);
  for (const d of contract.deliverables) {
    const cands = (byDeliverable.get(d) ?? [])
      .filter((b) => !used.has(b.provider_id))
      .sort((a, b) => b.confidence - a.confidence || a.price - b.price);
    const n = Math.min(WANT_TWO.has(d) ? 2 : 1, cands.length);
    for (let i = 0; i < n; i++) {
      selected.push(cands[i]);
      used.add(cands[i].provider_id);
    }
  }
  const total = selected.reduce((s, b) => s + b.price, 0);

  const rejected: Array<{ provider_id: string; reason: string }> = [];
  for (const bid of bids) {
    if (used.has(bid.provider_id)) continue;
    const def = providerById.get(bid.provider_id)!;
    let reason: string;
    if (def.id === "quickmt-01") {
      reason =
        "rejected: machine-translation-only output cannot credibly pass the evaluator_consensus_gte_80 acceptance test";
    } else {
      const overlap = selected.find((s) =>
        providerById.get(s.provider_id)!.deliverables.some((d) => def.deliverables.includes(d))
      );
      if (overlap) {
        const od = providerById.get(overlap.provider_id)!;
        reason = `rejected: ${od.id} covers the same deliverables at $${od.price} with confidence ${od.confidence}`;
      } else {
        reason = "rejected: not needed to cover the contract deliverables within budget";
      }
    }
    rejected.push({ provider_id: bid.provider_id, reason });
  }
  return { provider_ids: selected.map((s) => s.provider_id), total, rejected };
}

/* ---------------- Delivery (live or cached) ---------------- */

export function cachedArtifacts(providerId: string): Artifact[] {
  const entries = DEMO_CACHE[providerId] ?? [];
  return entries.map((e) => ({ ...e, mode: "cached" as const }));
}
