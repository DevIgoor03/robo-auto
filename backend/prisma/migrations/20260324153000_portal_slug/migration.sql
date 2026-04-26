-- AlterTable
ALTER TABLE "users" ADD COLUMN "portal_slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_portal_slug_key" ON "users"("portal_slug");
