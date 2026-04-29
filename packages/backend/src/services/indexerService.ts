/**
 * @file indexerService.ts
 * @description Background indexer service for syncing blockchain data.
 * 
 * This service runs as a cron job to continuously sync blockchain data
 * independent of HTTP requests, ensuring the backend always has the latest
 * contract state.
 */

import * as cron from 'node-cron';
import { RPC_URL, CONTRACT_ID, DEPLOYMENT_LEDGER } from '../config/env.js';
import { stellarService } from './stellarService.js';
import { prisma } from './db.js';
import { emitSSEEvent } from '../routes/events.js';
import { webhookService } from './WebhookService.js';
import {
  decodeSorobanEvent,
  parseContractEvent,
  stroopsToXlm,
  type RawSorobanEvent,
  type ContractEvent,
  type PayoutAllocatedEvent,
  type OrgFundedEvent,
  type PayoutClaimedEvent,
  type MaintainerAddedEvent,
} from '../utils/xdrDecoder.js';

/**
 * Extract the event index from the raw Soroban event.
 * The event ID format is typically "{ledger}-{eventIndex}" or the pagingToken contains this info.
 */
function extractEventIndex(rawEvent: RawSorobanEvent): number {
  // The pagingToken or id field often contains the event index
  // Format varies by RPC version, but we can parse from the id field
  if (rawEvent.id) {
    const parts = rawEvent.id.split('-');
    if (parts.length > 1) {
      return parseInt(parts[parts.length - 1], 10);
    }
  }
  // Fallback: use a hash of the event data to generate a consistent index
  // This ensures the same event always gets the same index
  const hash = rawEvent.txHash + rawEvent.ledger.toString();
  return parseInt(hash.slice(-8), 16) % 10000;
}

export class IndexerService {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private readonly CURSOR_ID = "default";

  /**
   * Start the indexer cron job
   */
  start(): void {
    if (this.isRunning) {
      console.log('Indexer is already running');
      return;
    }

    // Get cron expression from environment or use default (every 5 minutes)
    const cronExpression = process.env.INDEXER_CRON_EXPRESSION || '*/5 * * * *';

    console.log(`Starting indexer with cron expression: ${cronExpression}`);
    console.log('Syncing Blockchain Data...');

    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.syncBlockchainData();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.isRunning = true;
    console.log('Indexer started successfully');
  }

  /**
   * Stop the indexer cron job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('Indexer stopped');
  }

  /**
   * Get the last processed ledger from the database
   */
  private async getCursor(): Promise<number> {
    const state = await prisma.indexerState.findUnique({
      where: { id: this.CURSOR_ID },
    });

    if (!state) {
      console.log(`No existing cursor found. Initializing with DEPLOYMENT_LEDGER: ${DEPLOYMENT_LEDGER}`);
      return DEPLOYMENT_LEDGER;
    }

    return state.lastProcessedLedger;
  }

  /**
   * Update the last processed ledger in the database
   */
  private async updateCursor(ledger: number): Promise<void> {
    await prisma.indexerState.upsert({
      where: { id: this.CURSOR_ID },
      update: { lastProcessedLedger: ledger },
      create: { id: this.CURSOR_ID, lastProcessedLedger: ledger },
    });
  }

  /**
   * Sync blockchain data by fetching the latest contract state
   */
  private async syncBlockchainData(): Promise<void> {
    try {
      console.log('Starting blockchain data sync...');

      if (!CONTRACT_ID) {
        console.warn('No CONTRACT_ID configured, skipping sync');
        return;
      }

      const lastProcessedLedger = await this.getCursor();
      console.log(`Indexing from ledger: ${lastProcessedLedger + 1}`);

      // Fetch new events
      const eventsResponse = await stellarService.getEvents(lastProcessedLedger + 1);

      if (eventsResponse.events && eventsResponse.events.length > 0) {
        console.log(`Processing ${eventsResponse.events.length} new events...`);

        // Process each event with idempotent database writes
        const processedEvents: Array<{ event: ContractEvent; eventIndex: number }> = [];

        for (let i = 0; i < eventsResponse.events.length; i++) {
          const rawEvent = eventsResponse.events[i];
          try {
            // Decode the Base64-encoded XDR event data
            const decodedEvent = decodeSorobanEvent(rawEvent as RawSorobanEvent);

            // Parse into contract-specific event type
            const contractEvent = parseContractEvent(decodedEvent);

            if (!contractEvent) {
              console.warn(`Unknown event type: ${decodedEvent.eventName}`);
              continue;
            }

            // Extract event index for unique composite key
            const eventIndex = i; // Use array index as event index within this batch
            processedEvents.push({ event: contractEvent, eventIndex });

            console.log(`Processing event: ${contractEvent.eventName}`);

            // Handle each event type and emit appropriate SSE events
            await this.handleContractEvent(contractEvent, eventIndex);
          } catch (error) {
            console.error('Error processing event for SSE:', error);
          }
        }

        // Update the cursor to the latest event's ledger
        const latestLedger = Math.max(...eventsResponse.events.map(e => e.ledger));

        await prisma.$transaction(async (tx) => {
          // 1. Process all events and update other tables...
          // 2. Update the cursor
          await tx.indexerState.upsert({
            where: { id: this.CURSOR_ID },
            update: { lastProcessedLedger: latestLedger },
            create: { id: this.CURSOR_ID, lastProcessedLedger: latestLedger },
          });
        });

        console.log(`Successfully processed events up to ledger ${latestLedger}`);
      } else {
        console.log('No new events found');
      }

      console.log('Blockchain data sync completed successfully');

    } catch (error) {
      console.error('Error during blockchain data sync:', error);
    }
  }

  /**
   * Handle a parsed contract event and emit appropriate SSE events.
   * Uses upsert for idempotent database writes to prevent duplicates.
   *
   * @param event - The parsed contract event
   * @param eventIndex - Index of the event within the transaction
   */
  private async handleContractEvent(event: ContractEvent, eventIndex: number): Promise<void> {
    // Extract wallet address and amount based on event type
    let walletAddress = '';
    let volumeUSD = BigInt(0);
    const createdAt = new Date(event.ledgerClosedAt);

    switch (event.eventName) {
      case 'PayoutAllocated': {
        const payoutEvent = event as PayoutAllocatedEvent;
        walletAddress = payoutEvent.maintainer;
        volumeUSD = BigInt(payoutEvent.amount);
        
        // SSE Event
        emitSSEEvent('payout_allocated', {
          orgId: payoutEvent.orgId,
          maintainer: payoutEvent.maintainer,
          amountStroops: payoutEvent.amount,
          amountXlm: stroopsToXlm(payoutEvent.amount),
          ledger: payoutEvent.ledger,
          txHash: payoutEvent.txHash,
        });

        // Store specific PayoutEvent for analytics
        await prisma.payoutEvent.create({
          data: {
            orgId: payoutEvent.orgId,
            maintainer: payoutEvent.maintainer,
            amountStroops: BigInt(payoutEvent.amount),
            amountXlm: stroopsToXlm(payoutEvent.amount),
            ledger: payoutEvent.ledger,
            txHash: payoutEvent.txHash,
            createdAt,
          }
        });
        break;
      }

      case 'PayoutClaimed': {
        const claimEvent = event as PayoutClaimedEvent;
        walletAddress = claimEvent.maintainer;
        volumeUSD = BigInt(claimEvent.amount);
        
        // SSE
        emitSSEEvent('payout_claimed', {
          maintainer: claimEvent.maintainer,
          amountStroops: claimEvent.amount,
          amountXlm: stroopsToXlm(claimEvent.amount),
          ledger: claimEvent.ledger,
          txHash: claimEvent.txHash,
        });

        // Trigger Webhook
        // We need the orgId, so we look it up from our local Maintainer table
        const maintainer = await prisma.maintainer.findUnique({
          where: { address: claimEvent.maintainer }
        });

        if (maintainer) {
          await webhookService.dispatchPayoutClaimed(
            maintainer.orgId,
            claimEvent.maintainer,
            claimEvent.amount,
            claimEvent.txHash,
            claimEvent.ledger
          );
        }
        break;
      }

      case 'OrgFunded': {
        const fundEvent = event as OrgFundedEvent;
        walletAddress = fundEvent.from;
        volumeUSD = BigInt(fundEvent.amount);
        emitSSEEvent('funds_deposited', {
          orgId: fundEvent.orgId,
          from: fundEvent.from,
          amountStroops: fundEvent.amount,
          amountXlm: stroopsToXlm(fundEvent.amount),
          ledger: fundEvent.ledger,
          txHash: fundEvent.txHash,
        });
        break;
      }

      case 'OrgRegistered': {
        walletAddress = event.orgId; // Use orgId as identifier for non-wallet events
        emitSSEEvent('org_registered', {
          orgId: event.orgId,
          ledger: event.ledger,
          txHash: event.txHash,
        });
        break;
      }

      case 'MaintainerAdded': {
        const maintainerEvent = event as MaintainerAddedEvent;
        walletAddress = maintainerEvent.maintainer;
        
        // SSE
        emitSSEEvent('maintainer_added', {
          orgId: maintainerEvent.orgId,
          maintainer: maintainerEvent.maintainer,
          ledger: maintainerEvent.ledger,
          txHash: maintainerEvent.txHash,
        });

        // Store maintainer relation
        await prisma.maintainer.upsert({
          where: { address: maintainerEvent.maintainer },
          update: { orgId: maintainerEvent.orgId },
          create: {
            address: maintainerEvent.maintainer,
            orgId: maintainerEvent.orgId,
          }
        });
        break;
      }

      case 'ProtocolPaused': {
        walletAddress = event.protocolAdmin;
        emitSSEEvent('protocol_paused', {
          protocolAdmin: event.protocolAdmin,
          ledger: event.ledger,
          txHash: event.txHash,
        });
        break;
      }

      case 'ProtocolUnpaused': {
        walletAddress = event.protocolAdmin;
        emitSSEEvent('protocol_unpaused', {
          protocolAdmin: event.protocolAdmin,
          ledger: event.ledger,
          txHash: event.txHash,
        });
        break;
      }

      case 'Initialized': {
        walletAddress = event.protocolAdmin;
        emitSSEEvent('contract_initialized', {
          token: event.token,
          protocolAdmin: event.protocolAdmin,
          ledger: event.ledger,
          txHash: event.txHash,
        });
        break;
      }

      case 'ContractUpgraded': {
        walletAddress = event.protocolAdmin;
        emitSSEEvent('contract_upgraded', {
          protocolAdmin: event.protocolAdmin,
          newWasmHash: event.newWasmHash,
          ledger: event.ledger,
          txHash: event.txHash,
        });
        break;
      }
    }

    // Idempotent upsert: prevents duplicate records if the same event is processed twice
    // The unique constraint on (txHash, eventIndex, createdAt) ensures this
    await prisma.transaction.upsert({
      where: {
        txHash_eventIndex_createdAt: {
          txHash: event.txHash,
          eventIndex,
          createdAt,
        },
      },
      update: {
        // On update: don't change anything (event already recorded)
      },
      create: {
        txHash: event.txHash,
        eventIndex,
        walletAddress,
        volumeUSD: volumeUSD.toString(),
        type: event.eventName,
        ledger: event.ledger,
        rawData: JSON.stringify(event),
        createdAt,
      },
    });
  }

  /**
   * Get the current status of the indexer
   */
  getStatus(): { isRunning: boolean; lastProcessedLedger?: number } {
    return {
      isRunning: this.isRunning,
      // We'll return the cursor value if available
    };
  }

  /**
   * Manually trigger a sync (useful for testing or immediate updates)
   */
  async triggerSync(): Promise<void> {
    console.log('Manual sync triggered');
    await this.syncBlockchainData();
  }
}

// Export singleton instance
export const indexerService = new IndexerService();
