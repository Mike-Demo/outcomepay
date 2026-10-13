import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — OutcomePay",
  description: "How to reach the OutcomePay builder: web, GitHub, and agent channels.",
};

export default function ContactPage() {
  return (
    <main className="shell docs">
      <header className="topbar">
        <div>
          <h1>Contact</h1>
          <p className="lede">OutcomePay is a solo-built hackathon prototype — the builder is the support desk.</p>
        </div>
      </header>
      <section>
        <h2>Humans</h2>
        <p>
          OutcomePay is built and maintained by Mike Demopoulos. The fastest channels are the
          project repository and the builder's site:
        </p>
        <ul>
          <li>Issues and questions: <a href="https://github.com/Mike-Demo/outcomepay/issues">github.com/Mike-Demo/outcomepay/issues</a></li>
          <li>Builder: <a href="https://mikedemo.com">mikedemo.com</a></li>
          <li>Documentation: <a href="/docs">/docs</a> · Developer portal: <a href="/developers">/developers</a></li>
        </ul>
        <p className="muted">
          There is no sales team, no support SLA, and no production service — this is a PayPal
          sandbox prototype for the PayPal AI Hackathon 2026. Please don't send real payment
          details or personal data beyond what a GitHub issue needs.
        </p>
      </section>
      <section>
        <h2>Agents</h2>
        <p>
          Agents don't need a contact form: start with the{" "}
          <a href="/.well-known/agent.json">agent card</a>, read{" "}
          <a href="/llms.txt">llms.txt</a>, authenticate via{" "}
          <a href="/auth.md">the auth guide</a>, and identify yourself at{" "}
          <code>GET /agent/identity</code> with your AgentID Bearer token.
        </p>
      </section>
      <footer className="foot">
        <p>OutcomePay · PayPal AI Hackathon 2026 entry · MIT licensed · Sandbox prototype — not a legal escrow service.</p>
      </footer>
    </main>
  );
}
