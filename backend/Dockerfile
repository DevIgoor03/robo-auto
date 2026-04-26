# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# OpenSSL 3 + compat glibc/musl — necessário para o motor do Prisma no Alpine
RUN apk add --no-cache openssl libc6-compat

# Install dependencies first (layer cache)
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --no-cache

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
COPY . .
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# wget + OpenSSL 3 (Prisma migrate / query engine no Alpine)
RUN apk add --no-cache wget openssl libc6-compat

# Install only production deps
COPY package*.json ./
RUN npm ci --only=production --no-cache && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist           ./dist
COPY --from=builder /app/node_modules/.prisma  ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma  ./node_modules/@prisma

# Copy prisma schema (needed for migrate deploy)
COPY prisma ./prisma

# Entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["sh", "entrypoint.sh"]
