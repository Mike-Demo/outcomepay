#!/usr/bin/env bash
# Export an outcome's hash-chained ledger to ledger/<outcomeId>.json.
# The public repo acts as the transparency log: timestamped, immutable,
# auditable by anyone with scripts/verify-ledger.py.
set -euo pipefail
OUTCOME_ID="${1:?usage: export-ledger.sh <outcomeId>}"
BASE="${BASE_URL:-https://outcomepay.view.fast}"
mkdir -p ledger
curl -s "$BASE/api/agents/ledger?outcomeId=$OUTCOME_ID" | python3 -m json.tool > "ledger/${OUTCOME_ID}.json"
echo "wrote ledger/${OUTCOME_ID}.json"
