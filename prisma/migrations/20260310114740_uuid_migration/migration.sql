/*
  Warnings:

  - The primary key for the `api_registrada` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `api_rota` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `api_sub_org_token` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `bot_estado_historico` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `bot_estado_transicao` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `bot_fluxo` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `bot_fluxo_variaveis` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `bot_usuario` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `conversa` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `org_membro` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `organizacao` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `sub_org_membro` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `sub_organizacao` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `yjs_updates` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "api_registrada" DROP CONSTRAINT "api_registrada_organizacao_id_fkey";

-- DropForeignKey
ALTER TABLE "api_rota" DROP CONSTRAINT "api_rota_api_id_fkey";

-- DropForeignKey
ALTER TABLE "api_sub_org_token" DROP CONSTRAINT "api_sub_org_token_api_id_fkey";

-- DropForeignKey
ALTER TABLE "api_sub_org_token" DROP CONSTRAINT "api_sub_org_token_sub_organizacao_id_fkey";

-- DropForeignKey
ALTER TABLE "bot_estado_config" DROP CONSTRAINT "bot_estado_config_flow_id_fkey";

-- DropForeignKey
ALTER TABLE "bot_fluxo" DROP CONSTRAINT "bot_fluxo_sub_organizacao_id_fkey";

-- DropForeignKey
ALTER TABLE "bot_fluxo_variaveis" DROP CONSTRAINT "bot_fluxo_variaveis_flow_id_fkey";

-- DropForeignKey
ALTER TABLE "org_membro" DROP CONSTRAINT "org_membro_organizacao_id_fkey";

-- DropForeignKey
ALTER TABLE "org_membro" DROP CONSTRAINT "org_membro_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "sub_org_membro" DROP CONSTRAINT "sub_org_membro_sub_organizacao_id_fkey";

-- DropForeignKey
ALTER TABLE "sub_org_membro" DROP CONSTRAINT "sub_org_membro_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "sub_organizacao" DROP CONSTRAINT "sub_organizacao_organizacao_id_fkey";

-- DropForeignKey
ALTER TABLE "yjs_updates" DROP CONSTRAINT "yjs_updates_flow_id_fkey";

-- AlterTable
ALTER TABLE "api_registrada" DROP CONSTRAINT "api_registrada_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organizacao_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "api_registrada_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "api_registrada_id_seq";

-- AlterTable
ALTER TABLE "api_rota" DROP CONSTRAINT "api_rota_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "api_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "api_rota_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "api_rota_id_seq";

-- AlterTable
ALTER TABLE "api_sub_org_token" DROP CONSTRAINT "api_sub_org_token_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "api_id" SET DATA TYPE TEXT,
ALTER COLUMN "sub_organizacao_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "api_sub_org_token_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "api_sub_org_token_id_seq";

-- AlterTable
ALTER TABLE "bot_estado_config" ALTER COLUMN "flow_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "bot_estado_historico" DROP CONSTRAINT "bot_estado_historico_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "bot_estado_historico_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "bot_estado_historico_id_seq";

-- AlterTable
ALTER TABLE "bot_estado_transicao" DROP CONSTRAINT "bot_estado_transicao_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "bot_estado_transicao_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "bot_estado_transicao_id_seq";

-- AlterTable
ALTER TABLE "bot_fluxo" DROP CONSTRAINT "bot_fluxo_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "sub_organizacao_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "bot_fluxo_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "bot_fluxo_id_seq";

-- AlterTable
ALTER TABLE "bot_fluxo_variaveis" DROP CONSTRAINT "bot_fluxo_variaveis_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "flow_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "bot_fluxo_variaveis_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "bot_fluxo_variaveis_id_seq";

-- AlterTable
ALTER TABLE "bot_usuario" DROP CONSTRAINT "bot_usuario_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "bot_usuario_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "bot_usuario_id_seq";

-- AlterTable
ALTER TABLE "conversa" DROP CONSTRAINT "conversa_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "conversa_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "conversa_id_seq";

-- AlterTable
ALTER TABLE "org_membro" DROP CONSTRAINT "org_membro_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organizacao_id" SET DATA TYPE TEXT,
ALTER COLUMN "usuario_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "org_membro_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "org_membro_id_seq";

-- AlterTable
ALTER TABLE "organizacao" DROP CONSTRAINT "organizacao_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "organizacao_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "organizacao_id_seq";

-- AlterTable
ALTER TABLE "sub_org_membro" DROP CONSTRAINT "sub_org_membro_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "sub_organizacao_id" SET DATA TYPE TEXT,
ALTER COLUMN "usuario_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "sub_org_membro_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "sub_org_membro_id_seq";

-- AlterTable
ALTER TABLE "sub_organizacao" DROP CONSTRAINT "sub_organizacao_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organizacao_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "sub_organizacao_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "sub_organizacao_id_seq";

-- AlterTable
ALTER TABLE "yjs_updates" DROP CONSTRAINT "yjs_updates_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "flow_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "yjs_updates_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "yjs_updates_id_seq";

-- AddForeignKey
ALTER TABLE "bot_fluxo" ADD CONSTRAINT "bot_fluxo_sub_organizacao_id_fkey" FOREIGN KEY ("sub_organizacao_id") REFERENCES "sub_organizacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_fluxo_variaveis" ADD CONSTRAINT "bot_fluxo_variaveis_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "bot_fluxo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_estado_config" ADD CONSTRAINT "bot_estado_config_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "bot_fluxo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yjs_updates" ADD CONSTRAINT "yjs_updates_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "bot_fluxo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_organizacao" ADD CONSTRAINT "sub_organizacao_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membro" ADD CONSTRAINT "org_membro_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membro" ADD CONSTRAINT "org_membro_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "bot_usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_org_membro" ADD CONSTRAINT "sub_org_membro_sub_organizacao_id_fkey" FOREIGN KEY ("sub_organizacao_id") REFERENCES "sub_organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_org_membro" ADD CONSTRAINT "sub_org_membro_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "bot_usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_registrada" ADD CONSTRAINT "api_registrada_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_rota" ADD CONSTRAINT "api_rota_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_registrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_sub_org_token" ADD CONSTRAINT "api_sub_org_token_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_registrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_sub_org_token" ADD CONSTRAINT "api_sub_org_token_sub_organizacao_id_fkey" FOREIGN KEY ("sub_organizacao_id") REFERENCES "sub_organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
