/* ==========================================================================
   srs-core.js — motor ÚNICO de repetição espaçada da Chancelaria, usado por
   Flashcards, documentos da Biblioteca e revisões manuais.

   Algoritmo: inspirado no FSRS-5 (Free Spaced Repetition Scheduler),
   implementado sem dependências. Cada item tem:
     S (estabilidade, em dias)  — tempo para a lembrança cair a ~90 %
     D (dificuldade, 1–10)      — sobe quando você erra / acha difícil
   A probabilidade de lembrar após t dias é  R(t,S) = (1 + F·t/S)^-0,5.
   O próximo intervalo é o prazo em que R cai até a retenção-alvo
   (padrão 90 %, configurável em Configurações → Preferências de estudo).

   Ajustes próprios, documentados:
   • dificuldade informada pelo usuário (fácil/média/difícil) desloca a
     dificuldade inicial do item (−1 / 0 / +1,5);
   • proporção histórica de erros reduz até 30 % o crescimento do intervalo;
   • granularidade de 1 dia (mínimo 1 dia), teto configurável (padrão 365).
   Os 19 pesos são os padrão do FSRS-5; não há treino personalizado.
   NÃO é uma implementação oficial/completa do FSRS: faltam a otimização
   dos pesos com o seu histórico, o agendamento de revisões no mesmo dia
   (short-term), o "fuzz" e a calibração por retenção real. Use-a como um
   agendador adaptativo simples e documentado, não como o FSRS de referência.

   MÉTODO GLOBAL (Configurações → Preferências de estudo): 'adaptativo'
   (acima) ou 'fixo' (intervalos em dias configuráveis por resposta).
   TODOS os módulos (flashcards, Biblioteca, hub de Revisão) agendam por
   srsAgendar(), que respeita o método escolhido.
   Funções puras: recebem "hoje" (YYYY-MM-DD) por parâmetro → testáveis.
   ========================================================================== */
const SRS_W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const SRS_DECAY = -0.5, SRS_FACTOR = 19 / 81;
const SRS_RATING = { again: 1, hard: 2, good: 3, easy: 4 };
const SRS_FIXOS_PADRAO = { again: 7, hard: 15, good: 30, easy: 60 };   // os mesmos intervalos fixos que o app usava nos flashcards antes da v1.0.0
const SRS_NOMES = { again: 'Errei', hard: 'Difícil', good: 'Bom', easy: 'Fácil' };

function srsPrefs() {
  let p = {}; try { p = JSON.parse(localStorage.getItem('chancelaria_prefs')) || {}; } catch (e) {}
  const f = p.srsIntervalos || {}, fx = k => Math.max(1, Math.round(+f[k] || SRS_FIXOS_PADRAO[k]));
  return { modo: p.srsModo === 'fixo' ? 'fixo' : 'adaptativo', retencao: Math.min(0.97, Math.max(0.7, +p.srsRetencao || 0.9)), maxIntervalo: Math.max(7, +p.srsMaxIntervalo || 365), fixos: { again: fx('again'), hard: fx('hard'), good: fx('good'), easy: fx('easy') } };
}
const _clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const _d0 = r => SRS_W[4] - Math.exp(SRS_W[5] * (r - 1)) + 1;

function srsRetrievability(t, S) { return S > 0 ? Math.pow(1 + SRS_FACTOR * Math.max(0, t) / S, SRS_DECAY) : 0; }
function srsIntervaloPara(S, retencao, max) {
  const dias = (S / SRS_FACTOR) * (Math.pow(retencao, 1 / SRS_DECAY) - 1);
  return _clamp(Math.round(dias), 1, max || 365);
}
const _ajusteDif = dificuldade => dificuldade === 'facil' ? -1 : dificuldade === 'dificil' ? 1.5 : 0;

/* mem = { S, D, ultima:'YYYY-MM-DD'|null, reps, lapses, acertos, erros }  (item novo: S=0) */
function srsMemNovo(dificuldade) { return { S: 0, D: _clamp(_d0(3) + _ajusteDif(dificuldade), 1, 10), ultima: null, reps: 0, lapses: 0, acertos: 0, erros: 0 }; }

/* Próximo estado após avaliar `rating` ('again'|'hard'|'good'|'easy') em `hoje`. Pura. */
function srsProximo(mem, rating, hoje, prefs, dificuldade) {
  prefs = prefs || srsPrefs();
  const g = SRS_RATING[rating]; const m = Object.assign({}, mem);
  const t = m.ultima ? Math.max(0, diffDaysISO(m.ultima, hoje)) : 0;
  const R = m.S > 0 ? srsRetrievability(t, m.S) : null;
  if (!m.S || !m.ultima) {                                   // primeira revisão
    m.S = Math.max(0.1, SRS_W[g - 1]);
    m.D = _clamp(_d0(g) + _ajusteDif(dificuldade), 1, 10);
  } else {
    const D = m.D;
    // nova dificuldade (FSRS-5): passo linear + reversão à média
    const dNovo = D + (-SRS_W[6] * (g - 3)) * ((10 - D) / 9);
    m.D = _clamp(SRS_W[7] * _d0(4) + (1 - SRS_W[7]) * dNovo, 1, 10);
    if (g === 1) {                                           // esqueceu
      const sf = SRS_W[11] * Math.pow(D, -SRS_W[12]) * (Math.pow(m.S + 1, SRS_W[13]) - 1) * Math.exp((1 - R) * SRS_W[14]);
      m.S = _clamp(Math.min(sf, m.S), 0.1, 36500);
    } else {                                                 // lembrou
      const penal = g === 2 ? SRS_W[15] : 1, bonus = g === 4 ? SRS_W[16] : 1;
      let inc = 1 + Math.exp(SRS_W[8]) * (11 - D) * Math.pow(m.S, -SRS_W[9]) * (Math.exp((1 - R) * SRS_W[10]) - 1) * penal * bonus;
      const tot = (m.acertos || 0) + (m.erros || 0);
      if (tot >= 3) inc = 1 + (inc - 1) * (1 - 0.3 * ((m.erros || 0) / tot));   // histórico de erros freia o crescimento
      m.S = _clamp(m.S * inc, 0.1, 36500);
    }
  }
  m.reps = (m.reps || 0) + 1;
  if (g === 1) { m.lapses = (m.lapses || 0) + 1; m.erros = (m.erros || 0) + 1; } else m.acertos = (m.acertos || 0) + 1;
  m.ultima = hoje;
  let dias = srsIntervaloPara(m.S, prefs.retencao, prefs.maxIntervalo);
  if (g === 1) dias = 1;
  m.intervalo = dias; m.due = addDaysISO(hoje, dias); m.R = R;
  return m;
}

/* Método FIXO: o intervalo vem direto da tabela configurada. A dificuldade interna continua sendo
   atualizada (e S acompanha o intervalo) para que trocar de método depois seja contínuo. */
function srsProximoFixo(mem, rating, hoje, prefs, dificuldade) {
  const g = SRS_RATING[rating], m = Object.assign({}, mem);
  const dNovo = (m.S && m.ultima) ? m.D + (-SRS_W[6] * (g - 3)) * ((10 - m.D) / 9) : _d0(g) + _ajusteDif(dificuldade);
  m.D = _clamp((m.S && m.ultima) ? SRS_W[7] * _d0(4) + (1 - SRS_W[7]) * dNovo : dNovo, 1, 10);
  m.R = (m.S && m.ultima) ? srsRetrievability(Math.max(0, diffDaysISO(m.ultima, hoje)), m.S) : null;
  m.reps = (m.reps || 0) + 1;
  if (g === 1) { m.lapses = (m.lapses || 0) + 1; m.erros = (m.erros || 0) + 1; } else m.acertos = (m.acertos || 0) + 1;
  m.ultima = hoje; m.intervalo = prefs.fixos[rating]; m.S = m.intervalo; m.due = addDaysISO(hoje, m.intervalo);
  return m;
}
/* PONTO ÚNICO de agendamento: respeita o método global escolhido pelo usuário. */
function srsAgendar(mem, rating, hoje, prefs, dificuldade) {
  prefs = prefs || srsPrefs();
  return prefs.modo === 'fixo' ? srsProximoFixo(mem, rating, hoje, prefs, dificuldade) : srsProximo(mem, rating, hoje, prefs, dificuldade);
}

/* Intervalos previstos dos 4 botões (adaptativo: garante errei ≤ difícil < bom < fácil; fixo: a tabela). */
function srsPreview(mem, hoje, prefs, dificuldade) {
  prefs = prefs || srsPrefs();
  if (prefs.modo === 'fixo') return Object.assign({}, prefs.fixos);
  const r = {}; ['again', 'hard', 'good', 'easy'].forEach(k => { r[k] = srsProximo(mem, k, hoje, prefs, dificuldade).intervalo; });
  r.hard = Math.max(r.again, Math.min(r.hard, r.good)); r.good = Math.max(r.good, r.hard + (r.hard >= r.good ? 1 : 0)); r.easy = Math.max(r.easy, r.good + 1);
  r.good = Math.min(r.good, prefs.maxIntervalo); r.easy = Math.min(Math.max(r.easy, r.good), prefs.maxIntervalo);
  return r;
}

/* ---- Conversão de/para os formatos já existentes (sem perder dado algum) ---- */
function srsMemDeFlash(card) {
  const s = card.srs || {};
  if (s.stab > 0 && s.ultimaRevisao) return { S: s.stab, D: s.dif || 5, ultima: s.ultimaRevisao, reps: s.repeticoes || 0, lapses: s.lapsos || s.erros || 0, acertos: s.acertos || 0, erros: s.erros || 0 };
  if (s.ultimaRevisao) {                                      // cartão antigo (SM-2/intervalos fixos): estima S e D a partir do histórico
    const ease = s.fatorFacilidade || 2.5;
    return { S: Math.max(1, s.intervalo || 1), D: _clamp(9 - (ease - 1.3) * 3.33, 1, 10), ultima: s.ultimaRevisao, reps: s.repeticoes || 0, lapses: s.erros || 0, acertos: s.acertos || 0, erros: s.erros || 0 };
  }
  return Object.assign(srsMemNovo(card.dificuldade), { acertos: s.acertos || 0, erros: s.erros || 0 });
}
function srsMemDeDoc(d) {
  const s = d.srs || {};
  if (s.stab > 0 && s.lastReview) return { S: s.stab, D: s.dif || 5, ultima: s.lastReview, reps: s.reps || 0, lapses: s.lapsos || 0, acertos: s.acertos || 0, erros: s.erros || 0 };
  if (s.lastReview) return { S: Math.max(1, s.interval || 1), D: 5, ultima: s.lastReview, reps: s.reps || 0, lapses: 0, acertos: s.acertos || 0, erros: s.erros || 0 };
  return Object.assign(srsMemNovo('media'), { acertos: 0, erros: 0 });
}

/* Log de revisões (alimenta histórico e curva de retenção). Mantém os últimos 4000. */
function srsRegistrarLog(tipo, id, rating, R, intervalo, hoje, extra) {
  const log = load('srs_log', []);
  log.push(Object.assign({ t: hoje || todayISO(), k: tipo, id, r: SRS_RATING[rating], R: R == null ? null : Math.round(R * 100) / 100, i: intervalo, m: srsPrefs().modo }, extra || {}));
  save('srs_log', log.slice(-4000));
}
