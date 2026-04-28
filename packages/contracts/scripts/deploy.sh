#!/usr/bin/env bash

# =============================================================================
# very-princess — Soroban Contract Deploy Script
# =============================================================================
# This script builds, optimizes, and deploys the PayoutRegistry contract.
# It then updates the .env files in the backend and frontend packages.
# =============================================================================

set -e

# ── Colour helpers ──────────────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Colour

log()  { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}[deploy]${NC} ✓ $*"; }
err()  { echo -e "${RED}[deploy]${NC} ✗ $*" >&2; exit 1; }

# ── Configuration ───────────────────────────────────────────────────────────

# Resolve the repo root regardless of where this script is called from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${CONTRACT_DIR}/../.." && pwd)"

BACKEND_ENV="${REPO_ROOT}/packages/backend/.env"
FRONTEND_ENV="${REPO_ROOT}/packages/frontend/.env.local"

NETWORK="${NETWORK:-testnet}"
# Use a pre-funded CLI identity. Default to 'default' if not provided.
IDENTITY="${IDENTITY:-default}"

# ── Validate Prerequisites ──────────────────────────────────────────────────

log "Validating prerequisites..."

if ! command -v soroban &>/dev/null; then
    err "soroban CLI not found. Install: cargo install soroban-cli"
fi

if ! command -v cargo &>/dev/null; then
    err "cargo not found. Install Rust: https://rustup.rs/"
fi

# ── Step 1: Build the contract ──────────────────────────────────────────────

log "Building contract with cargo..."
cd "${CONTRACT_DIR}"
cargo build --target wasm32-unknown-unknown --release

WASM_PATH="target/wasm32-unknown-unknown/release/very_princess_contracts.wasm"

if [[ ! -f "${WASM_PATH}" ]]; then
    err "WASM build artefact not found at: ${WASM_PATH}"
fi

# ── Step 2: Optimize the WASM ───────────────────────────────────────────────

log "Optimizing WASM..."
soroban contract optimize --wasm "${WASM_PATH}"

OPTIMIZED_WASM_PATH="target/wasm32-unknown-unknown/release/very_princess_contracts.optimized.wasm"

if [[ ! -f "${OPTIMIZED_WASM_PATH}" ]]; then
    err "Optimized WASM not found at: ${OPTIMIZED_WASM_PATH}"
fi

# ── Step 3: Deploy to Testnet ───────────────────────────────────────────────

log "Deploying to ${NETWORK} using identity '${IDENTITY}'..."
CONTRACT_ID=$(soroban contract deploy \
    --wasm "${OPTIMIZED_WASM_PATH}" \
    --source "${IDENTITY}" \
    --network "${NETWORK}")

if [[ -z "${CONTRACT_ID}" ]]; then
    err "Deployment failed — no contract ID returned."
fi

ok "Contract deployed! CONTRACT_ID=${CONTRACT_ID}"

# ── Step 4: Update environment files ────────────────────────────────────────

log "Updating environment files..."

update_env() {
    local file=$1
    local key=$2
    local value=$3
    
    # Ensure directory exists
    mkdir -p "$(dirname "$file")"
    
    if [ -f "$file" ]; then
        if grep -q "^$key=" "$file"; then
            # Update existing key
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^$key=.*|$key=$value|" "$file"
            else
                sed -i "s|^$key=.*|$key=$value|" "$file"
            fi
        else
            # Append new key
            echo "$key=$value" >> "$file"
        fi
    else
        # Create new file
        echo "$key=$value" > "$file"
    fi
}

update_env "${BACKEND_ENV}" "CONTRACT_ID" "${CONTRACT_ID}"
update_env "${FRONTEND_ENV}" "NEXT_PUBLIC_CONTRACT_ID" "${CONTRACT_ID}"

ok "Updated ${BACKEND_ENV}"
ok "Updated ${FRONTEND_ENV}"

# ── Done ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deployment complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Contract ID : ${CYAN}${CONTRACT_ID}${NC}"
echo -e "  Network     : ${CYAN}${NETWORK}${NC}"
echo -e "  Identity    : ${CYAN}${IDENTITY}${NC}"
echo ""
