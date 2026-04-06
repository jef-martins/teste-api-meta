-- AlterTable
ALTER TABLE "sub_organizacao" ADD COLUMN     "collab_disabled_by_master" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "collab_enabled" BOOLEAN NOT NULL DEFAULT true;
