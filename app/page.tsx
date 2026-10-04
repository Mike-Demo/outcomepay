/**
 * OutcomePay command center.
 *
 * Single-screen layout:
 *   left   — the outcome contract + budget (buyer agent)
 *   center — the agent network (broker: bidding + team formation)
 *   right  — the PayPal transaction state
 *   bottom — the evidence timeline (provider artifacts)
 */

"use client";

import { useState } from "react";
import PaypalPanel from "./components/paypal-panel";
import OutcomePanel from "./components/outcome-panel";
import MarketPanel from "./components/market-panel";
import EvidencePanel from "./components/evidence-panel";

const PIPELINE = [
  "Intent created",
  "Budget approved",
  "Provider team formed",
  "Artifacts delivered",
  "Verification passed",
  "Human approved",
  "PayPal captured",
  "Outcome complete",
] as const;

export default function CommandCenter() {
  const [outcomeId, setOutcomeId] = useState<string | null>(null);
  const [teamTick, setTeamTick] = useState(0);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>
            OutcomePay <span className="tag">sandbox prototype</span>
          </h1>
          <p className="lede">
            Agents don&rsquo;t buy products. They buy outcomes.
          </p>
        </div>
        <div className="phase">Phase 2 · agent network</div>
      </header>

      <ol className="pipeline">
        {PIPELINE.map((step, i) => (
          <li key={step} className={`step ${i < 4 ? "done" : "pending"}`}>
            <span className="dot" />
            {step}
          </li>
        ))}
      </ol>

      <section className="grid">
        <article className="panel">
          <h2>Outcome + budget</h2>
          <OutcomePanel onPublished={setOutcomeId} />
        </article>

        <article className="panel">
          <h2>Agent network</h2>
          <MarketPanel outcomeId={outcomeId} onTeamFormed={() => setTeamTick((t) => t + 1)} />
        </article>

        <article className="panel">
          <h2>PayPal transaction</h2>
          <PaypalPanel />
        </article>
      </section>

      <section className="panel timeline">
        <h2>Evidence timeline</h2>
        <EvidencePanel outcomeId={outcomeId} teamTick={teamTick} />
      </section>

      <footer className="foot">
        OutcomePay · PayPal AI Hackathon 2026 entry · MIT licensed ·{" "}
        <span className="muted">built by Mike Demopoulos (solo)</span>
      </footer>
    </main>
  );
}
