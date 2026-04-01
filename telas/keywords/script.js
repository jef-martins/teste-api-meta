const API = '/api/admin/atalhos-navegacao';
const ESTADOS_API = '/api/admin/estados';
const FLUXOS_PAINEL_API = '/api/admin/fluxos/painel';
const FLUXOS_MODO_KEY = 'bot_admin_fluxos_modo';

let MODO_PADRAO = false;
let modoFluxos =
  localStorage.getItem(FLUXOS_MODO_KEY) === 'cadastrados'
    ? 'cadastrados'
    : 'ativos';
let estadosAtivos = [];
let fluxosPainel = {
  bancoConectado: false,
  fluxosBanco: [],
  fluxosMemoria: [],
};

const ORIGEM_LABEL = {
  cache: 'Cache Runtime',
  padrao: 'Padrão',
  sessao_zenvia: 'Sessão Zenvia',
  banco: 'Banco',
};

function toast(msg, err = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (err ? ' error' : '');
  setTimeout(() => {
    el.className = '';
  }, 3000);
}

async function api(method, path = '', body) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatarData(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR');
}

function normalizarLista(value) {
  return Array.isArray(value) ? value : [];
}

function normalizarFlowId(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

function renderizarBotoesModoFluxo() {
  const btnAtivos = document.getElementById('btn-modo-ativos');
  const btnCadastrados = document.getElementById('btn-modo-cadastrados');
  if (!btnAtivos || !btnCadastrados) return;

  const ativosSelecionado = modoFluxos === 'ativos';
  btnAtivos.className = `btn ${ativosSelecionado ? 'btn-primary' : 'btn-ghost'} btn-sm`;
  btnCadastrados.className = `btn ${ativosSelecionado ? 'btn-ghost' : 'btn-primary'} btn-sm`;
  btnAtivos.style.border = 'none';
  btnCadastrados.style.border = 'none';
}

function obterFluxosDaAbaSelecionada() {
  return modoFluxos === 'ativos'
    ? normalizarLista(fluxosPainel.fluxosMemoria)
    : normalizarLista(fluxosPainel.fluxosBanco);
}

function fluxoAtivoValidoParaCadastro(fluxo) {
  if (!fluxo || fluxo.ativo === false) return false;
  const id = String(fluxo.id || '');
  if (!MODO_PADRAO && id === '') {
    return false;
  }
  return true;
}

function obterFluxosParaCadastro() {
  if (modoFluxos === 'cadastrados' && !fluxosPainel.bancoConectado) {
    return [];
  }

  const base = obterFluxosDaAbaSelecionada();
  const filtrados =
    modoFluxos === 'ativos'
      ? base.filter(fluxoAtivoValidoParaCadastro)
      : base.filter((fluxo) => fluxo && fluxo.ativo === true);

  const mapa = new Map();
  for (const fluxo of filtrados) {
    const id = String(fluxo.id || '');
    const nome = String(fluxo.nome || '');
    const chave = `${id}::${nome.toLowerCase()}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, fluxo);
    }
  }

  return Array.from(mapa.values()).sort((a, b) =>
    String(a.nome || '').localeCompare(String(b.nome || '')),
  );
}

function obterIdsFluxosDoModoSelecionado() {
  if (modoFluxos === 'cadastrados') {
    if (!fluxosPainel.bancoConectado) return null;
    return new Set(
      normalizarLista(fluxosPainel.fluxosBanco).map((fluxo) =>
        normalizarFlowId(fluxo?.id),
      ),
    );
  }

  return new Set(
    normalizarLista(fluxosPainel.fluxosMemoria).map((fluxo) =>
      normalizarFlowId(fluxo?.id),
    ),
  );
}

function preencherSelectFluxos(flowIdPreferido = '', flowNomePreferido = '') {
  const select = document.getElementById('f-flow-id');
  if (!select) return;

  const fluxos = obterFluxosParaCadastro();

  if (!fluxos.length) {
    select.innerHTML =
      '<option value="">Nenhum fluxo ativo disponível para cadastro</option>';
    return;
  }

  select.innerHTML = fluxos
    .map((fluxo) => {
      const id = String(fluxo.id || '');
      const nome = String(fluxo.nome || (id ? id : 'Memória (Padrão)'));
      const descricao = fluxo.descricao ? ` — ${String(fluxo.descricao)}` : '';
      return `<option value="${escapeHtml(id)}" data-nome="${escapeHtml(nome)}">${escapeHtml(nome + descricao)}</option>`;
    })
    .join('');

  const preferidoPorId = String(flowIdPreferido || '');
  if (preferidoPorId && Array.from(select.options).some((o) => o.value === preferidoPorId)) {
    select.value = preferidoPorId;
    return;
  }

  if (preferidoPorId || flowNomePreferido) {
    const nomeFallback = String(flowNomePreferido || preferidoPorId || 'Fluxo indisponível');
    const option = document.createElement('option');
    option.value = preferidoPorId;
    option.dataset.nome = nomeFallback;
    option.textContent = `${nomeFallback} (indisponível para novo cadastro)`;
    select.appendChild(option);
    select.value = preferidoPorId;
    return;
  }

  select.value = select.options[0].value;
}

async function verificarModo() {
  try {
    const r = await fetch('/api/admin/modo');
    if (!r.ok) return;
    const dados = await r.json();
    MODO_PADRAO = dados.modoPadrao === true;
    const banner = document.getElementById('banner-modo');
    if (!banner) return;
    if (MODO_PADRAO) {
      banner.style.display = 'flex';
      banner.innerHTML = `
        <span>⚠️ <strong>Modo Padrão (Memória)</strong> — BOT_STATE_MACHINE_PADRAO=true. Banco de dados não conectado.
        Os atalhos de navegação criados aqui ficarão <strong>ativos enquanto o servidor estiver rodando</strong>, mas serão perdidos ao reiniciar.</span>`;
    } else {
      banner.style.display = 'none';
    }
  } catch (e) {
    console.warn('Não foi possível verificar o modo de operação:', e);
  }
}

async function carregarFluxosPainel() {
  try {
    const r = await fetch(FLUXOS_PAINEL_API);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const dados = await r.json();
    fluxosPainel = {
      bancoConectado: dados?.bancoConectado === true,
      fluxosBanco: normalizarLista(dados?.fluxosBanco),
      fluxosMemoria: normalizarLista(dados?.fluxosMemoria),
    };
  } catch (e) {
    console.warn('Falha ao carregar fluxos do painel:', e);
    fluxosPainel = { bancoConectado: false, fluxosBanco: [], fluxosMemoria: [] };
  }
}

function renderizarFluxosDisponiveis() {
  const titulo = document.getElementById('fluxos-disponiveis-titulo');
  const tb = document.getElementById('body-fluxos-disponiveis');
  if (!titulo || !tb) return;

  titulo.textContent =
    modoFluxos === 'ativos'
      ? 'Fluxos Ativos em Memória'
      : 'Fluxos Cadastrados no Banco';

  if (modoFluxos === 'cadastrados' && !fluxosPainel.bancoConectado) {
    tb.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">Banco indisponível. Não foi possível listar fluxos cadastrados.</td></tr>';
    return;
  }

  const lista = obterFluxosDaAbaSelecionada();
  if (!lista.length) {
    tb.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">Nenhum fluxo encontrado para esta visão.</td></tr>';
    return;
  }

  tb.innerHTML = lista
    .map((fluxo) => {
      const origem =
        modoFluxos === 'ativos'
          ? ORIGEM_LABEL[fluxo.origem] || 'Memória'
          : ORIGEM_LABEL.banco;
      const nome = fluxo.nome || 'Sem Nome';
      const id = fluxo.id || 'padrão';
      const org = fluxo.organizacaoNome || '—';
      const subOrg = fluxo.subOrganizacaoNome || '—';
      return `
        <tr>
          <td>${escapeHtml(org)}</td>
          <td>${escapeHtml(subOrg)}</td>
          <td><code>${escapeHtml(id)}</code></td>
          <td><strong>${escapeHtml(nome)}</strong></td>
          <td><span class="badge ${fluxo.ativo ? 'badge-green' : 'badge-gray'}">${fluxo.ativo ? 'Ativo' : 'Inativo'}</span></td>
          <td><span class="badge badge-blue">${escapeHtml(origem)}</span></td>
        </tr>`;
    })
    .join('');
}

async function carregarEstados() {
  const flowSelect = document.getElementById('f-flow-id');
  const flowId = flowSelect ? flowSelect.value : '';

  if (!flowId && !MODO_PADRAO) {
    estadosAtivos = [];
    const selectVazio = document.getElementById('f-estado-destino');
    if (selectVazio) {
      selectVazio.innerHTML =
        '<option value="">Selecione um fluxo ativo para carregar os estados</option>';
    }
    return;
  }

  const query = `?flowId=${encodeURIComponent(flowId || '')}`;
  const r = await fetch(ESTADOS_API + query);
  const dados = await r.json();
  estadosAtivos = Array.isArray(dados)
    ? dados.filter((estado) => estado.ativo !== false)
    : [];

  const select = document.getElementById('f-estado-destino');
  if (!select) return;
  select.innerHTML = estadosAtivos.length
    ? estadosAtivos
        .map(
          (estado) =>
            `<option value="${estado.estado}">${estado.estado}${estado.descricao ? ' — ' + estado.descricao : ''}</option>`,
        )
        .join('')
    : '<option value="">Nenhum estado ativo disponível</option>';
}

async function carregarKeywords() {
  const dados = await api('GET');
  const tb = document.getElementById('body-keywords');
  const lista = Array.isArray(dados) ? dados : [];
  const flowIdsPermitidos = obterIdsFluxosDoModoSelecionado();
  const modoLabel = modoFluxos === 'ativos' ? 'Ativos' : 'Cadastrados';

  if (flowIdsPermitidos === null) {
    document.getElementById('status-label').textContent = `0 keywords carregadas (${modoLabel})`;
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">Banco indisponível. Não é possível listar keywords no modo Cadastrados.</td></tr>';
    return;
  }

  const listaFiltrada = lista.filter((item) =>
    flowIdsPermitidos.has(normalizarFlowId(item?.flow_id)),
  );
  document.getElementById('status-label').textContent = `${listaFiltrada.length} atalhos carregados (${modoLabel})`;

  if (!listaFiltrada.length) {
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">Nenhum atalho encontrado para o modo selecionado.</td></tr>';
    return;
  }

  tb.innerHTML = listaFiltrada
    .map(
      (item) => `
        <tr>
          <td><code>${escapeHtml(item.keyword)}</code></td>
          <td>
            <div style="display:flex;flex-direction:column;gap:4px">
              <strong>${escapeHtml(item.flow_nome || '—')}</strong>
              <small style="color:var(--muted)"><code>${escapeHtml(item.flow_id || '—')}</code></small>
            </div>
          </td>
          <td><code>${escapeHtml(item.estado_destino)}</code></td>
          <td><span class="badge ${item.ativo ? 'badge-green' : 'badge-gray'}">${item.ativo ? 'Ativa' : 'Inativa'}</span></td>
          <td style="color:var(--muted)">${formatarData(item.updated_at)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick='editarKeyword(${JSON.stringify(item).replace(/'/g, "\\'")})'>✏️ Editar</button>
            <button class="btn btn-ghost btn-sm" onclick="alternarKeyword('${item.id}', ${item.ativo ? 'false' : 'true'})">${item.ativo ? '⏸ Desativar' : '▶️ Ativar'}</button>
            <button class="btn btn-danger btn-sm" onclick="excluirKeyword('${item.id}')">🗑</button>
          </td>
        </tr>`,
    )
    .join('');
}

function abrirNovaKeyword() {
  document.getElementById('edit-id').value = '';
  document.getElementById('f-keyword').value = '';
  document.getElementById('f-ativo').checked = true;
  document.getElementById('modal-titulo').textContent = 'Novo Atalho';

  preencherSelectFluxos();
  carregarEstados().then(() => {
    const select = document.getElementById('f-estado-destino');
    if (estadosAtivos.length > 0) {
      select.value = estadosAtivos[0].estado;
    }
    document.getElementById('modal-keyword').classList.add('open');
  });
}

async function editarKeyword(item) {
  document.getElementById('edit-id').value = item.id;
  document.getElementById('f-keyword').value = item.keyword || '';
  document.getElementById('f-ativo').checked = item.ativo !== false;

  preencherSelectFluxos(item.flow_id || '', item.flow_nome || '');
  await carregarEstados();

  const estadoSelect = document.getElementById('f-estado-destino');
  const estadoAlvo = item.estado_destino || '';
  if (estadoAlvo && !Array.from(estadoSelect.options).some((o) => o.value === estadoAlvo)) {
    const option = document.createElement('option');
    option.value = estadoAlvo;
    option.textContent = `${estadoAlvo} (fora do fluxo ativo)`;
    estadoSelect.appendChild(option);
  }
  estadoSelect.value = estadoAlvo;

  document.getElementById('modal-titulo').textContent = 'Editar Atalho';
  document.getElementById('modal-keyword').classList.add('open');
}

function fecharModal() {
  document.getElementById('modal-keyword').classList.remove('open');
}

async function salvarKeyword() {
  const id = document.getElementById('edit-id').value;
  const keyword = document.getElementById('f-keyword').value.trim();
  const flowSelect = document.getElementById('f-flow-id');
  const flow_id = flowSelect.value || '';
  const flow_nome =
    flowSelect.options[flowSelect.selectedIndex]?.dataset?.nome || '';
  const estado_destino = document.getElementById('f-estado-destino').value;
  const ativo = document.getElementById('f-ativo').checked;

  if (!keyword) return toast('O atalho é obrigatório.', true);
  if (!flow_nome && !flow_id) return toast('Selecione um fluxo ativo.', true);
  if (!estado_destino) return toast('Selecione um estado de destino.', true);

  const body = { keyword, flow_nome, flow_id, estado_destino, ativo };
  const r = id ? await api('PUT', '/' + id, body) : await api('POST', '', body);

  if (r.statusCode || r.message || r.erro) {
    return toast(r.message || r.erro || 'Erro ao salvar atalho.', true);
  }

  toast(id ? 'Atalho atualizado!' : 'Atalho criado!');
  fecharModal();
  await carregarKeywords();
}

async function alternarKeyword(id, ativo) {
  const r = await api('PATCH', '/' + id + '/ativo', { ativo });
  if (r.statusCode || r.message || r.erro) {
    return toast(r.message || r.erro || 'Erro ao atualizar status.', true);
  }
  toast(ativo ? 'Atalho ativado!' : 'Atalho desativado!');
  await carregarKeywords();
}

async function excluirKeyword(id) {
  if (!confirm('Excluir este atalho de navegação?')) return;
  const r = await api('DELETE', '/' + id);
  if (r.statusCode || r.message || r.erro) {
    return toast(r.message || r.erro || 'Erro ao excluir atalho.', true);
  }
  toast('Atalho excluído.');
  await carregarKeywords();
}

async function definirModoFluxos(novoModo) {
  if (novoModo !== 'ativos' && novoModo !== 'cadastrados') return;
  modoFluxos = novoModo;
  localStorage.setItem(FLUXOS_MODO_KEY, modoFluxos);
  renderizarBotoesModoFluxo();
  renderizarFluxosDisponiveis();
  preencherSelectFluxos();
  await carregarEstados();
  await carregarKeywords();
}

document.getElementById('modal-keyword').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) fecharModal();
});

document.getElementById('f-flow-id').addEventListener('change', async () => {
  await carregarEstados();
});

(async function init() {
  await verificarModo();
  await carregarFluxosPainel();
  renderizarBotoesModoFluxo();
  renderizarFluxosDisponiveis();
  preencherSelectFluxos();
  await carregarEstados();
  await carregarKeywords();
})();
