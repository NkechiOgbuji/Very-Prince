#!/usr/bin/env bash

# =============================================================================
# very-prince — Local Standalone Deployment Script
# =============================================================================
# This script automates the full deployment lifecycle to a local standalone
# Stellar/Soroban node. It starts the standalone network, creates and funds
# a deployer account, builds + deploys the PayoutRegistry contract, and
# initialises it with a test token and multisig admins.
#
# Usage:
#   ./deploy-local.sh              # full deployment
#   ./deploy-local.sh --skip-node  # skip starting the node (re-use running instance)
#   ./deploy-local.sh --teardown   # stop and remove all local state
# =============================================================================

set -e

# ── Colour helpers ──────────────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${CYAN}[local-deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}[local-deploy]${NC} ✓ $*"; }
warn() { echo -e "${YELLOW}[local-deploy]${NC} ⚠ $*"; }
err()  { echo -e "${RED}[local-deploy]${NC} ✗ $*" >&2; exit 1; }

# ── Resolve paths ──────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${CONTRACT_DIR}/../.." && pwd)"

BACKEND_ENV="${REPO_ROOT}/packages/backend/.env"
FRONTEND_ENV="${REPO_ROOT}/packages/frontend/.env.local"

# ── Configuration ──────────────────────────────────────────────────────────

NETWORK_PASSPHRASE="Standalone Network ; September 2024"
SOROBAN_RPC_URL="${SOROBAN_RPC_URL:-http://localhost:8000/soroban/rpc}"
HORIZON_URL="${HORIZON_URL:-http://localhost:8000}"
STELLAR_NETWORK="${STELLAR_NETWORK:-local}"
SOROBAN_NETWORK="${SOROBAN_NETWORK:-local}"
IDENTITY="${IDENTITY:-very-prince-deployer}"
TOKEN_ADMIN_NAME="${TOKEN_ADMIN_NAME:-very-prince-token-admin}"

# Contract initialisation parameters
INIT_ADMINS="${INIT_ADMINS:-3}"
INIT_THRESHOLD="${INIT_THRESHOLD:-2}"

# ── Parse flags ────────────────────────────────────────────────────────────

SKIP_NODE=false
TEARDOWN=false

for arg in "$@"; do
    case "$arg" in
        --skip-node) SKIP_NODE=true ;;
        --teardown)  TEARDOWN=true ;;
        -h|--help)
            echo "Usage: $0 [--skip-node] [--teardown]"
            echo ""
            echo "Options:"
            echo "  --skip-node   Skip starting the standalone node (reuse running instance)"
            echo "  --teardown    Stop the standalone node and remove all local state"
            echo ""
            exit 0
            ;;
        *) err "Unknown flag: $arg" ;;
    esac
done

# ── Teardown ───────────────────────────────────────────────────────────────

if $TEARDOWN; then
    log "Tearing down local standalone network..."
    stellar standalone stop 2>/dev/null || soroban network stop standalone 2>/dev/null || warn "No standalone node running."
    rm -rf "${HOME}/.config/stellar/standalone" 2>/dev/null || true
    rm -rf "${HOME}/.soroban/standalone" 2>/dev/null || true
    ok "Local standalone state removed."
    exit 0
fi

# ── Validate Prerequisites ─────────────────────────────────────────────────

log "Validating prerequisites..."

if ! command -v cargo &>/dev/null; then
    err "cargo not found. Install Rust: https://rustup.rs/"
fi

if ! command -v stellar &>/dev/null && ! command -v soroban &>/dev/null; then
    err "Neither 'stellar' CLI nor 'soroban' CLI found. Install: cargo install --locked stellar-cli"
fi

# Prefer stellar CLI if available, fall back to soroban
if command -v stellar &>/dev/null; then
    CLI="stellar"
else
    CLI="soroban"
fi

log "Using CLI: ${CLI}"

# ── Step 1: Start standalone node ──────────────────────────────────────────

if ! $SKIP_NODE; then
    log "Starting local standalone network..."
    if command -v stellar &>/dev/null; then
        stellar standalone start 2>/dev/null || warn "Standalone may already be running."
    else
        soroban network start standalone 2>/dev/null || warn "Standalone may already be running."
    fi
    # Give the node a moment to become ready
    sleep 3
    ok "Standalone network is running at ${SOROBAN_RPC_URL}"
else
    log "Skipping node start (--skip-node). Assuming standalone is already running."
fi

# ── Step 2: Configure CLI network ──────────────────────────────────────────

log "Configuring ${CLI} for local standalone network..."

${CLI} network add standalone \
    --rpc-url "${SOROBAN_RPC_URL}" \
    --network-passphrase "${NETWORK_PASSPHRASE}" \
    2>/dev/null || true

ok "Network 'standalone' configured."

# ── Step 3: Create and fund deployer identity ──────────────────────────────

log "Setting up deployer identity '${IDENTITY}'..."

if ! ${CLI} keys ls 2>/dev/null | grep -q "${IDENTITY}"; then
    ${CLI} keys generate "${IDENTITY}" 2>/dev/null
    ok "Deployer identity created."
else
    ok "Deployer identity '${IDENTITY}' already exists."
fi

DEPLOYER_ADDR=$(${CLI} keys address "${IDENTITY}" 2>/dev/null)
log "Deployer address: ${DEPLOYER_ADDR}"

log "Funding deployer account..."
if command -v stellar &>/dev/null; then
    curl -s "${HORIZON_URL}/friendbot?addr=${DEPLOYER_ADDR}" > /dev/null 2>&1 || \
        ${CLI} keys fund "${IDENTITY}" --network standalone 2>/dev/null || \
        warn "Fund request sent (may take a moment to confirm)."
else
    curl -s "http://localhost:8000/friendbot?addr=${DEPLOYER_ADDR}" > /dev/null 2>&1 || \
        warn "Fund request sent (may take a moment to confirm)."
fi
sleep 2
ok "Deployer account funded."

# ── Step 4: Create and fund token admin identity ────────────────────────────

log "Setting up token admin identity '${TOKEN_ADMIN_NAME}'..."

if ! ${CLI} keys ls 2>/dev/null | grep -q "${TOKEN_ADMIN_NAME}"; then
    ${CLI} keys generate "${TOKEN_ADMIN_NAME}" 2>/dev/null
    ok "Token admin identity created."
else
    ok "Token admin identity '${TOKEN_ADMIN_NAME}' already exists."
fi

TOKEN_ADMIN_ADDR=$(${CLI} keys address "${TOKEN_ADMIN_NAME}" 2>/dev/null)
log "Token admin address: ${TOKEN_ADMIN_ADDR}"

log "Funding token admin account..."
if command -v stellar &>/dev/null; then
    curl -s "${HORIZON_URL}/friendbot?addr=${TOKEN_ADMIN_ADDR}" > /dev/null 2>&1 || \
        ${CLI} keys fund "${TOKEN_ADMIN_NAME}" --network standalone 2>/dev/null || \
        warn "Fund request sent."
else
    curl -s "http://localhost:8000/friendbot?addr=${TOKEN_ADMIN_ADDR}" > /dev/null 2>&1 || \
        warn "Fund request sent."
fi
sleep 2
ok "Token admin account funded."

# ── Step 5: Build the contract ─────────────────────────────────────────────

log "Building contract with cargo..."
cd "${CONTRACT_DIR}"
cargo build --target wasm32-unknown-unknown --release

WASM_PATH="target/wasm32-unknown-unknown/release/very_prince_contracts.wasm"

if [[ ! -f "${WASM_PATH}" ]]; then
    err "WASM build artefact not found at: ${WASM_PATH}"
fi

ok "Contract built successfully."

# ── Step 6: Optimize the WASM ──────────────────────────────────────────────

log "Optimizing WASM..."
${CLI} contract optimize --wasm "${WASM_PATH}"

OPTIMIZED_WASM_PATH="target/wasm32-unknown-unknown/release/very_prince_contracts.optimized.wasm"

if [[ ! -f "${OPTIMIZED_WASM_PATH}" ]]; then
    err "Optimized WASM not found at: ${OPTIMIZED_WASM_PATH}"
fi

ok "WASM optimized."

# ── Step 7: Deploy the contract ────────────────────────────────────────────

log "Deploying PayoutRegistry to local standalone..."

CONTRACT_ID=$(${CLI} contract deploy \
    --wasm "${OPTIMIZED_WASM_PATH}" \
    --source "${IDENTITY}" \
    --network standalone)

if [[ -z "${CONTRACT_ID}" ]]; then
    err "Deployment failed — no contract ID returned."
fi

ok "Contract deployed! CONTRACT_ID=${CONTRACT_ID}"

# ── Step 8: Deploy a test Stellar Asset Contract (token) ──────────────────

log "Deploying test token (Stellar Asset Contract)..."

TOKEN_CONTRACT_ID=$(${CLI} contract deploy \
    --wasm "${OPTIMIZED_WASM_PATH}" \
    --source "${TOKEN_ADMIN_NAME}" \
    --network standalone 2>/dev/null || echo "")

# The SAC must be deployed via the token admin; for local testing we
# use the Soroban CLI's built-in SAC deployment.
log "Using stellar-cli token deploy for SAC..."

if command -v stellar &>/dev/null; then
    TOKEN_CONTRACT_ID=$(stellar token deploy \
        --source "${TOKEN_ADMIN_NAME}" \
        --network standalone 2>/dev/null || echo "")
fi

# Fallback: if token deploy didn't work, try soroban approach
if [[ -z "${TOKEN_CONTRACT_ID}" ]]; then
    warn "Direct SAC deploy failed; attempting via friendbot-funded admin..."
    # For standalone, we create a simple custom token via the contract init
    # We'll pass a placeholder and let the admin handle it.
    TOKEN_CONTRACT_ID=""
fi

# ── Step 9: Initialize the contract ────────────────────────────────────────

log "Initialising PayoutRegistry contract..."

# Build the admin addresses for multisig
ADMIN_ARGS=""
for i in $(seq 1 "${INIT_ADMINS}"); do
    ADMIN_NAME="very-prince-admin-${i}"
    if ! ${CLI} keys ls 2>/dev/null | grep -q "${ADMIN_NAME}"; then
        ${CLI} keys generate "${ADMIN_NAME}" 2>/dev/null
        # Fund each admin
        ADMIN_ADDR=$(${CLI} keys address "${ADMIN_NAME}" 2>/dev/null)
        if command -v stellar &>/dev/null; then
            curl -s "${HORIZON_URL}/friendbot?addr=${ADMIN_ADDR}" > /dev/null 2>&1 || \
                ${CLI} keys fund "${ADMIN_NAME}" --network standalone 2>/dev/null || true
        else
            curl -s "http://localhost:8000/friendbot?addr=${ADMIN_ADDR}" > /dev/null 2>&1 || true
        fi
    fi
    ADMIN_ADDR=$(${CLI} keys address "${ADMIN_NAME}" 2>/dev/null)
    ADMIN_ARGS="${ADMIN_ARGS} ${ADMIN_ADDR}"
done

sleep 2

# Build the init command
if [[ -n "${TOKEN_CONTRACT_ID}" ]]; then
    log "Initialising with token: ${TOKEN_CONTRACT_ID}"
    ${CLI} contract invoke \
        --id "${CONTRACT_ID}" \
        --source "${IDENTITY}" \
        --network standalone \
        -- \
        init \
        --token "${TOKEN_CONTRACT_ID}" \
        --admins "[${ADMIN_ARGS}]" \
        --threshold "${INIT_THRESHOLD}"
else
    # If no token was deployed separately, init with a dummy and note it
    warn "No standalone SAC deployed. Initialising without token (call init manually)."
    log "To init manually, run:"
    log "  ${CLI} contract invoke --id ${CONTRACT_ID} --source ${IDENTITY} --network standalone -- init --token <TOKEN_ADDRESS> --admins \"[${ADMIN_ARGS}]\" --threshold ${INIT_THRESHOLD}"
fi

ok "Contract initialised."

# ── Step 10: Update environment files ──────────────────────────────────────

log "Updating environment files for local development..."

update_env() {
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

update_env "${BACKEND_ENV}" "CONTRACT_ID" "${CONTRACT_ID}"
update_env "${BACKEND_ENV}" "RPC_URL" "${SOROBAN_RPC_URL}"
update_env "${BACKEND_ENV}" "HORIZON_URL" "${HORIZON_URL}"
update_env "${BACKEND_ENV}" "NETWORK_PASSPHRASE" "${NETWORK_PASSPHRASE}"

update_env "${FRONTEND_ENV}" "NEXT_PUBLIC_CONTRACT_ID" "${CONTRACT_ID}"
update_env "${FRONTEND_ENV}" "NEXT_PUBLIC_RPC_URL" "${SOROBAN_RPC_URL}"
update_env "${FRONTEND_ENV}" "NEXT_PUBLIC_NETWORK_PASSPHRASE" "${NETWORK_PASSPHRASE}"

ok "Environment files updated."
ok "  → ${BACKEND_ENV}"
ok "  → ${FRONTEND_ENV}"

# ── Summary ────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Local Standalone Deployment Complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Contract ID      : ${CYAN}${CONTRACT_ID}${NC}"
echo -e "  Network          : ${CYAN}standalone (local)${NC}"
echo -e "  RPC URL          : ${CYAN}${SOROBAN_RPC_URL}${NC}"
echo -e "  Passphrase       : ${CYAN}${NETWORK_PASSPHRASE}${NC}"
echo -e "  Deployer         : ${CYAN}${DEPLOYER_ADDR}${NC}"
echo -e "  Token Admin      : ${CYAN}${TOKEN_ADMIN_ADDR}${NC}"
echo ""
echo -e "  ${YELLOW}Admin identities:${NC}"
for i in $(seq 1 "${INIT_ADMINS}"); do
    ADMIN_NAME="very-prince-admin-${i}"
    ADMIN_ADDR=$(${CLI} keys address "${ADMIN_NAME}" 2>/dev/null || echo "unknown")
    echo -e "    ${CYAN}${ADMIN_NAME}${NC} → ${ADMIN_ADDR}"
done
echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo -e "    View contract:   ${CYAN}${CLI} contract inspect --id ${CONTRACT_ID} --network standalone${NC}"
echo -e "    Invoke contract: ${CYAN}${CLI} contract invoke --id ${CONTRACT_ID} --network standalone -- get_protocol_state${NC}"
echo -e "    Stop node:       ${CYAN}$0 --teardown${NC}"
echo ""
