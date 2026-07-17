/* ==========================================================================
   stats.js — módulo "Início": estatísticas gerais e Despacho do Dia
   (agenda que junta pendências de Cronograma e revisão de idiomas).
   ========================================================================== */

function renderDailyBrief() {
  const container = document.getElementById('dailyBriefContent'); if (!container) return;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let html = `<div class="brief-section"><span class="brief-section-title">Frente I — Idiomas (SRS)</span><div class="brief-item" onclick="goTab('palavras')"><div class="brief-item-meta"><span>Transmissão Ativa</span><span>Palavras</span></div><div class="brief-item-title">Revisão Espaçada Diária</div></div></div>`;

  const diarias = cronograma.filter(c => { const d = parseBR(c.data); return d && isMesmoDia(d, hoje) && !c.feito; });
  const atrasadas = cronograma.filter(c => { const d = parseBR(c.data); return d && d < hoje && !c.feito; });

  html += `<div class="brief-section"><span class="brief-section-title">Frente II — Edital Diplomacia</span>`;
  atrasadas.forEach(c => { html += `<div class="brief-item item-atrasado" onclick="openCronoEditModal('${c.id}')"><div class="brief-item-meta"><span>${c.materia}</span><span style="color:var(--bad);">🚨 ATRASADA</span></div><div class="brief-item-title">${c.tema}</div></div>`; });
  diarias.forEach(c => { html += `<div class="brief-item" onclick="openCronoEditModal('${c.id}')"><div class="brief-item-meta"><span>${c.materia}</span><span>HOJE</span></div><div class="brief-item-title">${c.tema}</div></div>`; });
  if (!diarias.length && !atrasadas.length) html += `<div class="empty" style="padding:12px 0;">Nenhuma obrigação pendente.</div>`;
  html += `</div>`;
  container.innerHTML = html;
}

function refreshStats() {
  document.getElementById('statMaterias').textContent = materias.length;
  document.getElementById('statQuestoes').textContent = questoes.length;
  document.getElementById('statNotas').textContent = notas.length;
  document.getElementById('statDocs').textContent = biblioDocs.length;
  document.getElementById('diploProgressLabel').textContent = pctGeral() + '% do edital coberto';
  const r = document.getElementById('diploRing'); if (r) r.style.setProperty('--pct', pctGeral());
  const pct = document.getElementById('diploProgressPct'); if (pct) pct.textContent = pctGeral() + '%';
  const bc = document.getElementById('biblioCountLabel');
  if (bc) {
    const dueCount = docsDueForReview().length;
    bc.textContent = biblioDocs.length + ' documento' + (biblioDocs.length === 1 ? '' : 's') + ' arquivado' + (biblioDocs.length === 1 ? '' : 's') + (dueCount ? ` · ${dueCount} p/ revisar` : '');
  }
  renderDailyBrief();
}
