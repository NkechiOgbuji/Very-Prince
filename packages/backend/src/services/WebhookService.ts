import { webhookRepository } from "../repositories/WebhookRepository.js";
import { createHash, randomBytes } from "node:crypto";
import { Queue } from "bullmq";
import { redis } from "./cache.js";

export interface WebhookJobData {
  organizationId: string;
  event: string;
  data: any;
}

export class WebhookService {
  private webhookQueue: Queue;

  constructor() {
    this.webhookQueue = new Queue("webhook-dispatch", {
      connection: redis,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  private generateWebhookSecret(): string {
    return randomBytes(32).toString('hex');
  }

  calculateSignature(payload: string, secret: string): string {
    return createHash('sha256').update(payload).update(secret).digest('hex');
  }

  async generateSecretForOrganization(organizationId: string): Promise<string> {
    const existingConfig = await webhookRepository.getConfig(organizationId);
    
    if (existingConfig && existingConfig.secret) {
      return existingConfig.secret;
    }

    const newSecret = this.generateWebhookSecret();
    await webhookRepository.upsertConfig(organizationId, existingConfig?.url || "", newSecret);
    return newSecret;
  }

  async getConfig(organizationId: string) {
    return webhookRepository.getConfig(organizationId);
  }

  async updateConfig(organizationId: string, url: string) {
    const secret = await this.generateSecretForOrganization(organizationId);
    return webhookRepository.upsertConfig(organizationId, url, secret);
  }

  /**
   * Dispatches a webhook asynchronously using BullMQ.
   */
  async queueWebhook(organizationId: string, event: string, data: any) {
    const config = await webhookRepository.getConfig(organizationId);
    if (!config || !config.url) {
      return;
    }

    await this.webhookQueue.add(`webhook:${event}:${organizationId}`, {
      organizationId,
      event,
      data,
    });
  }

  /**
   * Specifically handles PayoutClaimed webhooks.
   */
  async dispatchPayoutClaimed(
    organizationId: string, 
    maintainer: string, 
    amountStroops: string, 
    txHash: string,
    ledger: number
  ) {
    await this.queueWebhook(organizationId, "payout_claimed", {
      maintainer,
      amountStroops,
      amountXlm: (Number(amountStroops) / 10_000_000).toFixed(7),
      txHash,
      ledger,
      timestamp: new Date().toISOString(),
    });
  }
}

export const webhookService = new WebhookService();
