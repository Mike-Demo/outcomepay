#!/usr/bin/env bash
# OutcomePay — full pipeline with no UI.
# Every step is an API call. The functions only run on the SpaceFast space,
# so BASE must point at the deployed space (local `next dev` won't serve /api).
# Exactly one step needs a browser: the PayPal sandbox buyer approval (step 7).
set -euo pipefail
BASE="${BASE_URL:-https://outcomepay.view.fast}"

echo "=== 1. Publish outcome (buyer agent -> contract) ==="
OID=$(curl -s -X POST "$BASE/api/agents/outcome" -H 'Content-Type: application/json' \
  -d '{"goal":"Create and validate a Spanish launch kit for TidyLedger","budgetUsd":40}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['outcome']['id'])")
echo "outcome: $OID"

echo "=== 2. Solicit bids (8 providers, selected + rejected with reasons) ==="
curl -s -X POST "$BASE/api/agents/bids" -H 'Content-Type: application/json' \
  -d "{\"outcomeId\":\"$OID\"}" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
for b in d['bids']:
    r=' — '+(b['decision_reason'] or '')[:70] if b['decision']=='rejected' else ''
    print(f\"{b['provider_id']:16s} \${b['price_usd']:>5}  {b['decision']:8s}{r}\")
print('would select:', d['would_select'], 'total:', d['would_total'])"

echo "=== 3. Form team ==="
curl -s -X POST "$BASE/api/agents/form-team" -H 'Content-Type: application/json' \
  -d "{\"outcomeId\":\"$OID\"}" \
  | python3 -c "import json,sys; t=json.load(sys.stdin)['team']; print(t['provider_ids'], t['total_usd'], '/', t['budget_usd'])"

echo "=== 4. Run providers (deliver artifacts) ==="
for p in localizer-01 pagebuilder-01 researcher-01 reviewer-a reviewer-b; do
  curl -s -X POST "$BASE/api/agents/deliver" -H 'Content-Type: application/json' \
    -d "{\"outcomeId\":\"$OID\",\"providerId\":\"$p\"}" \
    | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f\"$p [\"+d['mode']+\"]:\", [a['title'] for a in d['artifacts']])"
done

echo "=== 5. Verify (deterministic checks + evaluator consensus) ==="
curl -s -X POST "$BASE/api/agents/verify" -H 'Content-Type: application/json' \
  -d "{\"outcomeId\":\"$OID\"}" | python3 -m json.tool

echo "=== 6. Human approval ==="
curl -s -X POST "$BASE/api/agents/approve" -H 'Content-Type: application/json' \
  -d "{\"outcomeId\":\"$OID\"}" | python3 -m json.tool | head -8

echo "=== 7. Create settlement order — NOW OPEN THE approveUrl IN A BROWSER ==="
echo "    Log in as the PayPal SANDBOX buyer and approve, then continue."
APPROVE_URL=$(curl -s -X POST "$BASE/api/agents/prepare-settlement" -H 'Content-Type: application/json' \
  -d "{\"outcomeId\":\"$OID\"}" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('order:', d['paypalOrderId'], '| amount:', d['amountUsd'])
open('/tmp/outcomepay_approve_url.txt','w').write(d['approveUrl'])
print('approveUrl:', d['approveUrl'])")
read -r -p "Press ENTER after approving at PayPal... "

echo "=== 8. Settle via policy engine (authorize + capture) ==="
curl -s -X POST "$BASE/api/agents/settle" -H 'Content-Type: application/json' \
  -d "{\"outcomeId\":\"$OID\"}" | python3 -m json.tool | head -45

echo "=== 9. Full audit receipt + hash-chain verification ==="
curl -s "$BASE/api/agents/receipt?outcomeId=$OID" -o "receipt-$OID.json"
echo "receipt saved: receipt-$OID.json"
curl -s "$BASE/api/agents/ledger/verify?outcomeId=$OID" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('chain valid:', d['valid'], '| entries:', len(d['entries']))"
echo "DONE — outcome $OID"
