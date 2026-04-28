import { prisma } from "../services/db.js";
import { randomBytes } from "node:crypto";

export class WebhookRepository {
  async getConfig(organizationId: string) {
    return prisma.webhookConfig.findUnique({
      where: { organizationId },
      include: {
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });
  }

  async upsertConfig(organizationId: string, url: string, secret?: string) {
    const existing = await prisma.webhookConfig.findUnique({
      where: { organizationId },
    });

    if (existing) {
      return prisma.webhookConfig.update({
        where: { organizationId },
        data: { url, ...(secret && { secret }) },
      });
    } else {
      const webhookSecret = secret || `whsec_${crypto.randomBytes(24).toString("hex")}`;
      return prisma.webhookConfig.create({
        data: {
          organizationId,
          url,
          secret: webhookSecret,
        },
      });
    }
  }

  async createDelivery(webhookConfigId: string, payload: any, statusCode?: number, responseBody?: string, errorMessage?: string) {
    return prisma.webhookDelivery.create({
      data: {
        webhookConfigId,
        payload: JSON.stringify(payload),
        statusCode,
        responseBody,
        errorMessage,
      },
    });
  }
}

export const webhookRepository = new WebhookRepository();
