# Security audit remediation backlog — 2026-10-21

Issue creation was not available in this session, so the following are ready-to-file issue titles and bodies. Priorities are ordered by real-world impact and reachability from a lower-trust caller, then by the relative size and safety of the fix. Each body links back to parent issue #3.

## Priority order

1. **[security][medium] Bind outcome writes and approvals to an outcome principal** — groups `anon-pipeline-writes-no-outcome-ownership` and `approval-not-bound-to-outcome-principal`. Both stem from the absence of an outcome owner/buyer principal; pipeline writes are anonymous, while approval accepts any authenticated AgentID identity.
2. **[security][medium] Prevent settled outcome state regression** — anonymous callers can regress a captured outcome, breaking the state/settlement invariant and re-enabling delivery.
3. **[security][low] Restrict legacy PayPal harness routes** — anonymous callers can invoke the operator's PayPal sandbox credentials.
4. **[security][low] Serialize ledger appends and protect backfill** — concurrent writes can fork the chain, and the unauthenticated route can synthesize history.
5. **[security][low] Remove approver emails from public responses** — public endpoints expose an unnecessary personal identifier.

The first issue groups the two principal-binding findings because they share the missing per-outcome principal as their root cause. They remain separate controls in the fix: authorize pipeline writes, and independently authorize approval.

## Ready-to-file remediation issues

### `[security][medium] Bind outcome writes and approvals to an outcome principal`

**Body:**

Parent issue: #3

Fingerprints: `anon-pipeline-writes-no-outcome-ownership`, `approval-not-bound-to-outcome-principal`

**Evidence:** `OutcomeRow` has no creator/owner field. No pipeline handler other than `approve.ts` calls `identityFromRequest` or performs an authorization check; `bids.ts` can replace bids and update status, and `deliver.ts` can replace artifacts and delete approval for any supplied `outcomeId`. Outcome IDs are available from public outcome/search reads. Separately, `approve.ts` records the first identity returned by `identityFromRequest` without comparing it to an outcome principal, and settlement preparation/capture check only that an approval row exists. AgentID identity is self-service, so an identity does not establish that the approver is the buyer.

**Root cause:** Outcomes have no stored principal against which callers or approvers can be authorized.

**Smallest fix:** Bind each outcome to its creator/buyer principal (or issue a per-outcome capability at creation). Require that principal or an explicitly delegated role on every pipeline write, and require the buyer principal or an authorized delegate to approve. At minimum, reject approval by the creating/delivering principal. Keep reads public only where the audit design requires it.

### `[security][medium] Prevent settled outcome state regression`

**Body:**

Parent issue: #3

Fingerprint: `settled-outcome-state-regression-unsealed`

**Evidence:** `bids.ts` and `form-team.ts` call `updateOutcomeStatus` without checking for `SETTLED`; `verify.ts` can insert verification and set `VERIFIED` for any status. After capture, an anonymous caller can therefore move the outcome back to `BIDS_IN` or `TEAM_FORMED` while its settlement row remains. `deliver.ts` only blocks when the current status is `SETTLED`, so regression can re-enable delivery and leave the status inconsistent with the captured settlement.

**Root cause:** Pipeline transitions do not enforce a sealed terminal state once settlement exists.

**Smallest fix:** Enforce valid current-to-next status transitions and reject bids, team formation, verification, and delivery after a settlement exists or the outcome is `SETTLED`. This may be enforced centrally in `updateOutcomeStatus` if all affected handlers also reject their writes before mutating related records.

### `[security][low] Restrict legacy PayPal harness routes`

**Body:**

Parent issue: #3

Fingerprint: `paypal-harness-unauthenticated-operator-account`

**Evidence:** `create-order.ts` has no authentication and checks only positive amount format, without the `$10,000` ceiling used by the outcome path. `authorize.ts` and `capture.ts` reject only orders linked to a settlement; otherwise they call PayPal using the operator's client credentials. The shared PayPal code refuses `PAYPAL_ENVIRONMENT=LIVE`, so the source-established exposure is to the sandbox account, API quota, and payer confusion—not live funds.

**Root cause:** Legacy harness routes expose operator-account PayPal operations without caller authorization or an amount ceiling.

**Smallest fix:** Require operator/AgentID authorization on create, authorize, and capture; apply the outcome path's amount cap; or remove the harness routes from the deployed bundle now that the policy engine supersedes them.

### `[security][low] Serialize ledger appends and protect backfill`

**Body:**

Parent issue: #3

Fingerprint: `ledger-append-race-and-unauthenticated-backfill`

**Evidence:** `appendLedger` selects the last entry and inserts a new one without a transaction, lock, or retry. The ledger schema has an index on `(outcome_id, seq)` but no uniqueness constraint, so concurrent appends can reuse a sequence and previous hash, forking the chain. `backfill.ts` is an unauthenticated POST that can synthesize outcome, team, artifact, verification, approval, and settlement entries from current database rows for any outcome with an empty chain.

**Root cause:** Appends are not serialized or protected by a unique sequence invariant, and reconstruction is exposed as an unauthenticated public operation.

**Smallest fix:** Add `UNIQUE(outcome_id, seq)` and serialize appends or re-read/retry on a uniqueness conflict. Require an operator identity for backfill or remove the route; if retained, mark reconstructed entries explicitly in their payload.

### `[security][low] Remove approver emails from public responses`

**Body:**

Parent issue: #3

Fingerprint: `public-receipt-exposes-approver-email`

**Evidence:** The recorded approver string prefers email over `sub` (`agentid.ts`); `approve.ts` writes that value into the hash-chained ledger payload. Public receipt and outcome endpoints return approval objects, and public ledger data includes the approver. The endpoints do not authenticate or redact these values. The public receipt also returns settlement PayPal IDs; the unnecessary disclosure identified here is the approver's email.

**Root cause:** An email address is selected as the public approver identifier and propagated into public approval and ledger responses.

**Smallest fix:** Record and publish a non-email identifier such as `agentid:<sub>` or a display name in approvals, receipts, and ledger payloads. Keep email only in an authenticated session view.

## Ready-to-file needs-validation issue

### `[security][needs-validation] Audit leads to validate`

**Body:**

Parent issue: #3

This checklist contains audit leads whose decisive facts are outside the static source inspection. Validate the missing facts below before treating any lead as a confirmed finding. No severity is assigned to these leads.

- [ ] **`agentid-bearer-token-no-audience-check`** — AgentID issuer behaviour: whether access tokens issued to a different client/application are accepted by the userinfo endpoint in a way OutcomePay can distinguish — i.e. whether userinfo (or an introspection/claims surface) exposes or enforces the token's intended client/audience and scope. If AgentID only ever issues userinfo-valid tokens for thi…
- [ ] **`anonymous-llm-cost-and-storage-exhaustion`** — Deployment facts: (1) whether SpaceFast enforces the 60 req/min per-client limit on this space or merely serves the headers, and (2) whether `LLM_API_KEY` is configured in the deployed environment (live mode) or the demo runs in cached mode.
- [ ] **`id-token-sub-not-bound-to-userinfo`** — Whether AgentID can ever return, for one authorization-code exchange, an ID token and an access token whose userinfo `sub` differs from the ID-token `sub` (e.g. via inbox-claim identity switching on the waiting page). That issuer behaviour is the decisive fact and is outside this repository and the no-execution rule.
- [ ] **`llm-injection-reviewer-score-gates-capture`** — Whether the configured reviewer LLM, given deliverer-controlled feedback/artifact content containing a literal 'Score: 100/100 — PASS' string, reproduces that string inside its report_md ahead of the appended authoritative line. Requires a live-model run with the operator's LLM configuration, which is outside source and the sandboxed-execution bou…

## Excluded candidates

Do not re-raise these rejected candidates without new evidence: `settlement-team-amount-desync-after-prepare` and `verification-not-bound-to-contract-goal`.
