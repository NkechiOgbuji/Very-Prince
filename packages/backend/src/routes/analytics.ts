/**
 * @file analytics.ts
 * @description HTTP route definitions for analytics.
 */

import type { FastifyPluginAsync } from "fastify";
import { analyticsController } from "../controllers/analyticsController.js";

/**
 * Analytics routes.
 * Registered at: /api/v1/analytics
 */
export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /leaderboard
   * Returns the leaderboard of top traders based on 7-day volume.
   *
   * @example
   * GET /api/v1/analytics/leaderboard
   */
  fastify.get(
    "/leaderboard",
    {
      schema: {
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                rank: { type: "integer" },
                walletAddress: { type: "string" },
                truncatedAddress: { type: "string" },
                volumeUSD: { type: "number" },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await analyticsController.getLeaderboard();
      return reply.send(result);
    }
  );
};
