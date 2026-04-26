#!/bin/sh
set -e

echo "============================================"
echo "  CopyTrader Backend - Starting..."
echo "============================================"

# Wait for PostgreSQL
echo "[1/3] Waiting for PostgreSQL..."
until node -e "
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => { c.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  echo "  PostgreSQL not ready — retrying in 2s..."
  sleep 2
done
echo "  PostgreSQL ready."

# Run Prisma migrations
echo "[2/3] Running database migrations..."
npx prisma migrate deploy
echo "  Migrations applied."

# Start server
echo "[3/3] Starting server on port 3001..."
exec node dist/index.js
