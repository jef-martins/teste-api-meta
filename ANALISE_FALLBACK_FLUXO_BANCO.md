# Análise: Continuidade de Fluxo Quando o Banco Cai

Data da análise: 2026-03-27

## Objetivo

Validar se a aplicação já atende estes cenários:

1. Se o banco **não conectar no startup**, usar fluxo padrão.
2. Se o banco **conectar e cair depois**, continuar usando o fluxo já carregado em memória e, quando voltar, atualizar tudo.
3. Registrar diagnóstico e fornecer prompt para criação da feature, se necessário.

## Resultado curto

- Cenário 1: **não implementado de forma geral** (apenas parcial no canal Meta com flag específica).
- Cenário 2: **parcialmente implementado**, com um bloqueio importante.
- Atualização automática ao voltar banco: **não implementada**.

## Evidências técnicas

### 1) Cache em memória de estados/transições existe

- O `EstadoRepository` mantém `configCache`, `transicoesCache` e `estadoInicialCache` em memória.
- Carrega no `onModuleInit()` e no evento `flow.updated` (`warmUpCache()`).

Referências:
- `src/bot/estado.repository.ts:27`
- `src/bot/estado.repository.ts:76`
- `src/bot/estado.repository.ts:83`
- `src/bot/estado.repository.ts:85`
- `src/bot/estado.repository.ts:100`
- `src/bot/estado.repository.ts:109`
- `src/bot/estado.repository.ts:116`

### 2) Se o banco cair depois de já ter carregado cache, o fluxo tende a continuar

- `obterConfigEstado()` e `buscarProximoEstado()` tentam primeiro cache.
- Persistência de estado do usuário usa Redis e gravação no banco em background com `catch`.
- Falhas de DB em `obterEstadoUsuario`, `obterVariaveisFluxoAtivo`, `obterRotaApi`, `registrarTransicao` são tratadas com fallback/erro logado.

Referências:
- `src/bot/estado.repository.ts:128`
- `src/bot/estado.repository.ts:162`
- `src/bot/estado.repository.ts:207`
- `src/bot/estado.repository.ts:235`
- `src/bot/estado.repository.ts:268`
- `src/bot/estado.repository.ts:286`
- `src/bot/estado.repository.ts:326`

### 3) Bloqueio crítico durante queda em runtime (mesmo com cache carregado)

- Em toda mensagem, o engine consulta keyword global antes de seguir fluxo.
- `GlobalKeywordService.buscarKeywordAtiva()` chama repositório sem `try/catch`.
- Se o banco caiu após startup, `prisma.isConnected` continua `true` (não é atualizado para `false`), então o repositório tenta query e pode lançar erro.
- Esse erro sobe para o `engine.process()`, e o processamento da mensagem é interrompido (capturado apenas no serviço de entrada).

Referências:
- `src/bot/state-machine.engine.ts:161`
- `src/global-keyword/global-keyword.service.ts:235`
- `src/global-keyword/global-keyword.repository.ts:25`
- `src/prisma/prisma.service.ts:15`
- `src/prisma/prisma.service.ts:28`
- `src/bot/wppConnect/bot.service.ts:208`
- `src/bot/meta/bot-meta.service.ts:153`

### 4) Cenário 1 (banco não conecta) não cai automaticamente para fluxo padrão

- `PrismaService` apenas loga erro no startup; não troca estratégia de repositório.
- Em `EstadoRepository`, se não carregar cache e DB indisponível, `obterEstadoInicial()` retorna `'NOVO'` e pode não haver config para responder.
- O fallback para máquina padrão existe no Meta **somente** com `BOT_STATE_MACHINE_PADRAO=true`.
- No WPPConnect, provider é sempre `EstadoRepository` (sem `DefaultEstadoRepository`).

Referências:
- `src/prisma/prisma.service.ts:17`
- `src/prisma/prisma.service.ts:30`
- `src/bot/estado.repository.ts:354`
- `src/bot/estado.repository.ts:369`
- `src/bot/meta/bot-meta.module.ts:25`
- `src/bot/meta/bot-meta.module.ts:32`
- `src/bot/meta/default-estado.repository.ts:9`
- `src/bot/wppConnect/bot.module.ts:10`

### 5) Atualização automática quando banco volta

- O refresh de cache depende de `warmUpCache()` no init e em `flow.updated`.
- `flow.updated` só é emitido quando há operações de fluxo (criar/atualizar/excluir/ativar), não por reconexão do banco.
- Não há mecanismo explícito de health-check/reconnect que dispare recarga automática ao banco voltar.

Referências:
- `src/bot/estado.repository.ts:76`
- `src/bot/estado.repository.ts:83`
- `src/flow/flow.service.ts:301`
- `src/flow/flow.service.ts:347`
- `src/flow/flow.service.ts:363`
- `src/flow/flow.service.ts:413`

## Conclusão por cenário solicitado

1. Banco não conectou -> usar fluxo padrão:
- **Hoje: não atende geral.**
- Só atende no Meta se `BOT_STATE_MACHINE_PADRAO=true`.
- WPP não tem esse fallback automático.

2. Banco conectou e caiu -> continuar com fluxo em memória e atualizar ao voltar:
- **Hoje: parcialmente atende a continuidade** via cache de estados/transições.
- **Falha importante**: lookup de keyword global pode derrubar o processamento da mensagem.
- **Atualização automática ao voltar banco não existe**.

3. Criar análise + prompt:
- **Atendido neste arquivo.**

## Prompt sugerido para implementar a feature

Use este prompt para implementação técnica (ex.: em nova task de Codex/GPT):

```text
Quero implementar resiliência de fluxo offline-first no projeto telebots-back com estes requisitos:

Objetivo funcional:
1) Se o banco não conectar no startup, usar automaticamente o fluxo padrão em memória.
2) Se o banco conectou e cair depois, continuar processando mensagens com o último fluxo carregado em memória.
3) Quando o banco voltar, recarregar cache de fluxos/keywords/variáveis sem derrubar o serviço.

Escopo técnico mínimo:
- Revisar PrismaService para expor estado real de conectividade (incluindo queda pós-startup e reconexão).
- Em EstadoRepository:
  - manter snapshot em memória de estados/transições/estado inicial;
  - nunca zerar cache em caso de erro de refresh;
  - criar rotina de refresh periódico com backoff/jitter quando DB indisponível;
  - disparar warmUpCache na reconexão.
- Em GlobalKeywordService/Repository:
  - evitar throw em leitura quando DB cair;
  - adicionar cache em memória de keywords ativas com fallback (stale-while-revalidate).
- Garantir que StateMachineEngine.process nunca pare fluxo por falha de infraestrutura (DB/Redis), apenas por erro lógico não tratado.
- Unificar comportamento Meta e WPP:
  - adicionar fallback para DefaultEstadoRepository também no canal WPP (ou estratégia única de provider resiliente).
- Observabilidade:
  - logs estruturados para: db_down, db_recovered, cache_refresh_ok, cache_refresh_failed, fallback_mode_enabled.
- Testes automatizados:
  - cenário startup sem DB;
  - cenário DB cai após cache carregado;
  - cenário DB volta e cache é atualizado;
  - garantir processamento de mensagem continua durante indisponibilidade.

Arquivos prioritários para alteração:
- src/prisma/prisma.service.ts
- src/bot/estado.repository.ts
- src/global-keyword/global-keyword.service.ts
- src/global-keyword/global-keyword.repository.ts
- src/bot/wppConnect/bot.module.ts
- src/bot/meta/bot-meta.module.ts
- testes em src/bot/*.spec.ts e src/global-keyword/*.spec.ts

Entregáveis:
- código + testes + breve documentação de operação (flags/env e comportamento em falha/reconexão).
```
