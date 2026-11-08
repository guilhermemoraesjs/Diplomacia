/* ==========================================================================
   biblioteca-revisao.js — módulo "Biblioteca → Revisão espaçada (SRS)":
   fila de flashcards dos fichamentos marcados para revisão, com algoritmo
   de intervalos crescentes (again/hard/good).
   ========================================================================== */

function docsDueForReview() {
  const today = todayISO();
  return biblioDocs.filter(d => d.srsAtivo && d.srs && d.srs.nextReview && d.srs.nextReview <= today);
}
function renderBiblioReviewBar() {
  const bar = document.getElementById('biblioReviewBar'); if (!bar) return;
  const ativos = biblioDocs.filter(d => d.srsAtivo);
  if (!ativos.length) { bar.style.display = 'none'; return; }
  const due = docsDueForReview();
  bar.style.display = 'flex';
  document.getElementById('biblioReviewCountText').textContent = due.length
    ? `${due.length} fichamento${due.length === 1 ? '' : 's'} pronto${due.length === 1 ? '' : 's'} para revisar hoje`
    : `Tudo em dia · ${ativos.length} fichamento${ativos.length === 1 ? '' : 's'} ativo${ativos.length === 1 ? '' : 's'} na revisão espaçada`;
  const btn = document.getElementById('biblioReviewBtn');
  btn.disabled = due.length === 0;
  btn.textContent = due.length ? 'Revisar agora' : 'Nada pendente';
}

let reviewQueue = [];
let reviewIndex = 0;
function iniciarRevisaoBiblioteca() {
  reviewQueue = docsDueForReview();
  reviewIndex = 0;
  if (!reviewQueue.length) { return; }
  document.getElementById('reviewCardWrap').style.display = 'block';
  document.getElementById('reviewDone').style.display = 'none';
  showBiblioPanel('review');
  renderReviewCard();
}
function renderReviewCard() {
  if (reviewIndex >= reviewQueue.length) {
    document.getElementById('reviewCardWrap').style.display = 'none';
    document.getElementById('reviewDone').style.display = 'block';
    document.getElementById('reviewProgress').textContent = '';
    return;
  }
  const d = reviewQueue[reviewIndex];
  document.getElementById('reviewProgress').textContent = `${reviewIndex + 1} / ${reviewQueue.length}`;
  document.getElementById('reviewMeta').textContent = [pastaNome(d.pastaId), d.materia].filter(Boolean).join(' · ');
  document.getElementById('reviewTitulo').textContent = d.titulo || '(sem título)';
  const conteudoEl = document.getElementById('reviewConteudo');
  conteudoEl.innerHTML = d.conteudo && d.conteudo.trim() ? sanitizarHTML(d.conteudo) : '<p style="color:var(--text-muted);">Documento vazio.</p>';
  conteudoEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.disabled = true);
}
/* Aplica uma avaliação ao documento (motor único srs-core). Reutilizada pela
   Revisão unificada. Não salva: quem chama decide quando gravar. */
function docRate(d, quality) {
  if (!d.srs) d.srs = { modo: 'automatico', interval: 1, reps: 0, nextReview: todayISO(), lastReview: null };
  const hoje = todayISO();
  if (d.srs.modo === 'manual') { d.srs.lastReview = hoje; d.srs.nextReview = null; return; }   // aguarda você escolher a próxima data em Propriedades
  const mem = srsMemDeDoc(d);
  const antes = d.srs.lastReview ? srsRetrievability(Math.max(0, diffDaysISO(d.srs.lastReview, hoje)), mem.S) : null;
  const n = srsAgendar(mem, quality, hoje, srsPrefs(), 'media');
  d.srs.stab = n.S; d.srs.dif = n.D; d.srs.lapsos = n.lapses; d.srs.acertos = n.acertos; d.srs.erros = n.erros;
  d.srs.interval = n.intervalo; d.srs.reps = quality === 'again' ? 0 : (d.srs.reps || 0) + 1;
  d.srs.lastReview = hoje; d.srs.nextReview = n.due; d.srs.em = Date.now();
  srsRegistrarLog('d', d.id, quality, antes, n.intervalo, hoje, { d: Math.round(n.D * 10) / 10, l: n.lapses });
}
function rateReview(quality) {
  const d = reviewQueue[reviewIndex]; if (!d) return;
  docRate(d, quality);
  save('biblio_docs', biblioDocs);
  if (typeof trackStudyDay === 'function') trackStudyDay();
  reviewIndex++;
  renderReviewCard();
  renderBiblioReviewBar();
}
function encerrarRevisao() {
  showBiblioPanel('list');
  renderBiblioDocList(); renderBiblioTree(); renderBiblioReviewBar();
}
