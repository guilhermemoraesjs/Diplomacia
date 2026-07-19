/* ==========================================================================
   navigation.js — navegação principal. O menu lateral agora é GERADO por
   código (não é mais HTML fixo), a partir de NAV_ITEMS + a ordem salva do
   usuário (nav_order), para permitir reordenar em Configurações.
   ========================================================================== */

const NAV_ITEMS = [
  { id: 'inicio', icone: '🏠', label: 'Início' },
  { id: 'paises', icone: '🌍', label: 'Países' },
  { id: 'organizacoes', icone: '🏛️', label: 'Organizações' },
  { id: 'tratados', icone: '📜', label: 'Tratados' },
  { id: 'atualidades', icone: '📰', label: 'Atualidades' },
  { id: 'biblioteca', icone: '📚', label: 'Biblioteca' },
  { id: 'flashcards', icone: '🧠', label: 'Flashcards' },
  { id: 'simulados', icone: '📝', label: 'Simulados' },
  { id: 'questoes', icone: '❓', label: 'Questões' },
  { id: 'notas', icone: '🗒️', label: 'Notas' },
  { id: 'cronograma', icone: '📅', label: 'Cronograma' },
  { id: 'palavras', icone: '✒️', label: 'Palavras' },
  { id: 'discursivas', icone: '✍️', label: 'Discursivas' },
  { id: 'configuracoes', icone: '⚙️', label: 'Configurações' }
];

/* Rotas que reaproveitam uma view + subview já existente, para não duplicar
   funcionalidade nenhuma. */
const NAV_ROTAS_REUTILIZADAS = {
  questoes: { tab: 'diplomacia', sub: 'questoes' },
  notas: { tab: 'diplomacia', sub: 'notas' },
  cronograma: { tab: 'diplomacia', sub: 'cronograma' },
  discursivas: { tab: 'diplomacia', sub: 'discursiva' },
  atualidades: { tab: 'diplomacia', sub: 'atualidades' }
};

function getNavOrder() {
  const saved = load('nav_order', null);
  const ids = NAV_ITEMS.map(i => i.id);
  if (!saved) return ids;
  // garante que itens novos (adicionados depois de salvar a ordem) apareçam no fim
  const ordenados = saved.filter(id => ids.includes(id));
  const faltantes = ids.filter(id => !ordenados.includes(id));
  return [...ordenados, ...faltantes];
}
function setNavOrder(order) { save('nav_order', order); renderSidebar(); }
function moveNavItem(id, direcao) {
  const order = getNavOrder();
  const i = order.indexOf(id);
  const j = i + direcao;
  if (j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  setNavOrder(order);
  renderConfigNavOrder();
}

function renderSidebar() {
  const el = document.getElementById('sidebarNavScroll'); if (!el) return;
  const activo = document.body.getAttribute('data-active-tab') || 'inicio';
  const order = getNavOrder();
  el.innerHTML = order.map(id => {
    const item = NAV_ITEMS.find(i => i.id === id); if (!item) return '';
    return `<button class="${activo === item.id ? 'active' : ''}" data-tab="${item.id}" onclick="goTab('${item.id}')">${item.icone} ${item.label}</button>`;
  }).join('');
}

function renderConfigNavOrder() {
  const el = document.getElementById('configNavOrderList'); if (!el) return;
  const order = getNavOrder();
  el.innerHTML = order.map((id, i) => {
    const item = NAV_ITEMS.find(x => x.id === id); if (!item) return '';
    return `
      <div class="nav-reorder-item">
        <span class="nav-reorder-ic">${item.icone}</span>
        <span class="nav-reorder-label">${item.label}</span>
        <div class="nav-reorder-arrows">
          <button class="btn ghost small" ${i === 0 ? 'disabled' : ''} onclick="moveNavItem('${id}', -1)">▲</button>
          <button class="btn ghost small" ${i === order.length - 1 ? 'disabled' : ''} onclick="moveNavItem('${id}', 1)">▼</button>
        </div>
      </div>`;
  }).join('');
}

function goTab(tab) {
  if (NAV_ROTAS_REUTILIZADAS[tab]) {
    const r = NAV_ROTAS_REUTILIZADAS[tab];
    goTab(r.tab);
    goSub(r.sub);
    document.body.setAttribute('data-active-tab', tab);
    renderSidebar();
    return;
  }
  document.body.setAttribute('data-active-tab', tab);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + tab);
  if (view) view.classList.add('active');
  renderSidebar();

  if (tab === 'palavras') connectHub();
  if (tab === 'paises') initPaisesTab();
  if (tab === 'simulados') initSimuladosTab();
  if (tab === 'configuracoes') renderConfigNavOrder();
}

function goSub(sub) {
  document.querySelectorAll('.subview').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('sub-' + sub);
  if (el) el.classList.add('active');
  document.querySelectorAll('.subtab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-sub') === sub));
}

function connectHub() {
  document.getElementById('hubFrame').src = HUB_ORIGIN + '/';
}
