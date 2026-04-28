import { organizationService, PaginatedOrgsResponse } from "../services/OrganizationService.js";
import { payoutService } from "../services/PayoutService.js";
import { stellarService } from "../services/stellarService.js";

// ─── Response Types ───────────────────────────────────────────────────────────

export interface OrgResponse {
  id: string;
  name: string;
  admin: string;
}

export interface MaintainersResponse {
  orgId: string;
  maintainers: string[];
  count: number;
}

export interface BalanceResponse {
  maintainer: string;
  claimableStroops: string;
  claimableXlm: string;
}

export interface BudgetResponse {
  orgId: string;
  budgetStroops: string;
  budgetXlm: string;
}

export interface FundResponse {
  success: boolean;
  transactionHash: string | undefined;
  orgId: string;
  donor: string;
  amountStroops: string;
}

export interface PayoutResponse {
  success: boolean;
  transactionHash: string | undefined;
  orgId: string;
  maintainer: string;
  amountStroops: string;
}

export interface ClaimTransactionResponse {
  transactionXdr: string;
}

export interface SubmitTransactionResponse {
  success: boolean;
  transactionHash: string | undefined;
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const contractController = {
  /**
   * Fetch a paginated list of organizations.
   */
  async getOrganizations(page: number, limit: number, search?: string): Promise<PaginatedOrgsResponse> {
    return organizationService.getOrganizations(page, limit, search);
  },

  /**
   * Register a new organization and index it in the local database.
   */
  async registerOrganization(
    id: string,
    name: string,
    admin: string,
    signerSecret: string
  ): Promise<FundResponse> {
    const result = await organizationService.registerOrganization(id, name, admin, signerSecret);
    
    return {
      success: result.success,
      transactionHash: result.transactionHash,
      orgId: id,
      donor: admin,
      amountStroops: "0",
    };
  },

  /**
   * Fetch the details of a registered organization.
   */
  async getOrganization(orgId: string): Promise<OrgResponse> {
    return organizationService.getOrganization(orgId);
  },

  /**
   * Fetch the ordered list of maintainer addresses for an organization.
   */
  async getMaintainers(orgId: string): Promise<MaintainersResponse> {
    const maintainers = await organizationService.getMaintainers(orgId);
    return {
      orgId,
      maintainers,
      count: maintainers.length,
    };
  },

  /**
   * Fetch the current budget for an organization.
   */
  async getOrgBudget(orgId: string): Promise<BudgetResponse> {
    return organizationService.getOrgBudget(orgId);
  },

  /**
   * Fetch the claimable balance for a maintainer address.
   */
  async getClaimableBalance(maintainerAddress: string): Promise<BalanceResponse> {
    return payoutService.getClaimableBalance(maintainerAddress);
  },

  /**
   * Fund an organization's budget.
   */
  async fundOrg(
    orgId: string,
    fromAddress: string,
    amountStroops: string,
    signerSecret: string
  ): Promise<FundResponse> {
    const result = await payoutService.fundOrg(
      orgId,
      fromAddress,
      amountStroops,
      signerSecret
    );
    return {
      success: result.success,
      transactionHash: result.transactionHash,
      orgId,
      donor: fromAddress,
      amountStroops,
    };
  },

  /**
   * Allocate a payout to a maintainer.
   */
  async allocatePayout(
    orgId: string,
    maintainerAddress: string,
    amountStroops: string,
    signerSecret: string
  ): Promise<PayoutResponse> {
    const result = await payoutService.allocatePayout(
      orgId,
      maintainerAddress,
      amountStroops,
      signerSecret
    );
    return {
      success: result.success,
      transactionHash: result.transactionHash,
      orgId,
      maintainer: maintainerAddress,
      amountStroops,
    };
  },

  /**
   * Create a claim payout transaction for a maintainer.
   */
  async createClaimTransaction(orgId: string, maintainerAddress: string): Promise<ClaimTransactionResponse> {
    const transactionXdr = await stellarService.createClaimPayoutTransaction(orgId, maintainerAddress);
    return { transactionXdr };
  },

  /**
   * Submit a signed transaction to the Stellar network.
   */
  async submitTransaction(signedTransaction: string): Promise<SubmitTransactionResponse> {
    const result = await stellarService.submitTransaction(signedTransaction);
    return {
      success: result.success,
      transactionHash: result.transactionHash,
    };
  },
} as const;
