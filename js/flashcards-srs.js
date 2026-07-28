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

/* Recalcula intervalo, fator de facilidade, repetições, acertos/erros e a
   próxima data de revisão a partir da qualidade escolhida pelo usuário:
   'again' (Errei) · 'hard' (Difícil) · 'good' (Bom) · 'easy' (Fácil). */
function flashRate(card, qualidade) {
  const s = card.srs;
  if (qualidade === 'again') {
    s.erros++;
    s.repeticoes = 0;
    s.fatorFacilidade = Math.max(FLASH_EASE_MIN, s.fatorFacilidade - 0.2);
    s.intervalo = 1;
  } else {
    s.acertos++;
    if (qualidade === 'hard') {
      s.fatorFacilidade = Math.max(FLASH_EASE_MIN, s.fatorFacilidade - 0.15);
      s.intervalo = s.repeticoes === 0 ? 1 : Math.max(1, Math.round(s.intervalo * 1.2));
    } else if (qualidade === 'easy') {
      s.fatorFacilidade = s.fatorFacilidade + 0.15;
      s.intervalo = s.repeticoes === 0 ? 4 : Math.max(1, Math.round(s.intervalo * s.fatorFacilidade * 1.3));
    } else { // 'good'
      if (s.repeticoes === 0) s.intervalo = 1;
      else if (s.repeticoes === 1) s.intervalo = 6;
      else s.intervalo = Math.max(1, Math.round(s.intervalo * s.fatorFacilidade));
    }
    s.repeticoes++;
  }
  s.ultimaRevisao = todayISO();
  s.proximaRevisao = addDaysISO(todayISO(), s.intervalo);
  s.estado = flashState(card);
  card.editadoEm = Date.now();
  return card;
}

/* Simula o resultado de uma avaliação SEM aplicar de verdade — usado para
   mostrar ao usuário, ao lado de cada botão, em quantos dias o cartão
   voltaria a aparecer (ex.: "Bom · 6 dias"). */
function flashPreviewIntervalo(card, qualidade) {
  const clone = JSON.parse(JSON.stringify(card));
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
