/**
 * @file apiKeyAuth.ts
 * @description Fastify plugin for API key authentication guard.
 *
 * This plugin provides an authentication guard that validates API keys
 * from Authorization: Bearer headers for read-only endpoints.
 * It ensures API keys are strictly restricted to GET requests and
 * validates organization access.
 */

import type { FastifyPluginAsync } from 'fastify';
import { ApiKeyService, type ApiKeyData } from '../services/apiKeyService.js';

// ─── Types ────────────────────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKeyData;
  }
}

// ─── Authentication Guard Plugin ───────────────────────────────────────────

export const apiKeyAuthPlugin: FastifyPluginAsync = async (fastify) => {
  const apiKeyService = new ApiKeyService();

  fastify.addHook('preHandler', async (request, reply) => {
    // Only apply to GET requests
    if (request.method !== 'GET') {
      return;
    }

    // Check for Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'API key required. Use Authorization: Bearer <api-key>',
      });
    }

    // Extract API key from Bearer token
    const apiKey = authHeader.replace('Bearer ', '').trim();
    if (!apiKey) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid API key format',
      });
    }

    // Validate the API key
    const apiKeyData = await apiKeyService.validateApiKey(apiKey);
    if (!apiKeyData) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or inactive API key',
      });
    }

    // Attach API key data to request for later use
    request.apiKey = apiKeyData;
  });
}

// ─── Helper Functions ─────────────────────────────────────────────────────

/**
 * Check if the authenticated API key has access to the specified organization
 * This should be used in route handlers to ensure organization-level access control
 */
export function checkOrganizationAccess(request: any, organizationId: string): boolean {
  return request.apiKey?.organizationId === organizationId;
}

/**
 * Middleware to ensure API key has access to the specific organization
 * Use this in routes that require organization-specific access
 */
export async function requireOrganizationAccess(
  request: any,
  reply: any,
  organizationId: string
) {
  if (!checkOrganizationAccess(request, organizationId)) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'API key does not have access to this organization',
    });
  }
}

// ─── Export ─────────────────────────────────────────────────────────────────

export default apiKeyAuthPlugin;
