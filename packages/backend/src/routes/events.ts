/**
 * @file events.ts
 * @description Server-Sent Events (SSE) endpoint for real-time UI updates.
 */

import type { FastifyPluginAsync } from "fastify";

// Store active SSE connections
const sseConnections = new Set<NodeJS.WritableStream>();

// Export function to emit events to all connected clients
export function emitSSEEvent(event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  
  sseConnections.forEach((stream) => {
    try {
      stream.write(message);
    } catch (error) {
      // Remove dead connections
      sseConnections.delete(stream);
    }
  });
}

export const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/events/stream
   * Server-Sent Events stream for real-time updates.
   */
  fastify.get("/stream", (request, reply) => {
    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // Add connection to active connections
    sseConnections.add(reply.raw);

    // Send initial connection event
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

    // Handle client disconnect
    request.raw.on("close", () => {
      sseConnections.delete(reply.raw);
    });

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
      } catch (error) {
        clearInterval(heartbeat);
        sseConnections.delete(reply.raw);
      }
    }, 30000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
    });

    // Return the raw stream (Fastify will handle the response)
    return reply;
  });
};
