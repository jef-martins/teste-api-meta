# Telebots — Back-End (NestJS)

API REST + WebSocket para o projeto Telebots. Construída com NestJS, Prisma (PostgreSQL) e Socket.IO com suporte a colaboração em tempo real via Yjs.

## Pré-requisitos (sem Docker)

- **Node.js** >= 20
- **npm** >= 9
- **PostgreSQL** >= 15 rodando na porta `5433`

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
# Na pasta telebots-backend-nestjs/
docker compose -f docker-compose.dev.yml up --build
```

- API disponível em: `http://localhost:3000`
- Banco de dados em: `localhost:5433`

### Produção

```bash
# Na pasta telebots-backend-nestjs/
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
