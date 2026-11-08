// Compatibilidade com dados ANTIGOS (formatos anteriores à v1.0.0): leitura, exibição, nenhuma perda de campo e uso normal.
const H = require('./helpers'); const { check } = H;
const LEGADO = {
  diplo_cronograma: [{ id: 'c1', tema: 'Guerra do Paraguai', estudar: 'Cap. 3', semana: 'Semana 5', tempo: '2h30', data: '05/11/2026', materia: '🌐 História Mundial', feito: false }, { id: 'c2', tema: 'Sem data', estudar: '', semana: '—', tempo: '—', data: '—', materia: '🌐 História Mundial', feito: true }],
  diplo_questoes: [{ id: 'q1', materia: '🌐 História Mundial', topico: 't1', tipo: 'C/E', fonte: 'CACD 2019', contexto: 'Texto-base sobre a Guerra Fria.', itens: [{ id: 'i1', texto: 'A OTAN foi criada em 1949.', gabarito: 'C' }, { id: 'i2', texto: 'O Pacto de Varsóvia é anterior.', gabarito: 'E' }], revisada: true }],
  diplo_discursivas: [{ id: 'd1', materia: '🌐 História Mundial', tema: 'Discuta a Guerra Fria.', linhas: '90 lines', tempoSeg: 120, historyTempos: [60, 60] }],
  diplo_atualidades: [{ id: 'a1', titulo: 'Evento antigo', resumo: 'Resumo antigo', criadoEm: 1700000000000 }],
  diplo_notas: [{ id: 'n1', titulo: 'Nota antiga', texto: 'Texto', criadoEm: 1700000000000 }],
  diplo_revisao: [{ id: 'r1', tema: 'Sintaxe', materia: 'Português', topicoId: null, dataEstudo: '2026-11-01', r1: true, r2: false, r3: false, r1Data: null, r2Data: null, r3Data: null }],
  biblio_pastas: [{ id: 'p1', nome: '📂 Direito', parentId: null }],
  biblio_docs: [{ id: 'b1', titulo: 'Doc antigo', conteudo: '<p>Conteúdo <b>antigo</b></p>', tipo: '🗂️', pastaId: 'p1', tags: ['velha'], autor: 'Fulano', fonte: 'Livro', materia: '🌐 História Mundial', data: '2025-01-02', prioridade: 'alta', srsAtivo: true, srs: { modo: 'automatico', interval: 7, reps: 2, nextReview: '2026-11-01', lastReview: '2026-10-25' }, observacoes: 'obs', criadoEm: 1700000000000, favorita: true }],
  flash_cards: [{ id: 'f1', tipo: 'basico', frente: 'Frente antiga', verso: 'Verso antigo', comparacaoA: { titulo: '', conteudo: '' }, comparacaoB: { titulo: '', conteudo: '' }, imagemFrenteUrl: '', imagemVersoUrl: '', clozeTexto: '', clozeIndex: null, clozeGrupoId: null, disciplina: 'História', tema: 'Guerra Fria', subtema: '', tags: ['x'], dificuldade: 'dificil', fonte: '', origemTipo: 'manual', origemRefId: null, criadoEm: 1700000000000, editadoEm: 1700000000000, srs: { estado: 'maduro', intervalo: 30, fatorFacilidade: 2.5, repeticoes: 3, acertos: 4, erros: 1, ultimaRevisao: '2026-10-01', proximaRevisao: '2026-10-31' } }],
  dashboard_streak: ['2026-11-06', '2026-11-07'], dashboard_metas: { diaria: 15, mensal: 600 }, simulados_progresso: { respondidas: { '2019-q1': { escolha: 'B', correta: true, tempoSeg: 30, data: '2026-11-05T23:30:00.000Z' } }, favoritas: [], revisao: [], anotacoes: {} }, nav_order: ['paises', 'inicio'], chancelaria_theme: 'light'
};
function contem(orig, atual, caminho) { // todo campo do original precisa existir, igual, no atual (o atual pode ter MAIS campos)
  if (orig === null || typeof orig !== 'object') return orig === atual ? [] : [`${caminho}: ${JSON.stringify(orig)} ≠ ${JSON.stringify(atual)}`];
  if (atual === null || typeof atual !== 'object') return [`${caminho}: objeto sumiu`];
  if (Array.isArray(orig)) return orig.length === atual.length ? orig.flatMap((x, i) => contem(x, atual[i], caminho + '[' + i + ']')) : [`${caminho}: tamanho ${orig.length} → ${atual.length}`];
  return Object.keys(orig).flatMap(k => contem(orig[k], atual[k], caminho + '.' + k));
}
(async () => {
  await H.emuOuSair(); const d = await H.novoAparelho(); const p = d.p, ev = (f, a) => p.evaluate(f, a);
  await d.ctx.addInitScript(l => { if (!localStorage.getItem('__legado')) { localStorage.setItem('__legado', '1'); Object.entries(l).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v))); } }, LEGADO);
  await p.goto(process.env.CHANC_URL || 'http://localhost:8123/index.html'); await p.waitForFunction(() => window.__EMU_ACTIVE === true); check(await H.login(d, 'legado' + Date.now()), 'app abre com dados antigos já salvos');
  console.log('\n[Leitura e exibição dos dados antigos]');
  check(d.erros.length === 0, 'carregou sem erros de JavaScript', d.erros.join(' | '));
  await H.ir(p, 'cronograma'); await p.click('#cronoRoot .subtab-btn:has-text("Lista")'); let t = await p.textContent('.cr-corpo'); check(t.includes('Guerra do Paraguai') && t.includes('Sem data') && t.includes('Atrasada'), 'cronograma: itens antigos listados (data passada = atrasada; "—" = sem data)');
  check(await ev(() => { const x = cronograma[0]; return x.duracaoMin === 150 && x.prioridade === 'media' && crStatus(x) === 'atrasada' && cronograma[1].feito && crStatus(cronograma[1]) === 'concluida'; }), 'campos novos derivados do antigo ("2h30" → 150 min; prioridade padrão; status)');
  await H.ir(p, 'questoes'); t = await p.textContent('#qbRoot'); check(t.includes('Texto-base sobre a Guerra Fria.') && t.includes('A OTAN foi criada em 1949.'), 'questão antiga (contexto + itens) exibida com o texto composto'); check(await ev(() => questoes[0].tipo === 'ce' && questoes[0].assunto !== undefined && questoes[0].revisar === true), 'questão antiga: tipo "C/E" → ce; "revisada" → revisar');
  await H.ir(p, 'discursivas'); t = await p.textContent('#dlRoot'); check(t.includes('Discuta a Guerra Fria.') && t.includes('até 90 linhas'), 'discursiva antiga: limite "90 lines" interpretado como 90 linhas');
  await H.ir(p, 'atualidades'); check((await p.textContent('#atRoot')).includes('Evento antigo') && await ev(() => atualidades[0].data === ymdLocal(new Date(1700000000000))), 'atualidade antiga exibida; data derivada de criadoEm no fuso local');
  await H.ir(p, 'notas'); check((await p.textContent('#notasRoot')).includes('Nota antiga'), 'anotação antiga exibida');
  await H.ir(p, 'biblioteca'); await p.locator('.biblio-doc-card', { hasText: 'Doc antigo' }).click(); await H.sleep(200); check((await p.innerText('#viewConteudo')).includes('Conteúdo antigo') && await p.locator('#viewIcon svg').count() === 1 && (await p.textContent('#viewTags')).includes('velha'), 'documento antigo abre: conteúdo, tipo (emoji → ícone) e tags');
  console.log('\n[Uso normal sobre dados antigos]');
  await H.ir(p, 'revisao'); check(await ev(() => revisaoContagens().devidas) === 3, 'revisão: documento, flashcard e a 2ª revisão manual aparecem vencidos', await ev(() => JSON.stringify(revisaoContagens()))); await p.click('#revisaoRoot >> text=Iniciar revisão');
  for (let i = 0; i < 3; i++) { const m = p.locator('.rv-botoes >> text=Mostrar resposta'); if (await m.count()) await m.click(); const b = p.locator('.rv-rate', { hasText: 'Bom' }); if (await b.count()) await b.click(); else await p.click('.rv-botoes >> text=Concluir revisão'); await H.sleep(120); }
  check(await ev(() => flashCards[0].srs.acertos === 5 && flashCards[0].srs.erros === 1 && flashCards[0].srs.intervalo > 30 && biblioDocs[0].srs.reps === 3 && biblioDocs[0].srs.interval > 7 && revisao[0].r2 === true), 'revisão de cartão SM-2 antigo, documento antigo e revisão manual antiga funcionam e preservam o histórico');
  console.log('\n[Nenhuma perda de dados]');
  await ev(() => { crSalvar(); qSalvar(); dlSalvar(); atSalvar(); notasSalvar(); }); await H.recarregar(p);
  const atual = await ev(k => Object.fromEntries(k.map(x => [x, JSON.parse(localStorage.getItem(x))])), Object.keys(LEGADO));
  const esperados = { ...LEGADO }; // flash_cards, biblio_docs, diplo_revisao foram alterados de propósito pela revisão acima: comparar o que NÃO é do estado de revisão
  const difs = [];
  ['diplo_cronograma', 'diplo_discursivas', 'diplo_atualidades', 'diplo_notas', 'biblio_pastas', 'dashboard_metas', 'nav_order', 'chancelaria_theme'].forEach(k => difs.push(...contem(esperados[k], atual[k], k)));
  // EXCEÇÃO DOCUMENTADA: tipo 'C/E' é normalizado para 'ce' ao regravar. O módulo antigo de questões era um stub (addQuestao() vazia),
  // portanto nunca produziu questões salvas; todos os OUTROS campos legados (contexto, itens, topico, fonte, revisada) são exigidos idênticos.
  const q0 = { ...esperados.diplo_questoes[0] }; delete q0.tipo; difs.push(...contem(q0, atual.diplo_questoes[0], 'diplo_questoes[0]'));
  const { srs: _s1, ...docSemSrs } = esperados.biblio_docs[0]; difs.push(...contem(docSemSrs, atual.biblio_docs[0], 'biblio_docs[0]'));
  const { srs: _s2, editadoEm: _e, ...cardSemSrs } = esperados.flash_cards[0]; difs.push(...contem(cardSemSrs, atual.flash_cards[0], 'flash_cards[0]'));
  difs.push(...contem(esperados.simulados_progresso, atual.simulados_progresso, 'simulados_progresso'));
  difs.push(...contem({ ...esperados.diplo_revisao[0], r2: true }, atual.diplo_revisao[0], 'diplo_revisao[0]'));
  check(difs.length === 0, 'todos os campos originais continuam presentes e idênticos após salvar tudo de novo e recarregar', difs.slice(0, 4).join(' | '));
  check(await ev(() => load('dashboard_streak', []).slice(0, 2).join() === '2026-11-06,2026-11-07'), 'sequência de estudos antiga preservada');
  await H.esperar(p, () => pendingSyncCount() === 0, null, 20000); const cloud = await H.fsGet(await ev(() => currentUid)); check(cloud && cloud.diplo_cronograma[0].tema === 'Guerra do Paraguai' && cloud.flash_cards[0].srs.acertos === 5, 'dados antigos (e a revisão) foram enviados à nuvem sem perda');
  check(d.erros.length === 0, 'nenhum erro de JavaScript na sessão', d.erros.join(' | '));
  await d.b.close(); process.exit(H.resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
