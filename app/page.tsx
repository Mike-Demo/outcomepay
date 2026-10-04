/**
 * OutcomePay command center (Phase 0 scaffold).
 *
 * Single-screen layout the demo will grow into:
 *   left   — the outcome contract + budget
 *   center — the agent network
 *   right  — the PayPal transaction state
 *   bottom — the evidence timeline
 *
 * Everything below is placeholder until Phase 1 (payment spine),
 * Phase 2 (agent network) and Phase 3 (verification) land.
 */

import PaypalPanel from "./components/paypal-panel";

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

const AGENTS = [
  { role: "Buyer agent", color: "#7dd3fc", job: "intent → outcome contract" },
  { role: "Broker agent", color: "#c4b5fd", job: "bidding + team formation" },
  { role: "Providers", color: "#86efac", job: "localizer · page builder · researcher · reviewers" },
  { role: "Verifiers", color: "#fca5a5", job: "two independent evaluators" },
  { role: "Policy engine", color: "#fcd34d", job: "deterministic · gates all money movement" },
] as const;

const GOLDEN_SCENARIO = `“Create and validate a Spanish launch kit for the
TidyLedger open-source project. Budget: $40.”`;

export default function CommandCenter() {
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
        <div className="phase">Phase 0 · scaffold</div>
      </header>

      <ol className="pipeline">
        {PIPELINE.map((step) => (
          <li key={step} className="step pending">
            <span className="dot" />
            {step}
          </li>
        ))}
      </ol>

      <section className="grid">
        <article className="panel">
          <h2>Outcome + budget</h2>
          <p className="scenario">{GOLDEN_SCENARIO}</p>
          <p className="muted">
            The buyer agent turns this into a machine-readable outcome
            contract (Phase 2). Budget meter lands with the broker.
          </p>
        </article>

        <article className="panel">
          <h2>Agent network</h2>
          <ul className="agents">
            {AGENTS.map((a) => (
              <li key={a.role}>
                <span
                  className="swatch"
                  style={{ background: a.color }}
                />
                <strong>{a.role}</strong>
                <span className="muted"> — {a.job}</span>
              </li>
            ))}
          </ul>
          <p className="muted">Bidding + team formation land in Phase 2.</p>
        </article>

        <article className="panel">
          <h2>PayPal transaction</h2>
          <PaypalPanel />
        </article>
      </section>

      <section className="panel timeline">
        <h2>Evidence timeline</h2>
        <p className="muted">
          Deterministic checks + two AI evaluators report here in Phase 3.
          The policy engine captures payment only when every check is green.
        </p>
      </section>

      <footer className="foot">
        OutcomePay · PayPal AI Hackathon 2026 entry · MIT licensed ·{" "}
        <span className="muted">built by Mike Demopoulos (solo)</span>
      </footer>
    </main>
  );
}
