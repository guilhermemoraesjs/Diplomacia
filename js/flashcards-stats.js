/* ==========================================================================
   flashcards-stats.js — módulo "Flashcards → Estatísticas": só lê os dados
   já salvos (flashCards / flashTempos / flashStreakDias) e calcula números
   agregados. Não sabe desenhar nada sozinho além do próprio painel de
   estatísticas — o dashboard resumido fica em flashcards-ui.js, que chama
   estas funções de cálculo.
   ========================================================================== */

function flashCalcularStats() {
  const hoje = todayISO();
  const paraHoje = flashCards.filter(c => c.srs.proximaRevisao <= hoje);
  const vencidos = flashCards.filter(flashIsVencido);
  const totalAcertos = flashCards.reduce((a, c) => a + c.srs.acertos, 0);
  const totalErros = flashCards.reduce((a, c) => a + c.srs.erros, 0);
  const totalRespostas = totalAcertos + totalErros;
  const pctAcerto = totalRespostas ? Math.round((totalAcertos / totalRespostas) * 100) : 0;

  const porDisciplina = {};
  flashCards.forEach(c => {
    const d = c.disciplina || 'Sem disciplina';
    if (!porDisciplina[d]) porDisciplina[d] = { total: 0, revisoes: 0, acertos: 0, erros: 0 };
    porDisciplina[d].total++;
    porDisciplina[d].revisoes += c.srs.acertos + c.srs.erros;
    porDisciplina[d].acertos += c.srs.acertos;
    porDisciplina[d].erros += c.srs.erros;
  });
  let disciplinaMaisRevisada = null, disciplinaComMaisErros = null;
  Object.entries(porDisciplina).forEach(([nome, v]) => {
    if (!disciplinaMaisRevisada || v.revisoes > porDisciplina[disciplinaMaisRevisada].revisoes) disciplinaMaisRevisada = nome;
    if (!disciplinaComMaisErros || v.erros > porDisciplina[disciplinaComMaisErros].erros) disciplinaComMaisErros = nome;
  });
  if (disciplinaMaisRevisada && porDisciplina[disciplinaMaisRevisada].revisoes === 0) disciplinaMaisRevisada = null;
  if (disciplinaComMaisErros && porDisciplina[disciplinaComMaisErros].erros === 0) disciplinaComMaisErros = null;

  const tempos = flashTempos.map(t => t.segundos).filter(s => s > 0);
  const tempoMedioSeg = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;

  const porTipo = {};
  flashCards.forEach(c => { porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1; });

  const porEstado = { novo: 0, aprendizado: 0, maduro: 0 };
  flashCards.forEach(c => { porEstado[flashState(c)]++; });

  return {
    total: flashCards.length,
    paraHoje: paraHoje.length,
    vencidos: vencidos.length,
    pctAcerto, totalAcertos, totalErros,
    streak: flashCalcularStreakAtual(),
    disciplinaMaisRevisada, disciplinaComMaisErros,
    tempoMedioSeg,
    porDisciplina, porTipo, porEstado
  };
}

/* Revisões feitas por dia nos últimos 7 dias — para o gráfico de evolução,
   no mesmo estilo do gráfico já usado em Simulados (renderLineChart). */
function flashRevisoesUltimosDias(dias) {
  const arr = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const label = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()];
    const count = flashTempos.filter(t => t.data === iso).length;
    arr.push({ label, iso, valor: count });
  }
  return arr;
}

function flashFmtSeg(s) {
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60); const r = s % 60;
  return `${m}m ${r}s`;
}
