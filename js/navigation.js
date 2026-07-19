/* ==========================================================================
   navigation.js — troca de abas principais (tabbar) e sub-abas (subtabs),
   além da conexão com o iframe externo do Hub Linguístico.
   ========================================================================== */

function goTab(tab) {
  document.body.setAttribute('data-active-tab', tab);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + tab).classList.add('active');

  document.querySelectorAll('.tabbar button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
  });
  if (tab === 'palavras') connectHub();
  if (tab === 'paises') initPaisesTab();
  if (tab === 'simulados') initSimuladosTab();
}

function goSub(sub) {
  document.querySelectorAll('.subview').forEach(v => v.classList.remove('active'));
  document.getElementById('sub-' + sub).classList.add('active');
  document.querySelectorAll('.subtab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-sub') === sub));
}

function connectHub() {
  document.getElementById('hubFrame').src = HUB_ORIGIN + '/';
}
