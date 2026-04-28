/**
 * @file index.ts
 * @description Shared TypeScript interfaces for the very-princess monorepo.
 *
 * Both `@very-princess/backend` and `@very-princess/frontend` import from here
 * to ensure a single source of truth for all Soroban-derived data shapes.
 */

// ── Stellar / Soroban primitives ──────────────────────────────────────────────

/** A Stellar public key (G…). */
export type StellarAddress = string;

/** A Soroban Symbol used as an organisation identifier. */
export type OrgId = string;

// ── Core domain types ─────────────────────────────────────────────────────────

/** Organisation as stored in the Soroban contract (DataKey::Organization). */
export interface Organization {
  id: OrgId;
  name: string;
  admins: StellarAddress[];
}

/** Maintainer record linking an address to its organisation. */
export interface Maintainer {
  address: StellarAddress;
  orgId: OrgId;
}

/** Claimable payout entry for a maintainer (DataKey::MaintainerBalance). */
export interface MaintainerPayout {
  amount: bigint;
  unlockTimestamp: number;
}

// ── API response shapes ───────────────────────────────────────────────────────

/** Organisation enriched with its on-chain budget, returned by the backend. */
export interface OrganizationWithBudget extends Organization {
  budgetStroops: string;
  budgetXlm: string;
}

/** Paginated list of organisations returned by GET /api/org. */
export interface PaginatedOrgsResponse {
  data: { id: string; name: string; admin: string; publicBudget?: string }[];
  meta: {
    totalPages: number;
    currentPage: number;
    totalCount: number;
  };
}

// ── Event / analytics types ───────────────────────────────────────────────────

/** A single on-chain payout event emitted by `allocate_payout`. */
export interface PayoutEvent {
  orgId: OrgId;
  amountStroops: bigint;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
}

/** Aggregated payout statistics for a maintainer address. */
export interface ProfileStats {
  address: StellarAddress;
  totalStroops: bigint;
  totalXlm: string;
  orgIds: OrgId[];
  payouts: PayoutEvent[];
}

// ── Stellar SDK wrappers ──────────────────────────────────────────────────────

/** Basic Horizon account information. */
export interface AccountInfo {
  id: string;
  sequence: string;
  balances: Array<{
    balance: string;
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
}

/** Result of a Soroban contract call (read or write). */
export interface ContractCallResult {
  success: boolean;
  value: unknown;
  transactionHash?: string;
}
