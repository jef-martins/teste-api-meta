const API = '/api/admin/keywords-globais';
const ESTADOS_API = '/api/admin/estados';
const FLUXOS_API = '/api/admin/fluxos';
let MODO_PADRAO = false;
let fluxosDisponiveis = [];
let estadosAtivos = [];

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
        As keywords globais criadas aqui ficarão <strong>ativas enquanto o servidor estiver rodando</strong>, mas serão perdidas ao reiniciar.</span>`;
    } else {
      banner.style.display = 'none';
    }
  } catch (e) {
    console.warn('Não foi possível verificar o modo de operação:', e);
  }
}

async function carregarEstados() {
  const flowSelect = document.getElementById('f-flow-id');
  const flowId = flowSelect ? flowSelect.value : '';
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
          (estado) => `<option value="${estado.estado}">${estado.estado}${estado.descricao ? ' — ' + estado.descricao : ''}</option>`,
        )
        .join('')
    : '<option value="">Nenhum estado ativo disponível</option>';
}

async function carregarFluxos() {
  const r = await fetch(FLUXOS_API);
  const dados = await r.json();
  fluxosDisponiveis = Array.isArray(dados) ? dados : [];

  const select = document.getElementById('f-flow-id');
  if (!select) return;

  select.innerHTML = fluxosDisponiveis.length
    ? fluxosDisponiveis
      .map((fluxo) => {
          const id = fluxo.id || '';
          const nome = fluxo.nome || (id ? id : 'Memória (Padrão)');
          const descricao = fluxo.descricao ? ` — ${fluxo.descricao}` : '';
          return `<option value="${escapeHtml(id)}" data-nome="${escapeHtml(nome)}">${escapeHtml(nome + descricao)}</option>`;
        })
        .join('')
    : '<option value="">Nenhum fluxo disponível</option>';
}

function formatarData(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR');
}

async function carregarKeywords() {
  const dados = await api('GET');
  const tb = document.getElementById('body-keywords');
  const lista = Array.isArray(dados) ? dados : [];
  document.getElementById('status-label').textContent = `${lista.length} keywords carregadas`;

  if (!lista.length) {
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">Nenhuma keyword global cadastrada.</td></tr>';
    return;
  }

  tb.innerHTML = lista
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
  document.getElementById('modal-titulo').textContent = 'Nova Keyword';
  const flowSelect = document.getElementById('f-flow-id');
  if (fluxosDisponiveis.length > 0) {
    flowSelect.value = fluxosDisponiveis[0].id || '';
  }
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
  const flowSelect = document.getElementById('f-flow-id');
  flowSelect.value = item.flow_id || '';

  if (!flowSelect.value && item.flow_nome) {
    const fluxoPorNome = fluxosDisponiveis.find(
      (fluxo) =>
        String(fluxo.nome || '').toLowerCase() ===
        String(item.flow_nome).toLowerCase(),
    );
    if (fluxoPorNome) {
      flowSelect.value = fluxoPorNome.id || '';
    }
  }

  await carregarEstados();
  document.getElementById('f-estado-destino').value = item.estado_destino || '';
  document.getElementById('modal-titulo').textContent = 'Editar Keyword';
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

  if (!keyword) return toast('A keyword é obrigatória.', true);
  if (!flow_nome && !flow_id) return toast('Selecione um fluxo.', true);
  if (!estado_destino) return toast('Selecione um estado de destino.', true);

  const body = { keyword, flow_nome, flow_id, estado_destino, ativo };
  const r = id
    ? await api('PUT', '/' + id, body)
    : await api('POST', '', body);

  if (r.statusCode || r.message || r.erro) {
    return toast(r.message || r.erro || 'Erro ao salvar keyword.', true);
  }

  toast(id ? 'Keyword atualizada!' : 'Keyword criada!');
  fecharModal();
  await carregarKeywords();
}

async function alternarKeyword(id, ativo) {
  const r = await api('PATCH', '/' + id + '/ativo', { ativo });
  if (r.statusCode || r.message || r.erro) {
    return toast(r.message || r.erro || 'Erro ao atualizar status.', true);
  }
  toast(ativo ? 'Keyword ativada!' : 'Keyword desativada!');
  await carregarKeywords();
}

async function excluirKeyword(id) {
  if (!confirm('Excluir esta keyword global?')) return;
  const r = await api('DELETE', '/' + id);
  if (r.statusCode || r.message || r.erro) {
    return toast(r.message || r.erro || 'Erro ao excluir keyword.', true);
  }
  toast('Keyword excluída.');
  await carregarKeywords();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.getElementById('modal-keyword').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) fecharModal();
});

document.getElementById('f-flow-id').addEventListener('change', async () => {
  await carregarEstados();
});

(async function init() {
  await verificarModo();
  await carregarFluxos();
  await carregarEstados();
  await carregarKeywords();
})();
