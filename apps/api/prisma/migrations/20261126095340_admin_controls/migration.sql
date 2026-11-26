-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'CONTENT_EDITOR', 'OPERATIONS', 'MARKETPLACE_CURATOR');

-- AlterTable
ALTER TABLE "appliances" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenReason" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenReason" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenReason" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "adminRoles" "AdminRole"[];

-- CreateTable
CREATE TABLE "site_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "site_setting_revisions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "authorId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_setting_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_setting_revisions_key_createdAt_idx" ON "site_setting_revisions"("key", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "site_setting_revisions_key_version_key" ON "site_setting_revisions"("key", "version");

-- AddForeignKey
ALTER TABLE "site_setting_revisions" ADD CONSTRAINT "site_setting_revisions_key_fkey" FOREIGN KEY ("key") REFERENCES "site_settings"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_setting_revisions" ADD CONSTRAINT "site_setting_revisions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
