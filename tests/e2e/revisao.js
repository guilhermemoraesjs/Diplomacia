// Revisão espaçada: hub unificado (flashcards + Biblioteca + manual), método ADAPTATIVO e FIXO, dificuldade, lapsos, histórico, persistência e sincronização.
const H = require('./helpers'); const { check } = H;
(async () => {
  await H.emuOuSair(); const d = await H.abrir(), p = d.p, ev = (f, a) => p.evaluate(f, a);
  const hoje = await ev(() => todayISO());
  const semear = () => ev(() => { flashCards = []; flashCriarCard({ frente: 'Quem criou a OMC?', verso: 'Rodada Uruguai', disciplina: 'Economia', dificuldade: 'media' }); biblioDocs = [{ id: 'dnovo', titulo: 'Fichamento OMC', conteudo: '<p>GATT e OMC</p>', tags: [], criadoEm: Date.now(), srsAtivo: true, srs: { modo: 'automatico', interval: 1, reps: 0, nextReview: todayISO(), lastReview: null } }]; save('biblio_docs', biblioDocs); revisao = []; save('diplo_revisao', revisao); save('srs_log', []); });
  const sessao = async (ratings) => { await H.ir(p, 'revisao'); await p.click('#revisaoRoot >> text=Iniciar revisão'); for (const r of ratings) { const m = p.locator('.rv-botoes >> text=Mostrar resposta'); if (await m.count()) await m.click(); await p.locator('.rv-rate', { hasText: r }).click(); await H.sleep(120); } };

  console.log('\n[Método ADAPTATIVO (padrão)]');
  await semear(); await H.ir(p, 'revisao'); check(await ev(() => srsPrefs().modo) === 'adaptativo', 'método padrão é adaptativo');
  let c = await ev(() => revisaoContagens()); check(c.hoje === 2 && c.devidas === 2 && c.atrasadas === 0, 'hub reúne 1 flashcard + 1 documento vencendo hoje', JSON.stringify(c));
  check((await p.locator('#revisaoRoot .rv-item').allTextContents()).join('|').includes('Quem criou a OMC?') && (await p.locator('#revisaoRoot .rv-item').allTextContents()).join('|').includes('Fichamento OMC'), 'lista mostra os dois itens, com tipo e "Novo"');
  await p.click('#revisaoRoot >> text=Iniciar revisão'); await p.click('.rv-botoes >> text=Mostrar resposta');
  const prev = await ev(() => srsPreview(srsMemDeFlash(flashCards[0]), todayISO(), srsPrefs(), 'media'));
  const rot = await p.locator('.rv-rate').allTextContents(); check(prev.again <= prev.hard && prev.hard < prev.good && prev.good < prev.easy && rot[2].includes(await ev(n => flashFormatDias(n), prev.good)), 'botões Errei/Difícil/Bom/Fácil mostram intervalos crescentes; "Bom" = previsão do motor', JSON.stringify([prev, rot]));
  await p.locator('.rv-rate', { hasText: 'Bom' }).click(); await H.sleep(150);
  let f = await ev(() => flashCards[0].srs); check(f.stab > 0 && f.dif >= 1 && f.acertos === 1 && f.erros === 0 && f.intervalo === prev.good && f.ultimaRevisao === hoje && f.proximaRevisao === await ev(n => addDaysISO(todayISO(), n), prev.good), 'flashcard: estabilidade/dificuldade gravadas, intervalo = previsão, próxima revisão = hoje + intervalo', JSON.stringify(f));
  const prevD = await ev(() => srsPreview(srsMemDeDoc(biblioDocs[0]), todayISO(), srsPrefs(), 'media')); check(prevD.good === prev.good, 'documento novo tem a MESMA previsão que flashcard novo (consistência entre módulos)', JSON.stringify([prev, prevD]));
  await p.click('.rv-botoes >> text=Mostrar resposta'); await p.locator('.rv-rate', { hasText: 'Difícil' }).click(); await H.sleep(150);
  let dd = await ev(() => biblioDocs[0].srs); check(dd.stab > 0 && dd.lastReview === hoje && dd.nextReview === await ev(n => addDaysISO(todayISO(), n), prevD.hard) && dd.interval === prevD.hard && dd.reps === 1 && dd.acertos === 1, 'documento: "Difícil" agenda pelo motor e mantém campos antigos (interval, reps, nextReview, lastReview)', JSON.stringify(dd));
  check((await p.textContent('#revisaoRoot')).includes('Revisão concluída') && await ev(() => revisaoContagens().devidas) === 0, 'sessão concluída e nada mais pendente'); await p.click('#revisaoRoot >> text=Voltar');
  let log = await ev(() => load('srs_log', [])); check(log.length === 2 && log[0].k === 'f' && log[0].r === 3 && log[0].m === 'adaptativo' && log[0].d >= 1 && log[0].l === 0 && log[1].k === 'd' && log[1].r === 2, 'histórico registra tipo, nota, método, dificuldade interna e lapsos', JSON.stringify(log));
  await p.click('#revisaoRoot .subtab-btn:has-text("Histórico")'); check((await p.textContent('#revisaoRoot')).includes('Bom') && (await p.textContent('#revisaoRoot')).includes('Difícil'), 'aba Histórico mostra as avaliações');

  console.log('\n[Lapsos e dificuldade]');
  await ev(() => { const s = flashCards[0].srs; s.ultimaRevisao = addDaysISO(todayISO(), -s.intervalo); s.proximaRevisao = todayISO(); flashSaveAll(); }); await sessao(['Errei']);
  f = await ev(() => flashCards[0].srs); check(f.erros === 1 && f.lapsos === 1 && f.intervalo === 1 && f.proximaRevisao === await ev(() => addDaysISO(todayISO(), 1)) && f.repeticoes === 0, 'errar: lapso contado, intervalo 1 dia, repetições zeradas, volta amanhã', JSON.stringify(f));
  const dif0 = f.dif; await ev(() => { const s = flashCards[0].srs; s.ultimaRevisao = addDaysISO(todayISO(), -1); s.proximaRevisao = todayISO(); flashSaveAll(); }); await sessao(['Fácil']); f = await ev(() => flashCards[0].srs);
  check(f.dif < dif0 && f.acertos === 2 && f.erros === 1, '"Fácil" reduz a dificuldade interna e mantém o histórico de acertos/erros', JSON.stringify([dif0, f.dif]));
  const dif = await ev(() => [srsMemNovo('facil').D, srsMemNovo('media').D, srsMemNovo('dificil').D]); check(dif[0] < dif[1] && dif[1] < dif[2], 'dificuldade informada pelo usuário (fácil < média < difícil) muda a dificuldade inicial', JSON.stringify(dif));

  console.log('\n[Persistência 1: recarregar]');
  await H.recarregar(p); check(await ev(() => flashCards[0].srs.acertos === 2 && flashCards[0].srs.lapsos === 1 && flashCards[0].srs.stab > 0 && biblioDocs[0].srs.stab > 0 && load('srs_log', []).length === 4), 'estado de revisão de cartão e documento preservado após recarregar');

  console.log('\n[Método FIXO configurável]');
  await H.ir(p, 'configuracoes'); await p.selectOption('#pfModo', 'fixo'); await H.sleep(200); for (const [k, v] of [['again', 2], ['hard', 4], ['good', 6], ['easy', 8]]) { await p.fill(`#pfFx_${k}`, String(v)); await p.dispatchEvent(`#pfFx_${k}`, 'change'); }
  check(await ev(() => { const s = srsPrefs(); return s.modo === 'fixo' && s.fixos.again === 2 && s.fixos.hard === 4 && s.fixos.good === 6 && s.fixos.easy === 8; }), 'configuração global salva: método fixo 2/4/6/8 dias'); check((await p.textContent('#cfgPrefs')).includes('não é uma implementação oficial'), 'tela informa que o modo adaptativo NÃO é o FSRS oficial');
  await semear(); await H.ir(p, 'revisao'); await p.click('#revisaoRoot >> text=Iniciar revisão'); await p.click('.rv-botoes >> text=Mostrar resposta'); const rf = await p.locator('.rv-rate').allTextContents();
  check(rf[0].includes('2 dias') && rf[1].includes('4 dias') && rf[2].includes('6 dias') && rf[3].includes('8 dias'), 'botões do flashcard mostram exatamente 2/4/6/8 dias', JSON.stringify(rf));
  await p.locator('.rv-rate', { hasText: 'Bom' }).click(); await H.sleep(120); await p.click('.rv-botoes >> text=Mostrar resposta'); await p.locator('.rv-rate', { hasText: 'Fácil' }).click(); await H.sleep(150);
  check(await ev(() => flashCards[0].srs.intervalo === 6 && flashCards[0].srs.proximaRevisao === addDaysISO(todayISO(), 6) && biblioDocs[0].srs.interval === 8 && biblioDocs[0].srs.nextReview === addDaysISO(todayISO(), 8)), 'FIXO: cartão "Bom" = +6 dias e documento "Fácil" = +8 dias (intervalos configurados respeitados nos DOIS módulos)');
  log = await ev(() => load('srs_log', [])); check(log.length === 2 && log.every(l => l.m === 'fixo'), 'histórico marca o método usado (fixo)');
  await ev(() => { const s = flashCards[0].srs; s.proximaRevisao = todayISO(); flashSaveAll(); }); await sessao(['Errei']); check(await ev(() => flashCards[0].srs.intervalo === 2 && flashCards[0].srs.lapsos === 1 && flashCards[0].srs.erros === 1), 'FIXO: "Errei" = +2 dias e conta o lapso');
  await H.recarregar(p); check(await ev(() => srsPrefs().modo === 'fixo' && srsPrefs().fixos.good === 6 && flashCards[0].srs.intervalo === 2), 'persistência 2: método e intervalos fixos preservados após recarregar');
  await H.ir(p, 'configuracoes'); await p.selectOption('#pfModo', 'adaptativo'); await semear(); check(await ev(() => { const a = srsPreview(srsMemDeFlash(flashCards[0]), todayISO(), srsPrefs(), 'media'); return srsPrefs().modo === 'adaptativo' && a.good === 3 && a.good !== 6; }), 'voltar ao adaptativo restaura a previsão do motor (não usa a tabela fixa)');

  console.log('\n[Dados antigos de revisão (formatos anteriores)]');
  await ev(() => { flashCards = []; flashCriarCard({ frente: 'Antigo', verso: 'x' }); const s = flashCards[0].srs; Object.assign(s, { estado: 'maduro', intervalo: 30, fatorFacilidade: 2.5, repeticoes: 4, acertos: 5, erros: 1, ultimaRevisao: addDaysISO(todayISO(), -30), proximaRevisao: todayISO() }); delete s.stab; delete s.dif; flashSaveAll(); biblioDocs = [{ id: 'dold', titulo: 'Doc antigo', conteudo: '', tags: [], criadoEm: 1, srsAtivo: true, srs: { modo: 'automatico', interval: 10, reps: 3, nextReview: todayISO(), lastReview: addDaysISO(todayISO(), -10) } }]; save('biblio_docs', biblioDocs); });
  await sessao(['Bom', 'Bom']); const old = await ev(() => ({ c: flashCards[0].srs, d: biblioDocs[0].srs }));
  check(old.c.acertos === 6 && old.c.erros === 1 && old.c.intervalo > 30 && old.c.stab > 30 && old.c.repeticoes === 5 && old.d.reps === 4 && old.d.interval > 10 && old.d.lastReview === hoje, 'cartão e documento no formato antigo continuam funcionando, com histórico de acertos/erros e intervalos preservados e crescendo', JSON.stringify(old));

  console.log('\n[Revisão manual (D+1/D+7/D+30)]');
  await ev(() => { revisao = [{ id: 'rm', tema: 'Sintaxe', materia: 'Português', dataEstudo: addDaysISO(todayISO(), -1), r1: false, r2: false, r3: false }]; save('diplo_revisao', revisao); flashCards = []; flashSaveAll(); biblioDocs = []; save('biblio_docs', biblioDocs); });
  await H.ir(p, 'revisao'); check(await ev(() => revisaoContagens().devidas) === 1 && (await p.textContent('#revisaoRoot')).includes('1ª revisão'), 'revisão manual vencida aparece no hub'); await p.click('#revisaoRoot >> text=Iniciar revisão'); await p.click('.rv-botoes >> text=Concluir revisão'); await H.sleep(150);
  check(await ev(() => revisao[0].r1 === true && revisao[0].r2 === false), 'concluir marca somente a 1ª revisão'); await H.recarregar(p); check(await ev(() => revisao[0].r1 === true), 'persistência 3: revisão manual concluída preservada');
  await H.ir(p, 'revisao'); await p.click('#revisaoRoot .subtab-btn:has-text("Retenção")'); check((await p.textContent('#revisaoRoot')).length > 20, 'aba Retenção renderiza');

  console.log('\n[Sincronização do estado de revisão entre aparelhos]');
  await ev(() => { flashCards = []; flashCriarCard({ frente: 'Sync SRS', verso: 'v', dificuldade: 'dificil' }); }); await sessao(['Bom']); await H.esperar(p, () => pendingSyncCount() === 0, null, 20000);
  const local = await ev(() => flashCards[0].srs), B = await H.novoAparelho(); await H.login(B, d.sub); const remoto = await B.p.evaluate(() => flashCards[0] && flashCards[0].srs);
  check(remoto && remoto.stab === local.stab && remoto.dif === local.dif && remoto.proximaRevisao === local.proximaRevisao && remoto.acertos === local.acertos, 'segundo aparelho recebe o estado de revisão idêntico (estabilidade, dificuldade, próxima data, acertos)', JSON.stringify([local, remoto]));
  await B.b.close(); check(d.erros.length === 0, 'nenhum erro de JavaScript', d.erros.join(' | '));
  await d.b.close(); process.exit(H.resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
