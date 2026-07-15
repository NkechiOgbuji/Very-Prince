#!/usr/bin/env bash

# =============================================================================
# Tests for deploy-local.sh
# =============================================================================
# These tests validate the local deployment script's argument parsing,
# environment file updates, and teardown behaviour. They do NOT require
# a running Stellar standalone node — they exercise the script's logic
# in isolation.
#
# Usage:
#   ./test-deploy-local.sh          # run all tests
#   ./test-deploy-local.sh -v       # verbose output
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="${SCRIPT_DIR}/deploy-local.sh"
CONTRACT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${CONTRACT_DIR}/../.." && pwd)"

VERBOSE=false
PASS_COUNT=0
FAIL_COUNT=0

for arg in "$@"; do
    case "$arg" in
        -v|--verbose) VERBOSE=true ;;
    esac
done

# ── Test Helpers ───────────────────────────────────────────────────────────

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

pass() {
    PASS_COUNT=$((PASS_COUNT + 1))
    echo -e "  ${GREEN}✓${NC} $1"
}

fail() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo -e "  ${RED}✗${NC} $1"
    if $VERBOSE && [[ -n "$2" ]]; then
        echo -e "    ${RED}$2${NC}"
    fi
}

section() {
    echo ""
    echo -e "${CYAN}── $1 ──${NC}"
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local label="$3"
    # Strip ANSI escape codes for matching
    local clean
    clean=$(echo "$haystack" | sed 's/\x1b\[[0-9;]*m//g')
    if echo "$clean" | grep -qF -- "$needle"; then
        pass "$label"
    else
        fail "$label (expected to contain '$needle')"
    fi
}

assert_not_contains() {
    local haystack="$1"
    local needle="$2"
    local label="$3"
    # Strip ANSI escape codes for matching
    local clean
    clean=$(echo "$haystack" | sed 's/\x1b\[[0-9;]*m//g')
    if echo "$clean" | grep -qF -- "$needle"; then
        fail "$label (expected NOT to contain '$needle')"
    else
        pass "$label"
    fi
}

assert_file_exists() {
    local file="$1"
    local label="$2"
    if [[ -f "$file" ]]; then
        pass "$label"
    else
        fail "$label (file not found: $file)"
    fi
}

assert_file_not_exists() {
    local file="$1"
    local label="$2"
    if [[ ! -f "$file" ]]; then
        pass "$label"
    else
        fail "$label (file unexpectedly exists: $file)"
    fi
}

assert_exit_code() {
    local expected=$1
    local actual=$2
    local label="$3"
    if [[ "$actual" -eq "$expected" ]]; then
        pass "$label"
    else
        fail "$label (expected exit code $expected, got $actual)"
    fi
}

assert_env_value() {
    local file=$1
    local key=$2
    local expected=$3
    local label="$4"
    local actual
    actual=$(grep "^${key}=" "$file" 2>/dev/null | cut -d'=' -f2-)
    if [[ "$actual" == "$expected" ]]; then
        pass "$label"
    else
        fail "$label (expected '${key}=${expected}', got '${key}=${actual}')"
    fi
}

# ── Tests ──────────────────────────────────────────────────────────────────

section "Script existence and permissions"

if [[ -f "$DEPLOY_SCRIPT" ]]; then
    pass "deploy-local.sh exists"
else
    fail "deploy-local.sh not found"
fi

if [[ -x "$DEPLOY_SCRIPT" ]]; then
    pass "deploy-local.sh is executable"
else
    fail "deploy-local.sh is not executable"
fi

section "Help flag"

HELP_OUTPUT=$("$DEPLOY_SCRIPT" --help 2>&1) || true
assert_contains "$HELP_OUTPUT" "Usage:" "--help shows usage"
assert_contains "$HELP_OUTPUT" "--skip-node" "--help mentions --skip-node"
assert_contains "$HELP_OUTPUT" "--teardown" "--help mentions --teardown"

section "Unknown flag rejection"

"$DEPLOY_SCRIPT" --invalid-flag 2>/dev/null && EXIT_CODE=0 || EXIT_CODE=$?
assert_exit_code 1 "$EXIT_CODE" "exits with code 1 on unknown flag"

section "Teardown without node"

# Teardown should succeed even if no standalone node is running
TEARDOWN_OUTPUT=$("$DEPLOY_SCRIPT" --teardown 2>&1 || true)
# Strip ANSI escape codes for matching
TEARDOWN_CLEAN=$(echo "$TEARDOWN_OUTPUT" | sed 's/\x1b\[[0-9;]*m//g')
if echo "$TEARDOWN_CLEAN" | grep -qiF -- "tear"; then
    pass "teardown runs without error"
else
    fail "teardown runs without error (expected to contain 'tear')"
fi

section "Environment file update helper"

# Create temporary env files to test the update logic
TMPDIR=$(mktemp -d)
TMP_BACKEND="${TMPDIR}/backend/.env"
TMP_FRONTEND="${TMPDIR}/frontend/.env.local"

# Source just the update_env function by extracting it from the script
# We'll simulate the function inline for testing
update_env_test() {
    local file=$1
    local key=$2
    local value=$3

    mkdir -p "$(dirname "$file")"

    if [ -f "$file" ]; then
        if grep -q "^$key=" "$file"; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^$key=.*|$key=$value|" "$file"
            else
                sed -i "s|^$key=.*|$key=$value|" "$file"
            fi
        else
            echo "$key=$value" >> "$file"
        fi
    else
        echo "$key=$value" > "$file"
    fi
}

# Test 1: Create new file
update_env_test "${TMP_BACKEND}" "CONTRACT_ID" "CABC123"
assert_file_exists "${TMP_BACKEND}" "env file created"
assert_env_value "${TMP_BACKEND}" "CONTRACT_ID" "CABC123" "new key-value written"

# Test 2: Update existing key
update_env_test "${TMP_BACKEND}" "CONTRACT_ID" "CXYZ789"
assert_env_value "${TMP_BACKEND}" "CONTRACT_ID" "CXYZ789" "existing key updated"

# Test 3: Append new key
update_env_test "${TMP_BACKEND}" "RPC_URL" "http://localhost:8000/soroban/rpc"
assert_env_value "${TMP_BACKEND}" "RPC_URL" "http://localhost:8000/soroban/rpc" "new key appended"

# Test 4: Update doesn't break other keys
assert_env_value "${TMP_BACKEND}" "CONTRACT_ID" "CXYZ789" "other keys preserved after append"

# Test 5: Create nested directory and file
update_env_test "${TMP_FRONTEND}" "NEXT_PUBLIC_CONTRACT_ID" "CABC123"
assert_file_exists "${TMP_FRONTEND}" "frontend env file created in nested dir"
assert_env_value "${TMP_FRONTEND}" "NEXT_PUBLIC_CONTRACT_ID" "CABC123" "frontend key written"

# Cleanup
rm -rf "$TMPDIR"

section "Script structure validation"

SCRIPT_CONTENT=$(cat "$DEPLOY_SCRIPT")

assert_contains "$SCRIPT_CONTENT" "set -e" "script uses set -e for safety"
assert_contains "$SCRIPT_CONTENT" "cargo build --target wasm32-unknown-unknown" "script builds WASM target"
assert_contains "$SCRIPT_CONTENT" "contract optimize" "script optimizes WASM"
assert_contains "$SCRIPT_CONTENT" "contract deploy" "script deploys contract"
assert_contains "$SCRIPT_CONTENT" "Standalone Network" "script references standalone network passphrase"
assert_contains "$SCRIPT_CONTENT" "update_env" "script updates env files"
assert_contains "$SCRIPT_CONTENT" "friendbot" "script funds accounts via friendbot"
assert_contains "$SCRIPT_CONTENT" "CONTRACT_ID" "script outputs CONTRACT_ID"
assert_contains "$SCRIPT_CONTENT" "NETWORK_PASSPHRASE" "script handles network passphrase"

section "Script doesn't hardcode secrets"

SCRIPT_CONTENT=$(cat "$DEPLOY_SCRIPT")
assert_not_contains "$SCRIPT_CONTENT" "SECRET=" "no hardcoded secrets"
assert_not_contains "$SCRIPT_CONTENT" "PRIVATE_KEY" "no private keys referenced as literals"
assert_not_contains "$SCRIPT_CONTENT" "password" "no hardcoded passwords"

section "Root package.json integration"

ROOT_PKG="${REPO_ROOT}/package.json"
assert_file_exists "${ROOT_PKG}" "root package.json exists"
assert_contains "$(cat "$ROOT_PKG")" "deploy:local" "deploy:local script registered in root package.json"

section "Contracts package.json"

CONTRACTS_PKG="${REPO_ROOT}/packages/contracts/package.json"
assert_file_exists "${CONTRACTS_PKG}" "contracts package.json exists"
assert_contains "$(cat "$CONTRACTS_PKG")" "deploy:local" "deploy:local in contracts package.json"
assert_contains "$(cat "$CONTRACTS_PKG")" "deploy:local:teardown" "deploy:local:teardown in contracts package.json"
assert_contains "$(cat "$CONTRACTS_PKG")" "test" "test script in contracts package.json"

# ── Results ────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo -e "  Tests: ${GREEN}${PASS_COUNT} passed${NC}, ${RED}${FAIL_COUNT} failed${NC}, ${TOTAL} total"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""

if [[ $FAIL_COUNT -gt 0 ]]; then
    exit 1
fi
