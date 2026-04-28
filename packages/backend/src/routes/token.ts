import { FastifyInstance } from "fastify";
import { prisma } from "../services/db.js";

export interface VerifyResponse {
  isVerified: boolean;
  riskLevel: "LOW" | "HIGH";
}

export const tokenController = {
  async verifyToken(address: string): Promise<VerifyResponse> {
    const verifiedContract = await prisma.verifiedContract.findUnique({
      where: { address },
    });

    if (verifiedContract) {
      return {
        isVerified: true,
        riskLevel: verifiedContract.riskLevel as "LOW" | "HIGH",
      };
    }

    return {
      isVerified: false,
      riskLevel: "HIGH",
    };
  },
};

export async function tokenRoutes(fastify: FastifyInstance) {
  fastify.get("/verify/:address", {
    schema: {
      description: "Verify if a token contract address is verified and check its risk level",
      tags: ["Tokens"],
      params: {
        type: "object",
        properties: {
          address: { 
            type: "string", 
            description: "Token contract address to verify" 
          },
        },
        required: ["address"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            isVerified: { 
              type: "boolean", 
              description: "Whether the token contract is verified" 
            },
            riskLevel: { 
              type: "string", 
              enum: ["LOW", "HIGH"],
              description: "Risk level assessment of the token" 
            },
          },
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { address } = request.params as { address: string };
    
    if (!address) {
      return reply.status(400).send({ error: "Address is required" });
    }

    const result = await tokenController.verifyToken(address);
    return result;
  });
}
