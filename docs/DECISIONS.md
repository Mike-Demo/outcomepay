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

## Hash-chained audit ledger (2026-10-04)
- `functions/_core/ledger.ts`: every lifecycle event appends an entry chaining
  the SHA-256 of the previous entry (`outcome.published → team.formed →
  artifact.delivered → verification.completed → approval.recorded →
  settlement.prepared → settlement.captured`). Canonical JSON (sorted keys),
  genesis prev-hash is 64 zeros. Verified: `crypto.subtle` works in the
  functions runtime.
- Public endpoints: `GET /api/agents/ledger?outcomeId=` (read the chain),
  `GET /api/agents/ledger/verify?outcomeId=` (recompute every link).
- `POST /api/agents/ledger/backfill` is a one-time idempotent migration that
  rebuilds a chain from existing DB records in chronological order.
- Transparency log: `scripts/export-ledger.sh` writes `ledger/<outcomeId>.json`
  to the public repo; `scripts/verify-ledger.py` verifies offline (independent
  implementation — TypeScript/SubtleCrypto vs Python/hashlib agree).
- UI: settlement receipt shows its ledger entry + an audit-trail block with a
  Verify chain button. The video line: "We borrowed blockchain's best idea —
  the hash chain — and left the casino behind."
- No chain, no token, no wallet, no gas. The money stays anchored in PayPal's
  ledger (real order/auth/capture IDs); the hash chain covers everything around
  the money.

## Code review fixes (2026-10-13)
A full code review (2026-10-13) plus a live stress-test run produced these
changes, all deployed and verified against the live space:
- **Policy gate on legacy PayPal routes.** `/api/paypal/authorize` and
  `/api/paypal/capture` now refuse any order/authorization that belongs to an
  agent settlement (`policy_gated`). Settlement money moves only through
  `POST /api/agents/settle`. The standalone routes remain for harness orders.
- **Approval freshness.** `approve` rejects when artifacts are newer than the
  PASS verification (`stale_verification`), and `deliver` now invalidates a
  recorded approval when new artifacts land (ledger: `approval.invalidated`).
  Settled outcomes are sealed: `deliver` rejects with `already_settled`.
- **LLM resilience.** Retries on 429/5xx (3s/8s/15s backoff) + 60s per-attempt
  timeout in the LLM client.
- **Evaluator semantics.** Reviewers never see other reviewers' reports
  (independence). Reviewer context is trimmed per kind — the landing page gets
  its full document, because a truncated page reads as "incomplete markup" and
  caused a false FAIL. Reviewer A's rubric is explicit: JSON keys and CLI
  command names stay English by design; only string *values* are judged.
- **Checks accept regional lang tags** (`lang="es-US"`), not just `lang="es"`.
- Verified live on outcome `out_mv72gjbmtsytm3`: reviewer split → feedback
  loop → PASS (A 100 / B 92) → approval → re-delivery invalidated approval →
  stale approval rejected → re-verify → approval accepted. Ledger: 31
  entries, chain intact; a tampered export copy is detected as BROKEN by
  `scripts/verify-ledger.py`.

## Agent-readiness build (2026-10-13)

Goal: make OutcomePay discoverable and operable by agents end-to-end, and
close the silicon-friendly / Ora audit gaps without changing the pipeline's
trust model. Shipped in versions v33–v36.

- **AgentID sign-in, unlisted.** A dedicated OutcomePay app was created in
  the AgentID console (Other/OIDC, client_secret_basic, redirect
  `https://outcomepay.view.fast/auth/callback`); the listing was never
  requested. Credentials live only as write-only SpaceFast env vars
  (`AGENTID_CLIENT_ID`, `AGENTID_CLIENT_SECRET`). Flow: `/auth` page →
  `/auth/login` (state + PKCE cookies) → issuer waiting page, where an
  agent authorizes its AgentMail inbox via the AgentMail authorize API
  (agent inboxes have no human account; the email-code path is a dead
  end) → `/auth/callback` exchanges the code, verifies the ES256 ID
  token against the issuer JWKS, fetches userinfo, renders the identity.
  The authorization leg was proven live before the callback existed; the
  full callback run is the standing verification step.
- **MCP server.** `POST /mcp` — streamable-HTTP JSON-RPC, 13 tools mapped
  1:1 onto the REST endpoints, dispatched by internal calls so the policy
  gates stay in exactly one place. Auth = AgentID Bearer validated
  against userinfo per call; unauthenticated requests get 401 +
  `WWW-Authenticate` naming the protected resource metadata.
- **Idempotency.** `Idempotency-Key` honored on outcome creation and
  settle (24h store keyed by key+endpoint; replays return the original
  response with an `Idempotency-Replayed` header). Live-verified.
- **Discovery surface.** A2A card at both `agent.json` and
  `agent-card.json`, ARD + AI catalogs, MCP server card, agent skills
  index (agentskills.io v0.2.0 schema), RFC 9728 PRM, RFC 8414 AS
  metadata with a WorkOS-profile `agent_auth` block, `auth.md`,
  `pricing.md`, markdown twins, NLWeb schemamap, sitemap with lastmod.
- **OpenAPI rebuilt programmatically** after the hand-written draft
  shipped with a brace imbalance and a top-level `securitySchemes` (Ora:
  "found but failed to parse"). The spec is now generated-checked:
  23 paths / 24 operations, every operation described, typed responses.
- **Platform quirks recorded.** (1) The SpaceFast edge 404s static `.md`
  files from the export, so the root markdown docs are served by
  generated function routes (`scripts/gen-md-routes.py` builds
  `functions/*.md.ts` from `public/*.md`). (2) Audit crawlers (Ora)
  receive HTTP 429s and bot-UA blocks from the edge mid-scan, so
  external scores under-report the served surface; Ora still moved
  47 → 55, silicon-friendly ≈ 9/30 → ≈ 23/30 (scorecard in the audit
  runs directory). Deliberately unbuilt: webhooks, L5 features,
  Web Bot Auth signatures, and an npm SDK (a publishing decision,
  not a code gap).

## Future adds — external discovery (deferred 2026-10-13, Demo's direction)

OutcomePay is a proof of concept and is deliberately NOT being promoted or
listed anywhere. The AgentID app stays unlisted ("Get Listed" never
requested). The following external-discovery items surfaced by the Ora
audit are recorded as future adds only, to be revisited if the project
ever goes beyond PoC:

- Brand/search presence for "OutcomePay" (indexing, press, backlinks)
- npm (or PyPI) package for the CLI/SDK (the CLI ships in-repo today)
- skills.sh listing for the OutcomePay skill (ships as a local skill)
- Wikipedia / Wikidata entity
- ChatGPT app / connector directory listing
- Agent Plugins manifest (plugin.json) in the repo

Nothing here blocks the hackathon submission: judges receive direct
links (repo, hosted demo, video) from the Devpost entry.

## GitHub Copilot stack validation + remediation (2026-10-13)

At Demo's direction the whole stack was validated by GitHub Copilot
(issue #1, PR #2). Verdict: FAIL on all seven dimensions under a strict
standard. Every load-bearing claim was re-verified against the code by
Cane before acting — the findings held up. Fixed the same day (v37):

- Legacy PayPal authorize/capture now FAIL CLOSED when no database is
  configured (`no_database`) instead of skipping the settlement gate.
- Settle compares the live PayPal order amount against the persisted
  settlement amount before capture (`amount_mismatch`).
- AgentID ID-token verification is strict: a numeric, unexpired `exp` is
  required and the signing key must match by `kid` (no first-key
  fallback). The callback is fail-closed: no valid ID token, no
  signed-in page (it previously proceeded on userinfo alone).
- `PAYPAL_ENVIRONMENT=LIVE` is refused in code (`live_refused`) so the
  sandbox-only claims are enforced, not just documented.
- Doc precision: README's "funds held when the team forms" corrected;
  auth.md's identity wording reconciled with the public-by-design REST
  pipeline; OpenAPI completed with the four operations it had omitted
  (`/api/paypal/order`, `/return`, `/cancel`, ledger backfill).

Accepted as documented prototype risks (not fixed): capture-path
concurrency has no atomic claim (PayPal's duplicate-capture rejection is
the backstop; noted in code — and demonstrated 2026-10-13: a triple
concurrent settle produced exactly one capture, with PayPal rejecting
the mid-flight loser `AUTHORIZATION_ALREADY_CAPTURED` and the app
rejecting the late one `already_settled`), the hash chain proves
tamper-evidence of entries, not completeness or provenance, and
idempotent replay is a sequential guarantee (also confirmed empirically
2026-10-13: five concurrent same-key creates produced five outcomes —
fix candidate: atomic key reservation). The deepest finding — the approval endpoint is
unauthenticated, so "human approval" is a workflow gate rather than an
identity guarantee — is Demo's design call; the MCP path already
attributes approvals to the caller's AgentID identity.

## Approvals bound to AgentID identity (2026-10-13, Demo's decision)

The Copilot validation's top risk — the approval endpoint accepted a
caller-supplied `approver` string with no authentication — is closed by
Demo's decision to bind approvals to AgentID identity (v38):

- `POST /api/agents/approve` now requires a verified AgentID identity:
  an AgentID access token in the Authorization header (validated at the
  issuer's userinfo endpoint), or the browser session. No identity →
  401 `identity_required` with the resource-metadata challenge. The
  recorded approver is derived (`agentid:<email|sub>`), never supplied.
- A verified sign-in now also mints an 8-hour browser session: an
  HMAC-SHA256-signed cookie (key = the AgentID client secret, server-side
  only) set by /auth/callback. `GET /auth/session` reports it; the
  Command Center swaps the approve button for "Sign in with AgentID to
  approve" when signed out and shows the approving identity when in.
- MCP `approve_outcome` forwards the caller's token to the REST endpoint,
  so the identity is verified end-to-end, not asserted by the tool. The
  CLI sends OUTCOMEPAY_MCP_TOKEN as the Bearer for approve.
- Scope kept deliberate: the rest of the pipeline stays public-by-design;
  the identity-bound approval is the one record settlement cannot
  proceed without, so the gate's key is now an identity, not a string.
- Filming note: sign in at /auth once (the issuer grant persists) and
  the session covers a filming block; approvals on camera record as
  `agentid:mikedemo.jobsearch@agentmail.to`.

## 2026-10-13 (evening) — Reload-safe Command Center (v39)

- Found by the concurrency collision test, twice: the Command Center
  kept the working outcome only in React state. A page reload lost the
  run, and outcomes created via CLI/API could never be loaded into the
  UI at all (so they could not be approved in the browser either).
- Fix: an outcome picker fed by `GET /api/agents/outcomes`, restore via
  `?outcome=<id>` or localStorage, and panel hydration from
  `GET /api/agents/outcome` (contract, bids, and the team derived from
  the selected bids). The Settlement panel re-derives the sandbox
  buyer-approve link for a prepared order after a reload
  (`prepare-settlement` stays non-idempotent server-side by design).
- Server state was never at risk — the audit ledger and outcome rows
  are the source of truth; the UI now treats them that way.
