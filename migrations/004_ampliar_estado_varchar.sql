-- Amplia coluna estado para suportar prefixo F{flowId}_ + nome do estado
-- Ex: F123_MENU_PRINCIPAL (antigo limite de 50 chars era insuficiente)

ALTER TABLE bot_estado_config
    ALTER COLUMN estado TYPE VARCHAR(100);

ALTER TABLE bot_estado_transicao
    ALTER COLUMN estado_origem  TYPE VARCHAR(100),
    ALTER COLUMN estado_destino TYPE VARCHAR(100);

ALTER TABLE bot_estado_usuario
    ALTER COLUMN estado_atual TYPE VARCHAR(100);

ALTER TABLE bot_estado_historico
    ALTER COLUMN estado_anterior TYPE VARCHAR(100),
    ALTER COLUMN estado_novo     TYPE VARCHAR(100);
