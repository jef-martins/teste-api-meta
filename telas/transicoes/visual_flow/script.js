const API = '/api/admin';
let estadosCache = [];
let transicoesCache = [];
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
  } catch (e) {
    console.warn('Não foi possível verificar o modo de operação:', e);
  }
}

/** Normaliza para sempre ter estado_origem e estado_destino */
function normalizarTransicao(t) {
  return {
    id: t.id,
    estado_origem: t.estado_origem ?? t.estadoOrigem,
    entrada: t.entrada,
    estado_destino: t.estado_destino ?? t.estadoDestino,
    ativo: t.ativo,
  };
}


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

async function api(method, path) {
  const r = await fetch(API + path, { method });
  return r.json();
}

async function carregarDadosERenderizar() {
  estadosCache = await api('GET', '/estados');
  const rawTransicoes = await api('GET', '/transicoes');
  transicoesCache = Array.isArray(rawTransicoes) ? rawTransicoes.map(normalizarTransicao) : [];
  
  const container = document.getElementById('mermaid-container');
  if (estadosCache.length === 0) {
    container.innerHTML = 'Nenhum estado configurado.';
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

  try {
    const { svg } = await mermaid.render('mermaid-svg-' + Date.now(), graph);
    container.innerHTML = svg;
    
    // Deixa o tamanho natural e permite overflow caso ultrapasse 100% da caixa
    const svgEl = container.querySelector('svg');
    if (svgEl) {
      svgEl.style.maxWidth = '100%';
      svgEl.style.height = 'auto';
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = "<div style='color:var(--danger)'>Erro ao renderizar fluxo.</div>";
  }
}

// Inicialização
verificarModo();
carregarDadosERenderizar();
