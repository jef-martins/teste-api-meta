# Análise do arquivo `jasper.js`

Este documento contém o aprendizado abstraído a partir do arquivo `jasper.js`. Ele serve como base de conhecimento para futuras manutenções, melhorias e tarefas a serem solicitadas neste projeto.

## 1. Visão Geral do Arquivo
O `jasper.js` é um servidor Node.js utilizando a biblioteca **Express**. Ele atua como um webhook para uma integração com a **WhatsApp Business API** (Cloud API da Meta). 
O bot tem o objetivo de atuar como "Assistente Virtual Braslar", fornecendo serviços de consulta a clientes.

## 2. Bibliotecas e Dependências
- `express`: Criação e roteamento do servidor web.
- `axios`: Realização de requisições HTTP tanto para retornar as mensagens ao WhatsApp (Meta Cloud API) quanto para consultar as APIs externas da Telecontrol.

## 3. Variáveis de Ambiente Necessárias
- `PORT` (Opcional, default: 3000): Porta onde o servidor Node vai rodar.
- `VERIFY_TOKEN`: Token de verificação utilizado para validar o Webhook na Meta/Facebook.
- `TOKEN_BRASLAR` (Opcional, fallback em código definido): Chave de aplicação (`Access-Application-Key`) para acessar as APIs da Telecontrol.

## 4. Rotas do Servidor
### `GET /` - Validação do Webhook
- Recebe tokens da Meta e valida se as strings combinam (`req.query['hub.verify_token'] === ACCESS_TOKEN`).
- Se combinar, retorna o `hub.challenge` com status code `200`.

### `POST /` - Recebimento de Mensagens
- Ponto de entrada de todos os eventos recebidos do WhatsApp.
- Baseia-se em `body.object === 'whatsapp_business_account'`.

## 5. Gestão de Estado da Conversa
O bot utiliza um objeto simples em memória chamado `userSessions = {}` para armazenar o estado de navegação e saber o que o usuário deve enviar a seguir. A chave do objeto é o telefone do usuário (`from`).

## 6. Fluxo de Atendimento (Árvore de Decisão)

1. **Início e Aceite de LGPD**
   - Quando o usuário envia qualquer mensagem fora de fluxo, o sistema envia opções Interativas de Resposta de Botão (`interactive/button`).
   - Pergunta inicial: Aceite do tratamento de dados (LGPD).
   - Botões: `Sim` (`lgpd_sim`) e `Não` (`lgpd_nao`).
   - Se disser "Não": Recebe mensagem negando atendimento.

2. **Menu Principal (List Reply)**
   - Se o usuário aceita a LGPD (`lgpd_sim`), ele recebe um Menu em formato Lista com 4 opções:
     - `menu_posto`: Resulta em aguardar o CEP do usuário (`stage: 'AWAITING_CEP'`).
     - `menu_protocolo`: Resulta em aguardar protocolo (`stage: 'AWAITING_PROTOCOLO'`).
     - `menu_os`: Resulta em aguardar OS (`stage: 'AWAITING_OS'`).
     - `menu_encerrar`: Finaliza atendimento e limpa a sessão.

3. **Interações de Texto (Etapas com API Externa)**
   Dependendo de qual `stage` está na sessão, o texto do usuário é usado como parâmetro:
   
   - **`AWAITING_CEP`**:
     - Chama a API da Telecontrol: `http://api2.telecontrol.com.br/institucional-dev/postoMaisProximo/cep/{CEP}/limit/3`
     - Traz os postos mais próximos, nome, número, telefone e a distância do cliente.
     
   - **`AWAITING_PROTOCOLO`**:
     - Chama a API da Telecontrol: `http://backend2.telecontrol.com.br/homologation-api-callcenter/callcenter/{PROTOCOLO}?ultima_obs_sac=true`
     - Traz os dados do consumidor, situação do protocolo, origem e datas.
     
   - **`AWAITING_OS`**:
     - Chama a API da Telecontrol: `http://backend2.telecontrol.com.br/os/ordem/os/{OS}`
     - Retorna as informações como nome do cliente, produto, status, defeito, e as datas (abertura / fechamento).

4. **Finalização**
   - Independentemente de acertar ou falhar nas buscas, o bot sugere um recomeço e deleta a sessão atual (`delete userSessions[from]`), permitindo que a próxima mensagem recomece o fluxo.
   
## 7. Envio para a Meta API
Sempre que uma resposta deve ser enviada (`payload`), o bot faz uma chamada POST para:
`https://graph.facebook.com/v18.0/{phone_id}/messages` enviando no Header o Bearer Token (`ACCESS_TOKEN`).

## 8. Pontos de Atenção (Insights para o Desenvolvedor)
- O estado (`userSessions`) está salvo na memória local da aplicação. Se o servidor for reinicializado (ou tiver múltiplas instâncias), clientes no meio de um fluxo perderão o estado.
- As chamadas das APIs externas `api_env` e `Access-Env` estão fixadas para *HOMOLOGATION*. Pode ser necessário colocar essa propriedade também em variáveis de ambiente se no futuro essa aplicação for enviada a produção.
- Estão sendo utilizadas as versions "v18.0" para a chamada da Graph API do facebook/Meta, é interessante se atentar se atualizações serão necessárias.
