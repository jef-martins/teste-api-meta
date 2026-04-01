ALTER TABLE "bot_keyword_global"
ADD COLUMN "flow_id" TEXT;

UPDATE "bot_keyword_global" AS kw
SET "flow_id" = cfg."flow_id"
FROM "bot_estado_config" AS cfg
WHERE cfg."estado" = kw."estado_destino"
  AND kw."flow_id" IS NULL;

CREATE INDEX "bot_keyword_global_flow_id_idx"
ON "bot_keyword_global"("flow_id");

ALTER TABLE "bot_keyword_global"
ADD CONSTRAINT "bot_keyword_global_flow_id_fkey"
FOREIGN KEY ("flow_id") REFERENCES "bot_fluxo"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
