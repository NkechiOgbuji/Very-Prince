/**
 * @file OrganizationCardTRPC.tsx
 * @description Example component demonstrating tRPC type safety.
 * 
 * This component shows how changing a backend return type immediately
 * causes a TypeScript compilation error in the frontend.
 */

'use client';

import { useOrganization } from '../hooks/useTRPCQuery';

interface OrganizationCardTRPCProps {
  orgId: string;
}

export function OrganizationCardTRPC({ orgId }: OrganizationCardTRPCProps) {
  const { data: org, isLoading, error } = useOrganization(orgId);

  if (isLoading) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50">
        <p className="text-red-600">Error loading organization: {error.message}</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg">
        <p className="text-gray-500">Organization not found</p>
      </div>
    );
  }

  // Type safety: TypeScript will show an error if any of these fields
  // don't exist in the backend response
  return (
    <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{org.name}</h3>
      <p className="text-sm text-gray-600 mb-1">
        <span className="font-medium">ID:</span> {org.id}
      </p>
      <p className="text-sm text-gray-600 mb-1">
        <span className="font-medium">Admin:</span> {org.admin}
      </p>
      {org.budgetStroops && (
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-medium">Budget (Stroops):</span> {org.budgetStroops}
        </p>
      )}
      {org.budgetXlm && (
        <p className="text-sm text-gray-600">
          <span className="font-medium">Budget (XLM):</span> {org.budgetXlm}
        </p>
      )}
      
      {/* 
        TYPE SAFETY DEMONSTRATION:
        Try adding a field that doesn't exist in the backend:
        <p className="text-sm text-gray-600">
          <span className="font-medium">Non-existent field:</span> {org.nonExistentField}
        </p>
        
        TypeScript will immediately show an error:
        "Property 'nonExistentField' does not exist on type '...'"
        
        This demonstrates the end-to-end type safety!
      */}
    </div>
  );
}
