# Documentação Técnica - Venon Bot (Telebots Backend)

## 1. Introdução
O **Venon Bot** (internamente referido como `telebots-backend-nestjs`) é o subsistema de backend para uma plataforma de criação e gestão de chatbots multicanal (WhatsApp via WPPConnect e Meta/WhatsApp Business API). Ele gerencia fluxos de conversação baseados em uma máquina de estados finitos, permitindo a execução de lógica complexa, integrações com APIs externas e colaboração em tempo real no editor de fluxos.

---

## 2. Stack Tecnológica
- **Framework**: [NestJS](https://nestjs.com/) (Node.js)
- **Linguagem**: TypeScript
- **ORM**: [Prisma](https://www.prisma.io/)
- **Banco de Dados**: PostgreSQL
- **Integração WhatsApp**:
  - [@wppconnect-team/wppconnect](https://github.com/wppconnect-team/wppconnect) (via Puppeteer/Browser)
  - WhatsApp Business API (via Webhooks da Meta)
- **Comunicação em Tempo Real**: Socket.io
- **Colaboração**: [Yjs](https://yjs.dev/) (CRDTs para edição colaborativa do fluxo)
- **Segurança**: Passport.js (JWT), Bcrypt, Helmet, Express Rate Limit

---

## 3. Arquitetura de Módulos
O projeto segue a estrutura modular do NestJS:

- **`AuthModule`**: Gestão de autenticação de usuários administrativos (JWT).
- **`BotModule`**: Núcleo da integração com WhatsApp. Contém o motor de estados e handlers de mensagens.
- **`FlowModule`**: Gerencia a criação e conversão de fluxos visuais (JSON) para a estrutura de estados no banco de dados.
- **`ConversationModule`**: Log e histórico de mensagens trocadas entre bot e usuários.
- **`AdminModule`**: Endpoints para o dashboard administrativo configurar estados, transições e monitoramento.
- **`CollaborationModule`**: Implementa a camada de sincronização Yjs via WebSockets para permitir que múltiplos usuários editem o mesmo fluxo simultaneamente.
- **`OrganizationModule`**: Suporte a multi-tenancy (Organizações e Sub-organizações).
- **`ApiRegistryModule`**: Cadastro de APIs externas que podem ser invocadas pelo bot durante a conversação.
- **`GlobalKeywordModule`**: Palavras-chave globais (ex: "sair", "menu") que disparam transições independentemente do estado atual.

---

## 4. Motor de Estados (Flow Engine)
O funcionamento do bot é baseado no `StateMachineEngine` (`src/bot/state-machine.engine.ts`).

### 4.1. Ciclo de Processamento
1. **Recebimento**: Uma mensagem chega via WPPConnect ou Webhook Meta.
2. **Identificação**: O sistema localiza o `chatId` e recupera o estado atual do usuário no banco ou memória.
3. **Keyword Global**: Verifica se a mensagem coincide com uma palavra-chave global.
4. **Transição Exata**: Tenta encontrar uma transição definida para o estado atual que coincida exatamente com a entrada do usuário.
5. **Execução de Handler**: Se não houver transição imediata, executa o `handler` associado ao estado atual.

### 4.2. Tipos de Handlers (`HandlerService`)
Os handlers definem o comportamento do nó no fluxo:
- `_handlerMensagem`: Envia uma ou mais mensagens de texto (suporta interpolação de variáveis).
- `_handlerCapturar`: Solicita e armazena dados enviados pelo usuário (ex: nome, e-mail, CPF).
- `_handlerLista`: Envia uma lista interativa do WhatsApp (Menu).
- `_handlerBotoes`: Envia botões interativos do WhatsApp.
- `_handlerRequisicao`: Realiza uma chamada HTTP para uma API externa e processa a resposta.
- `_handlerDelay`: Aguarda um tempo determinado antes de seguir para o próximo estado.

---

## 5. Modelo de Dados (Prisma)
Principais entidades do sistema (`prisma/schema.prisma`):

- **`BotFluxo`**: Representa um fluxo completo criado no editor.
- **`BotEstadoConfig`**: Um "nó" no fluxo. Define qual handler será executado e sua configuração JSON.
- **`BotEstadoTransicao`**: Uma "aresta" no fluxo. Define para qual estado o usuário vai com base na entrada (suporta curinga `*`).
- **`BotEstadoUsuario`**: Mantém o estado atual (`estadoAtual`) e o contexto (`contexto` JSON) de cada usuário do bot (identificado pelo número/WhatsApp).
- **`BotEstadoHistorico`**: Log de todas as transições realizadas para fins de auditoria e analytics.
- **`YjsUpdate`**: Armazena os binários de atualização do Yjs para persistência da colaboração.

---

## 6. Integração Multicanal
O sistema possui uma estratégia de canais definida no `AppModule`:
- **Desenvolvimento**: Prioriza o `BotModule` (WPPConnect), que inicia uma instância do WhatsApp Web via Puppeteer.
- **Produção**: Ativa o `BotMetaModule` para receber eventos via Webhook oficial da Meta. O WPPConnect pode ser desativado ou usado como fallback.

---

## 7. Registro de APIs e Interpolação
O bot permite integrar com APIs externas dinamicamente:
- **Interpolação**: Strings nas configurações (URLs, corpos de requisição, mensagens) podem usar o formato `{{variavel}}` ou `{variavel}` para injetar dados do contexto do usuário ou respostas de APIs anteriores.
- **Api Registry**: Centraliza o cadastro de rotas e tokens de autenticação por sub-organização.

---

## 8. Segurança e Performance
- **Rate Limiting**: Proteção contra brute-force em `/api/auth` e abuso geral em `/api`.
- **CORS**: Configurado para permitir apenas o domínio do frontend definido em variáveis de ambiente.
- **Trust Proxy**: Configurado para rodar atrás de proxies reversos (como Nginx ou Cloudflare).
- **Memory Management**: O script de produção define `--max-old-space-size=450` para otimizar o uso em ambientes com recursos limitados.

---

## 9. Como Executar
1. Instalar dependências: `npm install`
2. Configurar o arquivo `.env` (DATABASE_URL, JWT_SECRET, etc).
3. Gerar o cliente Prisma: `npx prisma generate`
4. Executar migrations: `npx prisma migrate dev`
5. Iniciar em desenvolvimento: `npm run start:dev`

---
*Documentação gerada automaticamente para análise técnica do projeto.*
