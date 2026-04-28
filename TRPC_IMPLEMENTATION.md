# tRPC Implementation for Very-Princess

This document describes the end-to-end type safety implementation using tRPC in the Very-Princess Turborepo.

## Overview

tRPC provides end-to-end type safety between the Next.js frontend and Fastify backend, eliminating API boundary errors and ensuring that changing a backend return type immediately causes TypeScript compilation errors in the frontend.

## Architecture

### Backend (Fastify + tRPC Server)

- **Location**: `packages/backend/src/trpc/`
- **Router**: `packages/backend/src/trpc/router.ts` - Defines all tRPC procedures
- **Server**: `packages/backend/src/trpc/server.ts` - Fastify integration
- **Integration**: Added to `packages/backend/src/index.ts`

### Frontend (Next.js + tRPC Client)

- **Location**: `packages/frontend/src/trpc/`
- **Client**: `packages/frontend/src/trpc/client.ts` - tRPC client configuration
- **Provider**: `packages/frontend/src/trpc/provider.tsx` - React Query provider
- **Hooks**: `packages/frontend/src/hooks/useTRPCQuery.ts` - React Query hooks
- **Integration**: Added to `packages/frontend/src/app/layout.tsx`

## Available tRPC Procedures

### Organization Procedures

- `organization.get` - Get organization details by ID
- `organization.list` - List organizations (placeholder)
- `organization.create` - Create organization (placeholder)

### Contract Procedures

- `contract.getStatus` - Get contract status
- `contract.getDetails` - Get contract details

### Stats Procedures

- `stats.getOverview` - Get statistics overview

## Type Safety Demonstration

### Backend Type Changes

When you modify a return type in the backend router, TypeScript immediately shows errors in the frontend:

```typescript
// Backend: packages/backend/src/trpc/router.ts
export const appRouter = t.router({
  organization: {
    get: t.procedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        // Change this return type
        return {
          id: input.id,
          name: "Test Org",
          admin: "0x123...",
          // Remove budgetStroops field
          // budgetStroops: "1000000",
        };
      }),
  },
});
```

### Frontend Compilation Error

The frontend will immediately show a TypeScript error:

```typescript
// Frontend: packages/frontend/src/components/OrganizationCardTRPC.tsx
{org.budgetStroops && (
  <p>Budget: {org.budgetStroops}</p>
)}
// Error: Property 'budgetStroops' does not exist on type...
```

## Usage Examples

### Direct tRPC Client Usage

```typescript
import { trpcClient } from '../trpc/client';

const org = await trpcClient.organization.get.query({ id: 'my-org' });
```

### React Query Hooks

```typescript
import { useOrganization } from '../hooks/useTRPCQuery';

function MyComponent() {
  const { data: org, isLoading } = useOrganization('my-org');
  
  if (isLoading) return <div>Loading...</div>;
  return <div>{org.name}</div>;
}
```

## Migration Path

The implementation provides both tRPC and REST APIs for backward compatibility:

1. **Phase 1**: tRPC endpoints available alongside existing REST endpoints
2. **Phase 2**: Gradually migrate frontend components to use tRPC
3. **Phase 3**: Decommission REST endpoints once fully migrated

## Verification

To verify type safety works:

1. Run `npm run build` in both packages
2. Modify a backend return type in `packages/backend/src/trpc/router.ts`
3. Run `npm run build` again - TypeScript errors should appear in the frontend
4. Check the test file: `packages/frontend/src/test-type-safety.ts`

## Dependencies Added

### Backend
- `@trpc/server`: ^10.45.0
- `@trpc/client`: ^10.45.0

### Frontend
- `@trpc/client`: ^10.45.0
- `@trpc/react-query`: ^10.45.0
- `@trpc/server`: ^10.45.0
- `@tanstack/react-query`: ^5.0.0

## Benefits

1. **End-to-end type safety**: No runtime type errors
2. **Autocomplete**: Full IDE support for API methods
3. **Refactoring safety**: Changes propagate automatically
4. **Reduced boilerplate**: No need for API response type definitions
5. **Better developer experience**: Instant feedback on API changes

## Next Steps

1. Implement remaining REST endpoints as tRPC procedures
2. Add authentication context to tRPC procedures
3. Implement proper error handling and validation
4. Add tRPC middleware for logging and metrics
5. Migrate all frontend components to use tRPC hooks
