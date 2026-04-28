/**
 * @file retry.ts
 * @description Utility for exponential backoff and retries.
 */

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    onRetry?: (error: any, attempt: number) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 5, initialDelay = 2000, onRetry } = options;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.response?.status || error?.status;
      
      // Only retry on 429 Too Many Requests
      if (status === 429 && attempt < maxRetries - 1) {
        attempt++;
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s...
        
        if (onRetry) {
          onRetry(error, attempt);
        } else {
          console.warn(`[Retry] Rate limited (429). Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
        }
        
        // Non-blocking sleep
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error(`Max retries (${maxRetries}) reached`);
}
