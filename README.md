# OutcomePay

**A market where AI agents buy *results*, not products — settled by PayPal.**

A buyer agent publishes a desired outcome and budget. Specialist provider agents
bid, form a temporary team, and deliver. Independent verifier agents check the
evidence against the contract. PayPal releases payment only after verification
passes.

> "Today, people pay for products and hours. OutcomePay lets AI agents form
> temporary businesses and get paid for verified results."

PayPal AI Hackathon 2026 entry. Solo build by Mike Demopoulos. MIT licensed.

## Status

**Phase 0 — scaffold** (2026-10-03). The command-center shell, outcome-contract
schema, PayPal payment spine (`lib/paypal.ts`), and the fictional demo target
are in place. The agent network (Phase 2) and verification pipeline (Phase 3)
are not yet built — see the roadmap below.

## The money flow (the whole idea in five steps)

1. Buyer agent turns plain language into an **outcome contract** (`contracts/`)
   with budget, deliverables, acceptance tests, and payment policy.
2. Broker agent runs **structured bidding**; providers form a team under budget.
3. PayPal order created with **intent=AUTHORIZE** — the buyer's budget
   commitment. Buyer approves; the order is authorized (funds held).
4. Providers deliver artifacts; **two independent verifier agents** + deterministic
   checks score the evidence. A **policy engine** (deterministic code, never an
   LLM) is the only thing allowed to move money.
5. On green: human approves → PayPal **capture** → receipt with real sandbox
   order/capture IDs + provider allocation ledger.

Sandbox prototype — not a legal escrow service.

## Quickstart

```bash
bun install        # or npm install
cp .env.sample .env.local   # fill in PayPal sandbox credentials
bun dev            # command center at http://localhost:3000
bun run build       # static export to out/
```

PayPal sandbox credentials: [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
→ Apps & Credentials → Sandbox → Create App. You also need a sandbox buyer
account to approve orders (same dashboard → Sandbox accounts).

## Project structure

```text
app/                  Next.js command center (single-screen demo UI)
contracts/            outcome-contract.schema.json — the machine-readable deal
lib/
  outcome-contract.ts contract + bid types, golden-scenario example
functions/
  _core/paypal.ts     PayPal spine: AUTHORIZE → authorize → capture (raw REST)
  _core/db.ts         paypal_orders table — every state change persisted
  api/health.ts       liveness check
  api/paypal/         create-order · order · authorize · capture · return · cancel
demo-target/          TidyLedger — fictional sample project the demo translates
docs/DECISIONS.md     Phase 0 decision record (why raw REST, why fictional, …)
scripts/publish.sh    SpaceFast publish (./scripts/publish.sh outcomepay)
```

## Phase 1 — payment spine click-through

The command center's PayPal panel is a live test harness. With sandbox
credentials configured (see below), the click-through is:

1. Enter amount → **Create order (AUTHORIZE)** → order row stored as CREATED
2. **Approve in PayPal sandbox ↗** — log in with a sandbox *buyer* account;
   PayPal redirects back to `/api/paypal/return`, which syncs the row to APPROVED
3. **Authorize (hold budget)** → authorization id stored, row AUTHORIZED
4. **Capture payment** → capture id stored, row CAPTURED

Every step shows the real PayPal IDs. In Phase 3, step 4 moves behind the
deterministic policy engine + human approval.

### Sandbox credentials

Local dev: copy `.env.sample` to `.env.local` and fill in `PAYPAL_CLIENT_ID` /
`PAYPAL_CLIENT_SECRET` from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
(Apps & Credentials → Sandbox). On SpaceFast, set them as space env vars
(`npx -y spacefast env` — see `sf help env`) along with
`PUBLIC_BASE_URL=https://outcomepay.view.fast` so PayPal can redirect back.

## Roadmap

- **Phase 0** (Oct 3–5): scaffold, PayPal sandbox account, repo — *you are here*
- **Phase 1** (Oct 6–12): payment spine live — authorize + capture a real sandbox order end-to-end
- **Phase 2** (Oct 13–25): agent network — buyer/broker/providers/verifiers, bidding UI
- **Phase 3** (Oct 26–Nov 1): verification + policy-gated capture, single-screen command center
- **Phase 4** (Nov 2–8): audit receipt, polish, Devpost draft, video script
- **Phase 5** (Nov 9–12): <3-min video, submit (deadline Thu Nov 12, 4:00 PM CT)

## What's real vs simulated

- **Real:** PayPal sandbox order authorize/capture with real transaction IDs;
  one live model step per demo run; deterministic acceptance checks.
- **Simulated:** provider agents (until Phase 2 wires real models); provider
  payout splits (internal ledger, labeled as such); the TidyLedger "client".

## License

MIT — see [LICENSE](LICENSE).
