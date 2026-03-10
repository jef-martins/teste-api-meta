/*
  Warnings:

  - You are about to drop the column `usuario_id` on the `api_registrada` table. All the data in the column will be lost.
  - Added the required column `organizacao_id` to the `api_registrada` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "api_registrada" DROP CONSTRAINT "api_registrada_usuario_id_fkey";

-- AlterTable
ALTER TABLE "api_registrada" DROP COLUMN "usuario_id",
ADD COLUMN     "organizacao_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "api_sub_org_token" (
    "id" SERIAL NOT NULL,
    "api_id" INTEGER NOT NULL,
    "sub_organizacao_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_sub_org_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_sub_org_token_api_id_sub_organizacao_id_key" ON "api_sub_org_token"("api_id", "sub_organizacao_id");

-- AddForeignKey
ALTER TABLE "api_registrada" ADD CONSTRAINT "api_registrada_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_sub_org_token" ADD CONSTRAINT "api_sub_org_token_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_registrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_sub_org_token" ADD CONSTRAINT "api_sub_org_token_sub_organizacao_id_fkey" FOREIGN KEY ("sub_organizacao_id") REFERENCES "sub_organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
