-- CreateTable
CREATE TABLE "convite" (
    "id" TEXT NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "org_id" TEXT,
    "sub_org_id" TEXT,
    "email" VARCHAR(255) NOT NULL,
    "papel" VARCHAR(20) NOT NULL DEFAULT 'membro',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "convidado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "convite_email_idx" ON "convite"("email");

-- CreateIndex
CREATE INDEX "convite_org_id_idx" ON "convite"("org_id");

-- CreateIndex
CREATE INDEX "convite_sub_org_id_idx" ON "convite"("sub_org_id");

-- AddForeignKey
ALTER TABLE "convite" ADD CONSTRAINT "convite_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convite" ADD CONSTRAINT "convite_sub_org_id_fkey" FOREIGN KEY ("sub_org_id") REFERENCES "sub_organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convite" ADD CONSTRAINT "convite_convidado_por_id_fkey" FOREIGN KEY ("convidado_por_id") REFERENCES "bot_usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
