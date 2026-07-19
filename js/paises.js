/* ==========================================================================
   paises.js — módulo "Países": Dossiê Diplomático.

   Cada país tem uma página própria (não modal) com:
   - Hero panorâmico (fundo com a bandeira desfocada + gradiente), favoritar
     e compartilhar (link direto via #pais/{cca3}).
   - Navegação por abas, fixa durante a navegação: Geral, Economia, Política,
     Geografia, História, Relações Internacionais, Organizações.
     (Atualidades, Questões e Flashcards ficam de fora por enquanto — os
     campos de dados já existem em paisesDadosExtra, só falta a UI, quando
     os módulos que alimentam essas abas existirem.)
   - "Centro de Estudos": coluna lateral fixa com favoritar, contadores
     (questões, flashcards, organizações, tratados, atualidades) e
     progresso de estudo — tudo lido dos dados reais já cadastrados,
     nunca inventado.

   Fonte dos dados objetivos (bandeira, capital, população, área, idiomas,
   moedas, fronteiras, DDI, domínio): API pública REST Countries, buscada
   uma vez e cacheada em localStorage por 7 dias (chave não sincronizada
   com a nuvem — é só um cache regenerável).

   Dados que nenhuma API gratuita cobre (economia, política, geografia
   textual, história, relações internacionais, organizações) são
   editáveis pelo usuário e ficam em 'paises_dados_extra', sincronizado
   com a nuvem como o resto do app. Quando o campo ainda não foi
   preenchido, a interface mostra um estado vazio elegante — nunca um
   dado inventado.
   ========================================================================== */

let paisesCache = load('paises_cache_v1', null);       // { fetchedAt, list }
let paisesFavoritos = load('paises_favoritos', []);
let paisesDadosExtra = load('paises_dados_extra', {});
let paisesApenasFavoritos = false;
let paisesFiltroContinenteAtual = 'todos';

let paisAtual = null;
let paisAtualTab = 'geral';
let paisSaveTimer = null;

const ORG_LABELS = {
  onu: 'ONU', omc: 'OMC', fmi: 'FMI', bancoMundial: 'Banco Mundial',
  g20: 'G20', brics: 'BRICS', mercosul: 'Mercosul', otan: 'OTAN',
  ocde: 'OCDE', unesco: 'UNESCO', ue: 'União Europeia',
  uniaoAfricana: 'União Africana', ligaArabe: 'Liga Árabe', commonwealth: 'Commonwealth'
};

/* Abas visíveis agora. Atualidades/Questões/Flashcards ainda não têm aba —
   os campos de dados (questoes[], flashcards[], atualidades[], tratados[])
   já existem em paisesDadosExtra e alimentam os contadores do Centro de
   Estudos, prontos para quando a UI dessas abas for construída. */
const PAIS_TABS = [
  ['geral', 'Geral'], ['economia', 'Economia'], ['politica', 'Política'],
  ['geografia', 'Geografia'], ['historia', 'História'],
  ['relacoes', 'Relações Internacionais'], ['organizacoes', 'Organizações']
];

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
function getPais(cca3) { return paisesCache ? paisesCache.list.find(p => p.cca3 === cca3) : null; }
function getPaisExtra(cca3) { return paisesDadosExtra[cca3] || {}; }
function fmtNum(n) { return (n || n === 0) ? Number(n).toLocaleString('pt-BR') : null; }

/* ==========================================================================
   COMPONENTES REUTILIZÁVEIS
   ========================================================================== */
function uiEmptyState(msg) {
  return `<div class="pais-empty-state">
    <span class="pais-empty-ic">◌</span>
    <span>${escapeHtml(msg || 'Informação ainda não cadastrada')}</span>
  </div>`;
}
function uiInfoCard(label, value) {
  return `<div class="pais-info-card">
    <span class="field-label">${escapeHtml(label)}</span>
    ${value ? `<div class="pais-info-value">${value}</div>` : uiEmptyState()}
  </div>`;
}
function uiInfoGrid(pares) { return `<div class="pais-grid-info">${pares.map(([l, v]) => uiInfoCard(l, v)).join('')}</div>`; }
function uiSectionCard(title, bodyHtml) {
  return `<div class="card pais-section-card">${title ? `<h4 class="pais-section-title">${escapeHtml(title)}</h4>` : ''}${bodyHtml}</div>`;
}
/* Campo de texto editável (uma linha), salvo em paisesDadosExtra[cca3][field] */
function uiEditableField(label, field, value, placeholder) {
  return `<div class="pais-info-card">
    <span class="field-label">${escapeHtml(label)}</span>
    <input type="text" class="pais-inline-input" value="${value ? escapeHtml(value) : ''}" placeholder="${escapeHtml(placeholder || 'Informação ainda não cadastrada — clique para adicionar')}" oninput="savePaisField('${field}', this.value)">
  </div>`;
}
function uiEditableTextarea(field, value, placeholder) {
  return `<textarea id="paisField_${field}" placeholder="${escapeHtml(placeholder)}" style="min-height:110px;" oninput="savePaisField('${field}', this.value)">${value ? escapeHtml(value) : ''}</textarea>
  <div class="mono" style="font-size:10px; color:var(--text-muted); margin-top:6px;">Salvo automaticamente e sincronizado com sua conta.</div>`;
}
function savePaisField(field, value) {
  if (!paisAtual) return;
  if (!paisesDadosExtra[paisAtual]) paisesDadosExtra[paisAtual] = {};
  paisesDadosExtra[paisAtual][field] = value;
  clearTimeout(paisSaveTimer);
  paisSaveTimer = setTimeout(() => save('paises_dados_extra', paisesDadosExtra), 700);
}

/* ---- Carregamento inicial (cache local de até 7 dias, senão busca na API) ---- */
async function initPaises() {
  const status = document.getElementById('paisesStatus'); if (!status) return;
  const cacheAge = paisesCache ? (Date.now() - paisesCache.fetchedAt) : Infinity;
  if (paisesCache && cacheAge < 7 * 24 * 60 * 60 * 1000) {
    renderPaisesFiltros(); renderPaisesGrid();
    status.textContent = `${paisesCache.list.length} países carregados`;
    aplicarRotaInicialPaises();
    return;
  }
  status.textContent = 'Carregando dados dos países...';
  try {
    const resp = await fetch('https://restcountries.com/v3.1/all?fields=name,cca3,capital,region,subregion,population,area,flags,languages,currencies,timezones,maps,borders,idd,tld');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    paisesCache = { fetchedAt: Date.now(), list: data };
    save('paises_cache_v1', paisesCache);
    renderPaisesFiltros(); renderPaisesGrid();
    status.textContent = `${data.length} países carregados`;
  } catch (e) {
    console.error('Falha ao carregar países:', e);
    if (paisesCache) {
      renderPaisesFiltros(); renderPaisesGrid();
      status.textContent = `${paisesCache.list.length} países (cache offline — falha ao atualizar)`;
    } else {
      status.textContent = 'Não foi possível carregar a lista de países. Verifique sua conexão e recarregue a página.';
    }
  }
  aplicarRotaInicialPaises();
}
/* Permite abrir um país direto por link compartilhado (#pais/BRA). */
function aplicarRotaInicialPaises() {
  const m = location.hash.match(/^#pais\/([A-Z]{3})$/);
  if (m && getPais(m[1])) abrirPais(m[1], false);
}

/* ---- Filtros e grid da lista ---- */
function renderPaisesFiltros() {
  if (!paisesCache) return;
  const continentes = [...new Set(paisesCache.list.map(p => p.region).filter(Boolean))].sort();
  const elC = document.getElementById('paisesFiltroContinente');
  if (elC) elC.innerHTML = ['todos', ...continentes].map(c =>
    `<button class="chip ${paisesFiltroContinenteAtual === c ? 'active' : ''}" onclick="setPaisesFiltroContinente('${c}')">${c === 'todos' ? 'Todos os continentes' : c}</button>`
  ).join('');

  const idiomas = new Set(); paisesCache.list.forEach(p => Object.values(p.languages || {}).forEach(l => idiomas.add(l)));
  const selI = document.getElementById('paisesFiltroIdioma');
  if (selI) { const cur = selI.value; selI.innerHTML = '<option value="">Idioma — todos</option>' + [...idiomas].sort().map(l => `<option value="${l}">${l}</option>`).join(''); selI.value = cur; }

  const moedas = new Map(); paisesCache.list.forEach(p => Object.entries(p.currencies || {}).forEach(([code, c]) => moedas.set(code, code + ' — ' + c.name)));
  const selM = document.getElementById('paisesFiltroMoeda');
  if (selM) { const cur = selM.value; selM.innerHTML = '<option value="">Moeda — todas</option>' + [...moedas.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([code, label]) => `<option value="${code}">${label}</option>`).join(''); selM.value = cur; }

  const selO = document.getElementById('paisesFiltroOrganizacao');
  if (selO) { const cur = selO.value; selO.innerHTML = '<option value="">Organização — todas</option>' + Object.entries(ORG_LABELS).map(([k, l]) => `<option value="${k}">${l}</option>`).join(''); selO.value = cur; }

  const sistemas = new Set(Object.values(paisesDadosExtra).map(d => d.sistemaPolitico).filter(Boolean));
  const selS = document.getElementById('paisesFiltroSistema');
  if (selS) { const cur = selS.value; selS.innerHTML = '<option value="">Sistema político — todos</option>' + [...sistemas].sort().map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join(''); selS.value = cur; }
}
function setPaisesFiltroContinente(c) { paisesFiltroContinenteAtual = c; renderPaisesFiltros(); renderPaisesGrid(); }
function togglePaisesSoFavoritos() {
  paisesApenasFavoritos = !paisesApenasFavoritos;
  const btn = document.getElementById('paisesFavBtn'); if (btn) btn.classList.toggle('active', paisesApenasFavoritos);
  renderPaisesGrid();
}

function renderPaisesGrid() {
  const el = document.getElementById('paisesGrid'); if (!el || !paisesCache) return;
  const q = (document.getElementById('paisesSearch').value || '').trim().toLowerCase();
  const idiomaF = document.getElementById('paisesFiltroIdioma').value;
  const moedaF = document.getElementById('paisesFiltroMoeda').value;
  const orgF = document.getElementById('paisesFiltroOrganizacao').value;
  const sisF = document.getElementById('paisesFiltroSistema').value;

  let list = paisesCache.list.filter(p => {
    if (paisesFiltroContinenteAtual !== 'todos' && p.region !== paisesFiltroContinenteAtual) return false;
    if (idiomaF && !Object.values(p.languages || {}).includes(idiomaF)) return false;
    if (moedaF && !Object.keys(p.currencies || {}).includes(moedaF)) return false;
    const extra = getPaisExtra(p.cca3);
    if (orgF && !(extra.organizacoes && extra.organizacoes[orgF])) return false;
    if (sisF && extra.sistemaPolitico !== sisF) return false;
    if (paisesApenasFavoritos && !paisesFavoritos.includes(p.cca3)) return false;
    if (q) {
      const hay = [
        p.name.common, p.name.official, ...(p.capital || []),
        ...Object.values(p.languages || {}),
        ...Object.entries(p.currencies || {}).map(([code, c]) => code + ' ' + c.name),
        p.region, p.subregion
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => a.name.common.localeCompare(b.name.common));

  if (!list.length) { el.innerHTML = '<div class="biblio-empty">Nenhum país encontrado para esse filtro.</div>'; return; }

  el.innerHTML = list.map(p => `
    <div class="pais-card" onclick="abrirPais('${p.cca3}')">
      <button class="pais-fav-btn ${paisesFavoritos.includes(p.cca3) ? 'active' : ''}" onclick="event.stopPropagation(); togglePaisFavorito('${p.cca3}')" title="Favoritar">★</button>
      <img class="pais-flag-thumb" src="${(p.flags && (p.flags.svg || p.flags.png)) || ''}" alt="Bandeira de ${escapeHtml(p.name.common)}" loading="lazy">
      <div class="pais-card-body">
        <div class="pais-card-nome">${escapeHtml(p.name.common)}</div>
        <div class="pais-card-meta">${(p.capital && p.capital[0]) || '—'} · ${p.region || '—'}</div>
      </div>
    </div>
  `).join('');
}
function togglePaisFavorito(cca3) {
  if (paisesFavoritos.includes(cca3)) paisesFavoritos = paisesFavoritos.filter(x => x !== cca3);
  else paisesFavoritos.push(cca3);
  save('paises_favoritos', paisesFavoritos);
  renderPaisesGrid();
  if (paisAtual === cca3) { renderPaisHero(); renderPaisStudySidebar(); }
}

/* ==========================================================================
   PÁGINA DO PAÍS — Dossiê Diplomático
   ========================================================================== */
function abrirPais(cca3, atualizarHash) {
  paisAtual = cca3; paisAtualTab = 'geral';
  document.getElementById('paisesListShell').style.display = 'none';
  document.getElementById('paisesCompareShell').style.display = 'none';
  document.getElementById('paisesDetailShell').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (atualizarHash !== false) location.hash = 'pais/' + cca3;
  renderPaisHero(); renderPaisTabs(); renderPaisTabContent(); renderPaisStudySidebar();
}
function fecharPaisDetalhe() {
  paisAtual = null;
  document.getElementById('paisesDetailShell').style.display = 'none';
  document.getElementById('paisesListShell').style.display = 'block';
  if (location.hash.startsWith('#pais/')) history.pushState('', document.title, location.pathname + location.search);
}

/* ---- Hero panorâmico ---- */
function renderPaisHero() {
  const p = getPais(paisAtual); const el = document.getElementById('paisHero'); if (!el || !p) return;
  const isFav = paisesFavoritos.includes(p.cca3);
  const bandeira = (p.flags && (p.flags.svg || p.flags.png)) || '';
  const idiomaPrincipal = Object.values(p.languages || {})[0] || '—';
  const moedaPrincipal = Object.values(p.currencies || {})[0];
  el.innerHTML = `
    <div class="pais-hero-bg" style="background-image:url('${bandeira}')"></div>
    <div class="pais-hero-gradient"></div>
    <div class="pais-hero-content">
      <img class="pais-hero-flag" src="${bandeira}" alt="Bandeira de ${escapeHtml(p.name.common)}">
      <div class="pais-hero-info">
        <div class="pais-hero-top">
          <div>
            <h2>${escapeHtml(p.name.common)}</h2>
            <div class="pais-hero-oficial">${escapeHtml(p.name.official)}</div>
          </div>
          <div class="pais-hero-actions">
            <button class="btn ${isFav ? 'secondary' : 'ghost'} small" onclick="togglePaisFavorito('${p.cca3}')">${isFav ? '★ Favorito' : '☆ Favoritar'}</button>
            <button class="btn ghost small" onclick="compartilharPais('${p.cca3}')">⤴ Compartilhar</button>
          </div>
        </div>
        <div class="pais-hero-tags">
          <span class="tag-chip">Capital: ${(p.capital && p.capital[0]) || '—'}</span>
          <span class="tag-chip">${p.region || '—'}${p.subregion ? ' · ' + p.subregion : ''}</span>
          <span class="tag-chip">Idioma: ${idiomaPrincipal}</span>
          <span class="tag-chip">Moeda: ${moedaPrincipal ? moedaPrincipal.name : '—'}</span>
        </div>
      </div>
    </div>`;
}
function compartilharPais(cca3) {
  const p = getPais(cca3); if (!p) return;
  const url = location.origin + location.pathname + '#pais/' + cca3;
  const texto = `${p.name.common} — Dossiê Diplomático (Chancelaria)`;
  if (navigator.share) {
    navigator.share({ title: texto, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => alert('Link copiado: ' + url)).catch(() => prompt('Copie o link:', url));
  } else {
    prompt('Copie o link:', url);
  }
}

/* ---- Navegação por abas (fixa durante a navegação) ---- */
function renderPaisTabs() {
  const el = document.getElementById('paisTabs'); if (!el) return;
  el.innerHTML = PAIS_TABS.map(([k, label]) => `<button class="subtab-btn ${paisAtualTab === k ? 'active' : ''}" onclick="goPaisTab('${k}')">${label}</button>`).join('');
}
function goPaisTab(tab) { paisAtualTab = tab; renderPaisTabs(); renderPaisTabContent(); }
function renderPaisTabContent() {
  const p = getPais(paisAtual); const el = document.getElementById('paisTabContent'); if (!el || !p) return;
  const extra = getPaisExtra(paisAtual);
  const renderers = {
    geral: tabGeral, economia: tabEconomia, politica: tabPolitica,
    geografia: tabGeografia, historia: tabHistoria, relacoes: tabRelacoes,
    organizacoes: tabOrganizacoes
  };
  el.innerHTML = (renderers[paisAtualTab] || tabGeral)(p, extra);
}

/* ---- Aba: Geral ---- */
function tabGeral(p, extra) {
  const idiomas = Object.values(p.languages || {}).join(', ') || null;
  const moedas = Object.entries(p.currencies || {}).map(([c, v]) => `${v.name} (${v.symbol || c})`).join(', ') || null;
  const fusos = (p.timezones || []).join(', ') || null;
  const densidade = (p.population && p.area) ? `${Math.round(p.population / p.area).toLocaleString('pt-BR')} hab./km²` : null;
  const ddi = (p.idd && p.idd.root) ? (p.idd.root + (p.idd.suffixes && p.idd.suffixes.length === 1 ? p.idd.suffixes[0] : '')) : null;
  const dominio = (p.tld || []).join(', ') || null;
  return uiInfoGrid([
    ['Nome oficial', escapeHtml(p.name.official)],
    ['Capital', (p.capital && p.capital[0]) || null],
    ['População', fmtNum(p.population)],
    ['Área', p.area ? fmtNum(p.area) + ' km²' : null],
    ['Densidade demográfica', densidade],
    ['Idiomas', idiomas],
    ['Moeda', moedas],
    ['Fuso horário', fusos],
    ['Código telefônico', ddi],
    ['Domínio da internet', dominio],
  ]) + (p.maps && p.maps.googleMaps ? `<div style="margin-top:14px;"><a class="btn ghost small" href="${p.maps.googleMaps}" target="_blank" rel="noopener">Ver no mapa ↗</a></div>` : '');
}

/* ---- Aba: Economia ---- */
function tabEconomia(p, extra) {
  const e = extra.economia || {};
  const field = (campo, label, placeholder) => `<div class="pais-info-card">
    <span class="field-label">${escapeHtml(label)}</span>
    <input type="text" class="pais-inline-input" value="${e[campo] ? escapeHtml(e[campo]) : ''}" placeholder="${escapeHtml(placeholder)}" oninput="savePaisEconomia('${campo}', this.value)">
  </div>`;
  return `<div class="pais-grid-info">
      ${field('pib', 'PIB', 'Ex.: US$ 2,1 trilhões (2024)')}
      ${field('pibPerCapita', 'PIB per capita', 'Ex.: US$ 8.900')}
      ${field('crescimento', 'Crescimento', 'Ex.: 2,9% ao ano')}
      ${field('inflacao', 'Inflação', 'Ex.: 4,5% ao ano')}
    </div>`
    + uiSectionCard('Exportações', uiEditableTextarea('economiaExportacoes', extra.economiaExportacoes, 'Principais produtos e destinos de exportação...'))
    + uiSectionCard('Importações', uiEditableTextarea('economiaImportacoes', extra.economiaImportacoes, 'Principais produtos e origens de importação...'))
    + uiSectionCard('Parceiros comerciais e setores econômicos', uiEditableTextarea('economiaParceiros', extra.economiaParceiros, 'Principais parceiros comerciais e setores de destaque...'));
}
function savePaisEconomia(campo, value) {
  if (!paisAtual) return;
  if (!paisesDadosExtra[paisAtual]) paisesDadosExtra[paisAtual] = {};
  if (!paisesDadosExtra[paisAtual].economia) paisesDadosExtra[paisAtual].economia = {};
  paisesDadosExtra[paisAtual].economia[campo] = value;
  clearTimeout(paisSaveTimer);
  paisSaveTimer = setTimeout(() => save('paises_dados_extra', paisesDadosExtra), 700);
}

/* ---- Aba: Política ---- */
function tabPolitica(p, extra) {
  return `<div class="pais-grid-info">
    ${uiEditableField('Forma de governo', 'formaGoverno', extra.formaGoverno)}
    ${uiEditableField('Sistema político', 'sistemaPolitico', extra.sistemaPolitico)}
    ${uiEditableField('Chefe de Estado', 'chefeEstado', extra.chefeEstado)}
    ${uiEditableField('Chefe de Governo', 'chefeGoverno', extra.chefeGoverno)}
    ${uiEditableField('Constituição', 'constituicao', extra.constituicao)}
  </div>`;
}

/* ---- Aba: Geografia ---- */
function tabGeografia(p, extra) {
  const fronteiras = (p.borders || []).map(b => { const bp = getPais(b); return bp ? bp.name.common : b; });
  return uiSectionCard('Dados geográficos', uiInfoGrid([
    ['Região', p.region || null], ['Sub-região', p.subregion || null],
    ['Área', p.area ? fmtNum(p.area) + ' km²' : null],
    ['Países vizinhos', fronteiras.length ? fronteiras.map(f => `<span class="tag-chip" style="margin:2px 4px 2px 0;">${escapeHtml(f)}</span>`).join('') : null],
  ]))
    + uiSectionCard('Complementos de estudo', `<div class="pais-grid-info">
      ${uiEditableField('Clima', 'clima', extra.clima)}
      ${uiEditableField('Relevo', 'relevo', extra.relevo)}
      ${uiEditableField('Hidrografia', 'hidrografia', extra.hidrografia)}
      ${uiEditableField('Recursos naturais', 'recursosNaturais', extra.recursosNaturais)}
      ${uiEditableField('Principais cidades', 'principaisCidades', extra.principaisCidades)}
    </div>`);
}

/* ---- Aba: História (linha do tempo vertical) ---- */
function tabHistoria(p, extra) {
  const eventos = (extra.historiaEventos || []).slice().sort((a, b) => (a.ano || '').localeCompare(b.ano || ''));
  const timeline = eventos.length
    ? `<div class="pais-timeline">${eventos.map(ev => `
        <div class="pais-timeline-item">
          <div class="pais-timeline-dot"></div>
          <div class="pais-timeline-body">
            <div class="pais-timeline-ano mono">${escapeHtml(ev.ano || '—')}</div>
            <div class="pais-timeline-evento">${escapeHtml(ev.evento)}</div>
            <button class="rdel" onclick="delPaisEventoHistoria('${ev.id}')">Remover</button>
          </div>
        </div>`).join('')}</div>`
    : uiEmptyState('Nenhum evento histórico cadastrado ainda.');

  return uiSectionCard('Adicionar evento à linha do tempo', `
      <div class="row2">
        <div><label class="field-label">Ano / período</label><input type="text" id="paisHistAno" placeholder="Ex.: 1822"></div>
        <div><label class="field-label">Evento</label><input type="text" id="paisHistEvento" placeholder="Ex.: Independência"></div>
      </div>
      <button class="btn small secondary" onclick="addPaisEventoHistoria()" style="margin-top:12px;">Adicionar à linha do tempo</button>
    `) + timeline;
}
function addPaisEventoHistoria() {
  const ano = document.getElementById('paisHistAno').value.trim();
  const evento = document.getElementById('paisHistEvento').value.trim();
  if (!evento) return;
  if (!paisesDadosExtra[paisAtual]) paisesDadosExtra[paisAtual] = {};
  if (!paisesDadosExtra[paisAtual].historiaEventos) paisesDadosExtra[paisAtual].historiaEventos = [];
  paisesDadosExtra[paisAtual].historiaEventos.push({ id: uid(), ano, evento });
  save('paises_dados_extra', paisesDadosExtra);
  renderPaisTabContent(); renderPaisStudySidebar();
}
function delPaisEventoHistoria(id) {
  paisesDadosExtra[paisAtual].historiaEventos = paisesDadosExtra[paisAtual].historiaEventos.filter(e => e.id !== id);
  save('paises_dados_extra', paisesDadosExtra);
  renderPaisTabContent(); renderPaisStudySidebar();
}

/* ---- Aba: Relações Internacionais ---- */
function tabRelacoes(p, extra) {
  const bloco = (campo, label, placeholder) => uiSectionCard(label, uiEditableTextarea('relacoes_' + campo, extra['relacoes_' + campo], placeholder));
  return bloco('brasil', 'Relação com o Brasil', 'Histórico diplomático, comércio, acordos relevantes...')
    + bloco('eua', 'Relação com os Estados Unidos', 'Histórico diplomático, comércio, acordos relevantes...')
    + bloco('china', 'Relação com a China', 'Histórico diplomático, comércio, acordos relevantes...')
    + bloco('ue', 'Relação com a União Europeia', 'Histórico diplomático, comércio, acordos relevantes...')
    + bloco('vizinhos', 'Relação com países vizinhos', 'Conflitos, integrações regionais, tratados de fronteira...');
}

/* ---- Aba: Organizações ---- */
function tabOrganizacoes(p, extra) {
  const org = extra.organizacoes || {};
  return uiSectionCard('Organizações das quais o país é membro', `
    <div class="filters">
      ${Object.entries(ORG_LABELS).map(([k, l]) => `<button class="chip ${org[k] ? 'active' : ''}" onclick="togglePaisOrg('${k}')">${l}</button>`).join('')}
    </div>
  `) + uiSectionCard('Observações', uiEditableTextarea('organizacoesObs', extra.organizacoesObs, 'Outras organizações, blocos regionais, acordos relevantes...'));
}
function togglePaisOrg(key) {
  if (!paisAtual) return;
  if (!paisesDadosExtra[paisAtual]) paisesDadosExtra[paisAtual] = {};
  if (!paisesDadosExtra[paisAtual].organizacoes) paisesDadosExtra[paisAtual].organizacoes = {};
  paisesDadosExtra[paisAtual].organizacoes[key] = !paisesDadosExtra[paisAtual].organizacoes[key];
  save('paises_dados_extra', paisesDadosExtra);
  renderPaisTabContent(); renderPaisesFiltros(); renderPaisStudySidebar();
}

/* ==========================================================================
   CENTRO DE ESTUDOS — coluna lateral fixa, sempre visível na página do país
   ========================================================================== */
function paisCompletude(extra) {
  const campos = [
    extra.formaGoverno, extra.sistemaPolitico, extra.chefeEstado, extra.chefeGoverno, extra.constituicao,
    extra.clima, extra.relevo, extra.hidrografia, extra.recursosNaturais, extra.principaisCidades,
    extra.relacoes_brasil, extra.relacoes_eua, extra.relacoes_china, extra.relacoes_ue, extra.relacoes_vizinhos,
    (extra.economia && extra.economia.pib), (extra.economia && extra.economia.pibPerCapita)
  ];
  const preenchidos = campos.filter(Boolean).length;
  const temHistoria = extra.historiaEventos && extra.historiaEventos.length ? 1 : 0;
  const total = campos.length + 1;
  return Math.round(100 * (preenchidos + temHistoria) / total);
}
function renderPaisStudySidebar() {
  const el = document.getElementById('paisStudySidebar'); if (!el) return;
  const p = getPais(paisAtual); if (!p) return;
  const extra = getPaisExtra(paisAtual);
  const isFav = paisesFavoritos.includes(p.cca3);
  const qtdOrg = extra.organizacoes ? Object.values(extra.organizacoes).filter(Boolean).length : 0;
  const qtdQuestoes = (extra.questoes || []).length;
  const qtdFlash = (extra.flashcards || []).length;
  const qtdAtualidades = (extra.atualidades || []).length;
  const qtdTratados = (extra.tratados || []).length;
  const pct = paisCompletude(extra);

  const item = (icone, label, valor, onclick) => `
    <div class="pais-study-item" ${onclick ? `onclick="${onclick}" style="cursor:pointer;"` : ''}>
      <span class="pais-study-ic">${icone}</span>
      <span class="pais-study-label">${label}</span>
      <span class="pais-study-value">${valor}</span>
    </div>`;

  el.innerHTML = `
    <div class="card pais-study-card">
      <h4 class="pais-section-title">Centro de Estudos</h4>
      <button class="btn ${isFav ? 'secondary' : 'ghost'} small" style="width:100%; margin-bottom:12px;" onclick="togglePaisFavorito('${p.cca3}')">${isFav ? '★ Favoritado' : '☆ Favoritar país'}</button>
      ${item('📝', 'Minhas anotações', 'em breve')}
      ${item('❓', 'Questões relacionadas', qtdQuestoes)}
      ${item('🧠', 'Flashcards', qtdFlash)}
      ${item('🏛️', 'Organizações', qtdOrg, "goPaisTab('organizacoes')")}
      ${item('📜', 'Tratados relacionados', qtdTratados)}
      ${item('📰', 'Atualidades', qtdAtualidades)}
      <div class="pais-study-progress">
        <div class="pais-study-progress-head"><span>Progresso de estudo</span><span class="mono">${pct}%</span></div>
        <div class="bar"><span style="width:${pct}%;"></span></div>
      </div>
    </div>`;
}

/* ---- Comparador de países ---- */
function abrirComparador() {
  document.getElementById('paisesListShell').style.display = 'none';
  document.getElementById('paisesDetailShell').style.display = 'none';
  document.getElementById('paisesCompareShell').style.display = 'block';
  populateCompareSelects();
  renderComparacao();
}
function fecharComparador() {
  document.getElementById('paisesCompareShell').style.display = 'none';
  document.getElementById('paisesListShell').style.display = 'block';
}
function populateCompareSelects() {
  if (!paisesCache) return;
  const opts = paisesCache.list.slice().sort((a, b) => a.name.common.localeCompare(b.name.common))
    .map(p => `<option value="${p.cca3}">${escapeHtml(p.name.common)}</option>`).join('');
  const a = document.getElementById('compararPaisA'), b = document.getElementById('compararPaisB');
  if (a && !a.dataset.filled) { a.innerHTML = opts; a.dataset.filled = '1'; }
  if (b && !b.dataset.filled) { b.innerHTML = opts; b.dataset.filled = '1'; if (paisesCache.list[1]) b.value = paisesCache.list[1].cca3; }
}
function renderComparacao() {
  const elResult = document.getElementById('comparacaoResult'); if (!elResult || !paisesCache) return;
  const a = getPais(document.getElementById('compararPaisA').value);
  const b = getPais(document.getElementById('compararPaisB').value);
  if (!a || !b) { elResult.innerHTML = ''; return; }
  const ea = getPaisExtra(a.cca3), eb = getPaisExtra(b.cca3);
  const rows = [
    ['Bandeira', `<img class="pais-flag-thumb" src="${(a.flags && a.flags.svg) || ''}">`, `<img class="pais-flag-thumb" src="${(b.flags && b.flags.svg) || ''}">`],
    ['Nome oficial', escapeHtml(a.name.official), escapeHtml(b.name.official)],
    ['Capital', (a.capital && a.capital[0]) || '—', (b.capital && b.capital[0]) || '—'],
    ['Continente', a.region || '—', b.region || '—'],
    ['População', fmtNum(a.population) || '—', fmtNum(b.population) || '—'],
    ['Área', (fmtNum(a.area) || '—') + ' km²', (fmtNum(b.area) || '—') + ' km²'],
    ['Idiomas', Object.values(a.languages || {}).join(', ') || '—', Object.values(b.languages || {}).join(', ') || '—'],
    ['Moeda', Object.values(a.currencies || {}).map(c => c.name).join(', ') || '—', Object.values(b.currencies || {}).map(c => c.name).join(', ') || '—'],
    ['Sistema político', ea.sistemaPolitico ? escapeHtml(ea.sistemaPolitico) : '—', eb.sistemaPolitico ? escapeHtml(eb.sistemaPolitico) : '—'],
  ];
  elResult.innerHTML = `<div class="card" style="overflow-x:auto;">
    <table class="doc-table" style="width:100%;">
      <thead><tr><th></th><th>${escapeHtml(a.name.common)}</th><th>${escapeHtml(b.name.common)}</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td class="mono" style="color:var(--text-muted); font-size:11px; white-space:nowrap;">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
}

/* ---- Boot ---- */
(function bootPaises() {
  if (document.getElementById('paisesGrid')) initPaises();
  window.addEventListener('hashchange', () => {
    const m = location.hash.match(/^#pais\/([A-Z]{3})$/);
    if (m && paisesCache && getPais(m[1])) { abrirPais(m[1], false); }
    else if (!m && paisAtual) { fecharPaisDetalhe(); }
  });
})();
