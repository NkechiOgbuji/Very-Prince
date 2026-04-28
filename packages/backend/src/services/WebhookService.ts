import { webhookRepository } from "../repositories/WebhookRepository.js";
import fetch from "node-fetch";
import { createHash, randomBytes } from "node:crypto";

export class WebhookService {
  private generateWebhookSecret(): string {
    return randomBytes(32).toString('hex');
  }

  private calculateSignature(payload: string, secret: string): string {
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

  async sendTestWebhook(organizationId: string) {
    const config = await webhookRepository.getConfig(organizationId);
    if (!config) throw new Error("Webhook not configured");

    const payload = {
      event: "test",
      timestamp: new Date().toISOString(),
      organizationId,
      message: "This is a test webhook from Very Princess",
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.calculateSignature(payloadString, config.secret);

    try {
      const response = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Very-Princess-Webhook/1.0",
          "X-Very-Princess-Signature": signature,
          "X-Very-Princess-Timestamp": new Date().toISOString(),
        },
        body: payloadString,
        timeout: 5000,
      });

      const responseBody = await response.text();
      
      await webhookRepository.createDelivery(
        config.id,
        payload,
        response.status,
        responseBody,
        signature
      );

      return {
        success: response.ok,
        statusCode: response.status,
        responseBody,
        signature,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await webhookRepository.createDelivery(
        config.id,
        payload,
        undefined,
        undefined,
        undefined,
        errorMessage
      );
      throw error;
    }
  }

  async sendWebhook(organizationId: string, event: string, data: any) {
    const config = await webhookRepository.getConfig(organizationId);
    if (!config || !config.url) {
      console.log(`Webhook not configured for organization ${organizationId}`);
      return false;
    }

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      organizationId,
      data,
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.calculateSignature(payloadString, config.secret);

    try {
      const response = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Very-Princess-Webhook/1.0",
          "X-Very-Princess-Signature": signature,
          "X-Very-Princess-Timestamp": new Date().toISOString(),
        },
        body: payloadString,
        timeout: 10000,
      });

      const responseBody = await response.text();
      
      await webhookRepository.createDelivery(
        config.id,
        payload,
        response.status,
        responseBody,
        signature
      );

      return response.ok;
    } catch (error) {
      console.error(`Failed to send webhook to ${config.url}:`, error);
      return false;
    }
  }
}

export const webhookService = new WebhookService();
