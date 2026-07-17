/* ==========================================================================
   paises.js — módulo "Países": atlas diplomático de referência para
   Relações Internacionais e CACD. Dados estáticos carregados sob demanda
   de /data/paises/*.json (index.json para a listagem, arquivo individual
   para a página de detalhe). Apenas favoritos são dados do usuário
   (persistidos via save()/load(), sincronizando com a nuvem).
   ========================================================================== */

const PAISES_INDEX_URL = 'data/paises/index.json';
const PAISES_DATA_DIR = 'data/paises/';

let paisesIndex = [];
let paisesIndexCarregado = false;
let paisesCache = {};
let paisesFavoritos = load('paises_favoritos', []);
let paisesFiltro = { busca: '', continente: 'todos', organizacao: 'todas', apenasFavoritos: false };
let paisesAtualId = null;

async function initPaisesTab() {
  if (!paisesIndexCarregado) await carregarPaisesIndex();
  showPaisesPanel('list');
  renderPaisesFiltros();
  renderPaisesList();
}

async function carregarPaisesIndex() {
  const el = document.getElementById('paisesList');
  if (el) el.innerHTML = '<div class="biblio-empty">Carregando países…</div>';
  try {
    const resp = await fetch(PAISES_INDEX_URL);
    paisesIndex = await resp.json();
    paisesIndexCarregado = true;
  } catch (e) {
    console.error('Falha ao carregar índice de países:', e);
    if (el) el.innerHTML = '<div class="biblio-empty">Não foi possível carregar a lista de países.</div>';
  }
}

async function carregarPaisData(id) {
  if (paisesCache[id]) return paisesCache[id];
  const resp = await fetch(PAISES_DATA_DIR + id + '.json');
  const data = await resp.json();
  paisesCache[id] = data;
  return data;
}

function showPaisesPanel(panel) {
  document.getElementById('paisesListView').style.display = panel === 'list' ? 'block' : 'none';
  document.getElementById('paisesDetailView').style.display = panel === 'detail' ? 'block' : 'none';
}

/* ---- Listagem / filtros ---- */
function renderPaisesFiltros() {
  const continentes = [...new Set(paisesIndex.map(p => p.continente))].sort();
  const orgsSet = new Set();
  paisesIndex.forEach(p => (p.organizacoes || []).forEach(o => orgsSet.add(o)));
  const orgs = [...orgsSet].sort();

  const contEl = document.getElementById('paisesFiltroContinente');
  if (contEl) contEl.innerHTML = ['todos', ...continentes].map(c =>
    `<button class="chip ${paisesFiltro.continente === c ? 'active' : ''}" onclick="setPaisesFiltroContinente('${c}')">${c === 'todos' ? 'Todos os continentes' : c}</button>`
  ).join('');

  const orgEl = document.getElementById('paisesFiltroOrganizacao');
  if (orgEl) orgEl.innerHTML = ['todas', ...orgs].map(o =>
    `<button class="chip ${paisesFiltro.organizacao === o ? 'active' : ''}" onclick="setPaisesFiltroOrganizacao('${o}')">${o === 'todas' ? 'Todas as organizações' : o}</button>`
  ).join('');
}
function setPaisesFiltroContinente(c) { paisesFiltro.continente = c; renderPaisesFiltros(); renderPaisesList(); }
function setPaisesFiltroOrganizacao(o) { paisesFiltro.organizacao = o; renderPaisesFiltros(); renderPaisesList(); }
function setPaisesBusca(v) { paisesFiltro.busca = v.trim().toLowerCase(); renderPaisesList(); }
function togglePaisesApenasFavoritos() {
  paisesFiltro.apenasFavoritos = !paisesFiltro.apenasFavoritos;
  const btn = document.getElementById('paisesFavBtn'); if (btn) btn.classList.toggle('active', paisesFiltro.apenasFavoritos);
  renderPaisesList();
}

function paisesFiltrados() {
  const q = paisesFiltro.busca;
  return paisesIndex.filter(p => {
    if (paisesFiltro.continente !== 'todos' && p.continente !== paisesFiltro.continente) return false;
    if (paisesFiltro.organizacao !== 'todas' && !(p.organizacoes || []).includes(paisesFiltro.organizacao)) return false;
    if (paisesFiltro.apenasFavoritos && !paisesFavoritos.includes(p.id)) return false;
    if (!q) return true;
    return p.nomeCurto.toLowerCase().includes(q) ||
      p.nomeOficial.toLowerCase().includes(q) ||
      p.capital.toLowerCase().includes(q) ||
      (p.idiomas || []).some(i => i.toLowerCase().includes(q));
  });
}

function renderPaisesList() {
  const el = document.getElementById('paisesList'); if (!el) return;
  const list = paisesFiltrados();
  if (!list.length) { el.innerHTML = '<div class="biblio-empty">Nenhum país encontrado para esse filtro.</div>'; return; }
  el.innerHTML = list.map(p => `
    <div class="card pais-card" onclick="abrirPais('${p.id}')">
      <div class="pais-card-flag">${p.bandeira}</div>
      <div class="pais-card-body">
        <div class="pais-card-nome">${p.nomeCurto}</div>
        <div class="pais-card-meta mono">${p.capital} · ${p.continente}</div>
        <div class="pais-card-orgs">${(p.organizacoes || []).slice(0, 4).map(o => `<span class="tag-chip">${o}</span>`).join('')}</div>
      </div>
      <button class="pais-fav-btn ${paisesFavoritos.includes(p.id) ? 'active' : ''}" onclick="event.stopPropagation(); togglePaisFavorito('${p.id}')" title="Favoritar">★</button>
    </div>
  `).join('');
}
function togglePaisFavorito(id) {
  paisesFavoritos = paisesFavoritos.includes(id) ? paisesFavoritos.filter(x => x !== id) : [...paisesFavoritos, id];
  save('paises_favoritos', paisesFavoritos);
  renderPaisesList();
  renderPaisFavBtnDetail();
}

/* ---- Página de detalhe ---- */
async function abrirPais(id) {
  paisesAtualId = id;
  const wrap = document.getElementById('paisesDetailContent');
  if (wrap) wrap.innerHTML = '<div class="biblio-empty">Carregando…</div>';
  showPaisesPanel('detail');
  const d = await carregarPaisData(id);
  renderPaisDetail(d);
}
function fecharPais() { paisesAtualId = null; showPaisesPanel('list'); }
function renderPaisFavBtnDetail() {
  const btn = document.getElementById('paisDetailFavBtn'); if (!btn || !paisesAtualId) return;
  btn.classList.toggle('active', paisesFavoritos.includes(paisesAtualId));
}

const PAISES_RELACAO_LABELS = { brasil: 'Relações com o Brasil', eua: 'Relações com os EUA', china: 'Relações com a China', ue: 'Relações com a União Europeia', regional: 'Integração Regional', vizinhos: 'Relações com Vizinhos' };

function renderPaisDetail(d) {
  const wrap = document.getElementById('paisesDetailContent'); if (!wrap) return;
  wrap.innerHTML = `
    <div class="card pais-hero">
      <div class="pais-hero-flag">${d.bandeira}</div>
      <div style="flex:1;">
        <div class="pais-hero-nome">${d.nomeCurto}</div>
        <div class="pais-hero-oficial">${d.nomeOficial}</div>
        <div class="pais-hero-orgs">${(d.organizacoes || []).map(o => `<span class="tag-chip" title="${o.nome}">${o.sigla}</span>`).join('')}</div>
      </div>
      <button id="paisDetailFavBtn" class="pais-fav-btn ${paisesFavoritos.includes(d.id) ? 'active' : ''}" onclick="togglePaisFavorito('${d.id}')" title="Favoritar">★</button>
    </div>

    <div class="card">
      <h3 class="section-title">Informações Gerais</h3>
      <div class="pais-info-grid">
        <div><span class="pais-info-label">Capital</span>${d.capital}</div>
        <div><span class="pais-info-label">População</span>${d.populacao}</div>
        <div><span class="pais-info-label">Área</span>${d.area}</div>
        <div><span class="pais-info-label">Idiomas</span>${(d.idiomas || []).join(', ')}</div>
        <div><span class="pais-info-label">Moeda</span>${d.moeda}</div>
        <div><span class="pais-info-label">Continente</span>${d.continente}</div>
        <div><span class="pais-info-label">Região</span>${d.regiao}</div>
        <div><span class="pais-info-label">Fuso horário</span>${d.fusoHorario}</div>
        <div><span class="pais-info-label">Domínio</span>${d.dominio}</div>
        <div><span class="pais-info-label">Código telefônico</span>${d.codigoTelefonico}</div>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">Governo</h3>
      <div class="pais-info-grid">
        <div><span class="pais-info-label">Sistema político</span>${d.governo.sistema}</div>
        <div><span class="pais-info-label">Chefe de Estado</span>${d.governo.chefeEstado}</div>
        <div><span class="pais-info-label">Chefe de Governo</span>${d.governo.chefeGoverno}</div>
        <div><span class="pais-info-label">Constituição</span>${d.governo.constituicao}</div>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title">Economia</h3>
      <div class="pais-info-grid">
        <div><span class="pais-info-label">PIB nominal</span>${d.economia.pib}</div>
        <div><span class="pais-info-label">PIB (PPC)</span>${d.economia.pibPPC}</div>
        <div><span class="pais-info-label">PIB per capita</span>${d.economia.pibPerCapita}</div>
        <div><span class="pais-info-label">Crescimento</span>${d.economia.crescimento}</div>
        <div><span class="pais-info-label">Inflação</span>${d.economia.inflacao}</div>
        <div><span class="pais-info-label">Desemprego</span>${d.economia.desemprego}</div>
        <div><span class="pais-info-label">Exportações</span>${d.economia.exportacoes}</div>
        <div><span class="pais-info-label">Importações</span>${d.economia.importacoes}</div>
      </div>
      <div style="margin-top:10px;"><span class="pais-info-label">Principais parceiros comerciais</span><div class="pais-card-orgs">${(d.economia.parceiros || []).map(p => `<span class="tag-chip">${p}</span>`).join('')}</div></div>
      <div style="margin-top:10px;"><span class="pais-info-label">Principais produtos</span><div class="pais-card-orgs">${(d.economia.produtos || []).map(p => `<span class="tag-chip">${p}</span>`).join('')}</div></div>
    </div>

    <div class="card">
      <h3 class="section-title">Relações Internacionais</h3>
      ${Object.keys(d.relacoes || {}).map(k => `<div class="pais-relacao"><div class="pais-relacao-titulo">${PAISES_RELACAO_LABELS[k] || k}</div><p>${d.relacoes[k]}</p></div>`).join('')}
    </div>

    <div class="card">
      <h3 class="section-title">Organizações Internacionais</h3>
      <div class="pais-card-orgs">${(d.organizacoes || []).map(o => `<span class="tag-chip" title="${o.nome}">${o.sigla}</span>`).join('')}</div>
    </div>

    <div class="card">
      <h3 class="section-title">Geografia</h3>
      <div class="pais-info-grid">
        <div><span class="pais-info-label">Clima</span>${d.geografia.clima}</div>
        <div><span class="pais-info-label">Relevo</span>${d.geografia.relevo}</div>
      </div>
      <div style="margin-top:10px;"><span class="pais-info-label">Países vizinhos</span><div class="pais-card-orgs">${(d.geografia.paisesVizinhos || []).map(p => `<span class="tag-chip">${p}</span>`).join('')}</div></div>
      <div style="margin-top:10px;"><span class="pais-info-label">Principais rios</span><div class="pais-card-orgs">${(d.geografia.rios || []).map(p => `<span class="tag-chip">${p}</span>`).join('')}</div></div>
      <div style="margin-top:10px;"><span class="pais-info-label">Principais cidades</span><div class="pais-card-orgs">${(d.geografia.principaisCidades || []).map(p => `<span class="tag-chip">${p}</span>`).join('')}</div></div>
    </div>

    <div class="card">
      <h3 class="section-title">Linha do Tempo</h3>
      <div class="pais-timeline">${(d.historia || []).map(h => `<div class="pais-timeline-item"><div class="pais-timeline-ano mono">${h.ano}</div><div class="pais-timeline-evento">${h.evento}</div></div>`).join('')}</div>
    </div>

    <div class="card">
      <h3 class="section-title">Curiosidades</h3>
      <ul class="pais-curiosidades">${(d.curiosidades || []).map(c => `<li>${c}</li>`).join('')}</ul>
    </div>

    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3 class="section-title" style="margin-bottom:0;">Flashcards</h3>
        <button class="btn secondary small" onclick="gerarFlashcardsPais('${d.id}')">🔁 Revisar flashcards</button>
      </div>
      <div id="paisFlashcardsWrap" style="margin-top:14px;"></div>
    </div>

    <div class="card">
      <h3 class="section-title">Atualidades</h3>
      <div class="biblio-empty">Em breve: integração automática com fontes de notícias sobre este país.</div>
    </div>

    <div class="card">
      <h3 class="section-title">Questões CACD</h3>
      <div class="biblio-empty">Em breve: banco de questões específico sobre este país.</div>
    </div>
  `;
}

/* ---- Flashcards automáticos ---- */
function flashcardsAutomaticos(d) {
  const cards = [
    { p: `Qual é a capital de ${d.nomeCurto}?`, r: d.capital },
    { p: `Qual é a moeda de ${d.nomeCurto}?`, r: d.moeda },
    { p: `Quais os idiomas oficiais de ${d.nomeCurto}?`, r: (d.idiomas || []).join(', ') },
    { p: `Qual o sistema político de ${d.nomeCurto}?`, r: d.governo.sistema },
    { p: `De quais organizações internacionais ${d.nomeCurto} faz parte?`, r: (d.organizacoes || []).map(o => o.sigla).join(', ') },
    { p: `Qual o PIB nominal de ${d.nomeCurto}?`, r: d.economia.pib }
  ];
  return cards.concat((d.flashcardsExtras || []).map(f => ({ p: f.pergunta, r: f.resposta })));
}
let paisesFlashcardsQueue = []; let paisesFlashcardsIndex = 0;
function gerarFlashcardsPais(id) {
  const d = paisesCache[id]; if (!d) return;
  paisesFlashcardsQueue = flashcardsAutomaticos(d);
  paisesFlashcardsIndex = 0;
  renderFlashcardPais();
}
function renderFlashcardPais() {
  const wrap = document.getElementById('paisFlashcardsWrap'); if (!wrap) return;
  if (paisesFlashcardsIndex >= paisesFlashcardsQueue.length) {
    wrap.innerHTML = '<div class="biblio-empty">Flashcards concluídos. Clique em "Revisar flashcards" para recomeçar.</div>';
    return;
  }
  const c = paisesFlashcardsQueue[paisesFlashcardsIndex];
  wrap.innerHTML = `
    <div class="pais-flashcard" onclick="this.classList.toggle('flipped')">
      <div class="pais-flashcard-face pais-flashcard-front">${c.p}</div>
      <div class="pais-flashcard-face pais-flashcard-back">${c.r}</div>
    </div>
    <div style="text-align:center; margin-top:10px; font-size:11px; color:var(--text-muted);">${paisesFlashcardsIndex + 1} / ${paisesFlashcardsQueue.length} · clique no card para virar</div>
    <div style="display:flex; justify-content:center; margin-top:10px;"><button class="btn secondary small" onclick="proximoFlashcardPais()">Próximo →</button></div>
  `;
}
function proximoFlashcardPais() { paisesFlashcardsIndex++; renderFlashcardPais(); }
