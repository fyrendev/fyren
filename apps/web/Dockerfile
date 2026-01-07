# Fyren Web Dockerfile
# Multi-stage build using Turborepo prune for proper monorepo support

# ================================
# Stage 1: Pruner
# Extract only what's needed for this app using turbo prune
# ================================
FROM node:20-alpine AS pruner
RUN apk add --no-cache libc6-compat
RUN npm install -g turbo@^2

WORKDIR /app
COPY . .
RUN turbo prune @fyren/web --docker

# ================================
# Stage 2: Installer
# Install dependencies (this layer is cached when deps don't change)
# ================================
FROM oven/bun:1.3-alpine AS installer

WORKDIR /app

# Copy pruned package.json files and lockfile
COPY --from=pruner /app/out/json/ .

# Install dependencies with Bun
RUN bun install --frozen-lockfile

# ================================
# Stage 3: Builder
# Copy source and build the application
# ================================
FROM installer AS builder

WORKDIR /app

# Copy pruned source code
COPY --from=pruner /app/out/full/ .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js application
RUN bun run build --filter=@fyren/web

# ================================
# Stage 4: Runner
# Minimal production image with standalone output
# ================================
FROM oven/bun:1.3-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 fyren && \
    adduser --system --uid 1001 fyren

# Copy standalone build output (preserves monorepo structure)
COPY --from=builder --chown=fyren:fyren /app/apps/web/.next/standalone ./
COPY --from=builder --chown=fyren:fyren /app/apps/web/.next/static ./apps/web/.next/static

# Set working directory to where server.js lives
WORKDIR /app/apps/web

# Switch to non-root user
USER fyren

# Expose port
EXPOSE 3000

# Set default port and hostname
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://0.0.0.0:3000/ || exit 1

# Start the Next.js server
CMD ["bun", "run", "server.js"]
