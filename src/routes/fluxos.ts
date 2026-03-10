import express from 'express';
import fluxoRepo from '../database/fluxoRepository';
import {
  flowToStateMachine,
  stateMachineToFlow,
} from '../services/flowConverter';

/**
 * Adiciona prefixo F{flowId}_ aos nomes dos estados para garantir unicidade entre fluxos.
 * bot_estado_config.estado é PRIMARY KEY, então nomes precisam ser globalmente únicos.
 */
function aplicarPrefixo(flowId, estados, transicoes) {
  const prefix = `F${flowId}_`;
  const estadosPrefixados = estados.map((e) => ({
    ...e,
    estado: prefix + e.estado,
  }));
  const transicoesAtualizadas = transicoes.map((t) => ({
    ...t,
    estado_origem: prefix + t.estado_origem,
    estado_destino: prefix + t.estado_destino,
  }));
  return { estadosPrefixados, transicoesAtualizadas };
}

const router = express.Router();

// ── Listar fluxos ────────────────────────────────────────────────────────────

router.get('/fluxos', async (req, res) => {
  try {
    const fluxos = await fluxoRepo.listarFluxos();
    res.json(fluxos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Obter fluxo (retorna no formato frontend) ───────────────────────────────

router.get('/fluxos/:id', async (req, res) => {
  try {
    const fluxo = await fluxoRepo.obterFluxo(req.params.id);
    if (!fluxo) return res.status(404).json({ erro: 'Fluxo não encontrado' });

    // Se tem flow_json salvo, retorna diretamente (é o formato do frontend)
    if (fluxo.flow_json) {
      return res.json({
        id: fluxo.id,
        name: fluxo.nome,
        description: fluxo.descricao,
        version: fluxo.versao,
        ativo: fluxo.ativo,
        ...fluxo.flow_json,
      });
    }

    // Senão, converte dos estados/transições
    const estados = await fluxoRepo.obterEstadosDoFluxo(fluxo.id);
    const transicoes = await fluxoRepo.obterTransicoesDoFluxo(fluxo.id);
    const variaveis = await fluxoRepo.obterVariaveisDoFluxo(fluxo.id);

    const flowData = stateMachineToFlow(estados, transicoes, variaveis);

    res.json({
      id: fluxo.id,
      name: fluxo.nome,
      description: fluxo.descricao,
      version: fluxo.versao,
      ativo: fluxo.ativo,
      ...flowData,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Criar fluxo ──────────────────────────────────────────────────────────────

router.post('/fluxos', async (req, res) => {
  try {
    const { name, description, nodes, connections, variables } = req.body;

    if (!name) return res.status(400).json({ erro: 'Nome é obrigatório' });

    const flowJson = { nodes, connections, variables };

    // 1. Cria registro do fluxo
    const fluxo = await fluxoRepo.criarFluxo(name, description, flowJson);

    // 2. Converte e salva estados/transições (com prefixo para unicidade da PK)
    const { estados, transicoes, variaveis } = flowToStateMachine(flowJson);
    const { estadosPrefixados, transicoesAtualizadas } = aplicarPrefixo(
      fluxo.id,
      estados,
      transicoes,
    );
    await fluxoRepo.salvarEstadosDoFluxo(fluxo.id, estadosPrefixados);
    await fluxoRepo.salvarTransicoesDoFluxo(transicoesAtualizadas);

    // 3. Salva variáveis
    if (variables && variables.length > 0) {
      await fluxoRepo.salvarVariaveisDoFluxo(fluxo.id, variables);
    }

    res.json({ ok: true, id: fluxo.id, fluxo });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// ── Atualizar fluxo ──────────────────────────────────────────────────────────

router.put('/fluxos/:id', async (req, res) => {
  try {
    const { name, description, nodes, connections, variables, version } =
      req.body;
    const flowId = req.params.id;

    const fluxoExistente = await fluxoRepo.obterFluxo(flowId);
    if (!fluxoExistente)
      return res.status(404).json({ erro: 'Fluxo não encontrado' });

    const flowJson = { nodes, connections, variables };

    // 1. Atualiza registro do fluxo
    await fluxoRepo.atualizarFluxo(flowId, {
      nome: name,
      descricao: description,
      flowJson,
      versao: version || fluxoExistente.versao + 1,
    });

    // 2. Limpa estados/transições antigos e recria (com prefixo para unicidade da PK)
    await fluxoRepo.limparEstadosDoFluxo(flowId);

    const { estados, transicoes, variaveis } = flowToStateMachine(flowJson);
    const { estadosPrefixados, transicoesAtualizadas } = aplicarPrefixo(
      flowId,
      estados,
      transicoes,
    );
    await fluxoRepo.salvarEstadosDoFluxo(flowId, estadosPrefixados);
    await fluxoRepo.salvarTransicoesDoFluxo(transicoesAtualizadas);

    // 3. Atualiza variáveis
    if (variables) {
      await fluxoRepo.salvarVariaveisDoFluxo(flowId, variables);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// ── Excluir fluxo ────────────────────────────────────────────────────────────

router.delete('/fluxos/:id', async (req, res) => {
  try {
    await fluxoRepo.excluirFluxo(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// ── Ativar fluxo ─────────────────────────────────────────────────────────────

router.post('/fluxos/:id/ativar', async (req, res) => {
  try {
    const fluxo = await fluxoRepo.obterFluxo(req.params.id);
    if (!fluxo) return res.status(404).json({ erro: 'Fluxo não encontrado' });

    await fluxoRepo.ativarFluxo(req.params.id);
    res.json({ ok: true, mensagem: `Fluxo "${fluxo.nome}" ativado` });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

export default router;
