# 1. Base Stage
FROM node:20-alpine AS base

# Install openssl for Prisma compatibility on Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# 2. Dependencies Stage
FROM base AS dependencies

# Copy package files and Prisma schema
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# 3. Builder Stage
FROM base AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Build application
RUN npm run build

# Prune devDependencies to reduce final image size
RUN npm prune --production

# 4. Production Runner Stage
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy runtime assets and application code
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public

# Ensure uploads folder permissions for non-root user
RUN mkdir -p /app/public/uploads && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 5000

# Run database migrations and start server in production
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
