# Devpost submission draft — OutcomePay

> DRAFT for Demo's review. Do not submit without approval.
> Deadline: Thu Nov 12, 2026, 4:00 PM CT. Target submit: Nov 11 evening.

## Project title

OutcomePay — agents buy outcomes, PayPal settles on proof

## Tagline

A market where AI agents publish outcome contracts, provider agents bid and
deliver, verifiers check the evidence, and PayPal releases payment only after
verification passes.

## Description

Commerce was designed for people choosing products. Agents don't need products
— they need outcomes. OutcomePay is infrastructure for an economy where AI
agents form temporary businesses, prove their work, and get paid, with PayPal
as the trust and settlement layer.

**How it works (golden scenario: a $40 Spanish launch kit for the fictional
open-source project TidyLedger):**

1. A **buyer agent** turns plain language into a machine-readable outcome
   contract: deliverables, acceptance tests, payment policy, budget.
2. A **broker agent** solicits structured bids from 8 provider agents and forms
   the cheapest covering team under budget ($37). Losing bids stay visible with
   reasons — including a machine-translation API rejected on quality grounds.
3. **Providers** deliver: Spanish UI strings + README, a localized landing
   page, a market research brief, and two independent quality reviews.
4. **Verification**: five deterministic checks (untranslated strings, required
   sections, accessibility ≥ 80, budget) plus two AI evaluators that must reach
   consensus ≥ 80.
5. A **human approves** the verified outcome.
6. The **policy engine** — deterministic code, the only path that touches
   money — re-verifies freshness and captures the PayPal order.

On the first live run, the localizer left `balance` untranslated. Both
reviewers failed it (78/100, consensus) and the deterministic check agreed.
Payment stayed blocked. The broker re-ran the provider with the reviewer
feedback, the fix landed, reviewers re-scored 95/100 and 86/100 — and the
policy engine settled $37.00 with real PayPal sandbox IDs. That failure loop
is the product working.

**Trust without crypto:** every lifecycle event is appended to a SHA-256
hash-chained audit ledger. Anyone can re-verify the chain via a public
endpoint or an offline script; settled ledgers are exported to the public
repo. The money itself is anchored in PayPal's ledger (real order, authorization,
and capture IDs on every receipt).

## How it uses PayPal (meaningful integration)

- Raw PayPal REST (Orders v2): orders created with `intent: "AUTHORIZE"` when
  the team forms — the buyer's budget commitment. Buyer approves, the order is
  authorized (funds held), and the policy engine captures only after
  verification passes and a human approves. (PayPal's Agent Toolkit was
  evaluated and rejected: its `create_order` hardcodes `intent: "CAPTURE"`,
  verified in source — wrong primitive for outcome-based settlement.)
- Real sandbox end-to-end: order → buyer approval → authorization → capture,
  with all IDs persisted and shown on the settlement receipt.

## How it uses AI (meaningful integration)

- Buyer agent parses natural-language goals into structured contracts.
- Five provider agents (localization, landing-page generation, market research,
  two independent reviewers) generate real artifacts via LLM at runtime.
- Two AI evaluators score evidence and must reach consensus; their feedback
  drives a genuine revision loop (critic → revision), not a scripted retry.
- Deterministic code — never the LLM — controls all money movement.

## Tech stack

Next.js 15 (static export) + SpaceFast serverless functions + SpaceFast DB.
Raw PayPal REST. OpenAI-compatible LLM layer (Groq free tier in the demo).
AG Grid for the provider allocation ledger. SHA-256 hash-chained audit log.

## Demo

- Hosted: https://outcomepay.view.fast/
- Video: <YouTube link — under 3 minutes>
- Repo: https://github.com/Mike-Demo/outcomepay (MIT)

## Built by

Mike Demopoulos (solo) — https://mikedemo.dev
