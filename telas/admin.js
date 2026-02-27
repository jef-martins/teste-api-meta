const API = 'http://localhost:3000/admin';
let estadosCache = [];
let transicoesCache = [];

// Inicialização opcional do Mermaid (Visualizador de Fluxos)
if (window.mermaid) {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      primaryColor: '#161b22',
      primaryTextColor: '#e6edf3',
      primaryBorderColor: '#30363d',
      lineColor: '#58a6ff',
      secondaryColor: '#21262d',
      tertiaryColor: '#0d1117'
    },
    flowchart: {
      htmlLabels: true,
      curve: 'bezier'
    }
  });
}

// ── Handlers predefinidos com campos padrão ──────────────────────────────────
const HANDLER_DEFAULTS = {
  _handlerMensagem: [['mensagens', 'array', '["Olá! Como posso ajudar?"]'], ['transicaoAutomatica', 'bool', 'false']],
  _handlerCapturar: [['mensagemPedir', 'string', ''], ['mensagemInvalida', 'string', ''], ['campoSalvar', 'string', ''], ['transicaoAutomatica', 'bool', 'false']],
  _handlerRequisicao: [['url', 'string', ''], ['metodo', 'string', 'GET'], ['campoResposta', 'string', ''], ['mensagemPedir', 'string', ''], ['mensagemSucesso', 'string', ''], ['mensagemNaoEncontrado', 'string', ''], ['mensagemErro', 'string', ''], ['transicaoAutomatica', 'bool', 'false']],
  _handlerLista: [['titulo', 'string', ''], ['botaoTexto', 'string', 'Selecione:'], ['secaoTitulo', 'string', 'Opções'], ['opcoes', 'json', '[]'], ['mensagemInvalida', 'string', '']],
  _handlerBotoes: [['titulo', 'string', ''], ['botoes', 'json', '[]']],
};

// ── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, err = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (err ? ' error' : '');
  setTimeout(() => el.className = '', 3000);
}

// ── Fetch helper ──────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

// ══════════════════════════════ ESTADOS ══════════════════════════════════════

async function carregarEstados() {
  const dados = await api('GET', '/estados');
  estadosCache = dados;
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
        <button class="btn btn-ghost btn-sm" onclick='editarEstado(${JSON.stringify(e)})'>✏️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="excluirEstado('${e.estado}')">🗑</button>
      </td>
    </tr>`).join('');
  
  if (typeof renderizarVisual === 'function') renderizarVisual();
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
  const r = key
    ? await api('PUT', '/estados/' + key, body)
    : await api('POST', '/estados', { ...body, estado });

  if (r.erro) return toast(r.erro, true);
  toast(key ? 'Estado atualizado!' : 'Estado criado!');
  fecharModal();
  carregarEstados();
}

async function excluirEstado(estado) {
  if (!confirm(`Excluir o estado "${estado}"? As transições vinculadas serão removidas.`)) return;
  const r = await api('DELETE', '/estados/' + estado);
  if (r.erro) return toast(r.erro, true);
  toast('Estado excluído.');
  carregarEstados();
  carregarTransicoes();
}

// ══════════════════════════════ CONFIG BUILDER ════════════════════════════════

function renderConfigBuilder(configAtual) {
  const handler = document.getElementById('f-handler').value;
  const defaults = HANDLER_DEFAULTS[handler] || [];
  const container = document.getElementById('config-fields');
  container.innerHTML = '';

  // Campos padrão do handler
  for (const [key, type, def] of defaults) {
    const val = configAtual?.[key] !== undefined
      ? configAtual[key]
      : (type === 'bool' ? false : (type === 'array' || type === 'json' ? JSON.stringify(configAtual?.[key] ?? JSON.parse(def)) : def));
    adicionarCampoConfig(key, type, typeof val === 'object' ? JSON.stringify(val) : String(val));
  }

  // Campos extras que existem no config mas não estão no padrão
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
  div.innerHTML = `
    <input class="key" placeholder="chave" value="${chave}" oninput="atualizarPreview()">
    <select class="type-sel" onchange="atualizarPreview()">
      <option value="string"  ${tipo === 'string' ? 'selected' : ''}>string</option>
      <option value="bool"    ${tipo === 'bool' ? 'selected' : ''}>bool</option>
      <option value="number"  ${tipo === 'number' ? 'selected' : ''}>number</option>
      <option value="array"   ${tipo === 'array' ? 'selected' : ''}>array</option>
      <option value="json"    ${tipo === 'json' ? 'selected' : ''}>json</option>
    </select>
    <input placeholder="valor" value="${escapeHtml(String(valor))}" oninput="atualizarPreview()" style="flex:1">
    <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove();atualizarPreview()" title="Remover">✕</button>`;
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
      else obj[k] = v;
    } catch { obj[k] = v; }
  });
  return obj;
}

function atualizarPreview() {
  document.getElementById('json-preview').textContent = JSON.stringify(coletarConfig(), null, 2);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ══════════════════════════════ TRANSIÇÕES ════════════════════════════════════

async function carregarTransicoes() {
  const dados = await api('GET', '/transicoes');
  transicoesCache = dados;
  const tb = document.getElementById('body-transicoes');

  if (!dados.length) {
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px">Nenhuma transição cadastrada.</td></tr>';
    if (typeof renderizarVisual === 'function') renderizarVisual();
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
  
  if (typeof renderizarVisual === 'function') renderizarVisual();
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

  // datalist de estados para autocomplete
  let dl = document.getElementById('lista-estados');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'lista-estados'; document.body.appendChild(dl); }
  dl.innerHTML = estadosCache.map(e => `<option value="${e.estado}">`).join('');
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

// ══════════════════════════════ VISUAL DE FLUXO (MERMAID) ═════════════════════

function setView(type) {
  if (type === 'table') {
    document.getElementById('view-table').style.display = 'block';
    document.getElementById('view-visual').style.display = 'none';
    document.getElementById('btn-view-table').className = 'btn btn-primary btn-sm';
    document.getElementById('btn-view-visual').className = 'btn btn-ghost btn-sm';
    document.getElementById('btn-nova-transicao').style.display = 'inline-flex';
  } else {
    document.getElementById('view-table').style.display = 'none';
    document.getElementById('view-visual').style.display = 'block';
    document.getElementById('btn-view-table').className = 'btn btn-ghost btn-sm';
    document.getElementById('btn-view-visual').className = 'btn btn-primary btn-sm';
    document.getElementById('btn-nova-transicao').style.display = 'none';
    renderizarVisual();
  }
}

async function renderizarVisual() {
  const visualDiv = document.getElementById('view-visual');
  if (!visualDiv || visualDiv.style.display === 'none') return;
  
  if (!window.mermaid) {
    document.getElementById('mermaid-container').innerHTML = 'Carregando motor visual...';
    return;
  }

  if (estadosCache.length === 0) {
    document.getElementById('mermaid-container').innerHTML = 'Nenhum estado configurado.';
    return;
  }

  // Mais espaçamento e tamanho
  let graph = "%%{init: {'flowchart': {'nodeSpacing': 100, 'rankSpacing': 300}}}%%\ngraph TD;\n";
  
  // Nodos (Blocos estilo Typebot)
  estadosCache.forEach(e => {

    let handlerFormat = e.handler ? `<br/><span style='font-size:14px;color:#8b949e;margin-top:8px;display:inline-block'>${e.handler}</span>` : '';
    graph += `  ${e.estado}["<div style='padding:24px;font-size:18px;font-weight:bold;text-align:center;min-width:220px'>${e.estado}${handlerFormat}</div>"]:::estadoNode\n`;
  });

  // Conexões agrupadas
  const connections = {};
  transicoesCache.forEach(t => {
    if (!t.ativo) return;

    // Garante layout de árvore top-down absoluto:
    // 1) Nenhuma seta sai do ENCERRADO (ele é obrigatoriamente um nó folha/final):
    if (t.estado_origem === 'ENCERRADO') return;
    
    // 2) Nenhuma seta volta para o NOVO (ele é obrigatoriamente a raiz):
    if (t.estado_destino === 'NOVO') return;

    const key = `${t.estado_origem}:::${t.estado_destino}`;
    if (!connections[key]) connections[key] = [];
    let texto = t.entrada === '*' ? 'Qualquer' : (t.entrada || 'vazio');
    connections[key].push(texto);
  });

  Object.entries(connections).forEach(([key, entradas]) => {
    const [origem, destino] = key.split(':::');
    const label = entradas.join(', ');
    // Aumenta a grossura da linha principal e tamanho do texto
    graph += `  ${origem} -->|"<span style='font-size:22px;font-weight:bold;color:#fff;background:#21262d;padding:4px;border-radius:4px'>${label}</span>"| ${destino}\n`;
  });

  if (transicoesCache.length === 0) {
     graph += "  VAZIO[Nenhuma transição]\\n";
  }

  // Estilo
  graph += `  classDef estadoNode fill:#161b22,stroke:#30363d,stroke-width:2px,color:#e6edf3,rx:10px,ry:10px;\n`;

  const container = document.getElementById('mermaid-container');
  try {
    const { svg } = await mermaid.render('mermaid-svg-' + Date.now(), graph);
    container.innerHTML = svg;
    
    // Força o SVG a não encolher em telas pequenas, gerando barra de rolagem horizontal nativa na view
    const svgEl = container.querySelector('svg');
    if (svgEl) {
      svgEl.style.maxWidth = 'none';
      svgEl.style.minWidth = '1400px'; 
      svgEl.style.height = 'auto';
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = "<div style='color:var(--danger)'>Erro ao renderizar fluxo.</div>";
  }
}

// ── Inicialização ─────────────────────────────────────────────────────────────
document.getElementById('modal-estado').addEventListener('click', e => {
  if (e.target === e.currentTarget) fecharModal();
});

document.getElementById('f-estado').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase();
});

carregarEstados();
carregarTransicoes();
