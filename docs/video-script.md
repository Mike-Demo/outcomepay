# OutcomePay — video script (LOCKED)

> Under 3 minutes. Screen walkthrough + voiceover. Royalty-free audio only.
> Record against the live demo at https://outcomepay.view.fast/
> Flow: publish → bids → team → run providers → verify (FAIL) → re-run with
> feedback → verify (PASS) → approve → settlement order → buyer approves →
> settle → receipt. Keep the PayPal buyer-approval tap tight in editing.

## 0:00–0:20 — The idea

*(Command center on screen, pipeline across the top.)*

"Commerce was designed for people choosing products. Agents don't need
products — they need outcomes. This is OutcomePay: a market where a buyer
agent publishes an outcome contract, provider agents bid and deliver, verifier
agents check the evidence, and PayPal settles payment — only after verification
passes."

*(Type the goal, publish. Contract appears: deliverables, acceptance tests,
$40 budget.)*

## 0:20–0:45 — The market

*(Request bids. Eight bid cards appear.)*

"Eight provider agents bid. The broker forms the cheapest team that covers the
contract — five providers, thirty-seven dollars of a forty-dollar budget. And
the losers stay visible: a machine-translation API gets rejected on quality
grounds, because it could never pass the consensus test."

## 0:45–1:15 — It fails (for real)

*(Run all providers. Artifacts land. Run verification.)*

"Now the important part. Verification runs five deterministic checks plus two
independent AI evaluators. And it fails — the localizer left the word 'balance'
untranslated. Both reviewers caught it: seventy-eight out of a hundred, consensus.
Payment is blocked. The acceptance criteria are not met."

*(Show the failed checks.)*

"So the broker does what a good manager does — it sends the provider back with
the reviewers' feedback attached."

*(Re-run localizer with feedback. Re-run reviewers: 95 and 86.)*

"Fixed. Ninety-five and eighty-six. Consensus."

## 1:15–1:45 — Proof, then approval

*(Verification PASS. Click 'Approve verified outcome'.)*

"Every check green, both evaluators in agreement — and still, nothing moves
until a human approves. The LLM never touches money. Only deterministic policy
plus this click can release funds."

## 1:45–2:15 — Settlement

*(Create settlement order → approve at PayPal → Settle via policy engine.
Receipt appears: real order, authorization, and capture IDs; AG Grid
allocation ledger.)*

"The policy engine re-verifies everything is still fresh, authorizes the held
funds, and captures thirty-seven dollars — with real PayPal sandbox IDs on the
receipt, and every provider's cut in the ledger."

## 2:15–3:00 — The point

*(Scroll the receipt; show the audit-trail verify; closing shot of pipeline,
all green.)*

"And the whole run is sealed into a hash-chained audit trail — anyone can
re-verify it. We borrowed blockchain's best idea, the hash chain, and left the
casino behind.

This isn't a shopping bot. It's infrastructure for an economy where agents form
temporary businesses, prove their work, and get paid — with PayPal as the trust
and settlement layer."
