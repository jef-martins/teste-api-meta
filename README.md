# Telebots — Back-End (NestJS)

API REST + WebSocket para o projeto Telebots. Construída com NestJS, Prisma (PostgreSQL) e Socket.IO com suporte a colaboração em tempo real via Yjs.

## Pré-requisitos (sem Docker)

- **Node.js** >= 20
- **npm** >= 9
- **PostgreSQL** >= 15 rodando na porta `5433`

## PostgreSQL localmente

### Opção 1: Usar Docker apenas para o banco

A forma mais simples se você não quer instalar PostgreSQL localmente:

```bash
# Subir o container PostgreSQL em background
docker run -d \
  --name telebots-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -p 5433:5432 \
  postgres:15-alpine
```

Verificar se está rodando:
```bash
docker ps | grep telebots-postgres
```

Parar o container:
```bash
docker stop telebots-postgres
```

Remover o container:
```bash
docker rm telebots-postgres
```

### Opção 2: PostgreSQL instalado localmente

Se você tem PostgreSQL >= 15 instalado:

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start
```

**macOS (via Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
- Download do [postgresql.org](https://www.postgresql.org/download/windows/)
- Durante a instalação, defina a senha do usuário `postgres` como `postgres`
- O serviço inicia automaticamente

Verificar se está rodando:
```bash
psql -U postgres -d postgres -c "SELECT 1"
```

Se necessário, criar a porta correta (se não estiver na 5433):
```bash
# Editar postgresql.conf e mudar port para 5433
# Ou criar uma alias de porta
```

## Variáveis de ambiente

Copie o arquivo de exemplo e ajuste conforme necessário:

```bash
cp .env.example .env
```

As principais variáveis:

| Variável | Descrição | Padrão |
|---|---|---|
| `DATABASE_URL` | URL de conexão do Prisma | `postgresql://postgres:postgres@localhost:5433/postgres?schema=public` |
| `PORT` | Porta da API | `3000` |
| `JWT_SECRET` | Secret do JWT | — |
| `FRONTEND_URL` | URL do frontend (CORS) | `http://localhost:5173` |
| `BOT_NUMERO_ADMIN` | Número admin do bot WhatsApp | — |
| `BOT_SESSAO` | Nome da sessão WPP | `sessao-bot-wpp` |

## Rodar sem Docker

```bash
# Instalar dependências
npm install

# Gerar cliente Prisma e rodar migrations
npx prisma migrate dev

# Desenvolvimento (watch mode)
npm run start:dev

# Produção
npm run build
npm run start:prod
```

## 🐳 Rodar com Docker (isolado)

O back-end possui seus próprios arquivos Docker e pode ser executado de forma completamente independente, incluindo o banco de dados PostgreSQL.

### Desenvolvimento (hot-reload)

O código-fonte é montado como volume: qualquer alteração no `src/` é refletida instantaneamente sem precisar rebuildar a imagem.

```bash
# Na pasta telebots-back
docker compose -f docker-compose.dev.yml up --build
```

- API disponível em: `http://localhost:3000`
- Banco de dados em: `localhost:5433`

### Produção

```bash
# Na pasta telebots-back
docker compose up -d --build
```

- API disponível em: `http://localhost:3000`

### Parar os containers

```bash
docker compose down                                  # produção
docker compose -f docker-compose.dev.yml down        # desenvolvimento
```

### Variáveis customizadas via `.env`

O compose lê o arquivo `.env` da pasta automaticamente. As seguintes variáveis também podem sobrescrever os defaults do compose:

| Variável | Default |
|---|---|
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | `postgres` |
| `DB_NAME` | `postgres` |
| `DB_PORT` | `5433` |
| `PORT` | `3000` |

---

## Scripts disponíveis

```bash
npm run start        # Iniciar
npm run start:dev    # Watch mode
npm run start:prod   # Produção (requer build)
npm run build        # Compilar TypeScript
npm run lint         # ESLint com auto-fix
npm run format       # Prettier
```

## Testes

```bash
npm run test         # Unit tests
npm run test:e2e     # E2E tests
npm run test:cov     # Coverage
```

## License

MIT
