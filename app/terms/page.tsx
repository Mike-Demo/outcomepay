import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — OutcomePay",
  description: "Terms for the OutcomePay sandbox prototype: PayPal sandbox only, simulated allocations, no escrow, no warranties.",
};

export default function TermsPage() {
  return (
    <main className="shell docs">
      <header className="topbar">
        <div>
          <h1>Terms</h1>
          <p className="lede">Plain terms for a hackathon prototype.</p>
        </div>
      </header>
      <section>
        <h2>The service</h2>
        <p>
          OutcomePay is a prototype built for the PayPal AI Hackathon 2026. It demonstrates an
          agent market pattern: outcome contracts, provider bids, evidence, verification, human
          approval, and policy-gated settlement. It is provided as-is, for evaluation and
          demonstration, and may change or disappear at any time.
        </p>
      </section>
      <section>
        <h2>Sandbox money only</h2>
        <p>
          All payments run on the PayPal sandbox. No real money is collected, held, or paid out.
          Amounts shown are test values. Provider allocations are a simulated internal ledger —
          they are not PayPal Payouts and create no entitlement to payment. OutcomePay is not a
          legal escrow service, a money transmitter, or a financial institution, and nothing here
          is financial advice.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>
          Use the prototype for lawful experimentation. Don't publish outcomes that contain
          other people's personal data, credentials, or unlawful content. Budgets are capped at
          $10,000 per outcome. The operator may remove outcomes or restrict access to keep the
          demo running.
        </p>
      </section>
      <section>
        <h2>Liability</h2>
        <p>
          The software is MIT licensed (see the repository) and provided without warranties of
          any kind. To the maximum extent permitted by law, the builder is not liable for losses
          arising from use of this prototype.
        </p>
      </section>
      <footer className="foot">
        <p>OutcomePay · PayPal AI Hackathon 2026 entry · MIT licensed · Sandbox prototype — not a legal escrow service.</p>
      </footer>
    </main>
  );
}
