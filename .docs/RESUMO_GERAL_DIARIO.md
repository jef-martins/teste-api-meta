# Resumo Geral do Projeto Telebots

> Documento gerado em 19/03/2026. Cobre todos os commits do autor nos projetos
> `telebots-frontend` e `telebots-backend-nestjs`.

---

## 19/03/2026 — Refactoring: remoção de código morto, N+1 e padrões repetidos

### Backend (`telebots-backend-nestjs`)

**Código morto removido:**
- Removido `src/database/` (4 arquivos: `db.ts`, `fluxoRepository.ts`, `estadoRepository.ts`, `conversaRepository.ts`) — código legado pré-NestJS usando raw `pg` pool, não importado por nenhum módulo NestJS
- Removido `src/controllers/conversaController.ts` — controller Express legado
- Removido `src/services/flowConverter.ts` — cópia JavaScript desatualizada do `FlowConverterService`; o NestJS usa `src/flow/flow-converter.service.ts`
- Removido `src/services/httpService.ts` — wrapper axios legado, sem uso

**N+1 queries eliminados (`flow.service.ts`):**
- `salvarEstados()`, `salvarTransicoes()`, `salvarVariaveis()` convertidos de loops com `create()` individual para `createMany()`, reduzindo de N queries para 1 por operação

**Padrões repetidos extraídos (`handler.service.ts`):**
- Extraído helper `avancarEExecutar()` — eliminado bloco "avançar estado + buscar config + executar handler" que se repetia 7 vezes
- Extraído helper `limparHtml()` — eliminada duplicação de lógica de strip de HTML em `_handlerRequisicao`
- Extraído `obterNomeModificador()` em `FlowService` — eliminou duplicação de lookup de nome do usuário em `criar()` e `atualizar()`

### Frontend (`telebots-frontend`)

- Removidos 3 `console.log` de debug em `flowStore.js → addConnection()` deixados durante desenvolvimento

---

## Visão Geral

O **Telebots** é uma plataforma de criação e execução de chatbots para WhatsApp (via WPPConnect). Ele é dividido em dois projetos:

| Projeto | Tech | Caminho |
|---------|------|---------|
| Backend | NestJS + Prisma + PostgreSQL | `/home/luismodesto/projetos/telebots-backend-nestjs` |
| Frontend | Vue 3 + Pinia + Vite | `/home/luismodesto/projetos/telebots-frontend` |

A plataforma permite criar fluxos visuais de conversa (editor drag-and-drop), compilá-los em máquinas de estado e executá-los via bot WhatsApp em tempo real.

---

## Fundação do Projeto

### Setup Inicial (Frontend)
- Sistema de design com variáveis CSS (cores, espaçamento, tipografia, bordas, sombras, temas)
- Stores Pinia: `flowStore`, `canvasStore`, `uiStore`, `simulatorStore`
- Composables: `useFlowBuilder`, `useCanvas`, `useHistory`, `useSimulator`, `useYjs`, `useAwareness`
- Utilitários e constantes: tipos de nós (`nodeTypes.js`), constantes de conexão
- Internacionalização (vue-i18n) com suporte a pt-BR e es

### Setup Inicial (Backend)
- NestJS com Prisma + PostgreSQL
- Módulos: auth (JWT), user, flow, bot (WPPConnect + state machine), collaboration (Yjs WebSocket)
- Schema inicial: `BotUsuario`, `BotFluxo`, `BotEstadoConfig`

---

## Autenticação e Usuários

### Backend
- **JWT** com payload: `{ sub, email, nome, master }`
- Registro e login via `auth.service.ts`
- **Flag `master`** em `BotUsuario` (Boolean, default false) para superadministradores
- **MasterGuard**: guard NestJS que protege rotas exclusivas de usuários master
- `UserController` protegido com `MasterGuard` (listar, criar, editar, excluir usuários)
- Login retorna `subOrgsAcessiveis` para o frontend saber quais sub-orgs o usuário pode acessar

### Frontend
- `Login.vue`: formulário de login + seletor de sub-org pós-login
  - 0 sub-orgs → aviso e redirect para `/`
  - 1 sub-org → seleciona automaticamente
  - 2+ sub-orgs → exibe seletor visual antes de redirecionar
- Rota `/users` com meta `masterOnly: true` — usuários não-master são redirecionados
- `Users.vue`: CRUD de usuários (somente master)

---

## Editor Visual de Fluxos

### Tipos de Nós
| Tipo | Descrição |
|------|-----------|
| `start` | Início do fluxo |
| `end` | Encerramento (com mensagem opcional) |
| `message` | Envia mensagem(ns) ao usuário |
| `decision` | Ramificação por condição ou opção |
| `action` | Executa ações (API, set-variable, integration) |
| `customComponent` | Componente personalizado colapsado |

### Sub-componentes
- **`waitForResponse`**: em nós Message, aguarda resposta do usuário e captura em variável
- **`setVariable`**: em nós Message e Action, atribui valor a variável
- **`integration`**: em nós Action, faz chamada HTTP a APIs registradas

### Canvas
- Drag-and-drop de nós da sidebar
- Conexões bezier/ortogonais entre portas
- Pan/zoom com mouse e trackpad
- Auto-layout hierárquico (algoritmo de largura em leque)
- Seleção múltipla com shift+click e box select
- Histórico de undo/redo
- Modo navegação (pan) vs. modo seleção

### Colaboração em Tempo Real
- Backend: Yjs WebSocket via `CollaborationGateway`
- Frontend: `useYjs.js` e `useAwareness.js`
- Sincronização de nós, conexões e variáveis em tempo real entre usuários
- Compilação automática via Yjs quando o fluxo é salvo

### Auto-save
- Debounce de 2s ao detectar mudanças em nós, conexões, variáveis, nome ou descrição
- Indicador visual "Salvando..." no header do editor
- Salva no localStorage e no backend simultaneamente

---

## Componentes Personalizados

- Seleção de múltiplos nós → botão direito → "Criar componente personalizado"
- O componente é salvo no backend e aparece na biblioteca (sidebar esquerda)
- Arrastar da biblioteca → cria nó `customComponent` no canvas (colapsado)
- Duplo clique → split-screen: editor do fluxo interno na metade inferior
- Backend: `flattenCustomComponents()` no converter "achata" esses nós antes de compilar

---

## Máquina de Estados e Bot

### Compilação (Backend)
- `FlowConverterService.flowToStateMachine()`: converte o JSON do fluxo em config de estados
- Expande `customComponent` antes de processar
- Cada nó vira um handler com tipo (`_handlerMensagem`, `_handlerCapturar`, `_handlerRequisicao`, etc.)

### Execução (Backend)
- `StateMachineEngine`: executa handlers em sequência por estado
- `HandlerService`: despacha cada tipo de handler
- Interpolação de variáveis com suporte a `{{variavel}}`, `{{obj.campo}}`, `{{lista[0].campo}}`
- `salvarDado`/`obterDados` suportam objetos (não só strings)

### Integração com WPPConnect
- Bot WhatsApp recebe mensagens e as encaminha para a state machine
- Mensagens enviadas pelo bot são interpoladas com dados do contexto da sessão

---

## Variáveis Globais e API Registry

### Variáveis Globais
- Definidas no editor do fluxo (painel lateral)
- Disponíveis em todos os nós via interpolação `{{variavel}}`
- Suporte a atribuição em massa (import/export de variáveis)
- Exibidas no simulador com valores atuais

### API Registry
- Registro de APIs externas com nome, base URL e headers
- Registro de rotas por API (método, path, descrição)
- **Backend**: `src/api-registry/` com CRUD completo (modelos `ApiRegistrada`, `ApiRota`)
- **Frontend**: `apiRegistryStore.js` — armazena no backend com fallback localStorage
- Usadas como destino nos sub-componentes `integration`

---

## Organizações e Sub-organizações

### Schema (Backend)
| Modelo | Descrição |
|--------|-----------|
| `Organizacao` | Agrupa sub-organizações |
| `SubOrganizacao` | Contexto isolado de fluxos e bots |
| `OrgMembro` | Membro de uma Organização (acessa todas as sub-orgs) |
| `SubOrgMembro` | Membro direto de uma Sub-org (acessa apenas ela) |

`BotFluxo` tem campo `subOrganizacaoId` (nullable, retrocompatível).

### Funcionamento
- Cada fluxo pertence a uma sub-organização
- Ao listar fluxos, o backend filtra por `subOrganizacaoId`
- Header `X-SubOrg-Id` injetado em todas as requests autenticadas
- **Usuário master** bypass todas as verificações de acesso (vê todos os fluxos de qualquer sub-org)

### Frontend
- `orgStore.js`: store Pinia com sub-org ativa, persistida em `sessionStorage`
- `Organizations.vue`: gerenciamento completo de orgs, sub-orgs, membros e transferências
- Badge de sub-org ativa no PageHeader (clicável)

---

## Rastreamento do Último Modificador

- `BotFluxo` tem campos `ultimoModificadoPorId` e `ultimoModificadorNome`
- Atualizados em `criar()` e `atualizar()` no `FlowService`
- `FlowList.vue` exibe nome e ícone do último modificador em cada card de fluxo

---

## Monitoramento do Servidor (Master)

### Backend
- `MonitoringService.infoServidor()`: coleta CPU (total e por núcleo), RAM, heap Node.js, uptime, stats PostgreSQL (conexões ativas/totais, cache hit ratio)
- Snapshots armazenados em buffer circular (máx 30) — `SnapshotServidor[]`
- Endpoints (protegidos por MasterGuard):
  - `GET /admin/servidor` — snapshot atual
  - `GET /admin/servidor/historico` — array de snapshots

### Frontend
- `ServerMonitoring.vue`: dashboard completo com:
  - Badge de saúde geral (Saudável / Alerta / Crítico)
  - Sparklines SVG para histórico de RAM e CPU
  - Barras por núcleo de CPU com cores dinâmicas por intensidade
  - Heap Node.js, conexões DB, cache hit ratio
  - Banner de alerta para recursos críticos
  - Auto-refresh configurável (10s / 30s / 1min / manual)
  - Exportar snapshot como JSON
  - Exportar relatório como PDF (via `window.print()`)

---

## Interface e Navegação

### PageHeader (Componente Compartilhado)
- Componente `PageHeader.vue` usado em todas as páginas exceto `/flow`
- Estrutura: lado esquerdo (botão voltar + ícone + título) + lado direito (navegação + usuário)
- Botões de navegação: Organizações, Dashboard, Docs, Dev (master), Usuários (master)
- Botão de logout com limpeza de stores
- Modal de configurações do usuário (tema, idioma)

### PageToolbar (Ações de Página)
- Componente `PageToolbar.vue` abaixo do PageHeader
- Contém ações específicas da página (ex.: botão "Novo Fluxo", "Atualizar", filtros)
- Separação clara entre navegação global (header) e controles de página (toolbar)
- Usado em: Dashboard, Users, Organizations, ServerMonitoring, DevDocs

### Painel Master (`/master`)
- Página inicial exclusiva para usuários master
- Cards de acesso rápido: Lista de Fluxos, Usuários, Organizações, Monitoramento, Docs, Documentação Dev

### Rotas
| Rota | Acesso | Descrição |
|------|--------|-----------|
| `/login` | público | Login e registro |
| `/` | autenticado | Lista de fluxos |
| `/flow/new` | autenticado | Novo fluxo |
| `/flow/:id` | autenticado | Editor de fluxo |
| `/dashboard` | autenticado | Dashboard de analytics |
| `/organizations` | autenticado | Gerenciar orgs e sub-orgs |
| `/docs` | público | Documentação para usuários finais |
| `/master` | master | Painel master |
| `/users` | master | Gerenciar usuários |
| `/monitoring` | master | Monitoramento do servidor |
| `/dev-docs` | master | Documentação técnica para desenvolvedores |

---

## Documentação

### `/docs` (Usuários Finais)
- Acessível publicamente (sem login)
- Explica como usar a plataforma: criar fluxos, variáveis, simulador, etc.

### `/dev-docs` (Desenvolvedores — Master Only)
- Referência técnica completa: arquitetura, endpoints REST, FlowJSON, máquina de estados, schema do banco, variáveis de ambiente, colaboração Yjs
- Sidebar de navegação entre seções
- Exemplos de código em blocos formatados

---

## Simulador

- Simula execução do fluxo diretamente no frontend (sem backend/WhatsApp)
- Suporta todos os tipos de nós, incluindo `customComponent`
- Exibe variáveis com valores atuais durante a simulação
- Interpola variáveis em mensagens exibidas
- Suporte a mensagens interativas (listas Zenvia)

---

## Importer Zenvia

- Importa fluxos no formato Zenvia (JSON) para o formato interno do Telebots
- Converte nós de mensagem, decisão e lista interativa
- Valida o JSON antes de importar

---

## O que Ainda Pode Ser Implementado

- **Seletor de sub-org pós-login**: troca de sub-org sem fazer logout novamente
- **Sub-org no contexto WebSocket**: `CollaborationGateway` não valida acesso à sub-org do fluxo
- **`BotEstadoUsuario` com sub-org**: múltiplas sub-orgs com bots ativos podem ter estados conflitantes
- **Indicador de sub-org no FlowEditor**: o editor não mostra a qual sub-org o fluxo pertence
- **Org/sub-org automática no registro**: novos usuários poderiam ganhar uma org pessoal automaticamente
