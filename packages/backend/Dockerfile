# ─── Stage 1: Base & Prune ───────────────────────────────────────────────────
# Use the lightweight Alpine image
FROM node:20-alpine AS base
# Install libc6-compat for Turborepo native binaries
RUN apk update && apk add --no-cache libc6-compat

FROM base AS builder
WORKDIR /app
RUN npm install -g turbo
COPY . .
# Surgically extract only the backend package and its dependencies
RUN turbo prune @very-princess/backend --docker

# ─── Stage 2: Install & Build ────────────────────────────────────────────────
FROM base AS installer
WORKDIR /app

# Install dependencies based on the pruned lockfile
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm ci

# Copy the actual pruned source code
COPY --from=builder /app/out/full/ .

# PATCH: turbo prune drops root TS configs and hoisted Stellar SDK types.
# We explicitly copy them from the builder and inject the missing types.
COPY --from=builder /app/tsconfig*.json ./
RUN npm install --no-save @types/urijs @types/json-schema

# Build the backend
RUN npx turbo run build --filter=@very-princess/backend...

# ─── Stage 3: Production Runner ──────────────────────────────────────────────
FROM base AS runner
WORKDIR /app/packages/backend

# Security: Create a non-root user to run the application
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify
USER fastify

# Copy the hoisted root node_modules
COPY --from=installer --chown=fastify:nodejs /app/node_modules /app/node_modules

# Copy only the compiled production assets and package.json
COPY --from=installer --chown=fastify:nodejs /app/packages/backend/package.json ./
COPY --from=installer --chown=fastify:nodejs /app/packages/backend/dist ./dist

# Expose the Fastify API port
EXPOSE 3001

# Start the compiled application
CMD ["node", "dist/index.js"]