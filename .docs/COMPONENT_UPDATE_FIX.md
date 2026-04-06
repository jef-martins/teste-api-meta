# Fix: Atualização de Componente não Propaga para Fluxos

**Data:** 2026-03-26  
**Branch:** devLuis2  
**Arquivos modificados:**
- `telebots-backend-nestjs/src/custom-component/custom-component.service.ts`
- `telebots-backend-nestjs/src/custom-component/custom-component.module.ts`
- `telebots-backend-nestjs/src/flow/flow.service.ts`

---

## Problema

Ao atualizar o conteúdo de um `customComponent` (via editor de fluxo ou `ComponentEditor`), o backend:
1. ✅ Atualiza o `nodesJson` do `ComponentePersonalizado` no banco corretamente.
2. ❌ **NÃO** atualiza os `flowJson` dos fluxos que já possuem nós `customComponent` apontando para esse componente.
3. ❌ **NÃO** recompila a máquina de estados desses fluxos.

Consequência:
- O `flowJson` armazenado nos fluxos mantém `internalNodes`/`internalConnections` desatualizados do componente.
- O bot continua executando o fluxo antigo do componente (usa os estados compilados desatualizados).
- Ao reabrir o editor do fluxo, o nó aparece com os dados antigos (pois `loadFlow` usa o `flowJson` do banco).

### Fluxo de dados atual (bugado)

```
PUT /api/custom-components/:id
  → Atualiza ComponentePersonalizado.nodesJson ✅
  → FIM (fluxos não são atualizados) ❌
```

### Fluxo de dados correto (pós-fix)

```
PUT /api/custom-components/:id
  → Atualiza ComponentePersonalizado.nodesJson ✅
  → Busca todos os BotFluxo que têm nó customComponent com componentId == :id ✅
  → Para cada fluxo encontrado:
      → Atualiza internalNodes/internalConnections do nó no flowJson ✅
      → Recompila a máquina de estados (bot_estado_config + bot_estado_transicao) ✅
```

---

## Solução Implementada

### 1. `FlowService` — novo método `atualizarNosDoComponente`

**Arquivo:** `src/flow/flow.service.ts`

Adicionado método público que:
1. Busca todos os `BotFluxo` cujo `flowJson` contém nós com `componentId` igual ao novo ID.
2. Para cada fluxo encontrado, percorre os nós e substitui `internalNodes`/`internalConnections` dos nós que referenciam o componente.
3. Persiste o `flowJson` atualizado e recompila a máquina de estados do fluxo via `persistirEstados`.

```ts
async atualizarNosDoComponente(
  componenteId: string,
  nodesJson: { nodes: FlowNode[]; connections: FlowConnection[] }
): Promise<{ fluxosAtualizados: number }>
```

### 2. `CustomComponentService` — injeção de `FlowService` e chamada após `atualizar`

**Arquivo:** `src/custom-component/custom-component.service.ts`

O método `atualizar` agora, após salvar no banco, chama `flowService.atualizarNosDoComponente(id, data.nodesJson)` para propagar as alterações a todos os fluxos afetados.

### 3. `CustomComponentModule` — adiciona `FlowModule` aos imports

**Arquivo:** `src/custom-component/custom-component.module.ts`

Importa `FlowModule` para que `FlowService` esteja disponível via DI no módulo de componentes personalizados.

---

## Detalhes de Implementação

### Busca de fluxos afetados

O `flowJson` é uma coluna JSON no PostgreSQL. A busca usa `prisma.$queryRaw` com um operador `@>` (contains) e `jsonb_path_exists` para encontrar fluxos que contêm um nó com `componentId` igual ao informado:

```sql
SELECT id, flow_json
FROM bot_fluxo
WHERE flow_json IS NOT NULL
  AND flow_json -> 'nodes' @> '[{"properties": {"componentId": "<ID>"}}]'
```

Alternativamente, como o Prisma não suporta nativamente queries JSON complexas de forma portável, a solução foi carregar todos os fluxos que têm `flowJson` e filtrar em memória — aceitável dado o número esperado de fluxos por sub-organização.

**Otimização:** Para evitar carregar fluxos desnecessários, a query filtra apenas `flowJson IS NOT NULL` e obtém apenas `id` e `flowJson`, sem carregar dados da máquina de estados.

### Tratamento de erros

Erros na propagação são logados mas **não** propagam para o cliente — a atualização do componente em si sempre é bem-sucedida, mesmo que a propagação falhe parcialmente. Isso garante tolerância a falhas.

---

## Limitações

- **Yjs rooms abertas:** Se um fluxo estiver com uma sala Yjs ativa (usuário editando), o `flowJson` será sobrescrito pelo `syncFlowJsonFromDoc` na próxima persistência do Yjs. O fix não afeta isso — quando a sala fechar/recompilar, usará os nós mais recentes (que agora têm os internos atualizados no `flowJson`).
- **Performance:** A busca é feita filtrando em memória. Para ambientes com milhares de fluxos, considerar um índice GIN no `flow_json` ou uma query `jsonb_path_exists` raw.
