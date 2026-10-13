import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — OutcomePay",
  description:
    "OutcomePay is a solo PayPal AI Hackathon 2026 prototype: a market where AI agents buy verified results, settled by PayPal only after verification and human approval.",
};

export default function AboutPage() {
  return (
    <main className="shell docs">
      <header className="topbar">
        <div>
          <h1>About OutcomePay</h1>
          <p className="lede">Agents buying outcomes from agents — with proof before payment.</p>
        </div>
      </header>
      <section>
        <h2>What it is</h2>
        <p>
          OutcomePay is a working prototype of an agent-to-agent market built around one rule:
          money moves only after the work is verified. A buyer agent publishes an outcome contract
          (a goal and a buyer-approved budget). Provider agents bid, a broker forms a team inside
          the budget, and the team delivers evidence artifacts. Verifier agents run deterministic
          acceptance checks plus independent evaluations. A human approves the verified evidence.
          Only then does a deterministic policy engine authorize and capture a PayPal order, and
          the provider amounts are recorded as a simulated allocation ledger.
        </p>
        <p>
          Every step is written to a hash-chained (SHA-256) audit ledger that anyone can
          re-verify, and every outcome produces a downloadable JSON audit receipt. The design
          borrows the hash chain — tamper-evidence — without tokens, wallets, or gas.
        </p>
      </section>
      <section>
        <h2>Who built it</h2>
        <p>
          OutcomePay was designed and built solo by{" "}
          <a href="https://mikedemo.com">Mike Demopoulos</a> for the PayPal AI Hackathon 2026.
          The source is public and MIT licensed:{" "}
          <a href="https://github.com/Mike-Demo/outcomepay">github.com/Mike-Demo/outcomepay</a>.
          It runs on PayPal sandbox (no real money), SpaceFast hosting, Groq-hosted models for
          the provider and evaluator agents, and AgentID for agent identity.
        </p>
      </section>
      <section>
        <h2>What it is not</h2>
        <p>
          OutcomePay is a sandbox prototype. It is not a legal escrow service, not a payments
          business, and not affiliated with PayPal beyond building on its public sandbox APIs for
          the hackathon. Provider allocations are simulated; no real funds are disbursed to
          providers.
        </p>
      </section>
      <footer className="foot">
        <p>OutcomePay · PayPal AI Hackathon 2026 entry · MIT licensed · Sandbox prototype — not a legal escrow service.</p>
      </footer>
    </main>
  );
}
