import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from "fastify";
import * as Sentry from "@sentry/node";

export async function errorHandler(server: FastifyInstance) {
  server.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    request.log.error({ err: error, reqId: request.id }, error.message);

    // Capture error in Sentry with contextual data
    if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        contexts: {
          request: {
            id: request.id,
            method: request.method,
            url: request.url,
            userAgent: request.headers["user-agent"],
            ip: request.ip,
          },
          user: (request as any).user ? {
            id: (request as any).user.walletAddress,
            email: (request as any).user.email,
          } : null,
        },
        tags: {
          route: request.routeOptions?.url || "unknown",
          statusCode: reply.statusCode.toString(),
          errorType: error.constructor.name,
        },
      });
    }

    if (error.message?.includes("timeout") || (error as any).code === "ETIMEDOUT") {
      return reply.status(504).send({ statusCode: 504, error: "Gateway Timeout", message: "Blockchain service timed out." });
    }

    if (error.validation) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: error.message, details: error.validation });
    }

    return reply.status(500).send({ statusCode: 500, error: "Internal Server Error", message: "An unexpected error occurred." });
  });

  // Capture unhandled promise rejections
  process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
    if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
      Sentry.captureException(reason, {
        contexts: {
          promise: {
            reason: String(reason),
          },
        },
        tags: {
          errorType: 'unhandledRejection',
        },
      });
    }
  });

  // Capture uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        contexts: {
          process: {
            pid: process.pid,
            version: process.version,
          },
        },
        tags: {
          errorType: 'uncaughtException',
        },
      });
    }
  });
}