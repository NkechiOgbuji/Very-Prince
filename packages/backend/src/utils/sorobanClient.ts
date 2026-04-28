import { SorobanRpc, Networks } from '@stellar/stellar-sdk';

/**
 * Retry configuration for Soroban RPC calls
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
};

/**
 * Utility function to implement exponential backoff retry mechanism
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // If this is the last attempt, throw the error
      if (attempt === config.maxRetries) {
        throw lastError;
      }
      
      // Check if error is rate limit related (429 status or similar)
      if (error instanceof Error && 
          (error.message.includes('rate limit') || 
           error.message.includes('429') ||
           error.message.includes('too many requests'))) {
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(2, attempt),
          config.maxDelay
        );
        
        console.warn(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // For non-rate-limit errors, don't retry
        throw lastError;
      }
    }
  }
  
  throw lastError!;
}

/**
 * Soroban RPC Client with retry mechanism
 */
export class SorobanClient {
  private rpcServer: SorobanRpc.Server;
  private contractId: string;
  private retryConfig: RetryConfig;

  constructor() {
    // Initialize Soroban RPC Server with Testnet URL
    this.rpcServer = new SorobanRpc.Server(
      'https://soroban-testnet.stellar.org',
      {
        allowHttp: false, // Use HTTPS for security
      }
    );

    // Get contract ID from environment variable
    this.contractId = process.env.CONTRACT_ID;
    if (!this.contractId) {
      throw new Error('CONTRACT_ID environment variable is required');
    }

    this.retryConfig = DEFAULT_RETRY_CONFIG;
  }

  /**
   * Get the contract ID
   */
  getContractId(): string {
    return this.contractId;
  }

  /**
   * Get the RPC server instance
   */
  getRpcServer(): SorobanRpc.Server {
    return this.rpcServer;
  }

  /**
   * Get account information with retry mechanism
   */
  async getAccount(accountId: string): Promise<SorobanRpc.Api.GetAccountResponse> {
    return retryWithBackoff(
      () => this.rpcServer.getAccount(accountId),
      this.retryConfig
    );
  }

  /**
   * Get contract data with retry mechanism
   */
  async getContractData(
    key: SorobanRpc.Api.LedgerEntry.ContractDataKey,
    durability: SorobanRpc.Durability = SorobanRpc.Durability.Persistent
  ): Promise<SorobanRpc.Api.GetLedgerEntriesResponse> {
    return retryWithBackoff(
      () => this.rpcServer.getContractData(this.contractId, key, durability),
      this.retryConfig
    );
  }

  /**
   * Get ledger entries with retry mechanism
   */
  async getLedgerEntries(
    keys: SorobanRpc.Api.LedgerEntryKey[]
  ): Promise<SorobanRpc.Api.GetLedgerEntriesResponse> {
    return retryWithBackoff(
      () => this.rpcServer.getLedgerEntries(keys),
      this.retryConfig
    );
  }

  /**
   * Simulate transaction with retry mechanism
   */
  async simulateTransaction(
    transaction: SorobanRpc.Api.Transaction
  ): Promise<SorobanRpc.Api.SimulateTransactionResponse> {
    return retryWithBackoff(
      () => this.rpcServer.simulateTransaction(transaction),
      this.retryConfig
    );
  }

  /**
   * Get latest ledger with retry mechanism
   */
  async getLatestLedger(): Promise<SorobanRpc.Api.GetLatestLedgerResponse> {
    return retryWithBackoff(
      () => this.rpcServer.getLatestLedger(),
      this.retryConfig
    );
  }

  /**
   * Get transaction with retry mechanism
   */
  async getTransaction(
    hash: string
  ): Promise<SorobanRpc.Api.GetTransactionResponse> {
    return retryWithBackoff(
      () => this.rpcServer.getTransaction(hash),
      this.retryConfig
    );
  }

  /**
   * Get events with retry mechanism
   */
  async getEvents(
    request: SorobanRpc.Api.GetEventsRequest
  ): Promise<SorobanRpc.Api.GetEventsResponse> {
    return retryWithBackoff(
      () => this.rpcServer.getEvents(request),
      this.retryConfig
    );
  }

  /**
   * Get health status with retry mechanism
   */
  async getHealth(): Promise<SorobanRpc.Api.GetHealthResponse> {
    return retryWithBackoff(
      () => this.rpcServer.getHealth(),
      this.retryConfig
    );
  }

  /**
   * Close the RPC server connection
   */
  async close(): Promise<void> {
    await this.rpcServer.close();
  }
}

/**
 * Create and export a singleton instance of the Soroban client
 */
let sorobanClientInstance: SorobanClient | null = null;

export function getSorobanClient(): SorobanClient {
  if (!sorobanClientInstance) {
    sorobanClientInstance = new SorobanClient();
  }
  return sorobanClientInstance;
}

/**
 * Export the Stellar SDK types for convenience
 */
export { SorobanRpc, Networks };
