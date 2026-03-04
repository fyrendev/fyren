# Fyren API Dockerfile
# Multi-stage build for minimal production image

# ================================
# Stage 1: Base
# ================================
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# ================================
# Stage 2: Install dependencies
# ================================
FROM base AS deps

# Copy full workspace structure for proper lockfile resolution
COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies with frozen lockfile for reproducibility
RUN bun install --frozen-lockfile

# ================================
# Stage 3: Build
# ================================
FROM base AS builder

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source files
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY turbo.json ./
COPY package.json bun.lock ./

# Build the packages
RUN bun run build --filter=@fyrendev/db
RUN bun run build --filter=@fyrendev/shared || true

# Bundle the API server and worker as separate entry points
RUN bun build apps/api/src/index.ts --outdir apps/api/dist --target bun
RUN bun build apps/api/src/worker.ts --outdir apps/api/dist --target bun

# ================================
# Stage 4: Production
# ================================
FROM base AS runner

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 fyren && \
    adduser --system --uid 1001 fyren

WORKDIR /app

# Copy bundled output (API server and worker)
COPY --from=builder --chown=fyren:fyren /app/apps/api/dist ./dist

# Copy database migrations
COPY --from=builder --chown=fyren:fyren /app/packages/db/drizzle ./drizzle

# Switch to non-root user
USER fyren

# Expose port
EXPOSE 3001

# Set default port
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the bundled API
CMD ["bun", "run", "dist/index.js"]
