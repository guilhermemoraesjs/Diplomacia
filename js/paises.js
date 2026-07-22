/* ==========================================================================
   paises.js — módulo "Países".

   ARQUITETURA (Etapa 1 — refatoração estrutural, sem mudança de visual ou
   de conteúdo):

   1) SEM MODAL. Cada país abre em uma PÁGINA (dentro da subview
      "paisesLista", substituindo a lista), nunca mais num modal.
   2) ROTEAMENTO POR URL. Abrir um país empurra `#/paises/{id}` para a URL
      via History API. Isso dá: refresh mantém a página aberta, voltar/
      avançar do navegador funciona, e o link é compartilhável. Não existe
      backend/roteador — é tudo resolvido no cliente com hash + popstate.
   3) PÁGINA ÚNICA E REUTILIZÁVEL. Não existe "página do Brasil", "página
      da França" etc. Existe UMA função de render (`renderPaisDetalhe`)
      que recebe dados normalizados de QUALQUER país.
   4) NORMALIZAÇÃO DE DADOS. `normalizarPais(basico, completo)` é o único
      lugar do código que decide "de onde vem cada campo, e o que mostrar
      se não existir". Todo o resto do módulo trabalha sempre com o mesmo
      formato de objeto — isso é o que permite adicionar muito mais
      informação no futuro (novos campos, novos países) sem tocar na
      estrutura de renderização.
   5) COMPONENTES REUTILIZÁVEIS. Pedaços de HTML que se repetiam (grade de
      informações, lista de badges, card genérico, estado vazio) viraram
      pequenas funções `ui*`. As abas da página são um REGISTRO
      (`PAIS_TAB_RENDERERS`), não um switch gigante — adicionar uma aba
      nova é 1 função + 1 entrada em `PAIS_DETALHE_ABAS`.
   ========================================================================== */

/* Paleta por continente — usada na barra inferior do card e nos marcadores
   do mapa, para reforçar a hierarquia visual sem poluir a interface. */
const CONTINENTE_COR = {
  'Europa': 'var(--ub-azul)',
  'América do Sul': 'var(--ub-verde)',
  'América do Norte': 'var(--brass-light)',
  'Ásia': 'var(--seal-glow)',
  'Oceania': '#59D6C7',
  'África': 'var(--brass)',
  'Europa/Ásia': 'var(--azul-light)'
};
function continenteCor(c) { return CONTINENTE_COR[c] || 'var(--brass)'; }

/* Bandeira real via flagcdn.com (SVG/PNG por código ISO 3166-1 alpha-2). */
function flagImgHtml(code, cls) {
  if (!code) return '';
  const c = code.toLowerCase();
  return `<img class="flag-img ${cls || ''}" src="https://flagcdn.com/w80/${c}.png" srcset="https://flagcdn.com/w160/${c}.png 2x" alt="Bandeira: ${code}" loading="lazy">`;
}

function fmtPopulacao(n) {
  if (n >= 1000000000) return (n / 1000000000).toFixed(n % 1000000000 === 0 ? 0 : 1) + ' bi';
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + ' mi';
  return n.toLocaleString('pt-BR');
}

/* ==========================================================================
   FONTE DE DADOS — camada "básica" (sempre disponível, usada na grade/mapa)
   ========================================================================== */
function paisesDefault() {
  return [
    { id: 'de', code: 'DE', nome: 'Alemanha', continente: 'Europa', capital: 'Berlim', populacao: 84000000, moeda: 'Euro (EUR)', idioma: 'Alemão', governo: 'República Federal Parlamentarista', lat: 52.52, lng: 13.40, organizacoes: ['UE', 'OTAN', 'G7', 'ONU'] },
    { id: 'ar', code: 'AR', nome: 'Argentina', continente: 'América do Sul', capital: 'Buenos Aires', populacao: 46000000, moeda: 'Peso argentino (ARS)', idioma: 'Espanhol', governo: 'República Presidencialista', lat: -34.60, lng: -58.38, organizacoes: ['Mercosul', 'G20', 'ONU'] },
    { id: 'au', code: 'AU', nome: 'Austrália', continente: 'Oceania', capital: 'Camberra', populacao: 26000000, moeda: 'Dólar australiano (AUD)', idioma: 'Inglês', governo: 'Monarquia Parlamentarista', lat: -35.28, lng: 149.13, organizacoes: ['G20', 'APEC', 'ONU'] },
    { id: 'br', code: 'BR', nome: 'Brasil', continente: 'América do Sul', capital: 'Brasília', populacao: 213000000, moeda: 'Real (BRL)', idioma: 'Português', governo: 'República Federativa Presidencialista', lat: -15.79, lng: -47.88, organizacoes: ['Mercosul', 'BRICS', 'G20', 'ONU', 'OMC'] },
    { id: 'ca', code: 'CA', nome: 'Canadá', continente: 'América do Norte', capital: 'Ottawa', populacao: 39000000, moeda: 'Dólar canadense (CAD)', idioma: 'Inglês / Francês', governo: 'Monarquia Parlamentarista', lat: 45.42, lng: -75.70, organizacoes: ['G7', 'OTAN', 'ONU'] },
    { id: 'cn', code: 'CN', nome: 'China', continente: 'Ásia', capital: 'Pequim', populacao: 1412000000, moeda: 'Yuan (CNY)', idioma: 'Mandarim', governo: 'República Popular Socialista', lat: 39.90, lng: 116.41, organizacoes: ['BRICS', 'G20', 'ONU (P5)', 'OMC'] },
    { id: 'es', code: 'ES', nome: 'Espanha', continente: 'Europa', capital: 'Madri', populacao: 47000000, moeda: 'Euro (EUR)', idioma: 'Espanhol', governo: 'Monarquia Parlamentarista', lat: 40.42, lng: -3.70, organizacoes: ['UE', 'OTAN', 'ONU'] },
    { id: 'us', code: 'US', nome: 'Estados Unidos', continente: 'América do Norte', capital: 'Washington, D.C.', populacao: 335000000, moeda: 'Dólar americano (USD)', idioma: 'Inglês', governo: 'República Federativa Presidencialista', lat: 38.90, lng: -77.04, organizacoes: ['G7', 'G20', 'OTAN', 'ONU (P5)'] },
    { id: 'fr', code: 'FR', nome: 'França', continente: 'Europa', capital: 'Paris', populacao: 68400000, area: '643.801 km²', moeda: 'Euro (EUR)', idioma: 'Francês', governo: 'República semipresidencialista', nomeOficial: 'República Francesa', regiao: 'Europa Ocidental',
      curiosidade: 'A França é o país mais visitado do mundo, recebendo mais de 90 milhões de turistas por ano.',
      lat: 48.86, lng: 2.35, organizacoes: ['ONU (P5)', 'UE', 'OTAN', 'OCDE', 'G7', 'G20', 'UNESCO'] },
    { id: 'in', code: 'IN', nome: 'Índia', continente: 'Ásia', capital: 'Nova Délhi', populacao: 1428000000, moeda: 'Rupia indiana (INR)', idioma: 'Hindi / Inglês', governo: 'República Federativa Parlamentarista', lat: 28.61, lng: 77.21, organizacoes: ['BRICS', 'G20', 'ONU'] },
    { id: 'il', code: 'IL', nome: 'Israel', continente: 'Ásia', capital: 'Jerusalém', populacao: 9800000, moeda: 'Novo shekel (ILS)', idioma: 'Hebraico / Árabe', governo: 'República Parlamentarista', lat: 31.77, lng: 35.21, organizacoes: ['ONU', 'OCDE'] },
    { id: 'it', code: 'IT', nome: 'Itália', continente: 'Europa', capital: 'Roma', populacao: 59000000, moeda: 'Euro (EUR)', idioma: 'Italiano', governo: 'República Parlamentarista', lat: 41.90, lng: 12.50, organizacoes: ['UE', 'OTAN', 'G7', 'ONU'] },
    { id: 'jp', code: 'JP', nome: 'Japão', continente: 'Ásia', capital: 'Tóquio', populacao: 124000000, moeda: 'Iene (JPY)', idioma: 'Japonês', governo: 'Monarquia Parlamentarista', lat: 35.68, lng: 139.65, organizacoes: ['G7', 'G20', 'ONU', 'OCDE'] },
    { id: 'mx', code: 'MX', nome: 'México', continente: 'América do Norte', capital: 'Cidade do México', populacao: 128000000, moeda: 'Peso mexicano (MXN)', idioma: 'Espanhol', governo: 'República Federativa Presidencialista', lat: 19.43, lng: -99.13, organizacoes: ['G20', 'OCDE', 'ONU'] },
    { id: 'pt', code: 'PT', nome: 'Portugal', continente: 'Europa', capital: 'Lisboa', populacao: 10300000, moeda: 'Euro (EUR)', idioma: 'Português', governo: 'República Semipresidencialista', lat: 38.72, lng: -9.14, organizacoes: ['UE', 'OTAN', 'ONU'] },
    { id: 'gb', code: 'GB', nome: 'Reino Unido', continente: 'Europa', capital: 'Londres', populacao: 67700000, moeda: 'Libra esterlina (GBP)', idioma: 'Inglês', governo: 'Monarquia Parlamentarista', lat: 51.51, lng: -0.13, organizacoes: ['ONU (P5)', 'OTAN', 'G7', 'G20'] },
    { id: 'ru', code: 'RU', nome: 'Rússia', continente: 'Europa/Ásia', capital: 'Moscou', populacao: 144000000, moeda: 'Rublo (RUB)', idioma: 'Russo', governo: 'República Federativa Semipresidencialista', lat: 55.75, lng: 37.62, organizacoes: ['BRICS', 'ONU (P5)', 'G20'] },
    { id: 'tr', code: 'TR', nome: 'Turquia', continente: 'Europa/Ásia', capital: 'Ancara', populacao: 85300000, moeda: 'Lira turca (TRY)', idioma: 'Turco', governo: 'República Presidencialista', lat: 39.93, lng: 32.86, organizacoes: ['OTAN', 'G20', 'ONU'] },
    { id: 'za', code: 'ZA', nome: 'África do Sul', continente: 'África', capital: 'Pretória', populacao: 60600000, moeda: 'Rand (ZAR)', idioma: 'Zulu / Inglês (+9)', governo: 'República Parlamentarista', lat: -25.75, lng: 28.19, organizacoes: ['BRICS', 'G20', 'ONU'] },
    { id: 'kr', code: 'KR', nome: 'Coreia do Sul', continente: 'Ásia', capital: 'Seul', populacao: 51700000, moeda: 'Won (KRW)', idioma: 'Coreano', governo: 'República Presidencialista', lat: 37.57, lng: 126.98, organizacoes: ['G20', 'OCDE', 'ONU'] }
  ];
}
let paises = load('diplo_paises', null) || paisesDefault();
let paisesFiltroContinente = 'todos';
let paisesFiltros = {
  idioma: 'todos', organizacao: 'todos', moeda: 'todos', governo: 'todos',
  g20: 'todos', brics: 'todos', ue: 'todos', ordenarPor: 'nome-az'
};
const GOVERNO_CATEGORIAS = ['Presidencialista', 'Semipresidencialista', 'Parlamentarista', 'Monarquia', 'Socialista'];

const ISO_NUMERICO_POR_PAIS = {
  de: 276, ar: 32, au: 36, br: 76, ca: 124, cn: 156, es: 724, us: 840,
  fr: 250, in: 356, il: 376, it: 380, jp: 392, mx: 484, pt: 620, gb: 826,
  ru: 643, tr: 792, za: 710, kr: 410
};
const PAIS_POR_ISO_NUMERICO = Object.fromEntries(
  Object.entries(ISO_NUMERICO_POR_PAIS).map(([id, iso]) => [iso, id])
);

/* Arquivo em data/paises/ com a ficha completa (quando existir). */
const PAIS_ARQUIVO_DETALHADO = { br: 'brasil', us: 'eua', cn: 'china', fr: 'franca', ru: 'russia' };

function idiomasDoPais(p) {
  return (p.idioma || '').split('/').map(s => s.replace(/\(.*?\)/g, '').trim()).filter(Boolean);
}
function organizacoesBaseDoPais(p) {
  return (p.organizacoes || []).map(o => o.replace(/\(.*?\)/g, '').trim());
}
function listaIdiomasUnicos() {
  const set = new Set(); paises.forEach(p => idiomasDoPais(p).forEach(i => set.add(i)));
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
function listaOrganizacoesUnicas() {
  const set = new Set(); paises.forEach(p => organizacoesBaseDoPais(p).forEach(o => set.add(o)));
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
function listaMoedasUnicas() {
  return [...new Set(paises.map(p => p.moeda))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
function listaContinentes() { return [...new Set(paises.map(p => p.continente))].sort(); }

/* ==========================================================================
   GRADE + FILTROS (view "lista")
   ========================================================================== */
function renderPaisesFiltros() {
  const el = document.getElementById('paisesFiltroContinente'); if (!el) return;
  const conts = ['todos', ...listaContinentes()];
  el.innerHTML = conts.map(c => `<button class="chip ${paisesFiltroContinente === c ? 'active' : ''}" onclick="setPaisesFiltroContinente('${c}')">${c === 'todos' ? 'Todos' : c}</button>`).join('');
}
function setPaisesFiltroContinente(c) { paisesFiltroContinente = c; renderPaisesFiltros(); renderPaises(); }

function togglePaisesOrdem() {
  paisesFiltros.ordenarPor = paisesFiltros.ordenarPor === 'nome-za' ? 'nome-az' : 'nome-za';
  atualizarLabelOrdenacao(); renderPaisesFiltrosAvancados(); renderPaises();
}
function atualizarLabelOrdenacao() {
  const btn = document.getElementById('paisesOrdemBtn'); if (!btn) return;
  const labels = { 'nome-az': 'A → Z', 'nome-za': 'Z → A', 'pop-desc': 'Pop. ↓', 'pop-asc': 'Pop. ↑' };
  btn.textContent = labels[paisesFiltros.ordenarPor] || 'Ordenar';
}

function togglePaisesFiltrosAvancados() {
  const el = document.getElementById('paisesFiltrosAvancados'); if (!el) return;
  const abrindo = el.style.display === 'none' || !el.style.display;
  el.style.display = abrindo ? 'block' : 'none';
  const btn = document.getElementById('paisesFiltrosAvancadosBtn');
  if (btn) btn.textContent = abrindo ? '⚙ Ocultar filtros' : '⚙ Mais filtros';
}
function renderPaisesFiltrosAvancados() {
  const el = document.getElementById('paisesFiltrosAvancados'); if (!el) return;
  const opcoes = (atual, valores) => ['<option value="todos">Todos</option>']
    .concat(valores.map(v => `<option value="${v}" ${atual === v ? 'selected' : ''}>${v}</option>`)).join('');
  const opcoesSimNao = (atual) => `
    <option value="todos" ${atual === 'todos' ? 'selected' : ''}>Todos</option>
    <option value="sim" ${atual === 'sim' ? 'selected' : ''}>Sim</option>
    <option value="nao" ${atual === 'nao' ? 'selected' : ''}>Não</option>`;

  el.innerHTML = `
    <div class="pf-grid">
      <div><label class="field-label">Idioma oficial</label><select onchange="setPaisesFiltro('idioma', this.value)">${opcoes(paisesFiltros.idioma, listaIdiomasUnicos())}</select></div>
      <div><label class="field-label">Organização internacional</label><select onchange="setPaisesFiltro('organizacao', this.value)">${opcoes(paisesFiltros.organizacao, listaOrganizacoesUnicas())}</select></div>
      <div><label class="field-label">Moeda</label><select onchange="setPaisesFiltro('moeda', this.value)">${opcoes(paisesFiltros.moeda, listaMoedasUnicas())}</select></div>
      <div><label class="field-label">Forma de governo</label><select onchange="setPaisesFiltro('governo', this.value)">${opcoes(paisesFiltros.governo, GOVERNO_CATEGORIAS)}</select></div>
      <div><label class="field-label">Membro do G20</label><select onchange="setPaisesFiltro('g20', this.value)">${opcoesSimNao(paisesFiltros.g20)}</select></div>
      <div><label class="field-label">Membro do BRICS</label><select onchange="setPaisesFiltro('brics', this.value)">${opcoesSimNao(paisesFiltros.brics)}</select></div>
      <div><label class="field-label">Membro da União Europeia</label><select onchange="setPaisesFiltro('ue', this.value)">${opcoesSimNao(paisesFiltros.ue)}</select></div>
      <div><label class="field-label">Ordenar por</label>
        <select onchange="setPaisesFiltro('ordenarPor', this.value)">
          <option value="nome-az" ${paisesFiltros.ordenarPor === 'nome-az' ? 'selected' : ''}>Nome (A → Z)</option>
          <option value="nome-za" ${paisesFiltros.ordenarPor === 'nome-za' ? 'selected' : ''}>Nome (Z → A)</option>
          <option value="pop-desc" ${paisesFiltros.ordenarPor === 'pop-desc' ? 'selected' : ''}>População (maior → menor)</option>
          <option value="pop-asc" ${paisesFiltros.ordenarPor === 'pop-asc' ? 'selected' : ''}>População (menor → maior)</option>
        </select>
      </div>
    </div>
    <button class="btn ghost small" style="margin-top:12px;" onclick="limparPaisesFiltrosAvancados()">Limpar filtros avançados</button>
  `;
}
function setPaisesFiltro(campo, valor) {
  paisesFiltros[campo] = valor;
  if (campo === 'ordenarPor') atualizarLabelOrdenacao();
  renderPaises();
}
function limparPaisesFiltrosAvancados() {
  paisesFiltros = { idioma: 'todos', organizacao: 'todos', moeda: 'todos', governo: 'todos', g20: 'todos', brics: 'todos', ue: 'todos', ordenarPor: 'nome-az' };
  atualizarLabelOrdenacao(); renderPaisesFiltrosAvancados(); renderPaises();
}

function paisCardHtml(p) {
  const orgs = p.organizacoes || [];
  return `
    <div class="card pais-card" style="--accent:${continenteCor(p.continente)}" onclick="abrirPaisDetalhe('${p.id}')">
      <div class="pc-top">
        <span class="pc-flag">${flagImgHtml(p.code)}</span>
        <div class="pc-name-wrap">
          <div class="pc-name">${p.nome}</div>
          <div class="pc-continent">${p.continente}</div>
        </div>
      </div>
      <div class="pc-stats">
        <div class="pc-stat"><span class="pc-stat-ic">🏛️</span><div><span class="pc-stat-label">Capital</span><span class="pc-stat-val">${p.capital}</span></div></div>
        <div class="pc-stat"><span class="pc-stat-ic">👥</span><div><span class="pc-stat-label">População</span><span class="pc-stat-val">${fmtPopulacao(p.populacao)}</span></div></div>
        <div class="pc-stat"><span class="pc-stat-ic">💰</span><div><span class="pc-stat-label">Moeda</span><span class="pc-stat-val">${p.moeda}</span></div></div>
      </div>
      ${orgs.length ? `<div class="pc-orgs">${orgs.slice(0, 3).map(o => `<span class="org-badge">${o}</span>`).join('')}${orgs.length > 3 ? `<span class="org-badge more">+${orgs.length - 3}</span>` : ''}</div>` : ''}
      <div class="pc-bar"></div>
    </div>`;
}

function renderPaises() {
  const el = document.getElementById('paisesGrid'); if (!el) return;
  const q = (document.getElementById('paisesSearch')?.value || '').trim().toLowerCase();

  let list = paises.filter(p => {
    const matchQ = !q || p.nome.toLowerCase().includes(q) || p.capital.toLowerCase().includes(q) || (p.code && p.code.toLowerCase().includes(q));
    const matchC = paisesFiltroContinente === 'todos' || p.continente === paisesFiltroContinente;
    const matchIdioma = paisesFiltros.idioma === 'todos' || idiomasDoPais(p).includes(paisesFiltros.idioma);
    const matchOrg = paisesFiltros.organizacao === 'todos' || organizacoesBaseDoPais(p).includes(paisesFiltros.organizacao);
    const matchMoeda = paisesFiltros.moeda === 'todos' || p.moeda === paisesFiltros.moeda;
    const matchGoverno = paisesFiltros.governo === 'todos' || (p.governo || '').includes(paisesFiltros.governo);
    const orgsBase = organizacoesBaseDoPais(p);
    const matchG20 = paisesFiltros.g20 === 'todos' || (paisesFiltros.g20 === 'sim') === orgsBase.includes('G20');
    const matchBrics = paisesFiltros.brics === 'todos' || (paisesFiltros.brics === 'sim') === orgsBase.includes('BRICS');
    const matchUe = paisesFiltros.ue === 'todos' || (paisesFiltros.ue === 'sim') === orgsBase.includes('UE');
    return matchQ && matchC && matchIdioma && matchOrg && matchMoeda && matchGoverno && matchG20 && matchBrics && matchUe;
  });

  list.sort((a, b) => {
    switch (paisesFiltros.ordenarPor) {
      case 'nome-za': return b.nome.localeCompare(a.nome, 'pt-BR');
      case 'pop-desc': return b.populacao - a.populacao;
      case 'pop-asc': return a.populacao - b.populacao;
      default: return a.nome.localeCompare(b.nome, 'pt-BR');
    }
  });

  el.innerHTML = list.length ? list.map(paisCardHtml).join('') : '<div class="empty" style="padding:20px 0; color:var(--text-muted);">Nenhum país encontrado para esses filtros.</div>';
  el.classList.remove('filtering'); void el.offsetWidth; el.classList.add('filtering');

  const lbl = document.getElementById('paisesCountLabel');
  if (lbl) {
    lbl.textContent = list.length === paises.length
      ? paises.length + ' país' + (paises.length === 1 ? '' : 'es') + ' catalogado' + (paises.length === 1 ? '' : 's')
      : list.length + ' de ' + paises.length + ' países (filtrados)';
  }
}

/* ==========================================================================
   CAMADA DE DADOS DA PÁGINA DE PAÍS — busca + normalização
   ========================================================================== */
let paisFichaCache = {}; // arquivo (ex.: "brasil") -> JSON já carregado
async function carregarFichaCompletaPais(paisId) {
  const arquivo = PAIS_ARQUIVO_DETALHADO[paisId];
  if (!arquivo) return null;
  if (paisFichaCache[arquivo]) return paisFichaCache[arquivo];
  try {
    const res = await fetch(`data/paises/${arquivo}.json`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const dados = await res.json();
    paisFichaCache[arquivo] = dados;
    return dados;
  } catch (e) {
    console.error(`Falha ao carregar ficha completa de "${paisId}" (data/paises/${arquivo}.json):`, e);
    return null;
  }
}

/* Único lugar do código que decide "de onde vem cada campo, e o que
   mostrar se não existir". A página de detalhe (e suas abas) trabalham
   sempre com o formato normalizado abaixo — nunca com `basico`/`completo`
   crus. Isso é o que permite acrescentar mais dados no futuro (novos
   campos, novos países com ou sem ficha completa) sem tocar em nada da
   renderização. */
function normalizarPais(basico, completo) {
  const p = basico, c = completo;
  return {
    id: p.id,
    code: p.code,
    nome: p.nome,
    nomeOficial: (c && c.nomeOficial) || p.nomeOficial || p.nome,
    continente: p.continente,
    regiao: (c && c.regiao) || p.regiao || p.continente,
    capital: (c && c.capital) || p.capital,
    populacao: (c && c.populacao) || fmtPopulacao(p.populacao),
    area: (c && c.area) || p.area || '—',
    idiomas: (c && c.idiomas) || idiomasDoPais(p),
    moeda: (c && c.moeda) || p.moeda,
    fusoHorario: (c && c.fusoHorario) || '—',
    dominio: (c && c.dominio) || '—',
    codigoTelefonico: (c && c.codigoTelefonico) || '—',
    governo: (c && c.governo) || { sistema: p.governo || '—', chefeEstado: '—', chefeGoverno: '—', constituicao: '—' },
    economia: (c && c.economia) || null,
    relacoes: (c && c.relacoes) || null,
    organizacoes: (c && c.organizacoes) || (p.organizacoes || []).map(sigla => ({ sigla, nome: sigla })),
    geografia: (c && c.geografia) || null,
    historia: (c && c.historia) || [],
    curiosidades: (c && c.curiosidades) || (p.curiosidade ? [p.curiosidade] : []),
    flashcardsExtras: (c && c.flashcardsExtras) || [],
    atualidades: (c && c.atualidades) || [],
    questoesCACD: (c && c.questoesCACD) || [],
    temFichaCompleta: !!c
  };
}

/* ==========================================================================
   COMPONENTES REUTILIZÁVEIS (blocos de HTML que se repetiam nas abas)
   ========================================================================== */
function uiInfoItem(label, valor) {
  return `<div class="pm-item"><span class="field-label">${label}</span>${valor || '—'}</div>`;
}
function uiInfoGrid(pares) {
  return `<div class="pm-grid">${pares.map(([l, v]) => uiInfoItem(l, v)).join('')}</div>`;
}
function uiBadgeList(itens) {
  if (!itens || !itens.length) return '';
  return `<div class="pc-orgs" style="margin-top:6px;">${itens.map(x => `<span class="org-badge">${x}</span>`).join('')}</div>`;
}
function uiEmpty(msg) { return `<div class="biblio-empty">${msg}</div>`; }
function uiCardItem(topo, corpoHtml, estiloExtra) {
  return `<div class="card" style="margin:0; padding:12px 14px;${estiloExtra || ''}">${topo ? `<div class="mono" style="font-size:11px; color:var(--brass-light);">${topo}</div>` : ''}<div style="font-size:13.5px; margin-top:${topo ? '2px' : '0'}; line-height:1.55;">${corpoHtml}</div></div>`;
}
function uiCarregando() { return '<div class="empty" style="padding:60px 0; text-align:center; color:var(--text-muted);">Carregando ficha completa…</div>'; }
function uiPaisHero(n) {
  return `
    <div class="pd-hero" style="--accent:${continenteCor(n.continente)}">
      <span class="pd-flag">${flagImgHtml(n.code)}</span>
      <div>
        <h2 style="margin-bottom:3px;">${n.nome}</h2>
        <div class="pd-sub mono">${n.nomeOficial} · ${n.continente}${n.regiao && n.regiao !== n.continente ? ' · ' + n.regiao : ''}</div>
        ${!n.temFichaCompleta ? '<span class="pd-badge-basico">Ficha básica — dados completos ainda não cadastrados</span>' : ''}
      </div>
    </div>`;
}
function uiPaisTabs(abas, atual) {
  return `<div class="subtabs" style="margin:16px 20px 0;">${abas.map(a =>
    `<button class="subtab-btn ${atual === a.id ? 'active' : ''}" onclick="irParaAbaPaisDetalhe('${a.id}')">${a.label}</button>`
  ).join('')}</div>`;
}

/* ==========================================================================
   REGISTRO DE ABAS — cada aba é uma entrada (id, label) + uma função pura
   (n) => html. Adicionar uma aba nova = 1 função + 1 linha aqui embaixo.
   ========================================================================== */
const RELACAO_NOME_AMIGAVEL = { brasil: 'Brasil', eua: 'Estados Unidos', china: 'China', ue: 'União Europeia', regional: 'Relações regionais' };

const PAIS_DETALHE_ABAS = [
  { id: 'geral', label: 'Geral' },
  { id: 'governo', label: 'Governo e Política' },
  { id: 'economia', label: 'Economia' },
  { id: 'relacoes', label: 'Relações Internacionais' },
  { id: 'organizacoes', label: 'Organizações' },
  { id: 'geografia', label: 'Geografia' },
  { id: 'historia', label: 'História' },
  { id: 'curiosidades', label: 'Curiosidades' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'atualidades', label: 'Atualidades' },
  { id: 'questoes', label: 'Questões CACD' }
];

const PAIS_TAB_RENDERERS = {
  geral(n) {
    return uiInfoGrid([
      ['Nome oficial', n.nomeOficial], ['Capital', n.capital], ['População', n.populacao],
      ['Área', n.area], ['Idiomas', (n.idiomas || []).join(', ')], ['Moeda', n.moeda],
      ['Região', n.regiao], ['Fuso horário', n.fusoHorario], ['Domínio', n.dominio], ['Código telefônico', n.codigoTelefonico]
    ]) + (n.curiosidades[0] ? `<div class="pm-curiosidade" style="margin-top:16px;"><span class="field-label">Em destaque</span>${n.curiosidades[0]}</div>` : '');
  },
  governo(n) {
    const g = n.governo;
    return uiInfoGrid([['Sistema', g.sistema], ['Chefe de Estado', g.chefeEstado], ['Chefe de Governo', g.chefeGoverno], ['Constituição', g.constituicao]]);
  },
  economia(n) {
    if (!n.economia) return uiEmpty('Nenhum dado econômico cadastrado ainda para este país.');
    const e = n.economia;
    return uiInfoGrid([['PIB (nominal)', e.pib], ['PIB (PPC)', e.pibPPC], ['PIB per capita', e.pibPerCapita], ['Crescimento', e.crescimento], ['Inflação', e.inflacao], ['Desemprego', e.desemprego]])
      + `<div style="margin-top:14px;"><span class="field-label">Exportações</span><p style="font-size:13px; margin:4px 0 0; line-height:1.6;">${e.exportacoes || '—'}</p></div>`
      + `<div style="margin-top:10px;"><span class="field-label">Importações</span><p style="font-size:13px; margin:4px 0 0; line-height:1.6;">${e.importacoes || '—'}</p></div>`
      + (e.parceiros && e.parceiros.length ? `<div style="margin-top:10px;"><span class="field-label">Principais parceiros</span>${uiBadgeList(e.parceiros)}</div>` : '')
      + (e.produtos && e.produtos.length ? `<div style="margin-top:10px;"><span class="field-label">Principais produtos</span>${uiBadgeList(e.produtos)}</div>` : '');
  },
  relacoes(n) {
    if (!n.relacoes || !Object.keys(n.relacoes).length) return uiEmpty('Sem informações de relações internacionais cadastradas.');
    return Object.entries(n.relacoes).map(([k, v]) => `
      <div style="margin-bottom:14px;"><span class="field-label">${RELACAO_NOME_AMIGAVEL[k] || k}</span><p style="font-size:13.5px; line-height:1.6; margin:4px 0 0;">${v}</p></div>
    `).join('');
  },
  organizacoes(n) {
    if (!n.organizacoes.length) return uiEmpty('Nenhuma organização cadastrada.');
    return `<div style="display:grid; gap:10px;">${n.organizacoes.map(o => uiCardItem(o.sigla, o.nome)).join('')}</div>`;
  },
  geografia(n) {
    if (!n.geografia) return uiEmpty('Nenhum dado geográfico cadastrado ainda para este país.');
    const g = n.geografia;
    return `<div class="pm-item" style="margin-bottom:12px;"><span class="field-label">Clima</span>${g.clima || '—'}</div>
      <div class="pm-item" style="margin-bottom:12px;"><span class="field-label">Relevo</span>${g.relevo || '—'}</div>`
      + uiInfoGrid([
        ['Países vizinhos', (g.paisesVizinhos || []).join(', ')],
        ['Principais rios', (g.rios || []).join(', ')],
        ['Principais cidades', (g.principaisCidades || []).join(', ')]
      ]);
  },
  historia(n) {
    if (!n.historia.length) return uiEmpty('Nenhum evento histórico cadastrado.');
    return `<div style="display:flex; flex-direction:column; gap:10px;">${n.historia.map(item => uiCardItem(item.ano, item.evento, ' border-left:3px solid var(--brass);')).join('')}</div>`;
  },
  curiosidades(n) {
    if (!n.curiosidades.length) return uiEmpty('Nenhuma curiosidade cadastrada.');
    return `<ul style="margin:0; padding-left:20px; display:flex; flex-direction:column; gap:8px;">${n.curiosidades.map(x => `<li style="font-size:13.5px; line-height:1.6;">${x}</li>`).join('')}</ul>`;
  },
  flashcards(n) {
    if (!n.flashcardsExtras.length) return uiEmpty('Nenhum flashcard cadastrado para este país.');
    return `<div style="display:grid; gap:10px;">${n.flashcardsExtras.map(f => `
      <div class="card pd-flash" onclick="this.classList.toggle('flipped')">
        <span class="field-label">Pergunta <span class="pd-flash-hint">(clique para ver a resposta)</span></span>
        <div style="font-size:13.5px; margin:4px 0 0;">${f.pergunta}</div>
        <div class="pd-flash-resposta"><span class="field-label">Resposta</span><div style="font-size:13.5px; margin-top:4px; color:var(--brass-light);">${f.resposta}</div></div>
      </div>`).join('')}</div>`;
  },
  atualidades(n) {
    if (!n.atualidades.length) return uiEmpty('Nenhuma atualidade cadastrada ainda para este país.');
    return n.atualidades.map(a => uiCardItem(null, `<h4 style="margin-bottom:4px;">${a.titulo}</h4><p>${a.resumo}</p>`, ' margin-bottom:10px;')).join('');
  },
  questoes(n) {
    if (!n.questoesCACD.length) return uiEmpty('Nenhuma questão CACD cadastrada ainda para este país.');
    return n.questoesCACD.map(item => uiCardItem(null, item.texto || JSON.stringify(item), ' margin-bottom:10px;')).join('');
  }
};

/* ==========================================================================
   PÁGINA DE DETALHE — abrir/fechar/renderizar (uma página só, para
   qualquer país). Requer no index.html:
     <div id="paisesListaWrap"> ...toolbar + #paisesGrid... </div>
     <div id="paisesDetalheWrap" style="display:none;"></div>
   ========================================================================== */
let paisDetalheAtual = null; // objeto NORMALIZADO do país aberto agora (ou null)
let paisDetalheAbaAtual = 'geral';

async function abrirPaisDetalhe(id, opts = {}) {
  const atualizarUrl = opts.atualizarUrl !== false;
  const p = paises.find(x => x.id === id); if (!p) return;

  const listaWrap = document.getElementById('paisesListaWrap');
  const detalheWrap = document.getElementById('paisesDetalheWrap');
  if (!detalheWrap) return; // index.html precisa da estrutura descrita acima

  if (listaWrap) listaWrap.style.display = 'none';
  detalheWrap.style.display = 'block';
  detalheWrap.innerHTML = uiCarregando();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const completo = await carregarFichaCompletaPais(id);
  paisDetalheAtual = normalizarPais(p, completo);
  paisDetalheAbaAtual = 'geral';
  renderPaisDetalhe();
  if (atualizarUrl) atualizarUrlPais(id);
}

function fecharPaisDetalhe(opts = {}) {
  const atualizarUrl = opts.atualizarUrl !== false;
  const listaWrap = document.getElementById('paisesListaWrap');
  const detalheWrap = document.getElementById('paisesDetalheWrap');
  if (detalheWrap) { detalheWrap.style.display = 'none'; detalheWrap.innerHTML = ''; }
  if (listaWrap) listaWrap.style.display = 'block';
  paisDetalheAtual = null;
  if (atualizarUrl) limparUrlPais();
}

function irParaAbaPaisDetalhe(aba) {
  paisDetalheAbaAtual = aba;
  renderPaisDetalhe();
}

function renderPaisDetalhe() {
  const wrap = document.getElementById('paisesDetalheWrap'); if (!wrap || !paisDetalheAtual) return;
  const n = paisDetalheAtual;
  if (!PAIS_DETALHE_ABAS.some(a => a.id === paisDetalheAbaAtual)) paisDetalheAbaAtual = 'geral';
  const renderTab = PAIS_TAB_RENDERERS[paisDetalheAbaAtual] || (() => '');

  wrap.innerHTML = `
    <button class="btn ghost small" onclick="fecharPaisDetalhe()" style="margin-bottom:14px;">← Voltar à lista</button>
    <div class="card" style="padding:0; overflow:hidden;">
      ${uiPaisHero(n)}
      ${uiPaisTabs(PAIS_DETALHE_ABAS, paisDetalheAbaAtual)}
      <div class="pd-tab-content">${renderTab(n)}</div>
    </div>
  `;
}

/* ==========================================================================
   ROTEAMENTO — cada país tem sua própria URL (#/paises/{id}), sem backend.
   ========================================================================== */
function atualizarUrlPais(id) {
  history.pushState({ pais: id }, '', `${location.pathname}${location.search}#/paises/${id}`);
}
function limparUrlPais() {
  history.pushState({ pais: null }, '', `${location.pathname}${location.search}#/paises`);
}
function aplicarRotaPaisAtual() {
  const m = location.hash.match(/^#\/paises\/([a-z]{2,3})$/i);
  if (m) {
    const id = m[1].toLowerCase();
    if (paises.some(p => p.id === id)) {
      goTab('paises');
      goSub('paisesLista');
      abrirPaisDetalhe(id, { atualizarUrl: false });
      return;
    }
  }
  if (paisDetalheAtual) fecharPaisDetalhe({ atualizarUrl: false });
}
window.addEventListener('popstate', aplicarRotaPaisAtual);
if (document.readyState !== 'loading') aplicarRotaPaisAtual();
else window.addEventListener('DOMContentLoaded', aplicarRotaPaisAtual);

/* ==========================================================================
   MAPA-MÚNDI — continentes reais (d3-geo + topojson), arquivos locais do
   projeto (vendor/ e data/), com destaque do território ao selecionar.
   Clicar num pino ou no território de um país abre a MESMA página de
   detalhe usada pela grade (nenhum modal envolvido).
   ========================================================================== */
function latLngToPct(lat, lng) {
  return { x: ((lng + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 };
}

const MAPA_MUNDI_W = 1000;
const MAPA_MUNDI_H = 500;
const MAPA_MUNDI_DATA_URL = 'data/world-atlas-countries-110m.json';

let mapaMundiSvgCache = null;
let mapaMundiFeaturesPromise = null;
let paisesMapaSelecionado = null;

function getMapaMundiFeatures() {
  if (!mapaMundiFeaturesPromise) {
    mapaMundiFeaturesPromise = fetch(MAPA_MUNDI_DATA_URL)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(topo => topojson.feature(topo, topo.objects.countries).features)
      .catch(e => { console.error('Falha ao carregar dados do mapa-múndi (' + MAPA_MUNDI_DATA_URL + '):', e); return []; });
  }
  return mapaMundiFeaturesPromise;
}

async function construirMapaMundiSvg() {
  if (mapaMundiSvgCache) return mapaMundiSvgCache;
  if (typeof d3 === 'undefined' || typeof topojson === 'undefined') {
    console.error('d3/topojson não carregados — confira as tags <script> de vendor/d3.min.js e vendor/topojson-client.min.js no index.html.');
    return null;
  }
  const features = await getMapaMundiFeatures();
  if (!features.length) return null;
  const projection = d3.geoEquirectangular().fitSize([MAPA_MUNDI_W, MAPA_MUNDI_H], { type: 'Sphere' });
  const pathGen = d3.geoPath(projection);
  const paths = features.map(f => {
    const iso = Number(f.id);
    const paisId = PAIS_POR_ISO_NUMERICO[iso];
    const cls = paisId ? 'mapa-country selectable' : 'mapa-country';
    const onclick = paisId ? ` onclick="selecionarPaisNoMapa('${paisId}')"` : '';
    return `<path d="${pathGen(f)}" class="${cls}" data-iso="${iso}"${onclick}></path>`;
  }).join('');
  mapaMundiSvgCache = `<svg class="mapa-mundi-svg" viewBox="0 0 ${MAPA_MUNDI_W} ${MAPA_MUNDI_H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
  return mapaMundiSvgCache;
}

function mapaMundiPinsHtml(q) {
  return paises.map(p => {
    const pos = latLngToPct(p.lat, p.lng);
    const match = q && (p.nome.toLowerCase().includes(q) || p.capital.toLowerCase().includes(q));
    return `<button type="button" class="map-pin ${match ? 'match' : ''}" style="left:${pos.x}%; top:${pos.y}%; --accent:${continenteCor(p.continente)}" onclick="selecionarPaisNoMapa('${p.id}')" title="${p.nome}">
        <span class="map-pin-dot"></span>
        <span class="map-pin-label">${flagImgHtml(p.code, 'map-pin-flag')}${p.nome}</span>
      </button>`;
  }).join('');
}

function aplicarSelecaoMapa() {
  const wrap = document.getElementById('paisesMapaSvgWrap'); if (!wrap) return;
  wrap.querySelectorAll('.mapa-country.selected').forEach(el => el.classList.remove('selected'));
  if (!paisesMapaSelecionado) return;
  const iso = ISO_NUMERICO_POR_PAIS[paisesMapaSelecionado];
  if (!iso) return;
  const el = wrap.querySelector(`.mapa-country[data-iso="${iso}"]`);
  if (el) { el.classList.add('selected'); el.parentNode.appendChild(el); }
}

function selecionarPaisNoMapa(id) {
  paisesMapaSelecionado = id;
  aplicarSelecaoMapa();
  goSub('paisesLista');
  abrirPaisDetalhe(id);
}

async function renderPaisesMapa() {
  const wrap = document.getElementById('paisesMapaSvgWrap'); if (!wrap) return;
  const q = (document.getElementById('paisesMapaSearch')?.value || '').trim().toLowerCase();
  const pins = mapaMundiPinsHtml(q);

  wrap.innerHTML = `${mapaMundiSvgCache || '<div class="map-grid-lines"></div>'}<div class="map-vignette"></div>${pins}`;
  aplicarSelecaoMapa();

  if (!mapaMundiSvgCache) {
    const svg = await construirMapaMundiSvg();
    if (!svg) return;
    const wrapAinda = document.getElementById('paisesMapaSvgWrap');
    if (!wrapAinda) return;
    const qAgora = (document.getElementById('paisesMapaSearch')?.value || '').trim().toLowerCase();
    wrapAinda.innerHTML = `${svg}<div class="map-vignette"></div>${mapaMundiPinsHtml(qAgora)}`;
    aplicarSelecaoMapa();
  }
}

function renderPaisesModule() {
  renderPaisesFiltros();
  renderPaisesFiltrosAvancados();
  atualizarLabelOrdenacao();
  renderPaises();
  renderPaisesMapa();
}
window.initPaisesTab = function () {
    renderPaisesModule();
};
