#!/usr/bin/env bash
set -euo pipefail

WEB_URL="${STAGING_WEB_URL:-}"
API_URL="${STAGING_API_URL:-}"

if [[ -z "$WEB_URL" || -z "$API_URL" ]]; then
  echo "ERROR: Set STAGING_WEB_URL and STAGING_API_URL"
  echo "Example: STAGING_WEB_URL=https://staging.turfop.com STAGING_API_URL=https://api-staging.turfop.com npm run smoke:staging"
  exit 1
fi

trim_trailing_slash() {
  local v="$1"
  echo "${v%/}"
}

WEB_URL="$(trim_trailing_slash "$WEB_URL")"
API_URL="$(trim_trailing_slash "$API_URL")"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

check_status() {
  local name="$1"
  local url="$2"
  local code
  code=$(curl -sS -o /tmp/turfop_smoke_body.txt -w "%{http_code}" "$url") || fail "$name unreachable: $url"
  [[ "$code" == "200" ]] || fail "$name expected 200 got $code: $url"
  pass "$name 200"
}

check_contains() {
  local name="$1"
  local needle="$2"
  if grep -Fqi "$needle" /tmp/turfop_smoke_body.txt; then
    pass "$name contains '$needle'"
  else
    fail "$name missing '$needle'"
  fi
}

echo "Running TurfOp staging smoke tests..."

echo "1) Web routes"
check_status "Landing page" "$WEB_URL/"
check_contains "Landing page" "TurfOp"

check_status "Sign-in page" "$WEB_URL/signin"
check_contains "Sign-in page" "Sign in"

echo "2) API routes"
check_status "API root" "$API_URL/"
check_contains "API root" "TurfOp API"

check_status "API health" "$API_URL/health"


echo "3) Security headers"
headers=$(curl -sSI "$API_URL/")

echo "$headers" | grep -qi "content-security-policy" && pass "CSP header present" || fail "Missing CSP header"
echo "$headers" | grep -qi "x-content-type-options" && pass "X-Content-Type-Options header present" || fail "Missing X-Content-Type-Options"
echo "$headers" | grep -qi "referrer-policy" && pass "Referrer-Policy header present" || fail "Missing Referrer-Policy"

if echo "$headers" | grep -qi "strict-transport-security"; then
  pass "HSTS header present"
else
  echo "WARN: HSTS header not present (expected only in production mode)"
fi

echo "All staging smoke tests passed."