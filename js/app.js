/* ==========================================================================
   app.js — ponto de entrada da aplicação. Orquestra a renderização inicial
   de todos os módulos a partir do que está salvo em localStorage/Firebase.
   Deve ser o penúltimo script (antes de updater.js): depende de todos os outros.

   ORDEM DE CARREGAMENTO (scripts globais, sem bundler) e dependências:
     version → config → utils → icons → backup → migrations → theme-auth →
     navigation → srs-core → materias → estudo-log → cronograma → revisao →
     questoes → discursiva → atualidades → conhecimento → notas →
     (vendor d3/topojson) → paises → dashboard → simulados → biblioteca-* →
     flashcards-* → revisao-hub → central → stats → configuracoes → app → updater
   ========================================================================== */
function reloadStateFromLocalStorage() {
  const t = localStorage.getItem('chancelaria_theme') || 'dark';
  document.body.setAttribute('data-theme', t);
  aplicarIconeTema();
  /* recarrega do localStorage os dados que os módulos mantêm em memória */
  materias = load(MATERIAS_KEY, null) || materiasDefault(); ensureMateriaColors();
  cronograma = (load(CRONO_KEY, []) || []).map(crNorm);
  revisao = load(REVISAO_KEY, []);
  questoes = (load('diplo_questoes', []) || []).map(qNorm); questoesHist = load('diplo_questoes_hist', []) || [];
  discursivas = (load('diplo_discursivas', []) || []).map(dlNorm);
  atualidades = (load('diplo_atualidades', []) || []).map(atNorm);
  kbItens = (load('diplo_kb', []) || []).map(kbNorm);
  notas = load('diplo_notas', []) || [];
  recarregarEstudoLog();
  renderSidebar();
  renderMaterias(); renderMateriaOptions(); renderCronograma(); renderRevisao();
  renderQuestoes(); renderDiscursivas(); renderAtualidades(); renderNotas(); renderKB();
  renderPaisesModule();
  renderBiblioTree(); renderBiblioDocList(); renderBiblioReviewBar();
  flashCards = load(FLASH_KEY, []);
  flashStreakDias = load(FLASH_STREAK_KEY, []);
  flashTempos = load(FLASH_TEMPOS_KEY, []);
  flashRebuildIndex();
  if (document.getElementById('view-flashcards')?.classList.contains('active')) initFlashcardsTab();
  refreshStats();
  renderRevisaoHub();
  renderSyncChip();
}

migrarSeNecessario().catch(e => console.warn('migração:', e)).finally(() => {
  reloadStateFromLocalStorage();
  if (location.hash && /^#\/paises\//.test(location.hash) && typeof aplicarRotaPaisAtual === 'function') { /* rota de país é tratada por paises.js */ }
});
// o dia virou com o app aberto? atualiza a Central
setInterval(() => { if (window._ultimoDia && window._ultimoDia !== todayISO()) refreshStats(); window._ultimoDia = todayISO(); }, 60000);
window._ultimoDia = todayISO();
