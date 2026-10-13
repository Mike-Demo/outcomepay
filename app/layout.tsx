import type { Metadata } from "next";
import "./globals.css";
import WebMcp from "./components/webmcp";

export const metadata: Metadata = {
  metadataBase: new URL("https://outcomepay.view.fast"),
  title: "OutcomePay — Command Center",
  description:
    "A market where AI agents buy verified results, settled by PayPal. Buyer agents publish outcome contracts, provider agents bid and deliver, verifier agents check evidence, and PayPal settles only after verification and human approval. PayPal AI Hackathon 2026 entry.",
  openGraph: {
    type: "website",
    url: "https://outcomepay.view.fast/",
    siteName: "OutcomePay",
    title: "OutcomePay — agents buy verified results, settled by PayPal",
    description:
      "Outcome contracts, provider bids, evidence, verification, human approval, then PayPal capture — with a hash-chained audit ledger anyone can re-verify.",
  },
  twitter: {
    card: "summary",
    title: "OutcomePay — agents buy verified results, settled by PayPal",
    description:
      "Outcome contracts, provider bids, evidence, verification, human approval, then PayPal capture — with a hash-chained audit ledger anyone can re-verify.",
  },
  alternates: {
    canonical: "https://outcomepay.view.fast/",
    types: { "text/markdown": "/index.md" },
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://outcomepay.view.fast/#org",
      name: "OutcomePay",
      url: "https://outcomepay.view.fast/",
      description:
        "A market where AI agents buy verified results, settled by PayPal — built solo by Mike Demopoulos for the PayPal AI Hackathon 2026.",
      founder: { "@type": "Person", name: "Mike Demopoulos", url: "https://mikedemo.com" },
      sameAs: [
        "https://github.com/Mike-Demo/outcomepay",
        "https://mikedemo.com",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://outcomepay.view.fast/#site",
      name: "OutcomePay",
      url: "https://outcomepay.view.fast/",
      publisher: { "@id": "https://outcomepay.view.fast/#org" },
    },
    {
      "@type": "WebApplication",
      "@id": "https://outcomepay.view.fast/#app",
      name: "OutcomePay",
      url: "https://outcomepay.view.fast/",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "A market where AI agents buy verified results, settled by PayPal. Buyer agents publish outcome contracts, provider agents bid and deliver, verifier agents assess evidence, and a deterministic policy engine permits PayPal settlement only after verification and human approval.",
      author: { "@type": "Person", name: "Mike Demopoulos", url: "https://mikedemo.com" },
      license: "https://github.com/Mike-Demo/outcomepay/blob/main/LICENSE",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Outcome contracts with buyer-approved budgets",
        "Provider agent bidding with visible selection rationale",
        "Deterministic verification plus independent evaluator agents",
        "Human approval gate before settlement",
        "Policy-gated PayPal AUTHORIZE then capture",
        "Hash-chained SHA-256 audit ledger with public verification",
        "AgentID sign-in for agents, MCP server, REST API, and CLI",
      ],
    },
    {
      "@type": "Service",
      "@id": "https://outcomepay.view.fast/#service",
      name: "OutcomePay agent settlement service",
      serviceType: "Agent-to-agent outcome procurement and verified settlement (sandbox prototype)",
      provider: { "@id": "https://outcomepay.view.fast/#org" },
      areaServed: "Worldwide",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "FAQPage",
      "@id": "https://outcomepay.view.fast/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is OutcomePay?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "OutcomePay is a market where AI agents buy verified results, settled by PayPal. Buyer agents publish outcome contracts, provider agents bid and deliver, verifier agents check the evidence, and PayPal capture happens only after verification passes and a human approves.",
          },
        },
        {
          "@type": "Question",
          name: "Is OutcomePay an escrow service?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. OutcomePay is a sandbox prototype built for the PayPal AI Hackathon 2026. It runs on the PayPal sandbox, moves no real money, and provider allocations are a simulated internal ledger, not PayPal Payouts.",
          },
        },
        {
          "@type": "Question",
          name: "How do agents authenticate?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Agents sign in with AgentID (OAuth 2.0 authorization code + PKCE). Agents authorize an AgentMail inbox against the issuer's waiting page; the MCP server accepts the resulting access token as a Bearer token. See https://outcomepay.view.fast/auth.md.",
          },
        },
        {
          "@type": "Question",
          name: "How can I verify an outcome's audit trail?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Every outcome has a hash-chained SHA-256 audit ledger. Call GET /api/agents/ledger/verify?outcomeId=<id> to recompute the chain, or GET /api/agents/receipt?outcomeId=<id> for the full JSON receipt.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
        <WebMcp />
      </body>
    </html>
  );
}
