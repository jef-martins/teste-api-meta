# Análise de Refatoração do Projeto (NestJS)

Esta análise detalha as oportunidades de refatoração identificadas no código-fonte, visando melhorar a manutenibilidade, escalabilidade, segurança e aderência às melhores práticas do framework NestJS e TypeScript.

## 1. Arquitetura e Duplicação de Código (O problema mais crítico)

**O que refatorar:** Os arquivos `src/bot/meta/handler-meta.service.ts` e `src/bot/wppConnect/handler.service.ts`.
**Por quê:** Atualmente, existe cerca de 90% de código duplicado entre os provedores Meta e WPPConnect. Ambos implementam a mesma lógica de negócios (como montar menus, capturar dados, fazer requisições HTTP e avançar estados). A única diferença real entre eles é a forma como a mensagem final é enviada para a API (Meta vs WPPConnect).
**Como resolver (Proposta):**
- Criar uma interface base `IBotProvider` que defina métodos simples como `enviarTexto()`, `enviarBotoes()`, `enviarLista()`.
- Criar implementações específicas (`MetaAdapter` e `WppConnectAdapter`) que apenas formatem o payload e façam o disparo.
- Centralizar a lógica de negócios em um único `BotHandlerService` que recebe o provedor via Injeção de Dependência, eliminando a duplicação de milhares de linhas de código.

## 2. Inconsistência na Camada de Acesso a Dados (Banco de Dados)

**O que refatorar:** O diretório `src/database/` (especificamente `estadoRepository.ts` e `db.ts`).
**Por quê:** O projeto apresenta sinais de uma migração inacabada. Grande parte do código utiliza o Prisma ORM (`src/prisma/` e `src/bot/estado.repository.ts`), porém, os arquivos legados na pasta `src/database/` continuam usando conexões raw (SQL puro) com o pacote `pg`. Manter dois métodos de acesso ao banco cria fragmentação, dificulta transações complexas e aumenta o risco de vazamento de conexões.
**Como resolver (Proposta):**
- Garantir que todos os módulos utilizem exclusivamente o `PrismaService` via Injeção de Dependência.
- Excluir a pasta `src/database/` e suas queries legadas assim que a migração for concluída.

## 3. Tipagem Fraca (Uso excessivo de `any`)

**O que refatorar:** Tipagens ao longo de todo o sistema. A análise do linter reportou dezenas de `Unsafe argument of type 'any'`.
**Por quê:** O uso contínuo de `any` em assinaturas de métodos (especialmente no `StateMachineEngine` e nos Handlers) anula o principal benefício do TypeScript, que é a segurança em tempo de compilação. Isso propicia bugs ocultos (como o erro de `.slice()` que foi corrigido anteriormente) e dificulta a manutenção, pois o desenvolvedor não tem auto-complete dos payloads.
**Como resolver (Proposta):**
- Criar DTOs e Interfaces para os payloads do banco (`BotEstadoConfig`, `ConfigRequisicao`, etc.).
- Tipar corretamente o objeto `message` que transita entre os módulos, substituindo os parâmetros `(message: any)`.

## 4. Violação do Princípio de Responsabilidade Única (SRP)

**O que refatorar:** O método `_handlerRequisicao` (e a lógica de tratamento HTTP embutida nos handlers).
**Por quê:** Os handlers de estado atuais são "Deus". Eles interpretam a mensagem, gerenciam o estado do usuário, formatam a interface gráfica do WhatsApp e **também realizam chamadas HTTP complexas (fetch)** para APIs externas. Isso torna o código difícil de testar de forma isolada.
**Como resolver (Proposta):**
- Extrair toda a lógica de `fetch` e parse de APIs externas para um serviço dedicado, como `HttpIntegrationService` ou delegar para o `HttpModule` oficial do NestJS (Axios).

## 5. Variáveis de Ambiente e Configuração Hardcoded

**O que refatorar:** URLs da API da Meta e chaves de acesso instanciadas diretamente nos serviços.
**Por quê:** O código faz uso de `process.env.VARIAVEL` espalhado por diversos arquivos, e em alguns lugares há URLs ou versões de API embutidas diretamente como strings (ex: chamadas Graph API).
**Como resolver (Proposta):**
- Centralizar as configurações utilizando o `ConfigModule` / `ConfigService` do NestJS. Isso facilita a validação (usando Joi ou class-validator) para garantir que o bot nem inicie se variáveis obrigatórias estiverem faltando no `.env`.

## 6. Linter e Padronização (Avisos Críticos)

**O que refatorar:** Avisos do ESLint apontando Promessas flutuantes (`@typescript-eslint/no-floating-promises`) e métodos assíncronos sem `await` (`@typescript-eslint/require-await`).
**Por quê:** Promessas não aguardadas (floating promises), especialmente no WebSocket (`collaboration.gateway.ts`), podem ocultar exceções e causar travamentos silenciosos da aplicação (Unhandled Rejection).
**Como resolver (Proposta):**
- Revisar as chamadas assíncronas assinaladas pelo linter para garantir que sejam resolvidas (`await`), tratadas com `.catch()` ou marcadas com `void` se forem disparadas conscientemente em background (fire-and-forget).

---
**Conclusão:** 
O projeto funciona, mas carrega débitos técnicos da migração para NestJS e do crescimento orgânico das funcionalidades (Meta vs WPP). Uma refatoração focada no item 1 (unificação dos handlers) trará o maior ganho imediato de produtividade e segurança.

**Aguardando suas instruções:** Leia a análise acima. Se decidir seguir em frente, me informe por qual ponto deseja começar a refatoração.