# Migração para UUID — Todos os IDs do Banco

## Motivação

IDs inteiros sequenciais (`autoincrement`) expõem informações sensíveis:
- É possível enumerar recursos por tentativa (ex: `/fluxos/1`, `/fluxos/2`, ...)
- Facilita ataques de força bruta em endpoints que dependem do ID
- UUIDs são aleatórios e não previsíveis, eliminando esses vetores

## Escopo da Migração

### Schema Prisma (`prisma/schema.prisma`)

Todos os 16 modelos tiveram seus IDs migrados:

| Modelo | Antes | Depois |
|--------|-------|--------|
| `BotUsuario` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `BotFluxo` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `BotFluxoVariavel` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `BotEstadoTransicao` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `BotEstadoHistorico` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `Conversa` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `YjsUpdate` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `Organizacao` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `SubOrganizacao` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `OrgMembro` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `SubOrgMembro` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `ApiRegistrada` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `ApiRota` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |
| `ApiSubOrgToken` | `Int @id @default(autoincrement())` | `String @id @default(uuid())` |

Modelos que já eram String e não mudaram: `BotEstadoConfig` (`estado`), `BotEstadoUsuario` (`chatId`).

Todas as FKs foram atualizadas de `Int` para `String`:
- `BotFluxo.subOrganizacaoId`, `BotFluxoVariavel.flowId`, `BotEstadoConfig.flowId`
- `YjsUpdate.flowId`, `OrgMembro.organizacaoId`, `OrgMembro.usuarioId`
- `SubOrgMembro.subOrganizacaoId`, `SubOrgMembro.usuarioId`
- `ApiRegistrada.organizacaoId`, `ApiRota.apiId`, `ApiSubOrgToken.apiId`, `ApiSubOrgToken.subOrganizacaoId`

### Controllers — remoção de `ParseIntPipe`

`ParseIntPipe` foi removido de todos os `@Param()` dos controllers, pois os IDs não são mais inteiros:

- `src/flow/flow.controller.ts`
- `src/organization/organization.controller.ts`
- `src/api-registry/api-registry.controller.ts`
- `src/user/user.controller.ts`
- `src/admin/admin.controller.ts`

Os helpers `getSubOrgId()` e `getOrgId()` nos controllers também foram simplificados — `parseInt()` removido, retornam o valor string diretamente do header.

### Services — tipos `number` → `string`

Todos os parâmetros de ID que eram `number` foram alterados para `string`:

- `src/auth/auth.service.ts` — `getMe(userId: string)`, `gerarToken({ id: string })`
- `src/auth/jwt.strategy.ts` — `validate(payload: { id: string })`
- `src/organization/organization.service.ts` — todos os parâmetros de org/suborg/usuário
- `src/flow/flow.service.ts` — todos os parâmetros de fluxo
- `src/api-registry/api-registry.service.ts` — todos os parâmetros de API/rota
- `src/user/user.service.ts` — `atualizar(id: string)`, `excluir(id: string, usuarioAtualId: string)`
- `src/admin/admin.service.ts` — `atualizarTransicao(id: string)`, `excluirTransicao(id: string)`

### Collaboration

- `src/collaboration/collaboration.gateway.ts` — `clientRooms: Map<string, string>`, `data.flowId: string`
- `src/collaboration/collaboration.service.ts` — `rooms: Map<string, Room>`, todos os métodos com `flowId: string`

## Migração do Banco de Dados

```
Migração aplicada: 20260310114740_uuid_migration
```

Como a mudança de `Int` para `String` no PostgreSQL requer recriar as tabelas, foi necessário:

```bash
npx prisma migrate reset --force --skip-seed   # Apaga e recria o banco
npx prisma migrate dev --name uuid-migration    # Cria e aplica a migration com o novo schema
```

**Atenção:** O `migrate reset` apaga todos os dados. Deve ser executado apenas em banco de desenvolvimento.

## Verificação

Após a migração, qualquer novo registro criado terá um UUID como ID:

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "nome": "Meu Fluxo"
}
```

URLs de fluxo ficam no formato `/flow/f47ac10b-58cc-4372-a567-0e02b2c3d479` em vez de `/flow/1`.
