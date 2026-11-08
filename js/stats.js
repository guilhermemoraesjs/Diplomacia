/* ==========================================================================
   stats.js — atualização dos indicadores globais (barra lateral, selos do
   menu e Central de Estudos). O "Despacho do Dia" agora vive em central.js.
   refreshStats() é chamado após qualquer alteração relevante de dados.
   ========================================================================== */
function renderDailyBrief() { if (typeof renderCentral === 'function') renderCentral(); }   // compatibilidade

function refreshStats() {
  try {
    const q = qbResumo(), meta = document.getElementById('sidebarMetaDiaria'); if (meta) meta.textContent = `${q.hoje}/${q.metaDia}`;
    const sk = document.getElementById('simuladosStreakInfo'); if (sk && typeof calcularStreakAtual === 'function') sk.innerHTML = `<div class="dash-streak-n">${calcularStreakAtual()} dias seguidos</div><div class="dash-streak-sub">Melhor sequência: ${calcularMelhorStreak()} dias</div>`;
    const v = document.getElementById('sidebarVersion'); if (v && typeof APP_INFO !== 'undefined') v.innerHTML = `<span>Versão v${escHtml(APP_INFO.version)}</span>`;
    renderSidebar();
    const c = document.getElementById('view-inicio'); if (c && c.classList.contains('active')) renderCentral();
  } catch (e) { console.error('refreshStats', e); }
}
