# Fyren API Dockerfile
# Multi-stage build for minimal production image

# ================================
# Stage 1: Base
# ================================
FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# ================================
# Stage 2: Install dependencies
# ================================
FROM base AS deps

# Copy package files for dependency installation
COPY package.json bun.lock* ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all dependencies
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
COPY package.json ./

# Build the packages and API
RUN bun run build --filter=@fyrendev/db
RUN bun run build --filter=@fyrendev/shared || true
RUN bun run build --filter=@fyrendev/api || echo "No build step for API"

# ================================
# Stage 4: Production
# ================================
FROM base AS runner

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 fyren && \
    adduser --system --uid 1001 fyren

WORKDIR /app

# Copy built application
COPY --from=builder --chown=fyren:fyren /app/packages/db ./packages/db
COPY --from=builder --chown=fyren:fyren /app/packages/shared ./packages/shared
COPY --from=builder --chown=fyren:fyren /app/apps/api ./apps/api
COPY --from=builder --chown=fyren:fyren /app/node_modules ./node_modules
COPY --from=builder --chown=fyren:fyren /app/package.json ./

# Switch to non-root user
USER fyren

# Expose port
EXPOSE 3001

# Set default port
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the API
CMD ["bun", "run", "apps/api/src/index.ts"]
