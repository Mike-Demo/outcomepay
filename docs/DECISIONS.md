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

## Phase 2 agent network (2026-10-04)
- **Buyer agent** (`buildContract`): deterministic slot parsing — goal text →
  deliverables via keyword map ("launch kit" ⇒ landing_page + launch_brief),
  budget from `$NN`/field/default 40, acceptance tests per deliverable.
  Shown in the UI so parsing is inspectable, not magic.
- **Broker** (`getBids`/`selectTeam`): deterministic — best confidence then
  price per deliverable, budget enforced, uncovered deliverables are an error.
  Rejected bids carry specific reasons (price, overlap, quality bar).
- **Two-reviewer rule**: quality_report always gets two independent providers
  (verification needs independence); other deliverables get one.
- **LLM abstraction** (`functions/_core/llm.ts`): OpenAI + Anthropic via direct
  REST, configured by `LLM_PROVIDER`/`LLM_API_KEY`/`LLM_MODEL` env vars.
  Providers call `deliverLive()` when a key exists; otherwise they serve the
  checked-in `functions/_core/cache.ts` artifacts labeled `mode:"cached"`.
  The demo cache is real hand-authored work product (Spanish strings, README,
  landing page, research brief, two reviews) — never silently faked.
- **Delivery is per-provider** (`POST /api/agents/deliver`) to stay under
  function timeouts; reviewers receive prior artifacts as context.
- **Golden team**: localizer-01 ($12) + pagebuilder-01 ($14) + researcher-01
  ($5) + reviewer-a/b ($3 each) = **$37 of $40**. Decoys (localizer-02,
  pagebuilder-02, quickmt-01) bid and are visibly rejected.
- Contract types live in `functions/_core/contracts.ts` (zero imports);
  `lib/outcome-contract.ts` re-exports for the app. Never import `lib/` from
  `functions/` — the publish bundle only ships `functions/`.

## Live LLM via Groq free tier (2026-10-04)
- `LLM_BASE_URL` added to `llm.ts`: any OpenAI-compatible endpoint works.
  Space env: `LLM_PROVIDER=openai`, `LLM_BASE_URL=https://api.groq.com/openai/v1`,
  `LLM_MODEL=openai/gpt-oss-120b`, `LLM_API_KEY` (Groq key, via stdin).
- Default model per base URL: groq → `openai/gpt-oss-120b` (verified against
  Groq's live `/models` — `llama-3.3-70b-versatile` no longer exists there),
  openrouter → `openrouter/free`, else gpt-4o-mini / claude-3-5-haiku-latest.
- **Unscripted win:** first live run's localizer left `balance` untranslated;
  both independent reviewers caught it (78/100 FAIL, consensus, same fix
  suggested). This is the Phase 3 controlled-failure demo beat writing itself.
- **Constraint:** Groq free tier TPM is 8K; reviewer prompts carry all prior
  artifacts (sliced to 5000 chars each) and hit 429 once — recovered after 12s.
  For the demo video, run providers with small pauses or trim reviewer context.

## Phase 3 verification + policy engine (2026-10-04)
- **Deterministic checks** (`functions/_core/checks.ts`): `no_untranslated_strings`
  (values vs English source, case-insensitive; value==key counts as untranslated),
  `required_sections_present` (per-kind structural rules), `accessibility_score_gte_80`
  (rule-based: lang, title, single h1, img alt, input labels, landmarks — contrast
  documented as out of scope), `evaluator_consensus_gte_80` (2 reviews parsed via
  `Score: N/100 — PASS/FAIL`, both ≥ 80 and agreeing), `budget`.
- **Policy engine** (`POST /api/agents/settle`) is the ONLY path that captures.
  It enforces in order: (1) verification PASS fresher than every artifact
  (re-verifies inline if stale, blocks on FAIL), (2) human approval recorded,
  (3) PayPal order APPROVED/AUTHORIZED (authorizes if needed), (4) capture.
- **Human gates**: `POST /api/agents/approve` (requires verification PASS);
  `POST /api/agents/prepare-settlement` (requires verification PASS + approval)
  creates the $37 AUTHORIZE order and the simulated allocation ledger.
- **Feedback loop**: `deliver` accepts `feedback`; localizer/pagebuilder/researcher
  prompts include reviewer feedback on re-runs. Verified live: `balance` miss →
  FAIL → re-run with feedback → fixed → reviewers re-scored 95/86 → PASS.
- Tables: `verifications`, `approvals`, `settlements`. Outcome statuses added:
  VERIFIED, SETTLED. `capturePaypalOrder` extracted to `functions/_core/paypal.ts`.
- UI: verification checklist + re-run-with-feedback in the evidence timeline;
  settlement stepper (right column); 8-state pipeline is now data-driven with a
  Reset demo button.

## AG Grid sponsor surface (2026-10-04)
- AG Grid is a named hackathon sponsor with its own prize pool. The paypaldev
  `hackathon-paypal-ag-grid-boilerplate` is a Next.js server-component app —
  architecturally incompatible with our static-export SpaceFast setup, so we did
  NOT merge it. Instead we use AG Grid's React grid (community, MIT) surgically:
  `app/components/allocation-grid.tsx` renders the settlement receipt's provider
  allocation ledger as a sortable, filterable grid with a pinned total row
  (dark Quartz theme via the v36 Theming API — no CSS imports needed).
- Deliberately skipped: the boilerplate's live-transactions view. PayPal's
  Transaction Search API lags hours and needs a dashboard feature flag; our own
  settlement receipt with real order/capture IDs is the stronger trust beat.
