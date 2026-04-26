-- CreateTable
CREATE TABLE "follower_portal_allowlist" (
    "id" TEXT NOT NULL,
    "master_id" TEXT NOT NULL,
    "bullex_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "follower_portal_allowlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "follower_portal_allowlist_master_id_bullex_email_key" ON "follower_portal_allowlist"("master_id", "bullex_email");

-- CreateIndex
CREATE INDEX "follower_portal_allowlist_master_id_idx" ON "follower_portal_allowlist"("master_id");

-- AddForeignKey
ALTER TABLE "follower_portal_allowlist" ADD CONSTRAINT "follower_portal_allowlist_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "master_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follower_portal_allowlist" ADD CONSTRAINT "follower_portal_allowlist_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seguidores já cadastrados: mantêm acesso ao portal
INSERT INTO "follower_portal_allowlist" ("id", "master_id", "bullex_email", "created_at", "created_by_user_id")
SELECT
  'mig_' || replace(gen_random_uuid()::text, '-', ''),
  f."master_id",
  lower(trim(f."bullex_email")),
  CURRENT_TIMESTAMP,
  NULL
FROM "follower_accounts" f
WHERE trim(f."bullex_email") <> ''
ON CONFLICT ("master_id", "bullex_email") DO NOTHING;
