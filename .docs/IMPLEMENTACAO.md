# Documentação de Implementação — Backend (NestJS)

## Resumo das Implementações

### 1. Correção de Interpolação de Variáveis

**Problema:** O método `interpolar()` em `state-machine.engine.ts` usava regex `/\{(\w+)\}/g` que não suportava:
- Duplas chaves `{{expr}}`
- Notação de ponto: `{{obj.field}}`
- Índices de array: `{{data[0].nome}}`

**Solução:**
- Arquivo: `src/bot/state-machine.engine.ts`
- Novo regex normaliza `{{expr}}` → `{expr}` primeiro
- Novo método privado `resolverExprPath(expr, ctx)` resolve paths com notação de ponto e índices de array
- `extrairValorPath()` também atualizado para suportar `data[0].nome`

**Correção adicional:** `_handlerMensagem` em `handler.service.ts` agora interpola cada mensagem com `obterDados(chatId)` antes de enviar. Antes, enviava o template literal sem resolver.

---

### 2. Organizações e Sub-organizações

#### Schema Prisma (prisma/schema.prisma)

Novos modelos adicionados:

| Modelo | Descrição |
|--------|-----------|
| `Organizacao` | Representa uma organização |
| `SubOrganizacao` | Sub-organização pertencente a uma Organização |
| `OrgMembro` | Usuário membro de uma Organização (herda acesso a todas sub-orgs) |
| `SubOrgMembro` | Usuário membro direto de uma Sub-organização (sem acesso às demais) |

Alterações em modelos existentes:
- `BotUsuario`: adicionados `orgsComoMembro`, `subOrgsComoMembro`, `apis`
- `BotFluxo`: adicionado campo `subOrganizacaoId` (nullable para retrocompatibilidade)

#### Módulo Organization (`src/organization/`)

**organization.service.ts** — Lógica de negócio:
- `getSubOrgsAcessiveis(usuarioId)` — retorna todas sub-orgs acessíveis (via org ou diretamente)
- `verificarAcessoSubOrg(usuarioId, subOrgId)` — verifica se usuário tem acesso
- CRUD completo de Organizações, Sub-organizações e Membros
- `transferirSubOrg(subOrgId, novaOrgId, usuarioId)` — transfere sub-org entre orgs

**organization.controller.ts** — Rotas REST:
```
GET    /api/minhas-sub-orgs                                        — sub-orgs acessíveis
GET    /api/organizacoes                                           — lista orgs do usuário
POST   /api/organizacoes                                           — cria organização
GET    /api/organizacoes/:orgId                                    — detalhe
PUT    /api/organizacoes/:orgId                                    — edita
DELETE /api/organizacoes/:orgId                                    — exclui
GET    /api/organizacoes/:orgId/membros                            — lista membros
POST   /api/organizacoes/:orgId/membros                            — adiciona membro por email
DELETE /api/organizacoes/:orgId/membros/:membroId                  — remove membro
GET    /api/organizacoes/:orgId/sub-orgs                           — lista sub-orgs
POST   /api/organizacoes/:orgId/sub-orgs                           — cria sub-org
PUT    /api/organizacoes/:orgId/sub-orgs/:subOrgId                 — edita sub-org
DELETE /api/organizacoes/:orgId/sub-orgs/:subOrgId                 — exclui sub-org
POST   /api/organizacoes/:orgId/sub-orgs/:subOrgId/transferir      — transfere sub-org
POST   /api/organizacoes/:orgId/sub-orgs/:subOrgId/membros         — adiciona membro à sub-org
DELETE /api/organizacoes/:orgId/sub-orgs/:subOrgId/membros/:id     — remove membro da sub-org
```

#### Integração com Auth

`auth.service.ts` agora injeta `OrganizationService` e retorna `subOrgsAcessiveis` no response do login:
```json
{
  "token": "...",
  "usuario": { "id": 1, "email": "...", "nome": "...", "papel": "admin" },
  "subOrgsAcessiveis": [{ "id": 1, "nome": "Equipe Vendas", "organizacao": { ... } }]
}
```

#### Filtro de Fluxos por Sub-organização

`flow.controller.ts` e `flow.service.ts` adaptados:
- `GET /api/fluxos` aceita header `X-SubOrg-Id` para filtrar por sub-organização
- `POST /api/fluxos` vincula o novo fluxo à sub-org informada via header
- `listar(subOrganizacaoId?)` — se não informado, retorna todos (retrocompatível)

---

### 3. API Registry

#### Schema Prisma

Novos modelos:
- `ApiRegistrada` — API salva por usuário (nome, urlBase, headers JSON)
- `ApiRota` — Rota de uma API (path, método, parâmetros JSON, bodyTemplate)

#### Módulo ApiRegistry (`src/api-registry/`)

**api-registry.service.ts** — CRUD completo de APIs e Rotas
**api-registry.controller.ts** — Rotas REST:
```
GET    /api/api-registry                           — lista APIs do usuário
POST   /api/api-registry                           — cria API
PUT    /api/api-registry/:id                       — atualiza API
DELETE /api/api-registry/:id                       — remove API
GET    /api/api-registry/:apiId/rotas              — lista rotas
POST   /api/api-registry/:apiId/rotas              — cria rota
PUT    /api/api-registry/:apiId/rotas/:rotaId      — atualiza rota
DELETE /api/api-registry/:apiId/rotas/:rotaId      — remove rota
```

---

## Migrações de Banco de Dados

Migração aplicada: `20260309175959_add_organizations_and_api_registry`

Inclui:
- Tabelas: `organizacao`, `sub_organizacao`, `org_membro`, `sub_org_membro`
- Tabelas: `api_registrada`, `api_rota`
- Coluna `sub_organizacao_id` em `bot_fluxo`
- Relações em `bot_usuario`

---

## O que Ainda Pode Ser Implementado

### Retrocompatibilidade de usuários sem sub-org
Os usuários existentes não têm sub-org. Considere criar automaticamente uma org+sub-org pessoal no registro de novos usuários (`auth.service.ts > register()`).

### Guard de Sub-org para operações de fluxo
Atualmente `FlowController` verifica acesso ao criar (`POST /fluxos`), mas não nas operações de atualizar/excluir fluxos. Adicionar verificação de acesso completa.

### Sub-org no contexto WebSocket (Colaboração)
O `CollaborationGateway` autentica via JWT mas não verifica se o usuário tem acesso à sub-org do fluxo que está abrindo. Adicionar validação no `handleJoinFlow`.

### BotEstadoUsuario e contexto de sub-org
Se múltiplas sub-orgs tiverem bots WhatsApp ativos, os estados de usuários podem conflitar. Adicionar `subOrganizacaoId` em `BotEstadoUsuario` em versão futura.
