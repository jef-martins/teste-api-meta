const API = 'http://localhost:3000/admin';
let estadosCache = [];

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
  estadosCache = await api('GET', '/estados');
  // datalist de estados para autocomplete
  let dl = document.getElementById('lista-estados');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'lista-estados'; document.body.appendChild(dl); }
  dl.innerHTML = estadosCache.map(e => `<option value="${e.estado}">`).join('');
}

async function carregarTransicoes() {
  const dados = await api('GET', '/transicoes');
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
carregarEstados();
carregarTransicoes();
