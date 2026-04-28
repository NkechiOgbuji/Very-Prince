/**
 * @file test-type-safety.ts
 * @description Test file to verify tRPC end-to-end type safety.
 * 
 * This file demonstrates how changing a backend return type immediately
 * causes a TypeScript compilation error in the frontend.
 */

import { trpcClient } from '../trpc/client';

// Test function to verify type safety
export async function testTypeSafety() {
  try {
    // This should work perfectly - the return type is inferred from the backend
    const org = await trpcClient.organization.get.query({ id: 'test-org' });
    
    // Type-safe access to organization properties
    console.log('Organization name:', org.name);
    console.log('Organization admin:', org.admin);
    console.log('Organization budget (stroops):', org.budgetStroops);
    console.log('Organization budget (XLM):', org.budgetXlm);
    
    // Uncomment the line below to see type safety in action:
    // If the backend doesn't return a 'description' field, TypeScript will error:
    // console.log('Organization description:', org.description);
    // Error: Property 'description' does not exist on type '{ id: string; name: string; admin: string; budgetStroops?: string; budgetXlm?: string; }'
    
    // Test contract status
    const status = await trpcClient.contract.getStatus.query();
    console.log('Contract status:', status.status);
    console.log('Contract version:', status.version);
    
    // Uncomment to test type safety on contract status:
    // console.log('Non-existent field:', status.nonExistentField);
    // Error: Property 'nonExistentField' does not exist on type '{ status: string; version: string; timestamp: string; }'
    
    return { success: true, org, status };
  } catch (error) {
    console.error('Type safety test failed:', error);
    return { success: false, error };
  }
}

// Test input validation
export function testInputValidation() {
  try {
    // This should work - valid input
    trpcClient.organization.get.query({ id: 'valid-org-id' });
    
    // Uncomment to see input validation in action:
    // This will cause a TypeScript error because 'id' is required
    // trpcClient.organization.get.query({}); 
    // Error: Property 'id' is missing in type '{}' but required in type '{ id: string; }'
    
    // This will cause a TypeScript error because id must be a string
    // trpcClient.organization.get.query({ id: 123 });
    // Error: Type 'number' is not assignable to type 'string'
    
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}

export default { testTypeSafety, testInputValidation };
