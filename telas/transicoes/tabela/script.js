const API = '/api/admin';
const FLUXOS_MODO_KEY = 'bot_admin_fluxos_modo';
let estadosCache = [];
let MODO_PADRAO = false;
let modoFluxos =
  localStorage.getItem(FLUXOS_MODO_KEY) === 'cadastrados'
    ? 'cadastrados'
    : 'ativos';
const ORIGEM_LABEL = {
  cache: 'Cache Runtime',
  padrao: 'Padrão',
  sessao_zenvia: 'Sessão Zenvia',
};

async function verificarModo() {
  try {
    const r = await fetch(API + '/modo');
    if (!r.ok) return;
    const dados = await r.json();
    MODO_PADRAO = dados.modoPadrao === true;
    const banner = document.getElementById('banner-modo');
    if (banner) {
      if (MODO_PADRAO) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <span>⚠️ <strong>Modo Padrão (Memória)</strong> — BOT_STATE_MACHINE_PADRAO=true. Banco de dados não conectado.
          As alterações feitas aqui ficarão <strong>ativas enquanto o servidor estiver rodando</strong>, mas serão perdidas ao reiniciar.</span>`;
      } else {
        banner.style.display = 'none';
      }
    }
  } catch (e) {
    console.warn('Não foi possível verificar o modo de operação:', e);
  }
}

/** Normaliza a resposta da API para sempre ter estado_origem e estado_destino */
function normalizarTransicao(t) {
  return {
    id: t.id,
    estado_origem: t.estado_origem ?? t.estadoOrigem,
    entrada: t.entrada,
    estado_destino: t.estado_destino ?? t.estadoDestino,
    ativo: t.ativo,
  };
}


function toast(msg, err = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (err ? ' error' : '');
  setTimeout(() => el.className = '', 3000);
}

async function api(method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

function obterFlowIdUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('flowId');
}

function montarUrlFluxo(flowId) {
  const valor = flowId == null ? '' : String(flowId);
  return `index.html?flowId=${encodeURIComponent(valor)}`;
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

function aplicarModoFluxosNaListagem(bancoConectado) {
  const ativosWrapper = document.getElementById('fluxos-ativos-wrapper');
  const cadastradosWrapper = document.getElementById('fluxos-cadastrados-wrapper');
  if (!ativosWrapper || !cadastradosWrapper) return;

  const mostrarAtivos = modoFluxos === 'ativos';
  ativosWrapper.style.display = mostrarAtivos ? 'block' : 'none';
  cadastradosWrapper.style.display = mostrarAtivos ? 'none' : 'block';

  if (!mostrarAtivos && !bancoConectado) {
    const statusBanco = document.getElementById('fluxos-banco-status');
    const tabelaBanco = document.getElementById('tbl-fluxos-banco');
    if (statusBanco) {
      statusBanco.style.display = 'block';
      statusBanco.textContent =
        'Banco indisponível no momento. A listagem de fluxos cadastrados será exibida quando houver conexão.';
    }
    if (tabelaBanco) {
      tabelaBanco.style.display = 'none';
    }
  }
}

function definirModoFluxos(novoModo) {
  if (novoModo !== 'ativos' && novoModo !== 'cadastrados') return;
  modoFluxos = novoModo;
  localStorage.setItem(FLUXOS_MODO_KEY, modoFluxos);
  renderizarBotoesModoFluxo();

  if (obterFlowIdUrl() !== null) {
    window.location.href = 'index.html';
    return;
  }
  carregarFluxos();
}

function escapeHtml(s) {
  return typeof s === 'string' ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : String(s);
}

function atualizarLinksTabs() {
  const flowId = obterFlowIdUrl();
  if (flowId !== null) {
    const elEstados = document.getElementById('link-estados');
    if (elEstados) elEstados.href = `/telas/estados/index.html?flowId=${encodeURIComponent(flowId)}`;
    const elTransicoes = document.getElementById('link-transicoes');
    if (elTransicoes) elTransicoes.href = `/telas/transicoes/tabela/index.html?flowId=${encodeURIComponent(flowId)}`;
  }
}

async function carregarFluxos() {
  document.getElementById('page-fluxos').style.display = 'block';
  document.getElementById('page-transicoes').style.display = 'none';

  const dados = await api('GET', '/fluxos/painel');
  const fluxosMemoria = Array.isArray(dados?.fluxosMemoria) ? dados.fluxosMemoria : [];
  const fluxosBanco = Array.isArray(dados?.fluxosBanco) ? dados.fluxosBanco : [];
  const bancoConectado = dados?.bancoConectado === true;
  const tbMemoria = document.getElementById('body-fluxos-memoria');
  const tbBanco = document.getElementById('body-fluxos-banco');
  const tabelaBanco = document.getElementById('tbl-fluxos-banco');
  const statusBanco = document.getElementById('fluxos-banco-status');

  if (!fluxosMemoria.length) {
    tbMemoria.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">Nenhum fluxo carregado em memória.</td></tr>';
  } else {
    tbMemoria.innerHTML = fluxosMemoria.map((f) => {
      const orgLabel = f.subOrganizacaoNome || f.organizacaoNome || '—';
      const origemLabel = ORIGEM_LABEL[f.origem] || f.origem || 'Memória';
      const podeAbrir = f.navegavel !== false;
      return `
      <tr>
        <td><code>${f.id || 'padrão'}</code></td>
        <td><strong>${escapeHtml(f.nome || 'Sem Nome')}</strong></td>
        <td><span class="badge badge-blue">${escapeHtml(origemLabel)}</span></td>
        <td style="color:var(--muted)">${escapeHtml(orgLabel)}</td>
        <td>${Number(f.estados || 0)}</td>
        <td>${Number(f.transicoes || 0)}</td>
        <td>
          <button class="btn btn-primary btn-sm" ${podeAbrir ? '' : 'disabled'} onclick="${podeAbrir ? `window.location.href='${montarUrlFluxo(f.id)}'` : ''}">Ver Transições</button>
        </td>
      </tr>`;
    }).join('');
  }

  if (!bancoConectado) {
    tabelaBanco.style.display = 'none';
    statusBanco.style.display = 'block';
    statusBanco.textContent = 'Banco indisponível no momento. A listagem de fluxos cadastrados será exibida quando houver conexão.';
  } else {
    tabelaBanco.style.display = 'table';
    statusBanco.style.display = 'none';

    if (!fluxosBanco.length) {
      tbBanco.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">Nenhum fluxo cadastrado no banco.</td></tr>';
    } else {
      tbBanco.innerHTML = fluxosBanco.map((f) => `
      <tr>
        <td>${escapeHtml(f.organizacaoNome || '—')}</td>
        <td>${escapeHtml(f.subOrganizacaoNome || '—')}</td>
        <td><code>${f.id}</code></td>
        <td><strong>${escapeHtml(f.nome || 'Sem Nome')}</strong></td>
        <td style="color:var(--muted)">${escapeHtml(f.descricao || '—')}</td>
        <td><span class="badge ${f.ativo ? 'badge-green' : 'badge-gray'}">${f.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="window.location.href='${montarUrlFluxo(f.id)}'">Ver Transições</button>
        </td>
      </tr>`).join('');
    }
  }

  aplicarModoFluxosNaListagem(bancoConectado);
}

async function carregarEstados() {
  const flowId = obterFlowIdUrl();
  if (flowId === null) return;
  const urlParams = flowId ? `?flowId=${flowId}` : '';
  estadosCache = await api('GET', '/estados' + urlParams);
  // datalist de estados para autocomplete
  let dl = document.getElementById('lista-estados');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'lista-estados'; document.body.appendChild(dl); }
  dl.innerHTML = estadosCache.map(e => `<option value="${e.estado}">`).join('');
}

async function carregarTransicoes() {
  const flowId = obterFlowIdUrl();
  if (flowId === null) {
      return carregarFluxos();
  }
  
  document.getElementById('page-fluxos').style.display = 'none';
  document.getElementById('page-transicoes').style.display = 'block';
  atualizarLinksTabs();

  // O botão de "Visual (Flow)" também deve manter o flowId
  const linksVisual = document.querySelectorAll('a[href="/telas/transicoes/visual_flow/index.html"]');
  linksVisual.forEach(l => l.href = `/telas/transicoes/visual_flow/index.html?flowId=${flowId}`);

  const urlParams = flowId ? `?flowId=${flowId}` : '';
  const rawDados = await api('GET', '/transicoes' + urlParams);
  const dados = Array.isArray(rawDados) ? rawDados.map(normalizarTransicao) : [];
  const tb = document.getElementById('body-transicoes');

  if (!dados.length) {
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px">Nenhuma transição cadastrada.</td></tr>';
    return;
  }

  tb.innerHTML = dados.map(t => `
    <tr id="tr-${t.id}">
      <td><code>${t.estado_origem}</code></td>
      <td><code style="color:#ffa657">${t.entrada}</code></td>
      <td><code>${t.estado_destino}</code></td>
      <td><span class="badge ${t.ativo ? 'badge-green' : 'badge-gray'}">${t.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick='editarTransicao(${JSON.stringify(t)})'>✏️</button>
        <button class="btn btn-danger btn-sm" onclick="excluirTransicao(${t.id})">🗑</button>
      </td>
    </tr>`).join('');
}

function adicionarLinhaTransicao() {
  const tb = document.getElementById('body-transicoes');
  const tr = document.createElement('tr');
  tr.className = 'new-row';
  tr.id = 'new-tr';
  tr.innerHTML = `
    <td><input id="nt-origem"  placeholder="ESTADO_ORIGEM"  list="lista-estados"></td>
    <td><input id="nt-entrada" placeholder="* ou 1 ou sair"></td>
    <td><input id="nt-destino" placeholder="ESTADO_DESTINO" list="lista-estados"></td>
    <td><span class="badge badge-blue">Nova</span></td>
    <td>
      <button class="btn btn-success btn-sm" onclick="salvarNovaTransicao()">✓</button>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('new-tr')?.remove()">✕</button>
    </td>`;
  tb.prepend(tr);
  document.getElementById('nt-origem').focus();
}

async function salvarNovaTransicao() {
  const origem = document.getElementById('nt-origem')?.value.trim().toUpperCase();
  const entrada = document.getElementById('nt-entrada')?.value.trim().toLowerCase();
  const destino = document.getElementById('nt-destino')?.value.trim().toUpperCase();
  if (!origem || !entrada || !destino) return toast('Preencha todos os campos.', true);
  const r = await api('POST', '/transicoes', { estado_origem: origem, entrada, estado_destino: destino });
  if (r.erro) return toast(r.erro, true);
  toast('Transição criada!');
  carregarTransicoes();
}

function editarTransicao(t) {
  const tr = document.getElementById('tr-' + t.id);
  tr.innerHTML = `
    <td><input value="${t.estado_origem}"  list="lista-estados" id="et-origem-${t.id}"></td>
    <td><input value="${t.entrada}"        id="et-entrada-${t.id}"></td>
    <td><input value="${t.estado_destino}" list="lista-estados" id="et-destino-${t.id}"></td>
    <td><span class="badge badge-yellow">Editando</span></td>
    <td>
      <button class="btn btn-success btn-sm" onclick="salvarEdicaoTransicao(${t.id},${t.ativo})">✓</button>
      <button class="btn btn-ghost btn-sm" onclick="carregarTransicoes()">✕</button>
    </td>`;
}

async function salvarEdicaoTransicao(id, ativo) {
  const r = await api('PUT', '/transicoes/' + id, {
    estado_origem: document.getElementById('et-origem-' + id).value.trim().toUpperCase(),
    entrada: document.getElementById('et-entrada-' + id).value.trim().toLowerCase(),
    estado_destino: document.getElementById('et-destino-' + id).value.trim().toUpperCase(),
    ativo,
  });
  if (r.erro) return toast(r.erro, true);
  toast('Transição atualizada!');
  carregarTransicoes();
}

async function excluirTransicao(id) {
  if (!confirm('Excluir esta transição?')) return;
  const r = await api('DELETE', '/transicoes/' + id);
  if (r.erro) return toast(r.erro, true);
  toast('Transição excluída.');
  carregarTransicoes();
}

// Inicialização
verificarModo();
renderizarBotoesModoFluxo();
const flowId = obterFlowIdUrl();
if (flowId !== null) {
  carregarEstados();
}
carregarTransicoes();
