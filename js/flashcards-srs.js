/* ==========================================================================
   flashcards-srs.js — módulo "Flashcards → SRS": algoritmo de repetição
   espaçada inspirado no SM-2 (o mesmo usado pelo Anki), isolado da
   interface e do armazenamento — só recebe um cartão e uma qualidade de
   resposta, e devolve o cartão com o estado de revisão recalculado.
   ========================================================================== */

const FLASH_EASE_MIN = 1.3;
const FLASH_EASE_INICIAL = 2.5;
const FLASH_MADURO_DIAS = 21; // convenção Anki: intervalo ≥ 21 dias = maduro

/* Classifica o estado do cartão a partir do seu histórico de SRS. */
function flashState(card) {
  const s = card.srs;
  if (!s || !s.ultimaRevisao) return 'novo';
  if (s.intervalo >= FLASH_MADURO_DIAS) return 'maduro';
  return 'aprendizado';
}

function flashIsDue(card) {
  return !!card.srs && card.srs.proximaRevisao <= todayISO();
}
function flashIsVencido(card) {
  return !!card.srs && card.srs.ultimaRevisao && card.srs.proximaRevisao < todayISO();
}

/* Modo "fixo" (opcional em Configurações): agenda fixa por qualidade, a
   que o app usava antes da v1.0.0. O padrão agora é o modo "adaptativo"
   (srs-core.js, inspirado no FSRS). Os dois modos preservam os mesmos
   campos do cartão; o adaptativo apenas acrescenta stab/dif/lapsos. */
const FLASH_INTERVALOS_FIXOS = { again: 7, hard: 15, good: 30, easy: 60 };

/* Recalcula intervalo, acertos/erros, repetições e a próxima data de
   revisão a partir da qualidade escolhida:
   'again' (Errei) · 'hard' (Difícil) · 'good' (Bom) · 'easy' (Fácil). */
function flashRate(card, qualidade) {
  const s = card.srs; const hoje = todayISO(); const prefs = srsPrefs();
  const antes = s.ultimaRevisao ? srsRetrievability(Math.max(0, diffDaysISO(s.ultimaRevisao, hoje)), srsMemDeFlash(card).S) : null;
  if (prefs.modo === 'fixo') {
    if (qualidade === 'again') { s.erros++; s.repeticoes = 0; } else { s.acertos++; s.repeticoes++; }
    s.intervalo = FLASH_INTERVALOS_FIXOS[qualidade];
    s.proximaRevisao = addDaysISO(hoje, s.intervalo);
  } else {
    const n = srsProximo(srsMemDeFlash(card), qualidade, hoje, prefs, card.dificuldade);
    s.stab = n.S; s.dif = n.D; s.lapsos = n.lapses;
    s.acertos = n.acertos; s.erros = n.erros;
    s.repeticoes = qualidade === 'again' ? 0 : (s.repeticoes || 0) + 1;
    s.intervalo = n.intervalo; s.proximaRevisao = n.due;
  }
  // fator de facilidade mantido por compatibilidade com dados e telas antigas
  if (qualidade === 'again') s.fatorFacilidade = Math.max(FLASH_EASE_MIN, s.fatorFacilidade - 0.2);
  else if (qualidade === 'hard') s.fatorFacilidade = Math.max(FLASH_EASE_MIN, s.fatorFacilidade - 0.15);
  else if (qualidade === 'easy') s.fatorFacilidade = s.fatorFacilidade + 0.15;
  s.ultimaRevisao = hoje;
  s.estado = flashState(card);
  card.editadoEm = Date.now();
  if (!card._preview) srsRegistrarLog('f', card.id, qualidade, antes, s.intervalo, hoje);
  return card;
}

/* Simula o resultado de uma avaliação SEM aplicar de verdade — mostra ao
   lado de cada botão em quantos dias o cartão voltaria (ex.: "Bom · 6 dias"). */
function flashPreviewIntervalo(card, qualidade) {
  const prefs = srsPrefs();
  if (prefs.modo === 'adaptativo') return srsPreview(srsMemDeFlash(card), todayISO(), prefs, card.dificuldade)[qualidade];
  const clone = JSON.parse(JSON.stringify(card)); clone._preview = true;
  flashRate(clone, qualidade);
  return clone.srs.intervalo;
}
function flashFormatDias(n) {
  if (n <= 0) return 'hoje';
  if (n === 1) return '1 dia';
  if (n < 30) return n + ' dias';
  const meses = Math.round(n / 30);
  return meses === 1 ? '1 mês' : meses + ' meses';
}
