/**
 * @file env.ts
 * @description Centralised environment variable configuration.
 *
 * All environment variables are validated and parsed here. The rest of the
 * application imports from this module rather than accessing `process.env`
 * directly. This single-source-of-truth approach makes it easy for new
 * contributors to understand what configuration is available.
 *
 * Required setup:
 *   1. Copy `.env.example` → `.env` in the repo root.
 *   2. Fill in your values (especially CONTRACT_ID after deploying).
 */

import "dotenv/config";

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Read an environment variable. If it is missing and no default is provided,
 * throws an error to fail fast during startup rather than at an unexpected
 * runtime point.
 */
function env(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(
      `[config] Missing required environment variable: ${key}. ` +
        `Copy .env.example → .env and provide a value.`
    );
  }
  return value;
}

// ─── Auth & Notifications ────────────────────────────────────────────────────

/**
 * Secret used to sign JWT tokens for one-click unsubscribes.
 */
export const JWT_SECRET = env("JWT_SECRET");

/**
 * API Key for the Resend transactional email service.
 */
export const RESEND_API_KEY = env("RESEND_API_KEY");

/**
 * The public URL of the frontend, used to generate absolute links in emails.
 */
export const FRONTEND_URL = env(
  "FRONTEND_URL",
  "http://localhost:3000"
);

// ─── Server ──────────────────────────────────────────────────────────────────

export const SERVER_PORT = parseInt(env("PORT", "3001"), 10);
export const SERVER_HOST = env("HOST", "0.0.0.0");

// ─── Stellar Network ─────────────────────────────────────────────────────────

/**
 * Horizon REST API base URL.
 * Defaults to the public Stellar Testnet endpoint.
 */
export const HORIZON_URL = env(
  "HORIZON_URL",
  "https://horizon-testnet.stellar.org"
);

/**
 * Soroban RPC server URL.
 * Defaults to the public Stellar Testnet Soroban RPC endpoint.
 */
export const RPC_URL = env(
  "RPC_URL",
  "https://soroban-testnet.stellar.org"
);

/**
 * The network passphrase is included in every transaction envelope to prevent
 * replay attacks across networks.
 */
export const NETWORK_PASSPHRASE = env(
  "NETWORK_PASSPHRASE",
  "Test SDF Network ; September 2015"
);

// ─── Contract ────────────────────────────────────────────────────────────────

/**
 * The Bech32-encoded contract ID of the deployed PayoutRegistry.
 * Written to .env.contracts by packages/contracts/scripts/deploy.sh.
 */
export const CONTRACT_ID = env("CONTRACT_ID", "");

/**
 * The ledger sequence number when the contract was deployed.
 * Used to initialize the indexer's cursor.
 */
export const DEPLOYMENT_LEDGER = parseInt(env("DEPLOYMENT_LEDGER", "0"), 10);
