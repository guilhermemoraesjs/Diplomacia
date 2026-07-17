/* ==========================================================================
   app.js — ponto de entrada da aplicação. Orquestra a renderização inicial
   de todos os módulos a partir do que está salvo em localStorage/Firebase.
   Deve ser o ÚLTIMO script carregado (depende de todos os outros).
   ========================================================================== */

function reloadStateFromLocalStorage() {
  const t = localStorage.getItem('chancelaria_theme') || 'dark';
  document.body.setAttribute('data-theme', t);
  renderMaterias(); renderMateriaOptions(); renderCronograma(); renderRevisao();
  renderDiscursivas(); renderAtualidades(); renderNotas();
  renderBiblioTree(); renderBiblioDocList(); renderBiblioReviewBar();
  refreshStats();
}

reloadStateFromLocalStorage();
