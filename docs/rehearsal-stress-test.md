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
