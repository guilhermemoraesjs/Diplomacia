/* ==========================================================================
   paises.js — módulo "Países": explorador de países com página individual,
   filtros avançados, busca inteligente, favoritos e comparador.

   Fonte dos dados objetivos (bandeira, capital, população, área, idiomas,
   moedas, fronteiras): API pública REST Countries (https://restcountries.com),
   buscada uma vez e cacheada em localStorage por 7 dias (chave não sincronizada
   com a nuvem — é só um cache regenerável).

   Dados que nenhuma API gratuita cobre (sistema político, organizações,
   política, relações internacionais, história, atualidades, questões e
   flashcards por país) são editáveis pelo usuário e ficam em
   'paises_dados_extra', sincronizado com a nuvem como o resto do app.
   ========================================================================== */

let paisesCache = load('paises_cache_v1', null);       // { fetchedAt, list }
let paisesFavoritos = load('paises_favoritos', []);
let paisesDadosExtra = load('paises_dados_extra', {});
let paisesApenasFavoritos = false;
let paisesFiltroContinenteAtual = 'todos';

let paisAtual = null;
let paisAtualTab = 'geral';
let paisFlashIndex = 0;
let paisFlashFlipped = false;
let paisSaveTimer = null;

const ORG_LABELS = {
  onu: 'ONU', g20: 'G20', otan: 'OTAN', ocde: 'OCDE', unesco: 'UNESCO',
  mercosul: 'Mercosul', ue: 'União Europeia', uniaoAfricana: 'União Africana',
  ligaArabe: 'Liga Árabe', commonwealth: 'Commonwealth', brics: 'BRICS'
};
const PAIS_TABS = [
  ['geral', 'Geral'], ['economia', 'Economia'], ['politica', 'Política'],
  ['relacoes', 'Relações Internacionais'], ['historia', 'História'],
  ['geografia', 'Geografia'], ['organizacoes', 'Organizações'],
  ['atualidades', 'Atualidades'], ['questoes', 'Questões'], ['flashcards', 'Flashcards']
];

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
function getPais(cca3) { return paisesCache ? paisesCache.list.find(p => p.cca3 === cca3) : null; }
function getPaisExtra(cca3) { return paisesDadosExtra[cca3] || {}; }

/* ---- Carregamento inicial (cache local de até 7 dias, senão busca na API) ---- */
async function initPaises() {
  const status = document.getElementById('paisesStatus'); if (!status) return;
  const cacheAge = paisesCache ? (Date.now() - paisesCache.fetchedAt) : Infinity;
  if (paisesCache && cacheAge < 7 * 24 * 60 * 60 * 1000) {
    renderPaisesFiltros(); renderPaisesGrid();
    status.textContent = `${paisesCache.list.length} países carregados`;
    return;
  }
  status.textContent = 'Carregando dados dos países...';
  try {
    const resp = await fetch('https://restcountries.com/v3.1/all?fields=name,cca3,capital,region,subregion,population,area,flags,languages,currencies,timezones,maps,borders');
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
  if (paisAtual === cca3) renderPaisHero();
}

/* ---- Página individual do país ---- */
function abrirPais(cca3) {
  paisAtual = cca3; paisAtualTab = 'geral'; paisFlashIndex = 0; paisFlashFlipped = false;
  document.getElementById('paisesListShell').style.display = 'none';
  document.getElementById('paisesCompareShell').style.display = 'none';
  document.getElementById('paisesDetailShell').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderPaisHero(); renderPaisTabs(); renderPaisTabContent();
}
function fecharPaisDetalhe() {
  paisAtual = null;
  document.getElementById('paisesDetailShell').style.display = 'none';
  document.getElementById('paisesListShell').style.display = 'block';
}
function renderPaisHero() {
  const p = getPais(paisAtual); const el = document.getElementById('paisHero'); if (!el || !p) return;
  const isFav = paisesFavoritos.includes(p.cca3);
  el.innerHTML = `
    <img class="pais-hero-flag" src="${(p.flags && (p.flags.svg || p.flags.png)) || ''}" alt="Bandeira de ${escapeHtml(p.name.common)}">
    <div class="pais-hero-info">
      <div class="pais-hero-top">
        <h2>${escapeHtml(p.name.common)}</h2>
        <button class="btn ${isFav ? 'secondary' : 'ghost'} small" onclick="togglePaisFavorito('${p.cca3}')">${isFav ? '★ Favorito' : '☆ Favoritar'}</button>
      </div>
      <div class="pais-hero-oficial">${escapeHtml(p.name.official)}</div>
      <div class="pais-hero-tags">
        <span class="tag-chip">${p.region || '—'}</span>
        <span class="tag-chip">Capital: ${(p.capital && p.capital[0]) || '—'}</span>
        <span class="tag-chip">${(p.population || 0).toLocaleString('pt-BR')} hab.</span>
      </div>
    </div>`;
}
function renderPaisTabs() {
  const el = document.getElementById('paisTabs'); if (!el) return;
  el.innerHTML = PAIS_TABS.map(([k, label]) => `<button class="subtab-btn ${paisAtualTab === k ? 'active' : ''}" onclick="goPaisTab('${k}')">${label}</button>`).join('');
}
function goPaisTab(tab) {
  paisAtualTab = tab; paisFlashIndex = 0; paisFlashFlipped = false;
  renderPaisTabs(); renderPaisTabContent();
}
function renderPaisTabContent() {
  const p = getPais(paisAtual); const el = document.getElementById('paisTabContent'); if (!el || !p) return;
  const extra = getPaisExtra(paisAtual);
  const renderers = {
    geral: tabGeral, economia: tabEconomia, politica: tabPolitica, relacoes: tabRelacoes,
    historia: tabHistoria, geografia: tabGeografia, organizacoes: tabOrganizacoes,
    atualidades: tabAtualidades, questoes: tabQuestoes, flashcards: tabFlashcards
  };
  el.innerHTML = (renderers[paisAtualTab] || tabGeral)(p, extra);
}

/* ---- Campos editáveis (texto livre, salvos com debounce) ---- */
function editableTextareaBlock(field, value, placeholder) {
  return `<div class="card">
    <textarea id="paisField_${field}" placeholder="${escapeHtml(placeholder)}" style="min-height:200px;" oninput="savePaisField('${field}', this.value)">${value ? escapeHtml(value) : ''}</textarea>
    <div class="mono" style="font-size:10px; color:var(--text-muted); margin-top:8px;">Salvo automaticamente e sincronizado com sua conta.</div>
  </div>`;
}
function savePaisField(field, value) {
  if (!paisAtual) return;
  if (!paisesDadosExtra[paisAtual]) paisesDadosExtra[paisAtual] = {};
  paisesDadosExtra[paisAtual][field] = value;
  clearTimeout(paisSaveTimer);
  paisSaveTimer = setTimeout(() => save('paises_dados_extra', paisesDadosExtra), 700);
}

/* ---- Aba: Geral ---- */
function tabGeral(p, extra) {
  const idiomas = Object.values(p.languages || {}).join(', ') || '—';
  const moedas = Object.entries(p.currencies || {}).map(([c, v]) => `${v.name} (${v.symbol || c})`).join(', ') || '—';
  const fusos = (p.timezones || []).join(', ') || '—';
  return `<div class="card">
    <div class="pais-grid-info">
      <div><label class="field-label">Capital</label><div>${(p.capital && p.capital[0]) || '—'}</div></div>
      <div><label class="field-label">População</label><div>${(p.population || 0).toLocaleString('pt-BR')}</div></div>
      <div><label class="field-label">Área</label><div>${(p.area || 0).toLocaleString('pt-BR')} km²</div></div>
      <div><label class="field-label">Idioma(s)</label><div>${idiomas}</div></div>
      <div><label class="field-label">Moeda(s)</label><div>${moedas}</div></div>
      <div><label class="field-label">Fuso horário</label><div>${fusos}</div></div>
    </div>
    ${p.maps && p.maps.googleMaps ? `<div style="margin-top:14px;"><a class="btn ghost small" href="${p.maps.googleMaps}" target="_blank" rel="noopener">Ver no mapa ↗</a></div>` : ''}
  </div>`;
}

/* ---- Aba: Economia ---- */
function tabEconomia(p, extra) {
  return editableTextareaBlock('economiaObs', extra.economiaObs, 'PIB, blocos econômicos, principais setores, câmbio, parceiros comerciais...');
}

/* ---- Aba: Política ---- */
function tabPolitica(p, extra) {
  return `<div class="card">
    <label class="field-label">Sistema político</label>
    <input type="text" id="paisSistemaPolitico" value="${extra.sistemaPolitico ? escapeHtml(extra.sistemaPolitico) : ''}" placeholder="Ex.: República Presidencialista Federativa" oninput="savePaisSistemaPolitico(this.value)">
  </div>
  ${editableTextareaBlock('politica', extra.politica, 'Chefe de Estado, chefe de governo, poderes, partidos, características do sistema...')}`;
}
function savePaisSistemaPolitico(value) {
  if (!paisAtual) return;
  if (!paisesDadosExtra[paisAtual]) paisesDadosExtra[paisAtual] = {};
  paisesDadosExtra[paisAtual].sistemaPolitico = value;
  clearTimeout(paisSaveTimer);
  paisSaveTimer = setTimeout(() => { save('paises_dados_extra', paisesDadosExtra); renderPaisesFiltros(); }, 700);
}

/* ---- Aba: Relações Internacionais / História ---- */
function tabRelacoes(p, extra) { return editableTextareaBlock('relacoes', extra.relacoes, 'Relações bilaterais relevantes, participação em fóruns, posições em política externa...'); }
function tabHistoria(p, extra) { return editableTextareaBlock('historia', extra.historia, 'Formação do Estado, eventos históricos marcantes, contexto atual...'); }

/* ---- Aba: Geografia ---- */
function tabGeografia(p, extra) {
  const fronteiras = (p.borders || []).map(b => { const bp = getPais(b); return bp ? bp.name.common : b; }).join(', ') || 'Nenhuma (país insular ou isolado)';
  return `<div class="card">
    <div class="pais-grid-info">
      <div><label class="field-label">Região</label><div>${p.region || '—'}</div></div>
      <div><label class="field-label">Sub-região</label><div>${p.subregion || '—'}</div></div>
      <div><label class="field-label">Área</label><div>${(p.area || 0).toLocaleString('pt-BR')} km²</div></div>
      <div><label class="field-label">Fronteiras terrestres</label><div>${fronteiras}</div></div>
    </div>
  </div>
  ${editableTextareaBlock('geografiaObs', extra.geografiaObs, 'Relevo, clima, hidrografia, biomas, recursos naturais...')}`;
}

/* ---- Aba: Organizações ---- */
function tabOrganizacoes(p, extra) {
  const org = extra.organizacoes || {};
  return `<div class="card">
    <label class="field-label">Organizações das quais o país é membro</label>
    <div class="filters">
      ${Object.entries(ORG_LABELS).map(([k, l]) => `<button class="chip ${org[k] ? 'active' : ''}" onclick="togglePaisOrg('${k}')">${l}</button>`).join('')}
    </div>
  </div>
  ${editableTextareaBlock('organizacoesObs', extra.organizacoesObs, 'Outras organizações, blocos regionais, acordos relevantes...')}`;
}
function togglePaisOrg(key) {
  if (!paisAtual) return;
  if (!paisesDadosExtra[paisAtual]) paisesDadosExtra[paisAtual] = {};
  if (!paisesDadosExtra[paisAtual].organizacoes) paisesDadosExtra[paisAtual].organizacoes = {};
  paisesDadosExtra[paisAtual].organizacoes[key] = !paisesDadosExtra[paisAtual].organizacoes[key];
  save('paises_dados_extra', paisesDadosExtra);
  renderPaisTabContent(); renderPaisesFiltros();
}

/* ---- Aba: Atualidades (por país) ---- */
function tabAtualidades(p, extra) {
  const items = extra.atualidades || [];
  return `<div class="card">
    <input type="text" id="paisAtualTitulo" placeholder="Título">
    <textarea id="paisAtualResumo" placeholder="Resumo..." style="margin-top:8px;"></textarea>
    <button class="btn small secondary" onclick="addPaisAtualidade()" style="margin-top:12px;">Guardar</button>
  </div>
  <div>${items.length ? items.map(a => `
    <div class="card">
      <h4>${escapeHtml(a.titulo)}</h4>
      <p>${escapeHtml(a.resumo || '')}</p>
      <button class="rdel" onclick="delPaisAtualidade('${a.id}')">Remover</button>
    </div>`).join('') : '<div class="biblio-empty">Nenhuma atualidade registrada para este país ainda.</div>'}</div>`;
}
function addPaisAtualidade() {
  const tit = document.getElementById('paisAtualTitulo').value.trim(); if (!tit) return;
  if (!paisesDadosExtra[paisAtual]) paisesDadosExtra[paisAtual] = {};
  if (!paisesDadosExtra[paisAtual].atualidades) paisesDadosExtra[paisAtual].atualidades = [];
  paisesDadosExtra[paisAtual].atualidades.unshift({ id: uid(), titulo: tit, resumo: document.getElementById('paisAtualResumo').value, criadoEm: Date.now() });
  save('paises_dados_extra', paisesDadosExtra);
  renderPaisTabContent();
}
function delPaisAtualidade(id) {
  paisesDadosExtra[paisAtual].atualidades = paisesDadosExtra[paisAtual].atualidades.filter(a => a.id !== id);
  save('paises_dados_extra', paisesDadosExtra);
  renderPaisTabContent();
}

/* ---- Aba: Questões (por país) ---- */
function tabQuestoes(p, extra) {
  const items = extra.questoes || [];
  return `<div class="card">
    <textarea id="paisQPergunta" placeholder="Pergunta..."></textarea>
    <textarea id="paisQResposta" placeholder="Resposta / gabarito..." style="margin-top:8px;"></textarea>
    <button class="btn small secondary" onclick="addPaisQuestao()" style="margin-top:12px;">Guardar questão</button>
  </div>
  <div>${items.length ? items.map(q => `
    <div class="card questao">
      <div class="qtxt">${escapeHtml(q.pergunta)}</div>
      <details><summary style="cursor:pointer; color:var(--azul-light); font-size:12.5px;">Ver resposta</summary><div class="qgab" style="margin-top:6px;">${escapeHtml(q.resposta || '')}</div></details>
      <div class="qactions"><button class="rdel" onclick="delPaisQuestao('${q.id}')">Remover</button></div>
    </div>`).join('') : '<div class="biblio-empty">Nenhuma questão cadastrada para este país ainda.</div>'}</div>`;
}
function addPaisQuestao() {
  const perg = document.getElementById('paisQPergunta').value.trim(); if (!perg) return;
  if (!paisesDadosExtra[paisAtual]) paisesDadosExtra[paisAtual] = {};
  if (!paisesDadosExtra[paisAtual].questoes) paisesDadosExtra[paisAtual].questoes = [];
  paisesDadosExtra[paisAtual].questoes.unshift({ id: uid(), pergunta: perg, resposta: document.getElementById('paisQResposta').value });
  save('paises_dados_extra', paisesDadosExtra);
  renderPaisTabContent();
}
function delPaisQuestao(id) {
  paisesDadosExtra[paisAtual].questoes = paisesDadosExtra[paisAtual].questoes.filter(q => q.id !== id);
  save('paises_dados_extra', paisesDadosExtra);
  renderPaisTabContent();
}

/* ---- Aba: Flashcards (por país) ---- */
function tabFlashcards(p, extra) {
  const items = extra.flashcards || [];
  let practice;
  if (items.length) {
    const idx = Math.min(paisFlashIndex, items.length - 1);
    const card = items[idx];
    practice = `<div class="card" style="text-align:center; cursor:pointer;" onclick="flipPaisFlash()">
      <div class="mono" style="font-size:10.5px; color:var(--text-muted); margin-bottom:10px;">${idx + 1} / ${items.length} · clique para virar</div>
      <div style="font-family:'Inter'; font-size:16px; font-weight:600; min-height:60px; display:flex; align-items:center; justify-content:center;">${escapeHtml(paisFlashFlipped ? card.verso : card.frente)}</div>
    </div>
    <div style="display:flex; gap:8px; justify-content:center; margin-top:10px; flex-wrap:wrap;">
      <button class="btn ghost small" onclick="event.stopPropagation(); prevPaisFlash()">← Anterior</button>
      <button class="btn ghost small" onclick="event.stopPropagation(); delPaisFlash('${card.id}')">🗑️ Remover</button>
      <button class="btn ghost small" onclick="event.stopPropagation(); nextPaisFlash()">Próximo →</button>
    </div>`;
  } else practice = '<div class="biblio-empty">Nenhum flashcard cadastrado para este país ainda.</div>';

  return `<div class="card">
    <input type="text" id="paisFlashFrente" placeholder="Frente (pergunta/termo)">
    <input type="text" id="paisFlashVerso" placeholder="Verso (resposta/definição)" style="margin-top:8px;">
    <button class="btn small secondary" onclick="addPaisFlash()" style="margin-top:12px;">Adicionar flashcard</button>
  </div>
  ${practice}`;
}
function addPaisFlash() {
  const f = document.getElementById('paisFlashFrente').value.trim();
  const v = document.getElementById('paisFlashVerso').value.trim();
  if (!f || !v) return;
  if (!paisesDadosExtra[paisAtual]) paisesDadosExtra[paisAtual] = {};
  if (!paisesDadosExtra[paisAtual].flashcards) paisesDadosExtra[paisAtual].flashcards = [];
  paisesDadosExtra[paisAtual].flashcards.push({ id: uid(), frente: f, verso: v });
  save('paises_dados_extra', paisesDadosExtra);
  paisFlashIndex = paisesDadosExtra[paisAtual].flashcards.length - 1; paisFlashFlipped = false;
  renderPaisTabContent();
}
function flipPaisFlash() { paisFlashFlipped = !paisFlashFlipped; renderPaisTabContent(); }
function nextPaisFlash() { const items = getPaisExtra(paisAtual).flashcards || []; if (!items.length) return; paisFlashIndex = (paisFlashIndex + 1) % items.length; paisFlashFlipped = false; renderPaisTabContent(); }
function prevPaisFlash() { const items = getPaisExtra(paisAtual).flashcards || []; if (!items.length) return; paisFlashIndex = (paisFlashIndex - 1 + items.length) % items.length; paisFlashFlipped = false; renderPaisTabContent(); }
function delPaisFlash(id) {
  paisesDadosExtra[paisAtual].flashcards = paisesDadosExtra[paisAtual].flashcards.filter(c => c.id !== id);
  paisFlashIndex = 0; paisFlashFlipped = false;
  save('paises_dados_extra', paisesDadosExtra);
  renderPaisTabContent();
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
    ['População', (a.population || 0).toLocaleString('pt-BR'), (b.population || 0).toLocaleString('pt-BR')],
    ['Área', (a.area || 0).toLocaleString('pt-BR') + ' km²', (b.area || 0).toLocaleString('pt-BR') + ' km²'],
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
})();
