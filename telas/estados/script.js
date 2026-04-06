const API = '/api/admin';
const FLUXOS_MODO_KEY = 'bot_admin_fluxos_modo';
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
    const statusLabel = document.getElementById('status-label');
    if (statusLabel && MODO_PADRAO) {
      statusLabel.textContent = '🟡 Modo Memória';
      statusLabel.style.background = 'rgba(210,153,34,0.2)';
      statusLabel.style.color = '#d2991a';
      statusLabel.style.border = '1px solid rgba(210,153,34,0.4)';
    }
  } catch (e) {
    console.warn('Não foi possível verificar o modo de operação:', e);
  }
}

const HANDLER_DEFAULTS = {
  _handlerMensagem: [['mensagens', 'array', '["Olá! Como posso ajudar?"]'], ['transicaoAutomatica', 'bool', 'false']],
  _handlerCapturar: [['mensagemPedir', 'string', ''], ['mensagemInvalida', 'string', ''], ['campoSalvar', 'string', ''], ['transicaoAutomatica', 'bool', 'false']],
  _handlerRequisicao: [['url', 'string', ''], ['metodo', 'string', 'GET'], ['campoResposta', 'string', ''], ['mensagemPedir', 'string', ''], ['mensagemSucesso', 'string', ''], ['mensagemNaoEncontrado', 'string', ''], ['mensagemErro', 'string', ''], ['transicaoAutomatica', 'bool', 'false']],
  _handlerLista: [['titulo', 'string', ''], ['botaoTexto', 'string', 'Selecione:'], ['secaoTitulo', 'string', 'Opções'], ['opcoes', 'json', '[]'], ['mensagemInvalida', 'string', '']],
  _handlerBotoes: [['titulo', 'string', ''], ['botoes', 'json', '[]']],
};

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

function atualizarStatusBanco(bancoConectado) {
  const statusLabel = document.getElementById('status-label');
  if (!statusLabel) return;

  if (bancoConectado) {
    statusLabel.textContent = '🟢 Banco Online';
    statusLabel.style.background = 'rgba(35,134,54,0.2)';
    statusLabel.style.color = '#3fb950';
    statusLabel.style.border = '1px solid rgba(35,134,54,0.4)';
    return;
  }

  statusLabel.textContent = '🟡 Somente Memória';
  statusLabel.style.background = 'rgba(210,153,34,0.2)';
  statusLabel.style.color = '#d2991a';
  statusLabel.style.border = '1px solid rgba(210,153,34,0.4)';
}

async function carregarFluxos() {
  document.getElementById('page-fluxos').style.display = 'block';
  document.getElementById('page-estados').style.display = 'none';

  const dados = await api('GET', '/fluxos/painel');
  const fluxosMemoria = Array.isArray(dados?.fluxosMemoria) ? dados.fluxosMemoria : [];
  const fluxosBanco = Array.isArray(dados?.fluxosBanco) ? dados.fluxosBanco : [];
  const bancoConectado = dados?.bancoConectado === true;
  const tbMemoria = document.getElementById('body-fluxos-memoria');
  const tbBanco = document.getElementById('body-fluxos-banco');
  const tabelaBanco = document.getElementById('tbl-fluxos-banco');
  const statusBanco = document.getElementById('fluxos-banco-status');

  atualizarStatusBanco(bancoConectado);

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
          <button class="btn btn-primary btn-sm" ${podeAbrir ? '' : 'disabled'} onclick="${podeAbrir ? `window.location.href='${montarUrlFluxo(f.id)}'` : ''}">Ver Estados</button>
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
          <button class="btn btn-primary btn-sm" onclick="window.location.href='${montarUrlFluxo(f.id)}'">Ver Estados</button>
        </td>
      </tr>`).join('');
    }
  }

  aplicarModoFluxosNaListagem(bancoConectado);

  // Carrega sessões NPS ativas junto com os fluxos
  void carregarSessoesNps();
}

async function carregarEstados() {
  const flowId = obterFlowIdUrl();
  if (flowId === null) {
      return carregarFluxos();
  }
  
  document.getElementById('page-fluxos').style.display = 'none';
  document.getElementById('page-estados').style.display = 'block';

  const dados = await api('GET', `/estados?flowId=${flowId}`);
  const tb = document.getElementById('body-estados');
  document.getElementById('status-label').textContent = `${dados.length} estados carregados`;

  if (!dados.length) {
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">Nenhum estado encontrado.</td></tr>';
    return;
  }

  tb.innerHTML = dados.map(e => `
    <tr>
      <td><code>${e.estado}</code></td>
      <td><span class="badge badge-blue">${e.handler}</span></td>
      <td style="color:var(--muted)">${e.descricao || '—'}</td>
      <td><span class="badge ${e.ativo ? 'badge-green' : 'badge-gray'}">${e.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td><code style="font-size:11px;color:var(--muted)">${JSON.stringify(e.config).substring(0, 50)}…</code></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick='editarEstado(${JSON.stringify(e).replace(/'/g, "\\'")})'>✏️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="excluirEstado('${e.estado}')">🗑</button>
      </td>
    </tr>`).join('');
}

function abrirNovoEstado() {
  document.getElementById('edit-key').value = '';
  document.getElementById('f-estado').value = '';
  document.getElementById('f-estado').disabled = false;
  document.getElementById('f-handler').value = '_handlerMensagem';
  document.getElementById('f-descricao').value = '';
  document.getElementById('f-ativo').checked = true;
  document.getElementById('modal-titulo').textContent = 'Novo Estado';
  renderConfigBuilder({});
  document.getElementById('modal-estado').classList.add('open');
}

function editarEstado(e) {
  document.getElementById('edit-key').value = e.estado;
  document.getElementById('f-estado').value = e.estado;
  document.getElementById('f-estado').disabled = true;
  document.getElementById('f-handler').value = e.handler;
  document.getElementById('f-descricao').value = e.descricao || '';
  document.getElementById('f-ativo').checked = e.ativo;
  document.getElementById('modal-titulo').textContent = 'Editar: ' + e.estado;
  renderConfigBuilder(e.config || {});
  document.getElementById('modal-estado').classList.add('open');
}

function fecharModal() {
  document.getElementById('modal-estado').classList.remove('open');
}

async function salvarEstado() {
  const key = document.getElementById('edit-key').value;
  const estado = document.getElementById('f-estado').value.trim().toUpperCase();
  const handler = document.getElementById('f-handler').value;
  const descricao = document.getElementById('f-descricao').value.trim();
  const ativo = document.getElementById('f-ativo').checked;
  const config = coletarConfig();

  if (!estado) return toast('O nome do estado é obrigatório.', true);

  const body = { handler, descricao, config, ativo };
  const flowId = obterFlowIdUrl();
  const urlParams = flowId ? `?flowId=${flowId}` : '';
  const r = key
    ? await api('PUT', '/estados/' + key + urlParams, body)
    : await api('POST', '/estados' + urlParams, { ...body, estado });

  if (r.erro) return toast(r.erro, true);
  toast(key ? 'Estado atualizado!' : 'Estado criado!');
  fecharModal();
  carregarEstados();
}

async function excluirEstado(estado) {
  if (!confirm(`Excluir o estado "${estado}"? As transições vinculadas serão removidas.`)) return;
  const flowId = obterFlowIdUrl();
  const urlParams = flowId ? `?flowId=${flowId}` : '';
  const r = await api('DELETE', '/estados/' + estado + urlParams);
  if (r.erro) return toast(r.erro, true);
  toast('Estado excluído.');
  carregarEstados();
}

// Config Builder

function renderConfigBuilder(configAtual) {
  const handler = document.getElementById('f-handler').value;
  const defaults = HANDLER_DEFAULTS[handler] || [];
  const container = document.getElementById('config-fields');
  container.innerHTML = '';

  const btnTest = document.getElementById('btn-testar-req');
  if (btnTest) {
    btnTest.style.display = handler === '_handlerRequisicao' ? 'inline-block' : 'none';
  }

  for (const [key, type, def] of defaults) {
    const val = configAtual?.[key] !== undefined
      ? configAtual[key]
      : (type === 'bool' ? false : (type === 'array' || type === 'json' ? JSON.stringify(configAtual?.[key] ?? JSON.parse(def)) : def));
    adicionarCampoConfig(key, type, typeof val === 'object' ? JSON.stringify(val) : String(val));
  }

  if (configAtual) {
    const padKeys = defaults.map(d => d[0]);
    for (const [k, v] of Object.entries(configAtual)) {
      if (!padKeys.includes(k)) {
        const t = typeof v === 'boolean' ? 'bool' : (Array.isArray(v) || typeof v === 'object') ? 'json' : 'string';
        adicionarCampoConfig(k, t, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
    }
  }

  atualizarPreview();
}

function adicionarCampoConfig(chave = '', tipo = 'string', valor = '') {
  const div = document.createElement('div');
  div.className = 'config-field';
  const showBtn = (tipo === 'json' || tipo === 'array') ? 'block' : 'none';

  let valEscape = String(valor);
  if (tipo === 'string') valEscape = valEscape.replace(/\n/g, '\\n');
  valEscape = escapeHtml(valEscape);

  div.innerHTML = `
    <input class="key" placeholder="chave" value="${escapeHtml(chave)}" oninput="atualizarPreview()">
    <select class="type-sel" onchange="toggleJsonBtn(this); atualizarPreview()">
      <option value="string"  ${tipo === 'string' ? 'selected' : ''}>string</option>
      <option value="bool"    ${tipo === 'bool' ? 'selected' : ''}>bool</option>
      <option value="number"  ${tipo === 'number' ? 'selected' : ''}>number</option>
      <option value="array"   ${tipo === 'array' ? 'selected' : ''}>array</option>
      <option value="json"    ${tipo === 'json' ? 'selected' : ''}>json</option>
    </select>
    <div style="flex:1; display:flex;">
      <input class="val-input" placeholder="valor" value="${valEscape}" oninput="atualizarPreview()" style="flex:1; border-top-right-radius:0; border-bottom-right-radius:0;">
      <button tabindex="-1" class="btn btn-primary btn-sm btn-json-edit" onclick="abrirModalJson(this)" style="display:${showBtn}; border-top-left-radius:0; border-bottom-left-radius:0; margin-left:-1px" title="Expandir JSON">{  }</button>
    </div>
    <button tabindex="-1" class="btn btn-ghost btn-sm" onclick="this.parentElement.remove();atualizarPreview()" title="Remover">✕</button>`;
  document.getElementById('config-fields').appendChild(div);
}

function coletarConfig() {
  const obj = {};
  document.querySelectorAll('#config-fields .config-field').forEach(row => {
    const [kEl, tEl, vEl] = row.querySelectorAll('input, select');
    const k = kEl.value.trim();
    if (!k) return;
    const t = tEl.value;
    const v = vEl.value;
    try {
      if (t === 'bool') obj[k] = v === 'true';
      else if (t === 'number') obj[k] = Number(v);
      else if (t === 'array' || t === 'json') obj[k] = JSON.parse(v);
      else obj[k] = v.replace(/\\n/g, '\n');
    } catch { obj[k] = v.replace(/\\n/g, '\n'); }
  });
  return obj;
}

function atualizarPreview() {
  document.getElementById('json-preview').textContent = JSON.stringify(coletarConfig(), null, 2);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.getElementById('modal-estado').addEventListener('click', e => {
  if (e.target === e.currentTarget) fecharModal();
});

let currentJsonInput = null;
let currentJsonMode = 'form'; // 'form' | 'json'

function toggleJsonBtn(sel) {
  const row = sel.closest('.config-field');
  const btn = row.querySelector('.btn-json-edit');
  if (sel.value === 'json' || sel.value === 'array') {
    btn.style.display = 'block';
  } else {
    btn.style.display = 'none';
  }
}

function adicionarCampoJson(chave = '', valor = '') {
  const container = document.getElementById('json-form-fields');
  const div = document.createElement('div');
  div.className = 'json-attr-row';
  div.style.display = 'flex';
  div.style.gap = '8px';
  div.innerHTML = `
    <input class="j-key" placeholder="Atributo" value="${escapeHtml(String(chave))}" style="flex: 0 0 150px; font-family:'JetBrains Mono', monospace; font-size:12px; color:#79c0ff">
    <input class="j-val" placeholder="Valor" value="${escapeHtml(String(valor))}" style="flex:1">
    <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()" title="Remover">✕</button>
  `;
  container.appendChild(div);
}

function abrirModalJson(btn) {
  const row = btn.closest('.config-field');
  const keyEl = row.querySelector('.key');
  const valEl = row.querySelector('.val-input');

  currentJsonInput = valEl;
  let val = valEl.value.trim();
  document.getElementById('json-form-fields').innerHTML = ''; // Limpa campos antigos

  let obj = {};
  if (val) {
    try { obj = JSON.parse(val); } catch (e) { }
  }

  // Preenche os campos existentes do JSON ou cria um em branco se estiver vazio
  const chaves = Object.keys(obj);
  if (chaves.length > 0) {
    for (const [k, v] of Object.entries(obj)) {
      let strVal = typeof v === 'object' ? JSON.stringify(v) : String(v);
      adicionarCampoJson(k, strVal);
    }
  } else {
    adicionarCampoJson(); // Inicia com um vazio
  }

  document.getElementById('modal-json-titulo').textContent = `Editar Payload: ${keyEl.value || 'Novo'}`;
  document.getElementById('modal-json').classList.add('open');
}

function fecharModalJson() {
  document.getElementById('modal-json').classList.remove('open');
  currentJsonInput = null;
  // Volta sempre para modo formulário ao fechar
  alternarModoJson('form', true);
}

function alternarModoJson(modo, silencioso = false) {
  currentJsonMode = modo;
  const formDiv = document.getElementById('json-modo-form');
  const rawDiv  = document.getElementById('json-modo-raw');
  const btnForm = document.getElementById('btn-modo-form');
  const btnJson = document.getElementById('btn-modo-json');

  if (modo === 'json') {
    // Ao ir para JSON, serializa os campos do formulário no textarea
    if (!silencioso) {
      const obj = {};
      document.querySelectorAll('#json-form-fields .json-attr-row').forEach(row => {
        const k = row.querySelector('.j-key').value.trim();
        const v = row.querySelector('.j-val').value.trim();
        if (!k) return;
        try {
          if (v === 'true') obj[k] = true;
          else if (v === 'false') obj[k] = false;
          else if (!isNaN(v) && v !== '') obj[k] = Number(v);
          else if ((v.startsWith('[') && v.endsWith(']')) || (v.startsWith('{') && v.endsWith('}'))) obj[k] = JSON.parse(v);
          else obj[k] = v;
        } catch { obj[k] = v; }
      });
      document.getElementById('json-raw-input').value = Object.keys(obj).length
        ? JSON.stringify(obj, null, 2) : '';
    }
    document.getElementById('json-raw-erro').style.display = 'none';
    formDiv.style.display = 'none';
    rawDiv.style.display  = 'block';
    btnForm.style.background = 'transparent';
    btnForm.style.color      = 'var(--muted)';
    btnJson.style.background = '#388bfd';
    btnJson.style.color      = '#fff';
    setTimeout(() => document.getElementById('json-raw-input').focus(), 50);
  } else {
    // Ao voltar para formulário, tenta parsear o JSON bruto e popular os campos
    if (!silencioso) {
      const raw = document.getElementById('json-raw-input').value.trim();
      if (raw) {
        try {
          const obj = JSON.parse(raw);
          document.getElementById('json-form-fields').innerHTML = '';
          for (const [k, v] of Object.entries(obj)) {
            adicionarCampoJson(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
          }
        } catch {
          document.getElementById('json-raw-erro').style.display = 'block';
          return; // Mantém no modo JSON para o user corrigir
        }
      }
    }
    formDiv.style.display = 'block';
    rawDiv.style.display  = 'none';
    btnForm.style.background = '#388bfd';
    btnForm.style.color      = '#fff';
    btnJson.style.background = 'transparent';
    btnJson.style.color      = 'var(--muted)';
  }
}

function salvarModalJson() {
  if (!currentJsonInput) return;

  // Se estiver no modo JSON bruto, tenta parsear primeiro
  if (currentJsonMode === 'json') {
    const raw = document.getElementById('json-raw-input').value.trim();
    const erroEl = document.getElementById('json-raw-erro');
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        currentJsonInput.value = JSON.stringify(obj);
        atualizarPreview();
        fecharModalJson();
        return;
      } catch {
        erroEl.style.display = 'block';
        document.getElementById('json-raw-input').focus();
        return;
      }
    } else {
      currentJsonInput.value = '';
      atualizarPreview();
      fecharModalJson();
      return;
    }
  }

  // Modo formulário (comportamento original)
  const obj = {};

  document.querySelectorAll('#json-form-fields .json-attr-row').forEach(row => {
    let k = row.querySelector('.j-key').value.trim();
    let v = row.querySelector('.j-val').value.trim();
    if (!k) return;

    try {
      // Tenta reconstruir arrays, booleanos e objs inferidos
      if (v === 'true') obj[k] = true;
      else if (v === 'false') obj[k] = false;
      else if (!isNaN(v) && v !== '') obj[k] = Number(v);
      else if ((v.startsWith('[') && v.endsWith(']')) || (v.startsWith('{') && v.endsWith('}'))) {
        obj[k] = JSON.parse(v);
      } else {
        obj[k] = v;
      }
    } catch (e) {
      obj[k] = v; // fallback a string literal
    }
  });

  currentJsonInput.value = Object.keys(obj).length ? JSON.stringify(obj) : '';
  atualizarPreview();
  fecharModalJson();
}

document.getElementById('f-estado').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase();
});

async function testarRequisicao() {
  const config = coletarConfig();
  if (!config.url) return toast('A configuração precisa de uma URL para testar.', true);

  const strConfig = JSON.stringify(config);
  const regex = /\{(\w+)\}/g;
  let match;
  const variaveisEncontradas = new Set();
  
  while ((match = regex.exec(strConfig)) !== null) {
    variaveisEncontradas.add(match[1]);
  }

  const variaveis = {};
  for (const v of variaveisEncontradas) {
    const resp = prompt(`A variável {${v}} foi encontrada na configuração.\nForneça um valor de simulação para testar a requisição:`, '');
    if (resp === null) return;
    variaveis[v] = resp;
  }

  const btn = document.getElementById('btn-testar-req');
  const txtOriginal = btn.innerHTML;
  btn.innerHTML = '⏳ Executando...';
  btn.disabled = true;

  try {
    const res = await fetch(API + '/testar-req', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, variaveis })
    });
    const r = await res.json();

    const elStatus = document.getElementById('test-req-status');
    const code = r.status || 'Erro do Servidor';
    elStatus.textContent = code;

    if (code === 200) elStatus.className = 'badge badge-green';
    else elStatus.className = 'badge', elStatus.style.background = 'var(--danger)'; // simplificado

    let parsed = r.data;
    try { if (typeof parsed === 'string') parsed = JSON.parse(parsed); } catch (e) { }

    document.getElementById('test-req-json').value = typeof parsed === 'object' ? JSON.stringify(parsed, null, 4) : String(parsed || r.erro || 'Sem resposta');
    document.getElementById('modal-test-req').classList.add('open');

  } catch (e) {
    toast('Erro ao chamar o simulador de requisições no backend.', true);
  }

  btn.innerHTML = txtOriginal;
  btn.disabled = false;
}

verificarModo();
renderizarBotoesModoFluxo();
carregarEstados();

// Sessões NPS Ativas

let npsCountdownTimer = null;
let npsUltimosDados = [];

function formatarDuracao(ms) {
  if (ms === null) return '<span style="color:var(--muted)">Sem expiração</span>';
  if (ms <= 0) return '<span style="color:#f85149; font-weight:600;">Expirando...</span>';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `<span style="color:#d2991a;">${h}h ${m % 60}m</span>`;
  if (m > 0) return `<span style="color:${m < 2 ? '#f85149' : '#d2991a'}; font-weight:${m < 2 ? '700' : '400'}">${m}m ${s % 60}s</span>`;
  return `<span style="color:#f85149; font-weight:700;">${s}s</span>`;
}

function formatarIdCurto(id) {
  if (!id) return '—';
  return id.length > 16 ? id.substring(0, 8) + '…' + id.slice(-4) : id;
}

function renderizarSessoesNps(sessoes) {
  const tabela = document.getElementById('tbl-sessoes-nps');
  const vazio = document.getElementById('sessoes-nps-vazio');
  const tbody = document.getElementById('body-sessoes-nps');

  if (!sessoes || sessoes.length === 0) {
    tabela.style.display = 'none';
    vazio.style.display = 'block';
    return;
  }

  tabela.style.display = 'table';
  vazio.style.display = 'none';

  const agora = Date.now();

  tbody.innerHTML = sessoes.map((s) => {
    const ociosaMs = agora - Date.parse(s.ultimaAtividadeEm);
    const tempoRestanteMs = s.tempoExpiracaoMs !== null
      ? Math.max(0, s.tempoExpiracaoMs - ociosaMs)
      : null;
    const progresso = `${s.currentIndex}/${s.totalItens}`;
    const expiracaoLabel = s.expiracaoEmAndamento
      ? '<span style="color:#f85149; font-weight:700; animation: pulse 1s infinite;">⚡ Expirando...</span>'
      : formatarDuracao(tempoRestanteMs);
    const tempoExpiracaoMinutos = s.tempoExpiracaoMs !== null
      ? Math.round(s.tempoExpiracaoMs / 60000)
      : '';

    return `
    <tr data-nps-id="${escapeHtml(s.nps_id)}" data-tempo-expiracao-ms="${s.tempoExpiracaoMs ?? ''}" data-ultima-atividade="${s.ultimaAtividadeEm}">
      <td><code style="color:#79c0ff; font-size:11px;" title="${escapeHtml(s.nps_id)}">${escapeHtml(formatarIdCurto(s.nps_id))}</code></td>
      <td style="font-size:12px;">
        <span style="color:var(--muted);">${escapeHtml(s.from)}</span><br>
        <span>→ ${escapeHtml(s.to)}</span>
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="background:var(--surface2); border-radius:4px; height:6px; flex:1; overflow:hidden;">
            <div style="background:#388bfd; height:100%; width:${Math.round((s.currentIndex / Math.max(s.totalItens, 1)) * 100)}%;"></div>
          </div>
          <span style="font-size:12px; color:var(--muted);">${progresso}</span>
        </div>
      </td>
      <td style="font-size:12px; color:var(--muted);" class="nps-ultima-atividade" data-ts="${s.ultimaAtividadeEm}">—</td>
      <td class="nps-tempo-restante" data-tempo-expiracao-ms="${s.tempoExpiracaoMs ?? ''}" data-ultima-atividade="${s.ultimaAtividadeEm}">${expiracaoLabel}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="abrirModalExpiracaoNps('${escapeHtml(s.nps_id)}', ${s.tempoExpiracaoMs !== null ? Math.round(s.tempoExpiracaoMs/60000) : 'null'})">⏱️ Expiração</button>
      </td>
    </tr>`;
  }).join('');

  // Atualiza os tempos relativos
  atualizarTemposRelativosNps();
}

function atualizarTemposRelativosNps() {
  const agora = Date.now();

  document.querySelectorAll('.nps-ultima-atividade').forEach(el => {
    const ts = Date.parse(el.dataset.ts);
    if (isNaN(ts)) return;
    const diff = agora - ts;
    const s = Math.floor(diff / 1000);
    const m = Math.floor(s / 60);
    el.textContent = m > 0 ? `há ${m}m ${s % 60}s` : `há ${s}s`;
  });

  document.querySelectorAll('.nps-tempo-restante').forEach(el => {
    const expiracaoMs = el.dataset.tempoExpiracaoMs;
    const ultimaAtividade = el.dataset.ultimaAtividade;
    if (!expiracaoMs || !ultimaAtividade) {
      el.innerHTML = '<span style="color:var(--muted)">Sem expiração</span>';
      return;
    }
    const ociosaMs = agora - Date.parse(ultimaAtividade);
    const restanteMs = Math.max(0, Number(expiracaoMs) - ociosaMs);
    el.innerHTML = formatarDuracao(restanteMs);
  });
}

async function carregarSessoesNps() {
  try {
    const r = await fetch('/api/zenvia/sessoes');
    if (!r.ok) throw new Error('Erro ao carregar sessões');
    npsUltimosDados = await r.json();
    renderizarSessoesNps(npsUltimosDados);
  } catch (e) {
    console.warn('Não foi possível carregar sessões NPS:', e);
  }
}

// Inicia o countdown ao vivo (atualiza a cada segundo sem re-renderizar a tabela)
function iniciarNpsCountdown() {
  if (npsCountdownTimer) clearInterval(npsCountdownTimer);
  npsCountdownTimer = setInterval(atualizarTemposRelativosNps, 1000);
}

// Recarrega dados do servidor a cada 30s e atualiza a tabela
setInterval(carregarSessoesNps, 30000);
iniciarNpsCountdown();

function abrirModalExpiracaoNps(nps_id, tempoAtualMinutos) {
  document.getElementById('exp-nps-id').value = nps_id;
  document.getElementById('exp-nps-id-label').textContent = nps_id;
  document.getElementById('exp-minutos').value = tempoAtualMinutos !== null ? tempoAtualMinutos : '';

  const statusLabel = document.getElementById('exp-nps-status-label');
  if (tempoAtualMinutos !== null) {
    statusLabel.textContent = `Expira após ${tempoAtualMinutos}min de ociosidade`;
    statusLabel.style.color = '#d2991a';
  } else {
    statusLabel.textContent = 'Sem expiração configurada';
    statusLabel.style.color = '#3fb950';
  }

  document.getElementById('modal-expiracao-nps').classList.add('open');
}

function fecharModalExpiracaoNps() {
  document.getElementById('modal-expiracao-nps').classList.remove('open');
}

async function salvarExpiracaoNps() {
  const nps_id = document.getElementById('exp-nps-id').value;
  const minStr = document.getElementById('exp-minutos').value.trim();
  const minutos = minStr ? Number(minStr) : null;

  if (minStr && (isNaN(minutos) || minutos <= 0)) {
    toast('Digite um número válido de minutos (mínimo 1).', true);
    return;
  }

  try {
    const r = await fetch(`/api/zenvia/${encodeURIComponent(nps_id)}/expiracao`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempoExpiracaoMinutos: minutos }),
    });
    const dados = await r.json();
    if (!r.ok) throw new Error(dados?.message || 'Erro ao salvar');
    toast(minutos ? `Expiração configurada: ${minutos}min` : 'Expiração desativada.');
    fecharModalExpiracaoNps();
    carregarSessoesNps();
  } catch (e) {
    toast('Erro ao salvar expiração: ' + e.message, true);
  }
}

async function desativarExpiracaoNps() {
  const nps_id = document.getElementById('exp-nps-id').value;
  document.getElementById('exp-minutos').value = '';
  try {
    await fetch(`/api/zenvia/${encodeURIComponent(nps_id)}/expiracao`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempoExpiracaoMinutos: null }),
    });
    toast('Expiração desativada para esta sessão.');
    fecharModalExpiracaoNps();
    carregarSessoesNps();
  } catch (e) {
    toast('Erro ao desativar expiração.', true);
  }
}

// Inicialização
