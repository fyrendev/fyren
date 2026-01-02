# Fyren Web Dockerfile
# Multi-stage build for minimal production image

# ================================
# Stage 1: Base
# ================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ================================
# Stage 2: Dependencies & Build
# ================================
FROM base AS builder

WORKDIR /app

# Copy shared package first (it's a workspace dependency)
COPY packages/shared ./packages/shared

# Copy web app source and package.json
COPY apps/web ./apps/web

# Create a modified package.json that replaces workspace:* with file reference
RUN cd apps/web && \
    sed -i 's/"@fyrendev\/shared": "workspace:\*"/"@fyrendev\/shared": "file:..\/..\/packages\/shared"/' package.json && \
    npm install

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js application
WORKDIR /app/apps/web
RUN npm run build

# ================================
# Stage 3: Production
# ================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 fyren && \
    adduser --system --uid 1001 fyren

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
