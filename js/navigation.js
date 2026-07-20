/* ==========================================================================
   navigation.js — navegação principal (sidebar), sub-abas, roteamento de
   itens que reaproveitam telas existentes, e busca global.
   ========================================================================== */

/* Mapa de itens da sidebar que não têm view própria — reaproveitam uma
   view + subview já existente, para não duplicar funcionalidade. */
const NAV_ROTAS_REUTILIZADAS = {
  questoes: { tab: 'diplomacia', sub: 'questoes' },
  notas: { tab: 'diplomacia', sub: 'notas' },
  cronograma: { tab: 'diplomacia', sub: 'cronograma' },
  discursivas: { tab: 'diplomacia', sub: 'discursiva' },
  atualidades: { tab: 'diplomacia', sub: 'atualidades' }
};

function goTab(tab) {
  if (NAV_ROTAS_REUTILIZADAS[tab]) {
    const r = NAV_ROTAS_REUTILIZADAS[tab];
    goTab(r.tab);
    goSub(r.sub);
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
    return;
  }
  document.body.setAttribute('data-active-tab', tab);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + tab);
  if (view) view.classList.add('active');

  document.querySelectorAll('.tabbar button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
  });
  if (tab === 'palavras') connectHub();
  if (tab === 'paises') initPaisesTab();
  if (tab === 'simulados') initSimuladosTab();
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
