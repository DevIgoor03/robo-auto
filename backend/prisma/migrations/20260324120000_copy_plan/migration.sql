-- CreateEnum
CREATE TYPE "CopyPlan" AS ENUM ('START', 'PRO', 'ELITE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "subscription_plan" "CopyPlan" NOT NULL DEFAULT 'START';
