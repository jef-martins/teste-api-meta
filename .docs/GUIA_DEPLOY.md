# Guia de Execução e Deploy

Este documento contém todas as instruções para rodar o bot localmente (com WPPConnect) e fazer o deploy no **Render** (com a Meta API) utilizando a configuração de Multi-Canais.

---

## 💻 1. Rodando o Projeto Localmente (Modo Desenvolvimento)

No ambiente de desenvolvimento, o **WPPConnect** (via QR Code) é ativado automaticamente e o módulo do Webhook da Meta API fica **desativado**.

### Pré-requisitos
- Node.js (v18+)
- PostgreSQL rodando localmente

### Passo a Passo

1. **Instale as dependências:**
   ```bash
   npm install
   ```
2. **Configure o `.env` local:**
   Crie ou edite o arquivo `.env` na raiz do projeto com o seguinte conteúdo:
   ```env
   # Controla o uso do WPPConnect (desenvolvimento)
   NODE_ENV=development 

   # Modo teste do bot
   BOT_MODO_TESTE=true
   BOT_NUMERO_ADMIN=55XX999999999 # O número que fará testes

   # Opcional: Para testar a máquina padrão, senão usa os fluxos via Banco de Dados
   # BOT_STATE_MACHINE_PADRAO=true 

   # Variáveis do DB (Ajustar com seus acessos ao Postgres local)
   DATABASE_URL="postgresql://postgres:suasenha@localhost:5433/postgres?schema=public"
   ```

3. **Inicie o Banco (Prisma):**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Inicie o projeto:**
   ```bash
   npm run start:dev
   ```
5. **Autentique no WhatsApp:**
   - Aguarde o terminal exibir a mensagem "`Escaneie o QR Code para conectar`".
   - Abra o WhatsApp no celular e escaneie o QRCode que aparece no terminal.

---

## ☁️ 2. Deploy no Render (Modo Produção via Git)

Quando hospedado no Render, ativamos o Modo Produção. O **WPPConnect é desativado** (não precisamos escanear QR Code) e o **Webhook da Meta API passa a escutar os eventos** do WhatsApp Cloud Oficial.

### Passos para criar a Web Service no Render:

1. Acesse https://dashboard.render.com/ e clique em **New > Web Service**.
2. Conecte o repositório do Git onde este código está hospedado.
3. Configure os seguintes campos principais:
   - **Name:** Nome do seu bot (ex: `venon-bot-api`)
   - **Environment:** `Node`
   - **Build Command:**
     ```bash
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command:**
     ```bash
     npm run start:prod
     ```
   - **Plan:** Free, Starter ou superior.

### ⚠️ Ajustes OBRIGATÓRIOS para o NestJS/WPPConnect no Render

Como nós temos o pacote do `wppconnect` (que usa Chromium via Puppeteer por debaixo dos panos) o Build na Render vai demorar demais e potencialmente estourar os limites de RAM gratuitos tentando baixar o Google Chrome de SO Linux.
**Porém**, nós não usaremos o pacote nesta infraestrutura (afinal, usaremos a Meta API na Render). Para contornar e otimizar, defina as Variáveis de Ambiente corretamente:

### Variáveis de Ambiente no Render (Environment Variables):

| Variável | Valor Recomendado | Descrição |
|---|---|---|
| `NODE_ENV` | `production` | **Crítico!** Desativa o WppConnect e liga as rotas da Meta API. |
| `PUPPETEER_SKIP_DOWNLOAD` | `true` | **Importante!** Evita que o Puppeteer do pacote wppconnect gaste memória/tempo baixando o Chromium na nuvem de deploy. |
| `DATABASE_URL` | `Sua string de banco Postgres Remoto (ex: Supabase, Neon ou Render Postgres)` | Banco de dados da produção. |
| `BOT_STATE_MACHINE_PADRAO` | `true` | Ativa a máquina de estados padrão (fluxo Braslar da memória, sem banco). Defina como `false` quando tiver alimentado o DB de produção. |
| `VERIFY_TOKEN` | `SEU_TOKEN_CRIADO_PELA_META` | Token de validação do Webhook na tela de configuração da Meta Dev. |
| `META_ACCESS_TOKEN` | `EAXXXX_TOKEN_LONGO...` | Bearer/Access token gerado na mesma tela de configuração para disparar as mensagens. |
| `TOKEN_BRASLAR` | `sua-chave-...` | Token das chamadas HTTP externas de sua infraestrutura. |

### Configuração do Webhook no "Meta For Developers":

1. Depois que o deploy no Render ficar verde (🟢 Live), copie a URL fornecida (ex: `https://venon-bot.onrender.com`).
2. Acesse o Painel da Meta, vá em **WhatsApp > API Setup > Configuration**.
3. Em *Webhook*, clique em Editar:
   - **Callback URL:** `https://venon-bot.onrender.com/api/webhook-meta` *(não esqueça do /api e a rota correta que fizemos)*.
   - **Verify Token:** Informe a mesma palavra/chave secreta que definiu no `VERIFY_TOKEN`.
4. Ao clicar em "Verify and Save", a Meta vai mandar uma request pra aplicação. Se retornar tudo sucesso, o webhook já passa a escutar eventos.
5. Acesse **Webhook Fields** (Manage) e se certifique que habilitou o campo `messages` para ser encaminhado à sua URL.

Pronto! Qualquer commit futuro no ramo `main`/`master` acionará um deploy dinâmico no Render e suas alterações irão pro ar sozinhas mantendo o estado do webhook.
