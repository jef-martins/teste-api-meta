
# Plano de reducao de any (backlog)

Data do snapshot inicial: 2026-03-25  
Atualizado em: 2026-03-26

## Estado atual
- Total atual de ocorrencias de `any` / `as any` / `<any>` em `src`: **3**
- Total anterior (inicio desta rodada): **39**
- Total do snapshot inicial (2026-03-25): **258**
- Reducao desta rodada: **36** ocorrencias
- Reducao liquida acumulada: **255** ocorrencias

## O que ja foi concluido
1. Bloco 1 (`flow-converter` + `flow.service` + contrato de `flow.controller`)
...
5. Bloco 5 (rodada 2026-03-26 - tarde)
- `src/collaboration/collaboration.gateway.ts`: tipagem de eventos WS e narrowing de binary data
- `src/admin/admin.controller.ts` & `src/admin/admin.service.ts`: troca de `any` por classes DTO (suporte a metadata)
- `src/bot/meta/bot-meta.service.ts` & `src/bot/meta/bot-meta.controller.ts`: interfaces para Meta Webhook e erros `unknown`
- `src/global-keyword/global-keyword.service.ts` & `src/global-keyword/global-keyword.controller.ts`: DTO class para keywords
- `src/redis/redis.service.ts`: tipagem de modos de expiração e remoção de cast inseguro
- `src/conversation/conversation.service.ts`: uso de `unknown` e cast seguro para `InputJsonValue`
- `src/bot/meta/default-state-machine.config.ts` & `src/bot/meta/default-estado.repository.ts`: tipagem de config in-memory
- Limpeza em specs: `handler-meta.service.spec.ts` e `handler.service.spec.ts` (acesso a privados e engine mocks)

6. Validacao de estabilidade (apos a rodada)
- `npx tsc --noEmit`: passando
- `npm test -- --runInBand`: passando (6 suites, 28 testes)

## Arquivos prioritarios que ja ficaram sem any (ou apenas any do Jest)
- `src/flow/flow-converter.service.ts`
- `src/flow/flow.service.ts`
- `src/flow/flow.controller.ts`
- `src/bot/meta/handler-meta.service.ts`
- `src/bot/wppConnect/handler.service.ts`
- `src/organization/organization.service.ts`
- `src/collaboration/collaboration.service.ts`
- `src/bot/estado.repository.ts`
- `src/bot/wppConnect/bot.service.ts`
- `src/admin/admin.service.ts`
- `src/admin/admin.controller.ts`
- `src/collaboration/collaboration.gateway.ts`
- `src/bot/meta/bot-meta.service.ts`
- `src/bot/meta/bot-meta.controller.ts`
- `src/global-keyword/global-keyword.service.ts`
- `src/global-keyword/global-keyword.controller.ts`
- `src/redis/redis.service.ts`
- `src/conversation/conversation.service.ts`
- `src/bot/meta/default-state-machine.config.ts`
- `src/bot/meta/default-estado.repository.ts`
- `src/bot/meta/handler-meta.service.spec.ts`

## Top arquivos com maior concentracao restante
1. `src/user/user.service.spec.ts` -> 2 (Jest `expect.any`)
2. `src/bot/wppConnect/handler.service.spec.ts` -> 1 (partial client mock)

## Conclusão da rodada de redução massiva
O projeto agora encontra-se em um estado de tipagem forte em quase toda a sua extensão de código-fonte (`src`). As 3 ocorrências restantes são utilitários de teste ou mocks parciais que não comprometem a segurança de tipos do ambiente de produção.

## Comandos uteis de acompanhamento
```bash
grep -rnE "\bany\b|as any|<any>" src | grep -v "node_modules" | grep -v "dist" | wc -l
npx tsc --noEmit
npm test -- --runInBand
```
