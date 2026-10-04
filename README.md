# OutcomePay

**A market where AI agents buy *results*, not products — settled by PayPal.**

A buyer agent publishes a desired outcome and budget. Specialist provider agents
bid, form a temporary team, and deliver. Independent verifier agents check the
evidence against the contract. A deterministic policy engine releases PayPal
payment only after verification passes — with a human approval gate on every
settlement.

> "Today, people pay for products and hours. OutcomePay lets AI agents form
> temporary businesses and get paid for verified results."

PayPal AI Hackathon 2026 entry. Solo build by Mike Demopoulos. MIT licensed.

**Live demo:** https://outcomepay.view.fast/ (SpaceFast)

> **Sandbox prototype — not a legal escrow service.** All payments run on
> PayPal's sandbox. Provider payouts are a simulated internal ledger.

## The idea in one loop

1. **Buyer agent** turns plain language ("Create and validate a Spanish launch
   kit for TidyLedger, budget $40") into a machine-readable **outcome contract**:
   deliverables, acceptance tests, payment policy.
2. **Broker agent** solicits structured bids from provider agents and forms the
   cheapest covering team under budget. Losing bids stay visible with reasons.
3. **Providers** deliver artifacts (localized copy, landing page, research,
   independent reviews).
4. **Verification**: deterministic checks (untranslated strings, required
   sections, accessibility, budget) plus two independent AI evaluators must
   reach consensus.
5. **Human approves** the verified outcome.
6. **Policy engine** — deterministic code, the *only* path that touches money —
   re-verifies freshness, then authorizes and **captures** the PayPal order
   (AUTHORIZE intent: funds are held when the team forms, released on proof).
7. Every event is appended to a **SHA-256 hash-chained audit ledger**; anyone
   can re-verify it via a public endpoint or offline script. No blockchain, no
   token — just the hash chain.

The golden scenario failed unscripted on its first live run (the localizer left
`balance` untranslated; both reviewers failed it 78/100). The broker re-ran the
provider with reviewer feedback, the fix landed, reviewers re-scored 95/100 and
86/100, and the policy engine settled $37.00. That failure loop *is* the demo.

## Run it locally

Requires Node.js 20+ and Bun (or npm).

```bash
git clone https://github.com/Mike-Demo/outcomepay.git
cd outcomepay
bun install          # or: npm install
cp .env.sample .env.local   # then fill in values (never commit this file)
bun run dev          # or: npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | for live PayPal | PayPal sandbox REST app credentials |
| `PAYPAL_ENVIRONMENT` | no (default `SANDBOX`) | `SANDBOX` or `LIVE` |
| `PUBLIC_BASE_URL` | for PayPal redirects | e.g. `https://outcomepay.view.fast` |
| `LLM_PROVIDER` | no (default `openai`) | `openai` or `anthropic` |
| `LLM_BASE_URL` | no | any OpenAI-compatible endpoint (e.g. Groq, OpenRouter) |
| `LLM_API_KEY` | for live providers | without it, providers serve checked-in demo artifacts labeled `cached` |
| `LLM_MODEL` | no | defaults per provider/endpoint |

Without PayPal credentials the payment panel runs its error-path harness;
without an LLM key the agent network runs on real checked-in artifacts in
`cached` mode. Nothing is ever faked silently — every artifact is labeled
`live` or `cached`.

## Deploy (SpaceFast)

```bash
./scripts/publish.sh <space> "message"   # builds, then sf publish
```

Set secrets on the space (values never touch disk):

```bash
printf '%s' "$PAYPAL_CLIENT_SECRET" | npx spacefast env set PAYPAL_CLIENT_SECRET --value-from-stdin --space <space> -y
```

GitHub pushes go through `./scripts/push-outcomepay.sh "message"` (API push;
excludes build output, `node_modules`, local env files).

## Project structure

```
app/                    Next.js 15 static-export command center
  components/           outcome-panel, market-panel, evidence-panel,
                        paypal-panel, settlement-panel, allocation-grid (AG Grid)
contracts/              outcome-contract.schema.json (+ example)
functions/              SpaceFast serverless API (shipped as the bundle)
  _core/                paypal.ts (raw REST: AUTHORIZE→authorize→capture)
                        agents.ts (buyer/broker/providers), checks.ts,
                        ledger.ts (hash chain), llm.ts (OpenAI/Anthropic/
                        OpenAI-compatible), db.ts, http.ts
  api/paypal/           create-order, order, authorize, capture, return, cancel
  api/agents/           outcome, bids, form-team, deliver, verify, approve,
                        prepare-settlement, settle, receipt, ledger, ledger/verify
demo-target/            TidyLedger — fictional CLI budgeting tool (the demo's
                        "client project"; kept fictional per hackathon rules)
ledger/                 exported hash-chained audit ledgers (transparency log)
scripts/                publish.sh, export-ledger.sh, verify-ledger.py
docs/                   DECISIONS.md, devpost-draft.md, video-script.md
```

## API sketch

| Endpoint | What it does |
|---|---|
| `POST /api/agents/outcome` | buyer agent: goal + budget → contract |
| `POST /api/agents/bids` | broker solicits bids (selected + rejected with reasons) |
| `POST /api/agents/form-team` | broker forms the team under budget |
| `POST /api/agents/deliver` | run one provider (`live` or `cached`); accepts `feedback` for revision loops |
| `POST /api/agents/verify` | deterministic checks + evaluator consensus |
| `POST /api/agents/approve` | human approval gate |
| `POST /api/agents/prepare-settlement` | creates the PayPal AUTHORIZE order |
| `POST /api/agents/settle` | **policy engine**: re-verifies, authorizes, captures |
| `GET /api/agents/receipt?outcomeId=` | full audit receipt (JSON download in the UI) |
| `GET /api/agents/ledger/verify?outcomeId=` | public hash-chain verification |

## Key design decisions

- **Raw PayPal REST, not the Agent Toolkit**: the toolkit's `create_order`
  hardcodes `intent: "CAPTURE"` (verified in source). OutcomePay needs
  `AUTHORIZE` at team formation and capture only after verification.
- **The LLM never touches money.** Bidding, delivery, and review are AI;
  capture is deterministic policy + human approval.
- **Honest labeling.** Every artifact says `live` or `cached`. The allocation
  ledger is labeled a simulated internal ledger.
- See [`docs/DECISIONS.md`](docs/DECISIONS.md) for the full record.

## License

MIT — see [LICENSE](LICENSE).
