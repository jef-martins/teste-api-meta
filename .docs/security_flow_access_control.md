# Correção de Segurança — Controle de Acesso em Fluxos

## Problema

Os endpoints `GET`, `PUT`, `DELETE /api/fluxos/:id` e `POST /api/fluxos/:id/ativar` não verificavam se o usuário autenticado tinha acesso ao fluxo solicitado.

Qualquer usuário autenticado conseguia ler, modificar, excluir ou ativar qualquer fluxo de qualquer sub-organização, bastando conhecer o ID do fluxo.

**Exemplo do ataque:**
- Usuário A cria um fluxo vinculado à Sub-org X (ID do fluxo: `abc-uuid`)
- Usuário B, sem vínculo com a Sub-org X, acessa `GET /api/fluxos/abc-uuid` e obtém o fluxo completo
- Usuário B pode também modificar (`PUT`) ou excluir (`DELETE`) o fluxo

## Solução

### `src/flow/flow.service.ts`

Adicionado método privado `verificarAcessoFluxo(fluxo, usuarioId)`:

```typescript
private async verificarAcessoFluxo(fluxo: any, usuarioId: string) {
  if (fluxo.subOrganizacaoId) {
    const temAcesso = await this.orgService.verificarAcessoSubOrg(usuarioId, fluxo.subOrganizacaoId);
    if (!temAcesso) {
      throw new ForbiddenException('Sem acesso a este fluxo');
    }
  }
}
```

- Se o fluxo não tiver `subOrganizacaoId` (retrocompatibilidade), o acesso é permitido
- Se tiver, delega ao `OrganizationService.verificarAcessoSubOrg()` que verifica membership na org ou sub-org
- Lança `ForbiddenException` (HTTP 403) se não tiver acesso

`OrganizationService` adicionado como dependência no construtor de `FlowService`.

Métodos atualizados para receber `usuarioId: string` e chamar `verificarAcessoFluxo`:
- `obter(id, usuarioId)` — verifica antes de retornar o fluxo
- `atualizar(id, data, usuarioId)` — verifica antes de salvar
- `excluir(id, usuarioId)` — busca o fluxo antes de deletar para verificar acesso
- `ativar(id, usuarioId)` — verifica antes de ativar

### `src/flow/flow.controller.ts`

`@Req() req: any` adicionado aos handlers `obter`, `atualizar`, `excluir` e `ativar`. O `req.user.id` (extraído do JWT pelo `JwtAuthGuard`) é passado como `usuarioId` para o service.

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/flow/flow.service.ts` | Novo método `verificarAcessoFluxo`, dependência `OrganizationService`, parâmetro `usuarioId` em 4 métodos |
| `src/flow/flow.controller.ts` | `@Req()` adicionado a 4 handlers, `req.user.id` passado ao service |

## Como Testar

1. Criar dois usuários (A e B) em sub-orgs diferentes
2. Usuário A cria um fluxo — anota o UUID retornado
3. Usuário B tenta `GET /api/fluxos/{uuid}` com seu token → deve receber `403 Forbidden`
4. Usuário A tenta o mesmo → deve receber `200 OK` com o fluxo

## Observações

- Fluxos sem `subOrganizacaoId` (criados antes da implementação de orgs) continuam acessíveis por qualquer usuário autenticado — isso é comportamento retrocompatível
- O WebSocket de colaboração (`CollaborationGateway`) ainda não valida acesso à sub-org no evento `join-flow` — pendente para implementação futura
