# Correção de Paridade: Meta Handler vs WPPConnect Handler

**Data:** 2026-03-26

## Contexto

O Telebots possui dois canais de comunicação com o WhatsApp:
- **WPPConnect** (`handler.service.ts`) — usado em desenvolvimento
- **Meta API** (`handler-meta.service.ts`) — usado em produção

A análise revelou que o handler da Meta estava significativamente incompleto comparado ao WPPConnect, causando falhas silenciosas em produção onde fluxos que funcionavam em dev quebravam na Meta API.

## Bugs Encontrados e Corrigidos

### 1. [CRITICO] `_handlerSetVariable` ausente na Meta
- **Problema:** O handler `_handlerSetVariable` não existia no Meta, causando falha quando o fluxo usava nós de atribuição de variáveis.
- **Correção:** Implementado `_handlerSetVariable` completo — processa assignments, interpola valores, e avança automaticamente via wildcard (`*`).

### 2. [ALTO] `_handlerMensagem`: falta processamento de assignments
- **Problema:** Nós de mensagem com `setVariable` inline (sub-componentes) não processavam as atribuições na Meta.
- **Correção:** Adicionado processamento de `config.assignments` após o envio de mensagens.

### 3. [ALTO] `_handlerMensagem`: falta lógica de auto-exit
- **Problema:** Nós de mensagem sem `transicaoAutomatica` mas com transição wildcard de saída ficavam travados esperando input do usuário. Isso ocorre com componentes personalizados que têm saída automática.
- **Correção:** Adicionada lógica de auto-exit: quando `corpo` está vazio e não há `transicaoAutomatica`, o handler verifica se existe transição `*` e avança automaticamente.

### 4. [ALTO] `_handlerLista`: falta fallback por label e wildcard
- **Problema:** Quando o usuário digitava o texto da opção (em vez de selecionar pelo ID/rowId), o Meta não encontrava a transição. Também não tentava o wildcard como fallback.
- **Correção:** Adicionado match por label (comparação case-insensitive) e fallback para wildcard (`*`).

### 5. [ALTO] `_handlerBotoes`: falta fallback por label e wildcard
- **Problema:** Mesmo problema do `_handlerLista` — quando o usuário digitava o texto do botão, a transição falhava.
- **Correção:** Adicionado match por label e fallback para wildcard (`*`).

### 6. [ALTO] `_handlerCapturar`: falta processamento de assignments
- **Problema:** Nós de captura com `setVariable` inline não processavam as atribuições na Meta.
- **Correção:** Adicionado processamento de `config.assignments` após salvar o campo capturado.

### 7. [MEDIO] `_handlerCapturarMulti`: falta interpolação nos prompts
- **Problema:** Prompts de campos como `"Seu nome é {{nome}}, qual seu email?"` não eram interpolados — a variável aparecia literalmente.
- **Correção:** Adicionada interpolação via `engine.interpolar()` nos prompts de cada campo.

### 8. [MEDIO] WPPConnect `_handlerRequisicao`: crash em JSON inválido
- **Problema:** `await res.json()` nas linhas de GET e POST podia lançar exceção se a resposta não fosse JSON válido, crashando o handler.
- **Correção:** Adicionado `.catch(() => ({}))` nas chamadas `res.json()`.

## Refatoração Adicional

- Adicionado helper `avancarEExecutar()` na Meta (já existia no WPPConnect) — centraliza a lógica de avançar estado + executar handler do próximo estado.
- Atualizado `_handlerDelay` e `_handlerRequisicao` na Meta para usar `avancarEExecutar` em vez de código duplicado.
- Atualizado JSDoc no topo do arquivo para incluir `_handlerSetVariable`.

## Arquivos Modificados

| Arquivo | Alterações |
|---------|-----------|
| `src/bot/meta/handler-meta.service.ts` | Bugs 1-7 + refatoração |
| `src/bot/wppConnect/handler.service.ts` | Bug 8 (JSON crash) |
