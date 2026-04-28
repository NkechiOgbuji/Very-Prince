/**
 * @file trpc-api.ts
 * @description Type-safe tRPC API client for very-princess.
 * 
 * This file provides tRPC-based alternatives to the REST API calls in api.ts,
 * with full end-to-end type safety between frontend and backend.
 */

import { trpcClient } from '../trpc/client';

// Re-export the types from the original API for compatibility
export interface Org {
  id: string;
  name: string;
  admin: string;
  budgetStroops?: string; // Budget in stroops from tRPC
  budgetXlm?: string; // Budget in XLM from tRPC
  publicBudget?: string; // Legacy field for compatibility
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    totalPages: number;
    currentPage: number;
    totalCount: number;
  };
}

/**
 * Fetch organization details using tRPC with full type safety.
 * This replaces the REST endpoint GET /api/org/:id
 */
export async function fetchOrganizationWithTRPC(id: string): Promise<Org> {
  try {
    const result = await trpcClient.organization.get.query({ id });
    return result;
  } catch (error) {
    throw new Error(`Failed to fetch organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get contract status using tRPC.
 * This replaces the health check endpoint
 */
export async function getContractStatusWithTRPC() {
  try {
    const result = await trpcClient.contract.getStatus.query();
    return result;
  } catch (error) {
    throw new Error(`Failed to get contract status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Legacy API functions for backward compatibility
// These can be gradually migrated to tRPC

/**
 * Fetch a paginated list of organizations from the backend.
 * Note: This still uses REST API for now since we haven't implemented
 * the list endpoint in tRPC yet.
 */
export async function fetchOrganizations(page: number = 1, limit: number = 10, search?: string): Promise<PaginatedResponse<Org>> {
  const BACKEND_URL = process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://localhost:3001/api/v1/contract";
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  if (search) {
    params.append('search', search);
  }
  
  const response = await fetch(`${BACKEND_URL}/orgs?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch organizations: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Register a new organization.
 * Note: This still uses REST API for now since we haven't implemented
 * the mutation endpoint in tRPC yet.
 */
export async function registerOrganization(
  id: string,
  name: string,
  admin: string,
  signerSecret: string
): Promise<{ success: boolean; transactionHash?: string }> {
  const BACKEND_URL = process.env["NEXT_PUBLIC_BACKEND_URL"] ?? "http://localhost:3001/api/v1/contract";
  const response = await fetch(`${BACKEND_URL}/orgs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name, admin, signerSecret }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to register organization: ${response.statusText}`);
  }
  return response.json();
}
