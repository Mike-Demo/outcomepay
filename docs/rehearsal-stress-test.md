# Rehearsal stress test — runbook (prepared 2026-10-13)

A full end-to-end rehearsal of the filmed run, plus adversarial probes.
Execute stepwise with the CLI (`node scripts/outcomepay.mjs …`) and curl.
Budget time for one verify FAIL + feedback loop — reviewer scores on
materially similar artifacts have ranged 68–100.

## Happy path (the filmed flow)

1. `outcome create --goal "Create and validate a Spanish launch kit for TidyLedger" --budget 40` → record the outcome id.
2. `bids <id>` → 8 bids; 5 selected / 3 rejected with reasons; team total $37.
3. `team <id>` → TEAM_FORMED.
4. `deliver <id> <providerId>` for each of localizer-01, pagebuilder-01, researcher-01, reviewer-a, reviewer-b (in that order).
5. `verify <id>` → PASS (if FAIL: deliver with `--feedback` to the flagged providers, re-verify; max 2 loops).
6. `approve <id>` → approval recorded.
7. `prepare <id>` → PayPal approve URL — **buyer approval happens here** (Demo's tap or browser with the sandbox buyer account).
8. `settle <id>` → SETTLED with PayPal order/authorization/capture IDs.
9. `ledger verify <id>` → valid, full chain. `receipt <id>` → complete JSON.

## Adversarial probes (all must refuse correctly)

- P1 Idempotency: two `POST /api/agents/outcome` with the same `Idempotency-Key` → same id, second response carries `Idempotency-Replayed: true`.
- P2 Settle before approve (after step 5, before step 6): `settle <id>` → refused (approval missing).
- P3 Freshness: after step 6, re-deliver localizer-01 → ledger gains `approval.invalidated`; `approve <id>` → `stale_verification`; re-verify → PASS; `approve <id>` → OK. (Then continue at step 7.)
- P4 Policy gate: after settlement, legacy `POST /api/paypal/capture` with the settlement authorization id → `policy_gated`; legacy authorize on the order → `policy_gated`.
- P5 Double settle: `settle <id>` again → `already_settled`. Deliver after settle → `already_settled`.
- P6 MCP auth: `POST /mcp` tools/list without a token → HTTP 401 JSON + `WWW-Authenticate` naming the PRM. `GET /agent/identity` without a token → same contract.
- P7 Tamper evidence: export the ledger, alter one amount in the copy, `python3 scripts/verify-ledger.py` on the copy → CHAIN BROKEN; the untouched export verifies.
- P8 Rate-limit visibility: any API response carries `RateLimit-Limit: 60`.

## Pass criteria

Happy path reaches SETTLED with a valid chain and a complete receipt;
every probe P1–P8 behaves as specified; any verify FAIL is recovered via
the feedback loop within 2 iterations.

## Results — 2026-10-13 rehearsal (v37/v38)

Outcome `out_mv76my7zpaz6rw` SETTLED: PayPal order `89S50650RT636330J`,
authorization `09M90787TM670390E`, capture `9WD20716S7726693C`, $37.00.
Verification PASS on the FIRST attempt (A 100 / B 85, accessibility 100);
pipeline ~4 minutes wall clock, no feedback loop. Buyer approval was
completed by Cane in the browser using Demo's Secure Vault sandbox
buyer login (saved 2026-10-13 for sandbox.paypal.com) — Demo no longer
needs to tap for rehearsals.

Probes: P1 idempotency ✅ · P2 settle-before-approve refused ✅ (error
is `no_settlement` — the settlement-record gate fires first; narration
should say settle refuses without a prepared order + PASS + approval) ·
P3 freshness ✅ (re-delivery on out_mv72gjbmtsytm3 invalidated its
approval; ledger shows approval.invalidated) · P4 legacy gate ✅
(policy_gated on both routes) · P5 double-settle + deliver-after-settle
✅ (already_settled) · P6 MCP/identity 401 contract ✅ · P7 tamper
evidence ✅ (11-entry chain INTACT; altered copy CHAIN BROKEN) · P8
RateLimit headers ✅ (replay-response gap found here, fixed in v38).

## Concurrency collision test — 2026-10-13 evening

Five agents ran against the live deployment simultaneously (three full
pipelines, one same-key idempotency storm, one same-outcome delivery
storm), followed by a coordinated triple-settle race.

- **Independent pipelines (A/B/C):** A PASS (100/84 after one feedback
  round), B PASS first attempt (100/92), C FAIL on consensus only —
  Reviewer B scored 72 twice, unchanged after its flagged gap was
  fixed (reviewer variance, not collisions). Zero cross-outcome
  contamination: bids, teams, artifacts, and verifications stayed
  isolated per outcome. All artifacts live-mode.
- **Idempotency storm (D): RACE CONFIRMED.** 5 concurrent
  `POST /api/agents/outcome` with one Idempotency-Key produced 5
  distinct outcomes and zero replays. The check-then-store design only
  protects sequential replays (P1). Fix candidate: atomic key
  reservation (insert-or-conflict before doing the work).
- **Same-outcome delivery storm (E):** 3 concurrent producer
  deliveries + concurrent reviewers on one outcome — hash chain stayed
  linear (7 entries, unique prev_hashes, verify valid). No fork.
- **Triple-settle race:** outcome `out_mv7blg4lfv25d8` (VERIFIED,
  approved by `agentid:mikedemo.jobsearch@agentmail.to`, PayPal order
  `5R3878762Y693520R` buyer-approved + authorized). Three concurrent
  settle calls → exactly ONE capture (`31722163FV664224D`, $37.00).
  Loser #2 was rejected by PayPal (`AUTHORIZATION_ALREADY_CAPTURED`);
  loser #3 by the app's `already_settled` recheck. Ledger: 11 entries,
  chain valid, exactly one `settlement.captured`.
- **The real coupling point is the shared Groq free-tier budget**
  (8,000 tokens/minute per API key): repeated 429s on deliver across
  all runners, roughly doubling wall-clock (~6.5–7.7 min per pipeline).
  Server retry/backoff absorbs it sequentially, not under a 5-way
  storm. Single sequential runs (the filming flow) are unaffected.
- **Edge transport fraying:** SpaceFast edge returned 502 problem
  documents for two deliveries that had actually committed
  server-side. The CLI printed them as success (exit 0) because the
  body had no `ok` field — CLI fixed same evening: any non-2xx now
  exits 1 with a "re-check state before retrying" warning.
- **Command Center state loss (fixed in v39):** the working outcome
  lived only in React state; a reload lost the run and API/CLI-created
  outcomes could not be loaded or approved in the UI at all. v39 adds
  an outcome picker, `?outcome=` + localStorage restore, panel
  hydration from server state, and a restored buyer-approve link for
  prepared orders. Proven by resuming `out_mv7blg4lfv25d8` in the
  browser after the fix and completing the run.
