-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MASTER');

-- CreateEnum
CREATE TYPE "CopyMode" AS ENUM ('FIXED', 'PERCENT_MASTER', 'PERCENT_BALANCE');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('REAL', 'DEMO');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('CALL', 'PUT');

-- CreateEnum
CREATE TYPE "TradeResult" AS ENUM ('PENDING', 'WIN', 'LOSS', 'EQUAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MASTER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bullex_email" TEXT NOT NULL,
    "encrypted_password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "balance_real" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance_demo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_connected" BOOLEAN NOT NULL DEFAULT false,
    "copy_running" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follower_accounts" (
    "id" TEXT NOT NULL,
    "master_id" TEXT NOT NULL,
    "bullex_email" TEXT NOT NULL,
    "encrypted_password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "copy_mode" "CopyMode" NOT NULL DEFAULT 'FIXED',
    "copy_amount" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "account_type" "AccountType" NOT NULL DEFAULT 'DEMO',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "stop_win" DOUBLE PRECISION,
    "stop_loss" DOUBLE PRECISION,
    "balance_real" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance_demo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_trades" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follower_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "master_id" TEXT NOT NULL,
    "follower_id" TEXT,
    "active_id" INTEGER NOT NULL,
    "active_name" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "instrument_type" TEXT NOT NULL,
    "result" "TradeResult" NOT NULL DEFAULT 'PENDING',
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "open_time" TIMESTAMP(3) NOT NULL,
    "close_time" TIMESTAMP(3),
    "external_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_sessions" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "master_accounts_user_id_key" ON "master_accounts"("user_id");

-- CreateIndex
CREATE INDEX "follower_accounts_master_id_idx" ON "follower_accounts"("master_id");

-- CreateIndex
CREATE UNIQUE INDEX "follower_accounts_master_id_bullex_email_key" ON "follower_accounts"("master_id", "bullex_email");

-- CreateIndex
CREATE INDEX "trades_master_id_idx" ON "trades"("master_id");

-- CreateIndex
CREATE INDEX "trades_follower_id_idx" ON "trades"("follower_id");

-- CreateIndex
CREATE INDEX "trades_result_idx" ON "trades"("result");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_key" ON "refresh_sessions"("token");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_idx" ON "refresh_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "portal_sessions_token_key" ON "portal_sessions"("token");

-- CreateIndex
CREATE INDEX "portal_sessions_follower_id_idx" ON "portal_sessions"("follower_id");

-- AddForeignKey
ALTER TABLE "master_accounts" ADD CONSTRAINT "master_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follower_accounts" ADD CONSTRAINT "follower_accounts_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "master_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "master_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "follower_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "follower_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
