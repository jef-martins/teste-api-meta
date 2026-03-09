-- AlterTable
ALTER TABLE "bot_fluxo" ADD COLUMN     "sub_organizacao_id" INTEGER;

-- CreateTable
CREATE TABLE "organizacao" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_organizacao" (
    "id" SERIAL NOT NULL,
    "organizacao_id" INTEGER NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_organizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_membro" (
    "id" SERIAL NOT NULL,
    "organizacao_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "papel" VARCHAR(20) NOT NULL DEFAULT 'membro',
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_membro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_org_membro" (
    "id" SERIAL NOT NULL,
    "sub_organizacao_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "papel" VARCHAR(20) NOT NULL DEFAULT 'membro',
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_org_membro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_registrada" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "url_base" VARCHAR(500) NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_registrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_rota" (
    "id" SERIAL NOT NULL,
    "api_id" INTEGER NOT NULL,
    "path" VARCHAR(300) NOT NULL,
    "metodo" VARCHAR(10) NOT NULL DEFAULT 'GET',
    "descricao" TEXT,
    "parametros" JSONB NOT NULL DEFAULT '[]',
    "body_template" JSONB,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_rota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizacao_slug_key" ON "organizacao"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sub_organizacao_organizacao_id_slug_key" ON "sub_organizacao"("organizacao_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "org_membro_organizacao_id_usuario_id_key" ON "org_membro"("organizacao_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "sub_org_membro_sub_organizacao_id_usuario_id_key" ON "sub_org_membro"("sub_organizacao_id", "usuario_id");

-- AddForeignKey
ALTER TABLE "bot_fluxo" ADD CONSTRAINT "bot_fluxo_sub_organizacao_id_fkey" FOREIGN KEY ("sub_organizacao_id") REFERENCES "sub_organizacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "api_registrada" ADD CONSTRAINT "api_registrada_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "bot_usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_rota" ADD CONSTRAINT "api_rota_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "api_registrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
