-- =============================================================================
-- 002_criar_tabela_fluxos.sql
--
-- Cria a tabela de fluxos e adiciona campos visuais à tabela de estados
-- para suportar a integração com o frontend (editor visual de fluxos).
-- =============================================================================

-- 1. Tabela de fluxos
CREATE TABLE IF NOT EXISTS bot_fluxo (
    id              SERIAL       PRIMARY KEY,
    nome            VARCHAR(100) NOT NULL,
    descricao       TEXT,
    versao          INTEGER      NOT NULL DEFAULT 1,
    ativo           BOOLEAN      NOT NULL DEFAULT false,
    flow_json       JSONB,
    criado_em       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. Campos visuais na tabela de estados (para manter posição/tipo do nó no editor)
ALTER TABLE bot_estado_config
    ADD COLUMN IF NOT EXISTS node_id   VARCHAR(50),
    ADD COLUMN IF NOT EXISTS node_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS position  JSONB DEFAULT '{"x": 0, "y": 0}',
    ADD COLUMN IF NOT EXISTS flow_id   INTEGER;

-- FK só se ainda não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_estado_fluxo' AND table_name = 'bot_estado_config'
    ) THEN
        ALTER TABLE bot_estado_config
            ADD CONSTRAINT fk_estado_fluxo
            FOREIGN KEY (flow_id) REFERENCES bot_fluxo(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Tabela de variáveis globais do fluxo
CREATE TABLE IF NOT EXISTS bot_fluxo_variaveis (
    id           SERIAL       PRIMARY KEY,
    flow_id      INTEGER      NOT NULL REFERENCES bot_fluxo(id) ON DELETE CASCADE,
    chave        VARCHAR(100) NOT NULL,
    valor_padrao TEXT,
    UNIQUE(flow_id, chave)
);

-- =============================================================================
-- FIM DA MIGRAÇÃO
-- =============================================================================
