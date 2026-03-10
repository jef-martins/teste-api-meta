# Migração Backend: Express → NestJS

## Visão Geral

O backend foi migrado do Express.js puro (`../Telebots-back`) para NestJS com arquitetura modular.
Mantém 100% de compatibilidade com as rotas da API existente + nova funcionalidade de colaboração em tempo real.

## Stack

- **NestJS** (framework)
- **Prisma 6** (ORM, substituindo queries raw do `pg`)
- **Passport + JWT** (autenticação)
- **Socket.io** (WebSocket para colaboração)
- **Yjs** (CRDTs para sincronização em tempo real)
- **PostgreSQL** (mesmo banco)

## Estrutura de Módulos

```
src/
├── main.ts                  # Bootstrap + CORS + helmet + rate-limit + Socket.io adapter
├── app.module.ts            # Root module
├── health.controller.ts     # GET /health
├── prisma/                  # PrismaService global
├── auth/                    # Login, setup, register, JWT guards, WS guard
├── user/                    # CRUD de usuários (admin only)
├── flow/                    # CRUD de fluxos + flowConverter + ativar
├── monitoring/              # Sessões, histórico, dashboard
├── conversation/            # Log de conversas
├── admin/                   # CRUD direto de estados/transições + testar-req
├── bot/                     # WPPConnect + StateMachine + Handlers (auto-inicia via OnModuleInit)
└── collaboration/           # NOVO: Yjs + WebSocket + awareness
```

## Mapeamento de Rotas (Express → NestJS)

| Express Original            | NestJS                        | Módulo        |
|-----------------------------|-------------------------------|---------------|
| POST /api/auth/login        | POST /api/auth/login          | AuthModule    |
| POST /api/auth/setup        | POST /api/auth/setup          | AuthModule    |
| POST /api/auth/register     | POST /api/auth/register       | AuthModule    |
| GET  /api/auth/me           | GET  /api/auth/me             | AuthModule    |
| CRUD /api/auth/usuarios     | CRUD /api/auth/usuarios       | UserModule    |
| CRUD /api/fluxos            | CRUD /api/fluxos              | FlowModule    |
| POST /api/fluxos/:id/ativar | POST /api/fluxos/:id/ativar   | FlowModule    |
| GET  /api/conversas         | GET  /api/conversas           | ConversationModule |
| GET  /api/sessoes           | GET  /api/sessoes             | MonitoringModule |
| GET  /api/sessoes/:chatId   | GET  /api/sessoes/:chatId     | MonitoringModule |
| GET  /api/historico/:chatId | GET  /api/historico/:chatId   | MonitoringModule |
| GET  /api/dashboard         | GET  /api/dashboard           | MonitoringModule |
| CRUD /admin/estados         | CRUD /api/admin/estados       | AdminModule   |
| CRUD /admin/transicoes      | CRUD /api/admin/transicoes    | AdminModule   |
| POST /admin/testar-req      | POST /api/admin/testar-req    | AdminModule   |
| GET  /health                | GET  /health                  | HealthController |

**Nota:** No NestJS, todas as rotas agora usam o prefixo global `/api` (exceto `/health`).

## Rate Limiting

Configurado no `main.ts` (idêntico ao Express):

| Rota          | Limite          | Janela    |
|---------------|-----------------|-----------|
| `/api/auth/*` | 20 requisições  | 15 min    |
| `/api/*`      | 100 requisições | 1 min     |

## Banco de Dados (Prisma Schema)

Tabelas mapeadas via Prisma (prisma/schema.prisma):

| Model               | Tabela                  | Descrição                        |
|----------------------|-------------------------|----------------------------------|
| BotUsuario           | bot_usuario             | Usuários admin                   |
| BotFluxo             | bot_fluxo               | Definições de fluxo              |
| BotFluxoVariavel     | bot_fluxo_variaveis     | Variáveis globais do fluxo       |
| BotEstadoConfig      | bot_estado_config       | Estados da máquina de estados    |
| BotEstadoTransicao   | bot_estado_transicao    | Transições entre estados         |
| BotEstadoUsuario     | bot_estado_usuario      | Estado atual de cada usuário     |
| BotEstadoHistorico   | bot_estado_historico    | Histórico de transições          |
| Conversa             | conversa                | Log de mensagens                 |
| YjsUpdate            | yjs_updates             | **NOVO** - Updates Yjs binários  |

### Migration

A migration inicial foi gerada em `prisma/migrations/20260309171102_init/`.

**Para banco novo:**
```bash
npx prisma migrate deploy
```

**Para sincronizar com banco existente (que já tem as tabelas):**
```bash
npx prisma migrate resolve --applied 20260309171102_init
```

## Colaboração em Tempo Real (NOVO)

### Arquitetura

```
Frontend (Vue 3)                     Backend (NestJS)
┌──────────────┐                    ┌──────────────────────┐
│  Yjs Y.Doc   │◄──── Socket.io ───►│ CollaborationGateway │
│  (local)     │                    │                      │
│  Y.Map nodes │   join-flow        │ CollaborationService │
│  Y.Map conns │   sync-step-1/2   │   ├─ Room management │
│  Y.Map vars  │   update          │   ├─ Yjs state       │
│              │   awareness       │   ├─ Persist (debounce)│
│  Awareness   │◄──── broadcast ───►│   └─ Auto-compact    │
│  (cursors)   │                    │                      │
└──────────────┘                    └──────────────────────┘
```

### Como Funciona

1. **Cada fluxo = 1 Y.Doc** com 3 Y.Maps: `nodes`, `connections`, `variables`
2. **Client entra numa room** via `join-flow` (WebSocket autenticado por JWT)
3. **Sync protocol**: troca de state vectors + diffs (igual ao Yjs sync protocol)
4. **Updates incrementais**: cada edição local é broadcast para todos na room
5. **Awareness**: posição do cursor + dados do usuário broadcast a cada ~50ms
6. **Persistência debounced**: updates Yjs salvos no PostgreSQL a cada 2s
7. **Auto-compactação**: a cada 50 updates, merge em 1 (economia de espaço)
8. **Fallback**: se não há Yjs updates, carrega do `flow_json` existente

### Eventos WebSocket

| Evento             | Direção        | Descrição                              |
|--------------------|----------------|----------------------------------------|
| join-flow          | Client→Server  | Entrar na room do fluxo                |
| flow-joined        | Server→Client  | Confirmação de entrada                 |
| sync-step-1        | Bidirecional   | Envio de state vector                  |
| sync-step-2        | Bidirecional   | Envio de diff (update)                 |
| update             | Bidirecional   | Update incremental de Yjs              |
| awareness-update   | Bidirecional   | Posição do cursor + presença           |
| awareness-query    | Bidirecional   | Solicita awareness de todos            |

### Frontend - Composables

Dois novos composables no frontend (`src/composables/`):

- **`useYjs.js`** — Conecta ao gateway WebSocket, gerencia Y.Doc local, sincroniza store ↔ doc
- **`useAwareness.js`** — Broadcast de posição de cursor + presença de outros editores

Integrados no `FlowEditor.vue`:
- Conecta automaticamente ao abrir um fluxo existente
- Conecta após o primeiro save de um fluxo novo
- Indicador visual "Colaborativo" / "Offline" no header
- Sync debounced do store → Y.Doc (200ms)

## Módulo Bot (Migrado)

O módulo Bot foi migrado mantendo a mesma arquitetura.
O `BotService` auto-inicia via `OnModuleInit` (equivalente ao `bot.iniciar()` no `index.js` do Express).

| Express Original       | NestJS                      | Descrição                          |
|------------------------|-----------------------------|------------------------------------|
| `bot/BotWhatsApp.js`   | `bot/bot.service.ts`        | WPPConnect lifecycle + listener    |
| `bot/Bot.js`           | (merged into bot.service)   | Delegação para Engine              |
| `bot/Handler.js`       | `bot/handler.service.ts`    | 6 handlers de estado               |
| `bot/StateMachineEngine.js` | `bot/state-machine.engine.ts` | Motor de estados            |
| `database/estadoRepository.js` | `bot/estado.repository.ts` | Queries de estado via Prisma |
| `database/conversaRepository.js` | `conversation/conversation.service.ts` | Log de mensagens |

### Handlers implementados

| Handler              | Função                                              |
|----------------------|-----------------------------------------------------|
| `_handlerMensagem`   | Envia mensagens e avança automaticamente             |
| `_handlerCapturar`   | Captura input (simples e multi-campo)                |
| `_handlerLista`      | Lista interativa WhatsApp com fallback texto         |
| `_handlerBotoes`     | Botões interativos com fallback texto                |
| `_handlerRequisicao` | HTTP request com interpolação, 4 modos de body       |
| `_handlerDelay`      | Pausa temporal (max 5min) com avanço automático      |

## Variáveis de Ambiente (.env)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname?schema=public
PORT=3000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=sua-chave-secreta
BOT_NUMERO_ADMIN=5511999999999
BOT_MODO_TESTE=false
BOT_SESSAO=sessao-bot-wpp
BOT_LID_ADMIN=              # opcional, para teste com @lid
```

## Integração Frontend ↔ Backend

O frontend (`../telebots-frontend`) já é compatível com o backend NestJS:
- `apiService.js` usa `VITE_API_URL || 'http://localhost:3000'` (porta padrão do NestJS)
- Todas as rotas da API são idênticas
- O campo `atualizado_em` (snake_case do Express/SQL) foi adaptado no frontend para aceitar também `atualizadoEm` (camelCase do Prisma)
- Dependências adicionadas ao frontend: `socket.io-client`, `yjs`

## Como Executar

### Backend
```bash
cd telebots-backend-nestjs
npm install
npx prisma migrate deploy   # ou resolve --applied para banco existente
npm run start:dev
```

### Frontend
```bash
cd telebots-frontend
npm install
npm run dev
```

## Status: Completo

- [x] Estrutura NestJS modular (11 módulos)
- [x] Todas as rotas migradas com mesma assinatura
- [x] Prisma schema + migration criados
- [x] Auth (JWT + Guards + WS Guard)
- [x] Bot auto-start via OnModuleInit
- [x] Rate limiting idêntico ao Express
- [x] Colaboração em tempo real (Yjs + WebSocket)
- [x] Composables do frontend (useYjs, useAwareness)
- [x] Integração frontend ↔ backend NestJS
- [x] Build sem erros (frontend + backend)
