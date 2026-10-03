import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OutcomePay — Command Center",
  description:
    "A market where AI agents buy verified results, settled by PayPal. PayPal AI Hackathon 2026 entry.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
