# Fyren Web Dockerfile
# Multi-stage build for minimal production image

# ================================
# Stage 1: Base
# ================================
FROM node:20-alpine AS base

# Install dependencies only when needed
RUN apk add --no-cache libc6-compat

WORKDIR /app

# ================================
# Stage 2: Install dependencies
# ================================
FROM base AS deps

# Copy package files
COPY package.json package-lock.json* bun.lock* ./
COPY apps/web/package.json ./apps/web/

# Install dependencies using npm (more reliable for Next.js)
RUN npm ci --prefer-offline

# ================================
# Stage 3: Build
# ================================
FROM base AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source files
COPY apps/web ./apps/web
COPY package.json ./

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js application
WORKDIR /app/apps/web
RUN npm run build

# ================================
# Stage 4: Production
# ================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 fyren && \
    adduser --system --uid 1001 fyren

# Copy public assets
COPY --from=builder /app/apps/web/public ./public

# Copy standalone build output
COPY --from=builder --chown=fyren:fyren /app/apps/web/.next/standalone ./
COPY --from=builder --chown=fyren:fyren /app/apps/web/.next/static ./.next/static

# Switch to non-root user
USER fyren

# Expose port
EXPOSE 3000

# Set default port and hostname
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the Next.js server
CMD ["node", "server.js"]
