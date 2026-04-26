-- AlterTable
ALTER TABLE "master_accounts" ADD COLUMN     "robot_ends_at" TIMESTAMP(3),
ADD COLUMN     "robot_running" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "trades" ALTER COLUMN "follower_id" DROP NOT NULL;
