/**
 * @file useTRPC.ts
 * @description React hook for using tRPC client with type safety.
 */

import { trpcClient } from '../trpc/client';

// Direct tRPC client usage for server components
export { trpcClient };

// For client components, we can create a simple hook
export function useTRPC() {
  return trpcClient;
}
