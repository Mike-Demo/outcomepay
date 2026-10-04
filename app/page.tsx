/**
 * OutcomePay command center.
 *
 * Single-screen layout:
 *   left   — the outcome contract + budget (buyer agent)
 *   center — the agent network (broker: bidding + team formation)
 *   right  — the PayPal transaction state + settlement (policy engine)
 *   bottom — the evidence timeline (provider artifacts + verification)
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import PaypalPanel from "./components/paypal-panel";
import OutcomePanel from "./components/outcome-panel";
import MarketPanel from "./components/market-panel";
import EvidencePanel from "./components/evidence-panel";
import SettlementPanel from "./components/settlement-panel";
import { api, type OutcomeStateView } from "./components/api";

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
  const [tick, setTick] = useState(0);
  const [pipeline, setPipeline] = useState<boolean[]>(PIPELINE.map(() => false));

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!outcomeId) {
      setPipeline(PIPELINE.map(() => false));
      return;
    }
    let cancelled = false;
    api<OutcomeStateView>(`/api/agents/outcome?id=${encodeURIComponent(outcomeId)}`)
      .then((s) => {
        if (cancelled) return;
        const delivered = ["DELIVERED", "VERIFIED", "SETTLED"].includes(s.outcome.status);
        const captured = !!s.settlement?.capture_id;
        setPipeline([
          true, // intent created
          true, // budget approved (contract carries the budget)
          !!s.team, // provider team formed
          delivered, // artifacts delivered
          s.verification?.overall === "PASS", // verification passed
          !!s.approval, // human approved
          captured, // PayPal captured
          captured, // outcome complete
        ]);
      })
      .catch(() => {
        /* pipeline stays as-is on fetch failure */
      });
    return () => {
      cancelled = true;
    };
  }, [outcomeId, tick]);

  const reset = () => {
    setOutcomeId(null);
    setPipeline(PIPELINE.map(() => false));
  };

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
        <div className="topbar-right">
          <div className="phase">Phase 3 · verification + settlement</div>
          {outcomeId && (
            <button className="btn btn-sm" onClick={reset} title="Start a new outcome">
              Reset demo
            </button>
          )}
        </div>
      </header>

      <ol className="pipeline">
        {PIPELINE.map((step, i) => (
          <li key={step} className={`step ${pipeline[i] ? "done" : "pending"}`}>
            <span className="dot" />
            {step}
          </li>
        ))}
      </ol>

      <section className="grid">
        <article className="panel">
          <h2>Outcome + budget</h2>
          <OutcomePanel
            onPublished={(id) => {
              setOutcomeId(id);
              bump();
            }}
          />
        </article>

        <article className="panel">
          <h2>Agent network</h2>
          <MarketPanel outcomeId={outcomeId} onTeamFormed={bump} />
        </article>

        <article className="panel">
          <h2>PayPal transaction</h2>
          <PaypalPanel />
          <h2 className="subhead">Settlement · policy engine</h2>
          <SettlementPanel outcomeId={outcomeId} onStateChange={bump} />
        </article>
      </section>

      <section className="panel timeline">
        <h2>Evidence timeline</h2>
        <EvidencePanel outcomeId={outcomeId} teamTick={tick} onStateChange={bump} />
      </section>

      <footer className="foot">
        OutcomePay · PayPal AI Hackathon 2026 entry · MIT licensed ·{" "}
        <span className="muted">built by Mike Demopoulos (solo)</span>
        <br />
        <span className="muted">Sandbox prototype — not a legal escrow service.</span>
      </footer>
    </main>
  );
}
