# AGENTS.md — OutcomePay

Instructions for AI coding agents working in this repository.

## What this is

OutcomePay: a market where AI agents buy verified results, settled by PayPal. PayPal AI Hackathon 2026 entry (solo). Next.js static UI + SpaceFast functions (`functions/`), MySQL-flavored DB bindings, PayPal sandbox, Groq-hosted models, AgentID identity.

## Layout

- `app/` — Next.js static export UI (Command Center, /docs, /developers, /about, trust pages)
- `functions/` — API + auth routes (file-tree routing: `functions/api/agents/settle.ts` → `POST /api/agents/settle`); shared logic in `functions/_core/`
- `public/` — static agent surface: `llms.txt`, `openapi.json`, `robots.txt`, `sitemap.xml`, `.well-known/` (agent card, catalogs, PRM)
- `scripts/` — `publish.sh` (build + deploy), `outcomepay.mjs` (CLI), ledger export/verify tools
- `docs/` — DECISIONS.md (architecture record), Devpost draft, video script, no-UI runbook

## Working rules

1. **Never commit secrets.** Credentials live only as SpaceFast env vars (see `.env.sample` for names). If a secret appears in a file, stop and remove it.
2. **Functions don't run under `next dev`.** Verify behavior against the live deployment after `./scripts/publish.sh` — not locally.
3. **Typecheck before publishing:** `npx tsc --noEmit` must pass.
4. **Settlement is policy-gated, always.** Verification PASS + recorded human approval + buyer authorization must all hold before capture; amounts are server-derived from the formed team. Never add a route that captures outside `functions/api/agents/settle.ts`, and never weaken the legacy-route `policy_gated` refusals.
5. **Wording is load-bearing:** say "buyer-approved budget", "order authorized", "captured after verification", "simulated provider allocation". Never write "escrow" in UI copy — the UI carries "Sandbox prototype — not a legal escrow service."
6. **Provider allocations are simulated** (internal ledger), not PayPal Payouts. Label them that way everywhere.
7. **The audit ledger is append-only and hash-chained.** Never mutate past entries; corrections are new entries.
8. Keep the agent surface in sync: when you add or change an endpoint, update `functions/api/index.ts`, `public/openapi.json`, `public/llms.txt`, and the agent card skills together.

## Verify your work

- `npx tsc --noEmit`
- `./scripts/publish.sh` then smoke the live URLs (health, changed endpoints, ledger verify on the settled demo outcome `out_mutdap0v6wtd83`)
- CLI smoke: `node scripts/outcomepay.mjs health`
