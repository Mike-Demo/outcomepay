# Phase 0 decision record — 2026-10-03

Locked decisions for the OutcomePay build (PayPal AI Hackathon 2026).

## Concept
**OutcomePay** — a market where agents buy verified results, settled by PayPal.
Locked 2026-10-03. Fallback (pivot only, decide by Oct 30): SwarmCart on the
same payment spine.

## Team
Solo — Mike Demopoulos, built with Cane (AI assistant).

## Golden-scenario target
Fictional in-repo sample project: **TidyLedger** (`demo-target/`), a tiny
invented CLI budgeting tool. Rationale: the hackathon video rules forbid
third-party trademarks without permission, and a self-contained target lets
judges rerun the whole loop.

## Payment integration: raw REST, not the Agent Toolkit
`functions/_core/paypal.ts` uses the PayPal Orders REST API directly with
`intent: "AUTHORIZE"` → buyer approval → `authorizePaypalOrder()` →
policy-gated `capturePaypalAuthorization()`. (The spine lives server-side under
`functions/` because the Next.js app is a static export — the UI only ever
talks to it over HTTP.)

Rationale: the official `@paypal/agent-toolkit`'s `create_order` hardcodes
`intent: "CAPTURE"` (verified in `typescript/src/shared/payloadUtils.ts`,
`parseOrderDetails` — `intent: 'CAPTURE'` is a literal). OutcomePay's core
guardrail story needs AUTHORIZE-then-capture, so the money path stays on raw
REST where intent is exact. The toolkit remains an option for the Phase 2
agent function-calling layer (non-money-critical reads), to be evaluated when
the broker agent is built.

Sandbox only. The policy engine (Phase 3) is the sole caller of the
authorize/capture functions — never an LLM directly.

## Language rules for the demo
Say: "buyer-approved budget", "order authorized", "captured after
verification", "simulated provider allocation". Never say "escrow". The UI
carries a "Sandbox prototype — not a legal escrow service" label.

## Deploy
SpaceFast: Next.js static export (`output: "export"`) + serverless functions
under `functions/api/*`, published with `scripts/publish.sh --space outcomepay`
(the proven pattern from zaks-ai-gallery). Space `outcomepay` created 2026-10-03,
live at https://outcomepay.view.fast/.

## Runtime env shape (2026-10-04 — the actual root cause)
The functions runtime invokes handlers as `(request, { ctx, env, params })` —
the real bindings live one level down under `env.env`. `withErrors` unwraps
this so every route sees `{ DB, PAYPAL_CLIENT_ID, … }` directly. (An earlier
"missing DB binding" theory was wrong: `DB` was present all along, just
nested. Verified live: inner keys are `DB, PAYPAL_CLIENT_ID,
PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT, PUBLIC_BASE_URL, STORAGE`.)
`functions/_core/db.ts` `getDb()` still tolerates a missing binding, so routes
degrade to stateless rather than 500ing.
