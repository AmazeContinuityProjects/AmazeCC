#!/usr/bin/env bash
# Post-deploy smoke test for the Faculty Reviews Worker.
#
#   bash scripts/smoke-test.sh https://reviews-api-staging.amazecc.com
#
# Needs only curl and node. Works whether ENABLE_AMAZE_REVIEWS is on or off.
set -euo pipefail

BASE="${1:?usage: smoke-test.sh <base-url>}"
BASE="${BASE%/}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

json_check() { node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$1"; }

echo "1/3 health (flag-independent liveness)"
curl -fsS "$BASE/health" -o "$TMP"
node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); if (j.ok !== true) process.exit(1)" "$TMP"

echo "2/3 catalog read returns valid JSON (200 flag on, 503 flag off)"
code="$(curl -s -o "$TMP" -w '%{http_code}' "$BASE/api/reviews/catalog")"
echo "    status $code"
case "$code" in 200|503) ;; *) echo "unexpected status"; exit 1 ;; esac
json_check "$TMP"

echo "3/3 unsigned ingest is rejected"
code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/internal/ingest" \
  -H 'Content-Type: application/json' --data '{}')"
echo "    status $code (expected 401)"
[ "$code" = "401" ]

echo "smoke test passed for $BASE"
