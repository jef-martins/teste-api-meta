-- CreateTable
CREATE TABLE "bot_usuario" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "nome" VARCHAR(100),
    "papel" VARCHAR(20) NOT NULL DEFAULT 'admin',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_fluxo" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "flow_json" JSONB,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_fluxo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_fluxo_variaveis" (
    "id" SERIAL NOT NULL,
    "flow_id" INTEGER NOT NULL,
    "chave" VARCHAR(100) NOT NULL,
    "valor_padrao" TEXT,

    CONSTRAINT "bot_fluxo_variaveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_estado_config" (
    "estado" VARCHAR(100) NOT NULL,
    "handler" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "node_id" VARCHAR(50),
    "node_type" VARCHAR(20),
    "position" JSONB DEFAULT '{"x": 0, "y": 0}',
    "flow_id" INTEGER,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_estado_config_pkey" PRIMARY KEY ("estado")
);

-- CreateTable
CREATE TABLE "bot_estado_transicao" (
    "id" SERIAL NOT NULL,
    "estado_origem" VARCHAR(100) NOT NULL,
    "entrada" VARCHAR(100) NOT NULL DEFAULT '*',
    "estado_destino" VARCHAR(100) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_estado_transicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_estado_usuario" (
    "chat_id" VARCHAR(100) NOT NULL,
    "nome" VARCHAR(255),
    "estado_atual" VARCHAR(100) NOT NULL DEFAULT 'NOVO',
    "contexto" JSONB NOT NULL DEFAULT '{}',
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_estado_usuario_pkey" PRIMARY KEY ("chat_id")
);

-- CreateTable
CREATE TABLE "bot_estado_historico" (
    "id" SERIAL NOT NULL,
    "chat_id" VARCHAR(100) NOT NULL,
    "estado_anterior" VARCHAR(100) NOT NULL,
    "estado_novo" VARCHAR(100) NOT NULL,
    "mensagem_gatilho" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_estado_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversa" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255),
    "dados" JSONB,
    "quem_enviou" VARCHAR(100),
    "para_quem" VARCHAR(100),
    "mensagem" TEXT,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yjs_updates" (
    "id" SERIAL NOT NULL,
    "flow_id" INTEGER NOT NULL,
    "update" BYTEA NOT NULL,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yjs_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_usuario_email_key" ON "bot_usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "bot_fluxo_variaveis_flow_id_chave_key" ON "bot_fluxo_variaveis"("flow_id", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "bot_estado_transicao_estado_origem_entrada_key" ON "bot_estado_transicao"("estado_origem", "entrada");

-- CreateIndex
CREATE INDEX "idx_historico_chat" ON "bot_estado_historico"("chat_id");

-- CreateIndex
CREATE INDEX "idx_historico_criado" ON "bot_estado_historico"("criado_em" DESC);

-- CreateIndex
CREATE INDEX "yjs_updates_flow_id_idx" ON "yjs_updates"("flow_id");

-- AddForeignKey
ALTER TABLE "bot_fluxo_variaveis" ADD CONSTRAINT "bot_fluxo_variaveis_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "bot_fluxo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_estado_config" ADD CONSTRAINT "bot_estado_config_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "bot_fluxo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_estado_transicao" ADD CONSTRAINT "bot_estado_transicao_estado_origem_fkey" FOREIGN KEY ("estado_origem") REFERENCES "bot_estado_config"("estado") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_estado_transicao" ADD CONSTRAINT "bot_estado_transicao_estado_destino_fkey" FOREIGN KEY ("estado_destino") REFERENCES "bot_estado_config"("estado") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_estado_usuario" ADD CONSTRAINT "bot_estado_usuario_estado_atual_fkey" FOREIGN KEY ("estado_atual") REFERENCES "bot_estado_config"("estado") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yjs_updates" ADD CONSTRAINT "yjs_updates_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "bot_fluxo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
