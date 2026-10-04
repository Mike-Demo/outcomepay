import type { ArtifactRow } from "./db";
import { TIDYLEDGER_STRINGS } from "./agents";
import type { OutcomeContract } from "./contracts";

/**
 * Deterministic verification checks. No LLM judgment here — these are
 * precise, re-runnable rules over the artifacts. Each check documents
 * exactly what it tests so the demo can show its work.
 */

export interface CheckResult {
  id: string;
  passed: boolean;
  detail: string;
}

/** Terms that are legitimately English inside Spanish artifacts. */
const ENGLISH_WHITELIST = ["add-income", "add-expense", "summary", "quit", "tidyledger", "pip install"];

/** no_untranslated_strings: every UI string value must actually be Spanish. */
export function checkNoUntranslatedStrings(artifacts: ArtifactRow[]): CheckResult {
  const failures: string[] = [];
  for (const a of artifacts) {
    if (a.kind !== "translated_copy") continue;
    let parsed: Record<string, unknown> | null = null;
    try {
      const obj = JSON.parse(a.content);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) parsed = obj;
    } catch {
      parsed = null;
    }
    if (parsed) {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v !== "string") continue;
        const en = TIDYLEDGER_STRINGS[k];
        const normV = v.trim().toLowerCase();
        if (en && normV === en.trim().toLowerCase()) {
          failures.push(`"${k}" still in English ("${v.trim()}")`);
        } else if (normV === k.toLowerCase()) {
          failures.push(`"${k}" untranslated (value equals the key)`);
        }
      }
      continue;
    }
    // Markdown/text artifacts: scan for verbatim English source sentences.
    for (const en of Object.values(TIDYLEDGER_STRINGS)) {
      if (en.length < 15) continue;
      if (ENGLISH_WHITELIST.some((w) => en.toLowerCase().includes(w))) continue;
      if (a.content.includes(en)) {
        failures.push(`${a.title}: contains untranslated "${en.slice(0, 60)}…"`);
        break;
      }
    }
  }
  return {
    id: "no_untranslated_strings",
    passed: failures.length === 0,
    detail: failures.length > 0 ? failures.join("; ") : "All UI strings translated; command names preserved.",
  };
}

/** required_sections_present: each artifact kind carries its required structure. */
export function checkRequiredSections(artifacts: ArtifactRow[]): CheckResult {
  const failures: string[] = [];
  for (const a of artifacts) {
    if (a.kind === "landing_page") {
      if (!/<html[^>]*lang="es"/i.test(a.content)) failures.push("landing page: missing lang=\"es\"");
      if (!/<title>[^<]+<\/title>/i.test(a.content)) failures.push("landing page: missing <title>");
      if (!/<h1[\s>]/i.test(a.content)) failures.push("landing page: missing <h1>");
    } else if (a.kind === "launch_brief") {
      if (!/^#{1,3}\s+\S/m.test(a.content)) failures.push("launch brief: no headings");
      if (!/\[ \]/.test(a.content)) failures.push("launch brief: no checklist");
    } else if (a.kind === "translated_copy" && /readme/i.test(a.title)) {
      if (!/^#\s+\S/m.test(a.content)) failures.push("README: no title heading");
      if (!/instal/i.test(a.content)) failures.push("README: no install section");
    } else if (a.kind === "quality_report") {
      if (!/score/i.test(a.content)) failures.push(`${a.title}: no score recorded`);
    }
  }
  return {
    id: "required_sections_present",
    passed: failures.length === 0,
    detail: failures.length > 0 ? failures.join("; ") : "All artifacts carry their required sections.",
  };
}

/**
 * accessibility_score_gte_80: rule-based audit of the landing page.
 * Checks: lang, title, single h1, img alt text, input labels, landmarks.
 * (Color contrast needs a renderer — out of scope, documented here.)
 */
export function checkAccessibility(artifacts: ArtifactRow[]): CheckResult {
  const pages = artifacts.filter((a) => a.kind === "landing_page");
  if (pages.length === 0) {
    return { id: "accessibility_score_gte_80", passed: false, detail: "No landing page artifact to audit." };
  }
  const html = pages[0].content;
  let score = 100;
  const findings: string[] = [];
  const dock = (n: number, msg: string) => {
    score -= n;
    findings.push(msg);
  };
  if (!/<html[^>]*lang="es"/i.test(html)) dock(20, 'missing lang="es"');
  if (!/<title>[^<]+<\/title>/i.test(html)) dock(15, "missing <title>");
  const h1count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1count !== 1) dock(10, `expected exactly 1 <h1>, found ${h1count}`);
  const imgsNoAlt = [...html.matchAll(/<img[^>]*>/gi)].filter((m) => !/alt=/i.test(m[0])).length;
  if (imgsNoAlt > 0) dock(10, `${imgsNoAlt} <img> without alt text`);
  const inputsNoLabel = [...html.matchAll(/<input[^>]*>/gi)].filter(
    (m) => !/aria-label=/i.test(m[0]) && !/id=/i.test(m[0])
  ).length;
  if (inputsNoLabel > 0) dock(10, `${inputsNoLabel} <input> without a label`);
  if (!/<main[\s>]|<header[\s>]|<nav[\s>]|<footer[\s>]/i.test(html)) dock(5, "no landmark elements");
  score = Math.max(0, score);
  return {
    id: "accessibility_score_gte_80",
    passed: score >= 80,
    detail: `Score ${score}/100 (threshold 80). ${findings.length > 0 ? findings.join("; ") + "." : "All checks passed."}`,
  };
}

const SCORE_RE = /score:\s*(\d+)\s*\/\s*100\s*[—–-]\s*(pass|fail)/i;

/** evaluator_consensus_gte_80: two independent reviewers, both PASS ≥ 80, in agreement. */
export function checkEvaluatorConsensus(artifacts: ArtifactRow[]): CheckResult {
  const id = "evaluator_consensus_gte_80";
  const reports = artifacts.filter((a) => a.kind === "quality_report");
  if (reports.length < 2) {
    return { id, passed: false, detail: `Need 2 independent reviews, found ${reports.length}.` };
  }
  const parsed = reports.map((a) => {
    const m = a.content.match(SCORE_RE);
    return m ? { score: Number(m[1]), passed: m[2].toLowerCase() === "pass", title: a.title } : null;
  });
  if (parsed.some((p) => !p)) {
    return { id, passed: false, detail: "Could not parse a reviewer score (expected “Score: N/100 — PASS/FAIL”)." };
  }
  const ps = parsed as Array<{ score: number; passed: boolean; title: string }>;
  const allPass = ps.every((p) => p.passed && p.score >= 80);
  const agree = ps.every((p) => p.passed) || ps.every((p) => !p.passed);
  const passed = allPass && agree;
  return {
    id,
    passed,
    detail: ps.map((p) => `${p.title}: ${p.score}/100 ${p.passed ? "PASS" : "FAIL"}`).join("; ") + (passed ? " — consensus." : " — no consensus to pass."),
  };
}

/** budget: team cost stays within the contract budget. */
export function checkBudget(contract: OutcomeContract, teamTotal: number): CheckResult {
  const passed = teamTotal <= contract.budget;
  return {
    id: "budget",
    passed,
    detail: `Team $${teamTotal.toFixed(2)} of $${contract.budget.toFixed(2)} budget.`,
  };
}

export function runAllChecks(
  contract: OutcomeContract,
  teamTotal: number,
  artifacts: ArtifactRow[]
): CheckResult[] {
  return [
    checkNoUntranslatedStrings(artifacts),
    checkRequiredSections(artifacts),
    checkAccessibility(artifacts),
    checkEvaluatorConsensus(artifacts),
    checkBudget(contract, teamTotal),
  ];
}
