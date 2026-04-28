const fs = require('fs');

const profilesRoute = `import type { FastifyPluginAsync } from 'fastify';
import { stellarService } from '../services/stellarService.js';

export const profileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/:address/stats',
    {},
    async (request, reply) => {
      const { address } = (request.params as { address: string });
      try {
        const stats = await stellarService.readProfileStats(address);
        return reply.send({
          address: stats.address,
          totalStroops: stats.totalStroops.toString(),
          totalXlm: stats.totalXlm,
          orgIds: stats.orgIds,
          payouts: stats.payouts.map((p) => ({
            orgId: p.orgId,
            amountStroops: p.amountStroops.toString(),
            ledger: p.ledger,
            ledgerClosedAt: p.ledgerClosedAt,
            txHash: p.txHash,
          })),
        });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: 'Failed to fetch profile stats' });
      }
    }
  );
};
`;

fs.writeFileSync('packages/backend/src/routes/profiles.ts', profilesRoute);
console.log('profiles.ts created');

let index = fs.readFileSync('packages/backend/src/index.ts', 'utf8');
if (!index.includes('profileRoutes')) {
  index = index.replace(
    'import { contractRoutes } from "./routes/contract.js";',
    'import { contractRoutes } from "./routes/contract.js";\nimport { profileRoutes } from "./routes/profiles.js";'
  );
  index = index.replace(
    'await server.register(contractRoutes, { prefix: "/api/v1/contract" });',
    'await server.register(contractRoutes, { prefix: "/api/v1/contract" });\nawait server.register(profileRoutes, { prefix: "/api/v1/profile" });'
  );
  fs.writeFileSync('packages/backend/src/index.ts', index);
  console.log('index.ts updated');
}