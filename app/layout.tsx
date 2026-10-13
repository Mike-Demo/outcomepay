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
  alternates: { canonical: "https://outcomepay.view.fast/" },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
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
