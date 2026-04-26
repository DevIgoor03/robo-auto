/*
  Warnings:

  - The values [PERCENT_MASTER,PERCENT_BALANCE] on the enum `CopyMode` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `active_id` on the `trades` table. All the data in the column will be lost.
  - You are about to drop the column `active_name` on the `trades` table. All the data in the column will be lost.
  - You are about to drop the column `close_time` on the `trades` table. All the data in the column will be lost.
  - You are about to drop the column `external_id` on the `trades` table. All the data in the column will be lost.
  - You are about to drop the column `instrument_type` on the `trades` table. All the data in the column will be lost.
  - You are about to drop the column `open_time` on the `trades` table. All the data in the column will be lost.
  - You are about to drop the column `result` on the `trades` table. All the data in the column will be lost.
  - The `direction` column on the `trades` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `master_position_id` to the `trades` table without a default value. This is not possible if the table is not empty.
  - Made the column `follower_id` on table `trades` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CopyMode_new" AS ENUM ('FIXED', 'MULTIPLIER', 'PROPORTIONAL');
ALTER TABLE "follower_accounts" ALTER COLUMN "copy_mode" DROP DEFAULT;
ALTER TABLE "follower_accounts" ALTER COLUMN "copy_mode" TYPE "CopyMode_new" USING ("copy_mode"::text::"CopyMode_new");
ALTER TYPE "CopyMode" RENAME TO "CopyMode_old";
ALTER TYPE "CopyMode_new" RENAME TO "CopyMode";
DROP TYPE "CopyMode_old";
ALTER TABLE "follower_accounts" ALTER COLUMN "copy_mode" SET DEFAULT 'FIXED';
COMMIT;

-- DropForeignKey
ALTER TABLE "trades" DROP CONSTRAINT "trades_follower_id_fkey";

-- DropIndex
DROP INDEX "trades_result_idx";

-- AlterTable
ALTER TABLE "follower_accounts" ADD COLUMN     "follower_activated_day" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "session_day" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "trades" DROP COLUMN "active_id",
DROP COLUMN "active_name",
DROP COLUMN "close_time",
DROP COLUMN "external_id",
DROP COLUMN "instrument_type",
DROP COLUMN "open_time",
DROP COLUMN "result",
ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "follower_name" TEXT,
ADD COLUMN     "instrument_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "master_position_id" TEXT NOT NULL,
ADD COLUMN     "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "position_id" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'OPEN',
ALTER COLUMN "follower_id" SET NOT NULL,
DROP COLUMN "direction",
ADD COLUMN     "direction" TEXT NOT NULL DEFAULT 'call';

-- DropEnum
DROP TYPE "Direction";

-- DropEnum
DROP TYPE "TradeResult";

-- CreateIndex
CREATE INDEX "trades_master_position_id_idx" ON "trades"("master_position_id");

-- CreateIndex
CREATE INDEX "trades_status_idx" ON "trades"("status");

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "follower_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
