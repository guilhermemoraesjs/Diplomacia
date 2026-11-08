/* ==========================================================================
   navigation.js — navegação principal. Menu lateral (desktop), barra
   inferior + folha "Mais" (celular) e atalhos de teclado são GERADOS por
   código a partir de NAV_ITEMS + a ordem salva pelo usuário (nav_order,
   reordenável em Configurações — preservado da versão anterior).
   ========================================================================== */

const NAV_GRUPOS = [
  { id: 'estudo', label: 'Estudo' },
  { id: 'pratica', label: 'Prática' },
  { id: 'conhecimento', label: 'Conhecimento' },
  { id: 'sistema', label: 'Sistema' }
];
const NAV_ITEMS = [
  { id: 'inicio', icone: 'home', label: 'Central de Estudos', curto: 'Central', grupo: 'estudo', atalho: 'i' },
  { id: 'cronograma', icone: 'calendar', label: 'Cronograma', curto: 'Cronograma', grupo: 'estudo', atalho: 'c' },
  { id: 'materias', icone: 'book-open', label: 'Matérias e edital', curto: 'Matérias', grupo: 'estudo', atalho: 'm' },
  { id: 'revisao', icone: 'repeat', label: 'Revisão espaçada', curto: 'Revisão', grupo: 'estudo', atalho: 'r' },
  { id: 'questoes', icone: 'help-circle', label: 'Banco de questões', curto: 'Questões', grupo: 'pratica', atalho: 'q' },
  { id: 'simulados', icone: 'clipboard', label: 'Simulados', curto: 'Simulados', grupo: 'pratica', atalho: 's' },
  { id: 'flashcards', icone: 'layers', label: 'Flashcards', curto: 'Flashcards', grupo: 'pratica', atalho: 'f' },
  { id: 'discursivas', icone: 'pen', label: 'Laboratório de discursivas', curto: 'Discursivas', grupo: 'pratica', atalho: 'd' },
  { id: 'palavras', icone: 'type', label: 'Palavras (idiomas)', curto: 'Palavras', grupo: 'pratica', atalho: 'p' },
  { id: 'atualidades', icone: 'newspaper', label: 'Atualidades', curto: 'Atualidades', grupo: 'conhecimento', atalho: 'a' },
  { id: 'paises', icone: 'globe', label: 'Países', curto: 'Países', grupo: 'conhecimento', atalho: 'o' },
  { id: 'organizacoes', icone: 'landmark', label: 'Organizações', curto: 'Organizações', grupo: 'conhecimento', atalho: 'g' },
  { id: 'tratados', icone: 'file-text', label: 'Tratados', curto: 'Tratados', grupo: 'conhecimento', atalho: 't' },
  { id: 'conhecimento', icone: 'network', label: 'Base de conhecimento', curto: 'Conhecimento', grupo: 'conhecimento', atalho: 'k' },
  { id: 'biblioteca', icone: 'library', label: 'Biblioteca', curto: 'Biblioteca', grupo: 'conhecimento', atalho: 'b' },
  { id: 'notas', icone: 'sticky-note', label: 'Anotações', curto: 'Notas', grupo: 'conhecimento', atalho: 'n' },
  { id: 'configuracoes', icone: 'settings', label: 'Configurações', curto: 'Config.', grupo: 'sistema', atalho: 'x' }
];
const NAV_BOTTOM = ['inicio', 'cronograma', 'questoes', 'revisao'];

/* Rotas que reaproveitam uma view + subview já existente */
const NAV_ROTAS_REUTILIZADAS = {
  questoes: { tab: 'diplomacia', sub: 'questoes' },
  materias: { tab: 'diplomacia', sub: 'materias' },
  notas: { tab: 'diplomacia', sub: 'notas' },
  cronograma: { tab: 'diplomacia', sub: 'cronograma' },
  discursivas: { tab: 'diplomacia', sub: 'discursiva' },
  atualidades: { tab: 'diplomacia', sub: 'atualidades' },
  organizacoes: { tab: 'conhecimento', kb: 'organizacao' },
  tratados: { tab: 'conhecimento', kb: 'tratado' }
};

function getNavOrder() {
  const saved = load('nav_order', null);
  const ids = NAV_ITEMS.map(i => i.id);
  if (!saved) return ids;
  const ordenados = saved.filter(id => ids.includes(id));
  const faltantes = ids.filter(id => !ordenados.includes(id));
  return [...ordenados, ...faltantes];
}
function setNavOrder(order) { save('nav_order', order); renderSidebar(); }
function moveNavItem(id, direcao) {
  const order = getNavOrder();
  const i = order.indexOf(id), j = i + direcao;
  if (j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  setNavOrder(order);
  renderConfigNavOrder();
}
function navItem(id) { return NAV_ITEMS.find(i => i.id === id); }
function navBadge(id) {
  try { if (id === 'revisao' && typeof revisaoContagens === 'function') { const n = revisaoContagens().devidas; return n ? `<span class="badge-dot" aria-label="${n} pendentes">${n > 99 ? '99+' : n}</span>` : ''; } } catch (e) {}
  return '';
}

function renderSidebar() {
  const ativo = document.body.getAttribute('data-active-tab') || 'inicio';
  const order = getNavOrder();
  const el = document.getElementById('sidebarNavScroll');
  if (el) {
    el.innerHTML = NAV_GRUPOS.map(g => {
      const itens = order.map(navItem).filter(i => i && i.grupo === g.id);
      return `<div class="nav-group-title">${g.label}</div>` + itens.map(i =>
        `<button class="${ativo === i.id ? 'active' : ''}" data-tab="${i.id}" ${ativo === i.id ? 'aria-current="page"' : ''} onclick="goTab('${i.id}')">${icon(i.icone, 18)}<span>${i.label}</span>${navBadge(i.id)}</button>`).join('');
    }).join('');
  }
  const bn = document.getElementById('bottomNav');
  if (bn) {
    const emMais = !NAV_BOTTOM.includes(ativo);
    bn.innerHTML = NAV_BOTTOM.map(id => { const i = navItem(id); return `<button class="${ativo === id ? 'active' : ''}" ${ativo === id ? 'aria-current="page"' : ''} onclick="goTab('${id}')" aria-label="${i.label}">${icon(i.icone, 22)}<span>${i.curto}</span>${navBadge(id)}</button>`; }).join('') +
      `<button class="${emMais ? 'active' : ''}" onclick="abrirMais()" aria-label="Mais opções" aria-haspopup="dialog">${icon('more', 22)}<span>Mais</span></button>`;
  }
  const titulo = document.getElementById('topbarTitle'); const it = navItem(ativo);
  if (titulo) titulo.textContent = it ? it.label : 'Chancelaria';
  const mg = document.getElementById('moreGrid');
  if (mg) mg.innerHTML = NAV_GRUPOS.map(g => {
    const itens = order.map(navItem).filter(i => i && i.grupo === g.id && !NAV_BOTTOM.includes(i.id));
    return itens.length ? `<h4>${g.label}</h4><div class="sheet-grid">` + itens.map(i => `<button class="${ativo === i.id ? 'active' : ''}" onclick="fecharMais(); goTab('${i.id}')">${icon(i.icone, 22)}<span>${i.curto}</span>${navBadge(i.id)}</button>`).join('') + '</div>' : '';
  }).join('');
}
function abrirMais() { const o = document.getElementById('moreSheet'); if (o) { renderSidebar(); o.classList.add('show'); } }
function fecharMais() { const o = document.getElementById('moreSheet'); if (o) o.classList.remove('show'); }

function renderConfigNavOrder() {
  const el = document.getElementById('configNavOrderList'); if (!el) return;
  const order = getNavOrder();
  el.innerHTML = order.map((id, i) => {
    const item = navItem(id); if (!item) return '';
    return `
      <div class="nav-reorder-item">
        <span class="nav-reorder-ic">${icon(item.icone, 18)}</span>
        <span class="nav-reorder-label">${item.label}</span>
        <div class="nav-reorder-arrows">
          <button class="btn ghost small" ${i === 0 ? 'disabled' : ''} onclick="moveNavItem('${id}', -1)" aria-label="Mover ${item.label} para cima">${icon('chevron-down', 14).replace('ic ic-chevron-down', 'ic rot180')}</button>
          <button class="btn ghost small" ${i === order.length - 1 ? 'disabled' : ''} onclick="moveNavItem('${id}', 1)" aria-label="Mover ${item.label} para baixo">${icon('chevron-down', 14)}</button>
        </div>
      </div>`;
  }).join('');
}

/* Inicializadores por aba (os dados podem ter mudado em outro módulo) */
const NAV_AO_ABRIR = {
  inicio: () => typeof renderCentral === 'function' && renderCentral(),
  revisao: () => { if (typeof rvSessao !== 'undefined' && rvSessao && rvSessao.i >= rvSessao.fila.length) rvSessao = null; return typeof renderRevisaoHub === 'function' && renderRevisaoHub(); },
  conhecimento: () => { if (typeof kbEstado !== 'undefined') { kbEstado.tipo = ''; kbEstado.aberto = null; } return typeof renderKB === 'function' && renderKB(); },
  configuracoes: () => { renderConfigNavOrder(); if (typeof renderConfiguracoes === 'function') renderConfiguracoes(); if (typeof checkUpdate === 'function') checkUpdate({ manual: false }); },
  palavras: () => connectHub(),
  paises: () => initPaisesTab(),
  simulados: () => initSimuladosTab(),
  flashcards: () => initFlashcardsTab()
};
const NAV_AO_ABRIR_SUB = {
  questoes: () => typeof renderQuestoes === 'function' && renderQuestoes(),
  cronograma: () => typeof renderCronograma === 'function' && renderCronograma(),
  discursiva: () => typeof renderDiscursivas === 'function' && renderDiscursivas(),
  atualidades: () => typeof renderAtualidades === 'function' && renderAtualidades(),
  materias: () => typeof renderMaterias === 'function' && renderMaterias()
};

function goTab(tab) {
  fecharMais();
  if (NAV_ROTAS_REUTILIZADAS[tab]) {
    const r = NAV_ROTAS_REUTILIZADAS[tab];
    goTab(r.tab);
    if (r.sub) { goSub(r.sub); if (NAV_AO_ABRIR_SUB[r.sub]) NAV_AO_ABRIR_SUB[r.sub](); }
    if (r.kb && typeof kbDefinirFiltro === 'function') kbDefinirFiltro(r.kb);
    document.body.setAttribute('data-active-tab', tab);
    renderSidebar();
    try { sessionStorage.setItem('chancelaria_tab', tab); } catch (e) {}
    return;
  }
  document.body.setAttribute('data-active-tab', tab);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + tab);
  if (view) view.classList.add('active');
  renderSidebar();
  window.scrollTo({ top: 0 });
  if (NAV_AO_ABRIR[tab]) NAV_AO_ABRIR[tab]();
  try { sessionStorage.setItem('chancelaria_tab', tab); } catch (e) {}
}

function goSub(sub) {
  document.querySelectorAll('.subview').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('sub-' + sub);
  if (el) el.classList.add('active');
  document.querySelectorAll('.subtab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-sub') === sub));
}

function connectHub() {
  const f = document.getElementById('hubFrame');
  if (f && !f.src) f.src = HUB_ORIGIN + '/';
}

/* ---- Tema ---- */
function aplicarIconeTema() {
  const b = document.getElementById('themeBtn'); if (!b) return;
  const escuro = document.body.getAttribute('data-theme') !== 'light';
  b.innerHTML = icon(escuro ? 'sun' : 'moon', 18);
  b.setAttribute('aria-label', escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro');
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', escuro ? '#0A1329' : '#F2F5FB');
}

/* ---- Atalhos de teclado: "g" + letra navega; "?" mostra a ajuda ---- */
let _gPendente = 0;
function abrirAjudaAtalhos() {
  const linhas = NAV_ITEMS.map(i => `<div class="row between" style="padding:5px 0;"><span>${i.label}</span><span><kbd class="kbd">g</kbd> <kbd class="kbd">${i.atalho}</kbd></span></div>`).join('');
  const ov = document.createElement('div'); ov.className = 'modal-overlay show';
  ov.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="Atalhos de teclado"><h3>Atalhos de teclado</h3>
    <div class="row between" style="padding:5px 0;"><span>Buscar em tudo</span><span><kbd class="kbd">Ctrl/⌘</kbd> <kbd class="kbd">K</kbd></span></div>
    <div class="row between" style="padding:5px 0;"><span>Esta ajuda</span><span><kbd class="kbd">?</kbd></span></div>${linhas}
    <div class="modal-actions"><button class="btn secondary small">Fechar</button></div></div>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.btn')) ov.remove(); });
  document.body.appendChild(ov);
}
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  if (e.key === '?') { abrirAjudaAtalhos(); return; }
  if (_gPendente && Date.now() - _gPendente < 1200) {
    const it = NAV_ITEMS.find(i => i.atalho === e.key.toLowerCase()); _gPendente = 0;
    if (it) { e.preventDefault(); goTab(it.id); }
    return;
  }
  if (e.key === 'g') _gPendente = Date.now();
});
