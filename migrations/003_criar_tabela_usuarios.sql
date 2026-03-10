-- Tabela de usuários para autenticação
CREATE TABLE IF NOT EXISTS bot_usuario (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  nome VARCHAR(100),
  papel VARCHAR(20) DEFAULT 'admin',
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
