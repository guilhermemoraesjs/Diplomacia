/* ==========================================================================
   flashcards-review.js — módulo "Flashcards → Revisão": monta a fila de
   cartões a revisar, controla a sessão (frente → mostrar resposta → avaliar),
   atalhos de teclado e o registro de tempo gasto por cartão / sequência de
   dias estudados. Delega o cálculo de intervalos ao flashcards-srs.js e a
   pintura de HTML ao flashcards-ui.js (renderFlashReviewCard).
   ========================================================================== */

let flashReviewQueue = [];
let flashReviewIdx = 0;
let flashReviewRevelado = false;
let flashReviewInicioMs = 0;
let flashReviewAtiva = false;
let flashReviewSessaoStats = { acertos: 0, erros: 0 };

function flashFilaVencidosENovos() {
  const hoje = todayISO();
  return flashCards.filter(c => c.srs.proximaRevisao <= hoje);
}

/* Constrói a fila a partir de um conjunto de filtros (usado tanto pelo botão
   rápido do Dashboard quanto pela aba Revisar com filtros avançados). */
function flashConstruirFila(filtros) {
  filtros = filtros || {};
  let lista = filtros.apenasDevidos === false ? [...flashCards] : flashFilaVencidosENovos();
  if (filtros.disciplina) lista = lista.filter(c => c.disciplina === filtros.disciplina);
  if (filtros.tema) lista = lista.filter(c => c.tema === filtros.tema);
  if (filtros.tag) lista = lista.filter(c => (c.tags || []).includes(filtros.tag));
  if (filtros.dificuldade) lista = lista.filter(c => c.dificuldade === filtros.dificuldade);
  if (filtros.estados && filtros.estados.length) {
    lista = lista.filter(c => {
      if (filtros.estados.includes('vencido') && flashIsVencido(c)) return true;
      if (filtros.estados.includes('novo') && flashState(c) === 'novo') return true;
      if (filtros.estados.includes('aprendizado') && flashState(c) === 'aprendizado') return true;
      if (filtros.estados.includes('maduro') && flashState(c) === 'maduro') return true;
      return false;
    });
  }
  // embaralha levemente para intercalar disciplinas, mantendo vencidos há mais tempo primeiro
  return lista.sort((a, b) => (a.srs.proximaRevisao || '').localeCompare(b.srs.proximaRevisao || ''));
}

function flashIniciarSessao(fila) {
  flashReviewQueue = fila;
  flashReviewIdx = 0;
  flashReviewSessaoStats = { acertos: 0, erros: 0 };
  flashReviewAtiva = true;
  flashShowPanel('revisar');
  document.getElementById('flashRevisarFiltrosWrap').style.display = 'none';
  document.getElementById('flashSessaoWrap').style.display = 'block';
  document.getElementById('flashReviewDone').style.display = 'none';
  document.getElementById('flashReviewCardWrap').style.display = 'block';
  flashApresentarCartaoAtual();
}

function flashCartaoAtual() { return flashReviewQueue[flashReviewIdx]; }

function flashApresentarCartaoAtual() {
  if (flashReviewIdx >= flashReviewQueue.length) {
    flashReviewAtiva = false;
    document.getElementById('flashReviewCardWrap').style.display = 'none';
    document.getElementById('flashReviewDone').style.display = 'block';
    document.getElementById('flashReviewDoneStats').textContent =
      `${flashReviewSessaoStats.acertos} certo(s) · ${flashReviewSessaoStats.erros} errado(s)`;
    flashRenderDashboard();
    return;
  }
  flashReviewRevelado = false;
  flashReviewInicioMs = Date.now();
  renderFlashReviewCard(flashCartaoAtual(), false);
}

function flashRevisaoRevelar() {
  if (flashReviewRevelado) return;
  flashReviewRevelado = true;
  renderFlashReviewCard(flashCartaoAtual(), true);
}

function flashRevisaoAvaliar(qualidade) {
  if (!flashReviewRevelado) return;
  const card = flashCartaoAtual(); if (!card) return;
  const segundos = Math.max(1, Math.round((Date.now() - flashReviewInicioMs) / 1000));
  flashRate(card, qualidade);
  flashSaveAll();
  if (qualidade === 'again') flashReviewSessaoStats.erros++; else flashReviewSessaoStats.acertos++;

  flashTempos.push({ data: todayISO(), cardId: card.id, segundos });
  flashTempos = flashTempos.slice(-2000);
  save(FLASH_TEMPOS_KEY, flashTempos);

  flashTrackStudyDay();
  if (typeof trackStudyDay === 'function') trackStudyDay();
  if (typeof trackActivity === 'function') trackActivity(qualidade === 'again' ? 'erro' : 'acerto', `Flashcard de ${card.disciplina || 'estudo geral'}`);

  flashReviewIdx++;
  flashApresentarCartaoAtual();
}

function flashEncerrarRevisao() {
  flashReviewAtiva = false;
  document.getElementById('flashSessaoWrap').style.display = 'none';
  document.getElementById('flashRevisarFiltrosWrap').style.display = 'block';
  flashRenderDashboard();
  flashRenderRevisarFiltros();
}

/* ---- Atalhos de teclado: Espaço mostra a resposta; 1–4 avaliam. Só agem
   quando a sessão de revisão está de fato visível/ativa, para não capturar
   teclas em outras partes do app. ---- */
document.addEventListener('keydown', e => {
  if (!flashReviewAtiva) return;
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
  if (e.key === ' ') { e.preventDefault(); flashRevisaoRevelar(); }
  else if (e.key === '1') flashRevisaoAvaliar('again');
  else if (e.key === '2') flashRevisaoAvaliar('hard');
  else if (e.key === '3') flashRevisaoAvaliar('good');
  else if (e.key === '4') flashRevisaoAvaliar('easy');
});

/* ---- Sequência de dias estudados (streak dedicado a Flashcards) ---- */
function flashTrackStudyDay() {
  const hoje = todayISO();
  if (!flashStreakDias.includes(hoje)) {
    flashStreakDias.push(hoje);
    flashStreakDias = flashStreakDias.slice(-365);
    save(FLASH_STREAK_KEY, flashStreakDias);
  }
}
function flashCalcularStreakAtual() {
  let streak = 0; let d = new Date();
  while (flashStreakDias.includes(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
