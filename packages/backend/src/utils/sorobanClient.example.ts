/**
 * Example usage of the SorobanClient utility
 * 
 * This file demonstrates how to use the SorobanClient to interact
 * with the Soroban RPC and read contract state.
 */

import { getSorobanClient } from './sorobanClient.js';

/**
 * Example: Get contract data
 */
export async function getContractExample() {
  try {
    const client = getSorobanClient();
    
    // Get the latest ledger
    const latestLedger = await client.getLatestLedger();
    console.log('Latest ledger:', latestLedger);
    
    // Get contract health status
    const health = await client.getHealth();
    console.log('RPC Health:', health);
    
    // Example: Get specific contract data (you would need to define the key)
    // import { SorobanRpc } from './sorobanClient.js';
    // const contractData = await client.getContractData({
    //   contract: client.getContractId(),
    //   key: SorobanRpc.xdr.LedgerKey.contractData(
    //     new SorobanRpc.xdr.LedgerKey.ContractData({
    //       contract: SorobanRpc.Address.fromString(client.getContractId()).toScAddress(),
    //       key: SorobanRpc.xdr.ScVal.scvSymbol("your_key_name"),
    //       durability: SorobanRpc.xdr.ContractDataDurability.persistent()
    //     })
    //   )
    // });
    
    console.log('Contract ID:', client.getContractId());
    
    return {
      latestLedger,
      health,
      contractId: client.getContractId()
    };
  } catch (error) {
    console.error('Error in Soroban client example:', error);
    throw error;
  }
}

/**
 * Example: Get account information
 */
export async function getAccountExample(accountId: string) {
  try {
    const client = getSorobanClient();
    
    const account = await client.getAccount(accountId);
    console.log('Account info:', account);
    
    return account;
  } catch (error) {
    console.error('Error getting account:', error);
    throw error;
  }
}

/**
 * Example: Get events from the contract
 */
export async function getEventsExample(startLedger: number, endLedger: number) {
  try {
    const client = getSorobanClient();
    
    const events = await client.getEvents({
      startLedger,
      endLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [client.getContractId()]
        }
      ]
    });
    
    console.log('Events:', events);
    return events;
  } catch (error) {
    console.error('Error getting events:', error);
    throw error;
  }
}
