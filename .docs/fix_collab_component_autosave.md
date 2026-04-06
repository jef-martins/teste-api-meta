# Fix: Autosave de Componentes em Modo Colaborativo

## Problema

Ao editar um componente via `ComponentEditor.vue` (página separada) em modo colaborativo (Yjs), as mudanças eram salvas no banco para o componente, mas **os fluxos que usam esse componente nunca eram atualizados nem recompilados**.

Além disso, após qualquer recompilação de fluxo via Yjs colaborativo, o evento `flow.updated` **não era emitido**, deixando o cache do `EstadoRepository` obsoleto. Isso causava o erro `P2003` ao tentar salvar o estado de usuários do bot cujo estado havia sido deletado/recriado na recompilação.

## Causa Raiz

Em `collaboration.service.ts`, o método `persistUpdates` para `roomType === 'component'` chamava apenas `syncComponentJsonFromDoc`, que salva o componente no banco, mas não propagava as mudanças para os fluxos que usam o componente.

O caminho REST (`custom-component.service.atualizar`) fazia essa propagação via `flowService.atualizarNosDoComponente` + `collaborationService.forceUpdateComponentInAllFlows`, mas o caminho Yjs não fazia nada equivalente.

## Correção (`collaboration.service.ts`)

### 1. Propagação de componente para fluxos

Adicionado método privado `findFlowsUsingComponent(componentId)` que:
- Verifica salas Yjs ativas (estado mais atualizado)
- Busca no DB fluxos inativos que referenciam o componente

Em `persistUpdates`, após salvar o componente, chama `forceUpdateComponentInAllFlows` com os fluxos encontrados. Isso:
- Atualiza as salas Yjs ativas em tempo real (clientes conectados recebem a atualização)
- Para salas inativas, cria sala temporária, persiste, e limpa
- Agenda recompilação dos fluxos afetados

### 2. Emissão de `flow.updated` após recompilação

Em `recompileFlow`, após `flowService.recompilarFluxo`, emite `this.eventEmitter.emit('flow.updated')`. Isso atualiza o cache do `EstadoRepository`, evitando o erro `P2003`.

Injetado `EventEmitter2` no construtor do `CollaborationService`.

### 3. Robustez do sync frontend (useYjs + flowStore + ComponentEditor)

**Problema:** Ao adicionar sub-componentes (waitForResponse, sendMessage, etc.) a um nó no `ComponentEditor.vue`, a mudança podia não ser sincronizada com o Yjs em certos cenários de timing.

**Causas identificadas:**

1. **Race condition em watchers de name/description (`flowStore.js`)**: Os watchers `watch(name)` e `watch(description)` usavam flush padrão (`'pre'`), que é assíncrono. Quando `syncDocToStore()` definia `flowStore.name` com `_applyingRemote = true`, o watcher só disparava DEPOIS de `setApplyingRemote(false)`, causando `_markDirty()` espúrios e potencial interferência no scheduling de sync.

2. **Falta de safety net para syncs perdidos (`useYjs.js`)**: O mecanismo RAF-based de sync depende de: `_markDirty()` → `_syncVersion++` → watch → `scheduleSync()` → RAF → `syncStoreToDoc()`. Se qualquer elo dessa cadeia falhasse (ex: RAF disparando com `yjsConnected = false`, deduplicação de watchers do Vue), a mudança era perdida permanentemente.

3. **Poluição de localStorage (`ComponentEditor.vue`)**: `useFlowBuilder` era chamado sem `flowId`, fazendo `loadFromLocalStorage()` carregar dados genéricos e `saveToLocalStorage()` salvar dados do componente na chave genérica.

**Correções:**

- **`flowStore.js`**: Watchers de `name` e `description` agora usam `{ flush: 'sync' }`, garantindo que disparem sincronamente enquanto `_applyingRemote` ainda é `true`.
- **`useYjs.js`**: Adicionado sync periódico (5s) como safety net. Compara `_lastSyncedVersion` com `flowStore._syncVersion` para detectar mudanças não sincronizadas. Só dispara `syncStoreToDoc()` quando há mudanças pendentes.
- **`ComponentEditor.vue`**: `useFlowBuilder` agora recebe `flowId: props.componentId` para evitar poluição do localStorage genérico.

## Fluxos Afetados

| Cenário | Antes | Depois |
|---------|-------|--------|
| Editar componente via ComponentEditor.vue (Yjs) | Componente salvo, fluxos NÃO atualizados | Componente + fluxos atualizados, recompilados |
| Recompilação via Yjs | Cache do bot não atualizado (P2003) | Cache atualizado via `flow.updated` |
| Editar componente inline no FlowEditor (close) | Funcionava via REST | Sem mudança |
| Editar fluxo diretamente no FlowEditor | Funcionava via Yjs | Sem mudança (+ cache agora atualizado) |
| Adicionar sub-componente no ComponentEditor | Podia não sincronizar em certos timings | Sync garantido via safety net periódico (5s) |
| Adicionar sub-componente no FlowEditor | Funcionava (mesma correção melhora robustez) | Robustez melhorada via safety net |
