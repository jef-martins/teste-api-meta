-- CreateTable
CREATE TABLE "yjs_component_updates" (
    "id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "update" BYTEA NOT NULL,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yjs_component_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "yjs_component_updates_component_id_idx" ON "yjs_component_updates"("component_id");

-- AddForeignKey
ALTER TABLE "yjs_component_updates" ADD CONSTRAINT "yjs_component_updates_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "componente_personalizado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
