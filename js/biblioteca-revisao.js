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
  conteudoEl.innerHTML = d.conteudo && d.conteudo.trim() ? d.conteudo : '<p style="color:var(--text-muted);">Documento vazio.</p>';
  conteudoEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.disabled = true);
}
function rateReview(quality) {
  const d = reviewQueue[reviewIndex]; if (!d) return;
  if (!d.srs) d.srs = { modo: 'automatico', interval: 1, reps: 0, nextReview: todayISO(), lastReview: null };
  if (d.srs.modo === 'manual') {
    d.srs.lastReview = todayISO();
    d.srs.nextReview = null; // aguarda você escolher a próxima data em Propriedades
  } else {
    if (quality === 'again') {
      d.srs.interval = 1; d.srs.reps = 0;
    } else if (quality === 'hard') {
      d.srs.interval = Math.max(1, Math.round(d.srs.interval * 1.3));
    } else {
      d.srs.interval = d.srs.reps === 0 ? 3 : Math.round(d.srs.interval * 2.3);
      d.srs.reps++;
    }
    d.srs.lastReview = todayISO();
    d.srs.nextReview = addDaysISO(todayISO(), d.srs.interval);
  }
  save('biblio_docs', biblioDocs);
  reviewIndex++;
  renderReviewCard();
  renderBiblioReviewBar();
}
function encerrarRevisao() {
  showBiblioPanel('list');
  renderBiblioDocList(); renderBiblioTree(); renderBiblioReviewBar();
}
