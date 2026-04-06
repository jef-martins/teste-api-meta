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

## Fluxos Afetados

| Cenário | Antes | Depois |
|---------|-------|--------|
| Editar componente via ComponentEditor.vue (Yjs) | Componente salvo, fluxos NÃO atualizados | Componente + fluxos atualizados, recompilados |
| Recompilação via Yjs | Cache do bot não atualizado (P2003) | Cache atualizado via `flow.updated` |
| Editar componente inline no FlowEditor (close) | Funcionava via REST | Sem mudança |
| Editar fluxo diretamente no FlowEditor | Funcionava via Yjs | Sem mudança (+ cache agora atualizado) |
