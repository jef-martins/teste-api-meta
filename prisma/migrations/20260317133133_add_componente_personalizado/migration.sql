-- CreateTable
CREATE TABLE "componente_personalizado" (
    "id" TEXT NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "icone" VARCHAR(50) DEFAULT 'package',
    "nodes_json" JSONB NOT NULL,
    "sub_organizacao_id" TEXT,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "componente_personalizado_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "componente_personalizado" ADD CONSTRAINT "componente_personalizado_sub_organizacao_id_fkey" FOREIGN KEY ("sub_organizacao_id") REFERENCES "sub_organizacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
