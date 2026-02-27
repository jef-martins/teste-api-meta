const API = 'http://localhost:3000/admin';

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

document.getElementById('modal-estado').addEventListener('click', e => {
  if (e.target === e.currentTarget) fecharModal();
});

document.getElementById('f-estado').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase();
});

carregarEstados();
