-- AlterTable: aumentar limites de varchar para suportar estados com nomes longos
-- e node_ids aninhados (componentes dentro de componentes)

ALTER TABLE "bot_estado_config" ALTER COLUMN "estado" SET DATA TYPE VARCHAR(255);
ALTER TABLE "bot_estado_config" ALTER COLUMN "handler" SET DATA TYPE VARCHAR(255);
ALTER TABLE "bot_estado_config" ALTER COLUMN "node_id" SET DATA TYPE VARCHAR(255);
ALTER TABLE "bot_estado_config" ALTER COLUMN "node_type" SET DATA TYPE VARCHAR(50);

ALTER TABLE "bot_estado_transicao" ALTER COLUMN "estado_origem" SET DATA TYPE VARCHAR(255);
ALTER TABLE "bot_estado_transicao" ALTER COLUMN "entrada" SET DATA TYPE VARCHAR(255);
ALTER TABLE "bot_estado_transicao" ALTER COLUMN "estado_destino" SET DATA TYPE VARCHAR(255);

ALTER TABLE "bot_estado_usuario" ALTER COLUMN "estado_atual" SET DATA TYPE VARCHAR(255);

ALTER TABLE "bot_estado_historico" ALTER COLUMN "estado_anterior" SET DATA TYPE VARCHAR(255);
ALTER TABLE "bot_estado_historico" ALTER COLUMN "estado_novo" SET DATA TYPE VARCHAR(255);
