const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const port = process.env.PORT || 3000;
const ACCESS_TOKEN = process.env.VERIFY_TOKEN; 

app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === ACCESS_TOKEN) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Objeto para gerenciar o estado simples da conversa
const userSessions = {};

app.post('/', async (req, res) => {
  const body = req.body;

  // Log para debug
  console.log(JSON.stringify(body, null, 2));

  if (body.object === 'whatsapp_business_account') {
    if (body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]) {

      const value = body.entry[0].changes[0].value;
      const message = value.messages[0];
      const from = message.from;
      const phone_id = value.metadata.phone_number_id;

      try {
        let payload;

        // 1. TRATAMENTO DE RESPOSTA DE BOTÃO (LGPD)
        if (message.type === 'interactive' && message.interactive.button_reply) {
          const buttonId = message.interactive.button_reply.id;

          if (buttonId === 'lgpd_sim') {
            payload = {
              messaging_product: "whatsapp",
              to: from,
              type: "interactive",
              interactive: {
                type: "list",
                header: { type: "text", text: "Menu Principal" },
                body: { text: "Como posso ajudar você hoje? Selecione uma das opções abaixo:" },
                footer: { text: "Assistente Virtual Braslar" },
                action: {
                  button: "Ver Opções",
                  sections: [
                    {
                      title: "Serviços",
                      rows: [
                        { id: "menu_posto", title: "Posto Mais Próximo", description: "Encontre assistência perto de você" },
                        { id: "menu_protocolo", title: "Consultar Protocolo", description: "Status do seu atendimento" },
                        { id: "menu_os", title: "Consultar OS", description: "Status da sua Ordem de Serviço" },
                        { id: "menu_encerrar", title: "Encerrar", description: "Finalizar atendimento" }
                      ]
                    }
                  ]
                }
              }
            };
          } else if (buttonId === 'lgpd_nao') {
            payload = {
              messaging_product: "whatsapp",
              to: from,
              type: "text",
              text: { body: "❌ Entendemos. Para sua segurança e conformidade com a LGPD, não podemos prosseguir sem o seu aceite." }
            };
          }
        } 
        // 2. TRATAMENTO DE RESPOSTA DE LISTA (MENU)
        else if (message.type === 'interactive' && message.interactive.list_reply) {
          const listId = message.interactive.list_reply.id;
          
          if (listId === 'menu_posto') {
            userSessions[from] = { stage: 'AWAITING_CEP' };
            payload = { messaging_product: "whatsapp", to: from, type: "text", text: { body: "Por favor, digite o seu **CEP** (somente números):" } };
          } 
          else if (listId === 'menu_protocolo') {
            userSessions[from] = { stage: 'AWAITING_PROTOCOLO' };
            payload = { messaging_product: "whatsapp", to: from, type: "text", text: { body: "Por favor, digite o número do seu **Protocolo**:" } };
          } 
          else if (listId === 'menu_os') {
            userSessions[from] = { stage: 'AWAITING_OS' };
            payload = { messaging_product: "whatsapp", to: from, type: "text", text: { body: "Por favor, digite o número da sua **Ordem de Serviço (OS)**:" } };
          } 
          else if (listId === 'menu_encerrar') {
            delete userSessions[from];
            payload = { messaging_product: "whatsapp", to: from, type: "text", text: { body: "Atendimento finalizado. Obrigado por entrar em contato! 👋" } };
          }
        }
        // 3. TRATAMENTO DE TEXTO (CAPTURANDO ENTRADAS DO USUÁRIO)
        else if (message.type === 'text' && userSessions[from]) {
          const userText = message.text.body.trim();
          const session = userSessions[from];
          let resultText = "";

          const headersBase = {
            'Access-Application-Key': process.env.TOKEN_BRASLAR || '64b37f479af4007c883406f0b535c432e22c888e',
            'Content-Type': 'application/json'
          };

          try {
            if (session.stage === 'AWAITING_CEP') {
              const response = await axios.get(`http://api2.telecontrol.com.br/institucional-dev/postoMaisProximo/cep/${userText}/limit/3`, {
                headers: { ...headersBase, 'api_env': 'HOMOLOGATION' }
              });
              
              if (response.data && response.data.length > 0) {
                resultText = `📍 *Postos encontrados para o CEP ${userText}:*\n\n`;
                response.data.forEach((posto, index) => {
                  resultText += `*${index + 1}. ${posto.nome}*\n`;
                  resultText += `🏠 Endereço: ${posto.contato_endereco}, ${posto.contato_numero}\n`;
                  resultText += `📞 Tel: ${posto.fone}\n`;
                  resultText += `📏 Distância: ${parseFloat(posto.distance).toFixed(2)} km\n\n`;
                });
              } else {
                resultText = "❌ Nenhum posto encontrado para este CEP.";
              }
            } 
            else if (session.stage === 'AWAITING_PROTOCOLO') {
              const response = await axios.get(`http://backend2.telecontrol.com.br/homologation-api-callcenter/callcenter/${userText}?ultima_obs_sac=true`, {
                headers: { ...headersBase, 'Access-Env': 'HOMOLOGATION' }
              });

              if (response.data && response.data.data && response.data.data.length > 0) {
                const prot = response.data.data[0].atributes;
                resultText = `📄 *Detalhes do Protocolo ${userText}:*\n\n`;
                resultText += `👤 Consumidor: ${prot.consumidor_nome || 'Não informado'}\n`;
                resultText += `📦 Situação: *${prot.situacao}*\n`;
                resultText += `📅 Abertura: ${prot.data_abertura}\n`;
                resultText += `🛠 Origem: ${prot.origem}`;
              } else {
                resultText = `❌ Protocolo ${userText} não encontrado.`;
              }
            } 
            else if (session.stage === 'AWAITING_OS') {
              const response = await axios.get(`http://backend2.telecontrol.com.br/os/ordem/os/${userText}`, {
                headers: { ...headersBase, 'Access-Env': 'HOMOLOGATION' }
              });

              if (response.data && response.data.os && response.data.os.length > 0) {
                const osData = response.data.os[0];
                resultText = `🛠 *Detalhes da OS ${userText}:*\n\n`;
                resultText += `👤 Cliente: ${osData.consumidor_nome}\n`;
                resultText += `📦 Produto: ${osData.descricao}\n`;
                resultText += `📊 Status: *${osData.status_os}*\n`;
                resultText += `⚠️ Defeito: ${osData.defeito_reclamado}\n`;
                resultText += `📅 Abertura: ${osData.data_abertura}\n`;
                if (osData.data_fechamento) resultText += `🏁 Fechamento: ${osData.data_fechamento}`;
              } else {
                resultText = `❌ Ordem de Serviço ${userText} não encontrada.`;
              }
            }

            // Finaliza a sessão e volta ao menu ou encerra
            resultText += "\n\nO que mais você gostaria de fazer? (Mande qualquer mensagem para ver o menu)";
            delete userSessions[from];

          } catch (apiError) {
            console.error("Erro na requisição externa:", apiError.response ? apiError.response.data : apiError.message);
            resultText = "⚠️ Erro ao consultar os dados. Verifique se o código informado está correto e tente novamente.";
          }

          payload = {
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: resultText }
          };
        }
        // 4. MENSAGEM INICIAL OU FORA DE FLUXO
        else {
          payload = {
            messaging_product: "whatsapp",
            to: from,
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: "Olá! Para iniciarmos seu atendimento, você aceita o tratamento dos seus dados conforme a LGPD?" },
              action: {
                buttons: [
                  { type: "reply", reply: { id: "lgpd_sim", title: "Sim" } },
                  { type: "reply", reply: { id: "lgpd_nao", title: "Não" } }
                ]
              }
            }
          };
        }

        if (payload) {
          await axios({
            method: "POST",
            url: `https://graph.facebook.com/v18.0/${phone_id}/messages`,
            data: payload,
            headers: {
              "Authorization": `Bearer ${ACCESS_TOKEN}`,
              "Content-Type": "application/json"
            }
          });
          console.log(`Resposta enviada para ${from}`);
        }
      } catch (error) {
        console.error("Erro na API da Meta:", error.response ? error.response.data : error.message);
      }
    }
    res.status(200).end();
  } else {
    res.status(404).end();
  }
});

app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});