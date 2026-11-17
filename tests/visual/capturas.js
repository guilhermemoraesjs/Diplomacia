// Capturas de tela para revisão visual (não é teste de aprovação): abre o app no emulador,
// cria dados de exemplo NO USUÁRIO DE TESTE e fotografa cada módulo em desktop e celular.
// Uso: (emulador + servidor rodando) node tests/visual/capturas.js [pasta-saida] [tema]
const H = require('../e2e/helpers'); const path = require('path'); const fs = require('fs');
const OUT = process.argv[2] || path.join(__dirname, 'saida'); const TEMA = process.argv[3] || 'dark';
const ABAS = ['inicio', 'cronograma', 'materias', 'revisao', 'questoes', 'simulados', 'flashcards', 'discursivas', 'atualidades', 'paises', 'organizacoes', 'conhecimento', 'biblioteca', 'notas', 'configuracoes'];
async function semear(p) {
  await p.evaluate(() => {
    const hoje = todayISO(), br = d => isoToBR(addDaysISO(hoje, d));
    cronograma = [
      { id: 'c1', tema: 'Teoria realista das RI', materia: materias[0].nome, data: br(0), prioridade: 'alta', duracaoMin: 90, feito: false },
      { id: 'c2', tema: 'Crase e regência', materia: materias[1 % materias.length].nome, data: br(0), prioridade: 'media', duracaoMin: 60, feito: true },
      { id: 'c3', tema: 'Tratado de Tordesilhas', materia: materias[2 % materias.length].nome, data: br(-2), prioridade: 'media', duracaoMin: 45, feito: false },
      { id: 'c4', tema: 'Balanço de pagamentos', materia: materias[3 % materias.length].nome, data: br(1), prioridade: 'baixa', duracaoMin: 60, feito: false },
      { id: 'c5', tema: 'Direito dos tratados', materia: materias[4 % materias.length].nome, data: br(2), prioridade: 'alta', duracaoMin: 120, feito: false }
    ].map(crNorm); crSalvar();
    for (let i = 0; i < 12; i++) registrarEstudo({ data: addDaysISO(hoje, -i), materia: materias[i % materias.length].nome, minutos: 30 + (i * 17) % 110, origem: 'manual', refId: 'x' + i });
    questoes = [
      { id: 'q1', tipo: 'ce', enunciado: 'O GATT foi sucedido pela OMC em 1995.', gabarito: 'C', materia: materias[0].nome, assunto: 'Comércio' },
      { id: 'q2', tipo: 'multipla', enunciado: 'Qual organização sucedeu o GATT?', alternativas: [{ letra: 'A', texto: 'OMC' }, { letra: 'B', texto: 'FMI' }], gabarito: 'A', materia: materias[0].nome },
      { id: 'q3', tipo: 'ce', enunciado: 'O Brasil é membro permanente do CSNU.', gabarito: 'E', materia: materias[2 % materias.length].nome }
    ].map(qNorm); qSalvar();
    questoesHist = [{ id: 'h1', qid: 'q1', t: Date.now(), resposta: 'C', correta: true }, { id: 'h2', qid: 'q3', t: Date.now(), resposta: 'C', correta: false }, { id: 'h3', qid: 'q2', t: Date.now(), resposta: 'A', correta: true }]; qSalvarHist();
    if (typeof flashCriarCard === 'function') { flashCriarCard({ frente: 'Quem criou a OMC?', verso: 'Rodada Uruguai', disciplina: 'Economia', dificuldade: 'media' }); flashCriarCard({ frente: 'Ano da Carta da ONU', verso: '1945', disciplina: 'História', dificuldade: 'facil' }); }
    biblioDocs = [{ id: 'd1', titulo: 'Fichamento — OMC e o sistema multilateral', conteudo: '<h2>GATT</h2><p>Acordo Geral de Tarifas e Comércio, 1947.</p>', tags: ['comércio'], criadoEm: Date.now(), srsAtivo: true, srs: { modo: 'automatico', interval: 1, reps: 0, nextReview: hoje, lastReview: null } }]; save('biblio_docs', biblioDocs);
    revisao = [{ id: 'r1', tema: 'Sintaxe', materia: materias[1 % materias.length].nome, data: br(-1), r1: hoje, r2: br(6), r3: br(29) }]; save('diplo_revisao', revisao);
    if (typeof atualidades !== 'undefined') { atualidades.push(atNorm({ id: 'a1', titulo: 'Cúpula do BRICS', data: hoje, resumo: 'Ampliação do bloco e agenda de pagamentos em moeda local.', tema: 'Política externa', tags: ['BRICS'] })); save('diplo_atualidades', atualidades); }
  });
}
(async () => {
  await H.emuOuSair(); fs.mkdirSync(OUT, { recursive: true });
  for (const [nome, ctx] of [['desktop', { viewport: { width: 1366, height: 900 } }], ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }]]) {
    const d = await H.abrir({ context: ctx }); await semear(d.p);
    await d.p.evaluate(t => { document.body.setAttribute('data-theme', t); if (typeof aplicarIconeTema === 'function') aplicarIconeTema(); }, TEMA);
    for (const a of ABAS) {
      await H.ir(d.p, a); await H.sleep(500);
      await d.p.screenshot({ path: path.join(OUT, `${nome}-${a}.png`), fullPage: process.env.FULL !== '0' });
    }
    if (nome === 'mobile') { await d.p.evaluate(() => abrirMais()); await H.sleep(400); await d.p.screenshot({ path: path.join(OUT, `mobile-mais.png`) }); await d.p.evaluate(() => fecharMais()); }
    /* estados internos: modais, editores, sessões */
    const ESTADOS = [
      ['modal-crono', async () => { await H.ir(d.p, 'cronograma'); await d.p.evaluate(() => crNovo(todayISO())); }],
      ['modal-questao', async () => { await H.ir(d.p, 'questoes'); await d.p.evaluate(() => qAbrirForm()); }],
      ['flash-criar', async () => { await H.ir(d.p, 'flashcards'); await d.p.evaluate(() => flashShowPanel('criar')); }],
      ['flash-lista', async () => { await H.ir(d.p, 'flashcards'); await d.p.evaluate(() => flashShowPanel('lista')); }],
      ['biblio-editor', async () => { await H.ir(d.p, 'biblioteca'); await d.p.evaluate(() => novoDocumento()); }],
      ['pais-detalhe', async () => { await H.ir(d.p, 'paises'); await d.p.evaluate(() => abrirPaisDetalhe('br')); await H.sleep(800); }],
      ['revisao-sessao', async () => { await H.ir(d.p, 'revisao'); await d.p.evaluate(() => rvIniciar()); }],
      ['timer', async () => { await H.ir(d.p, 'inicio'); await d.p.evaluate(() => abrirTimerModal()); }]
    ];
    for (const [n, fn] of ESTADOS) {
      try { await fn(); await H.sleep(500); await d.p.screenshot({ path: path.join(OUT, `${nome}-estado-${n}.png`), fullPage: process.env.FULL !== '0' }); }
      catch (e) { console.log('estado', n, 'falhou:', e.message.split('\n')[0]); }
      await d.p.keyboard.press('Escape'); await d.p.evaluate(() => document.querySelectorAll('.modal-overlay.show').forEach(m => { if (m.id) m.classList.remove('show'); else m.remove(); })).catch(() => {});
    }
    console.log(nome, 'erros:', d.erros.length ? d.erros : 'nenhum');
    await d.b.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
