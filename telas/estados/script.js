const API = '/api/admin';
let MODO_PADRAO = false;

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

async function carregarEstados() {
  const dados = await api('GET', '/estados');
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
}

// ══════════════════════════════ CONFIG BUILDER ════════════════════════════════

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
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
carregarEstados();
