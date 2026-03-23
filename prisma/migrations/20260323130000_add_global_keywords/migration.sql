CREATE TABLE "bot_keyword_global" (
    "id" TEXT NOT NULL,
    "keyword" VARCHAR(150) NOT NULL,
    "estado_destino" VARCHAR(100) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_keyword_global_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bot_keyword_global_keyword_key" ON "bot_keyword_global"("keyword");
CREATE INDEX "bot_keyword_global_estado_destino_idx" ON "bot_keyword_global"("estado_destino");
CREATE INDEX "bot_keyword_global_ativo_idx" ON "bot_keyword_global"("ativo");

ALTER TABLE "bot_keyword_global"
ADD CONSTRAINT "bot_keyword_global_estado_destino_fkey"
FOREIGN KEY ("estado_destino") REFERENCES "bot_estado_config"("estado")
ON DELETE RESTRICT ON UPDATE CASCADE;
