// Laboratório de discursivas: proposta, editor com cronômetro/autosave/limite, versões, restauração, avaliação, histórico e persistência.
const H = require('./helpers'); const { check } = H;
(async () => {
  await H.emuOuSair(); const d = await H.abrir(), p = d.p, ev = (f, a) => p.evaluate(f, a);
  await H.ir(p, 'discursivas'); const M = await ev(() => materias[2].nome);

  console.log('\n[Proposta]');
  await p.click('.page-actions >> text=Nova proposta'); await p.click('#crModal .modal-actions >> text=Salvar'); check((await p.textContent('#dlfErro')).includes('tema'), 'proposta sem tema é recusada'); 
  await p.fill('#dlfTema', 'Discuta a política externa brasileira.'); await p.selectOption('#dlfMat', M); await p.selectOption('#dlfTipo', 'Redação'); await p.fill('#dlfLim', '5'); await p.fill('#dlfTags', 'PEB, multilateralismo'); await p.click('#crModal .modal-actions >> text=Salvar'); await H.sleep(150);
  check(await ev(m => discursivas.length === 1 && discursivas[0].tema.startsWith('Discuta') && discursivas[0].materia === m && discursivas[0].limiteLinhas === 5 && discursivas[0].tags.join() === 'PEB,multilateralismo' && discursivas[0].producoes.length === 0, M), 'proposta salva (matéria, tipo, limite 5, tags, sem produções)');
  await p.locator('.dl-card [aria-label="Editar proposta"]').click(); await p.fill('#dlfTema', 'Discuta a política externa brasileira no século XXI.'); await p.click('#crModal .modal-actions >> text=Salvar'); await H.sleep(150);
  check(await ev(() => discursivas[0].tema.endsWith('século XXI.')), 'edição da proposta aplicada');
  await H.recarregar(p); check(await ev(() => discursivas.length === 1 && discursivas[0].tema.endsWith('XXI.') && discursivas[0].limiteLinhas === 5), 'persistência 1: proposta editada preservada');

  console.log('\n[Cronômetro e autosave]');
  await H.ir(p, 'discursivas'); await p.click('#dlRoot .dl-card >> text=Escrever'); await p.waitForSelector('#dlTexto'); check(await ev(() => discursivas[0].producoes.length === 1), 'abrir cria a 1ª produção');
  await p.click('#dlTimerBtn'); await H.sleep(2300); const t1 = await p.textContent('#dlTempo'); check(/^00:0[2-9]$/.test(t1), 'cronômetro avança enquanto roda', t1); await p.click('#dlTimerBtn');
  const tempo = await ev(() => discursivas[0].producoes[0].tempoSeg); check(tempo >= 2 && tempo <= 5, 'ao pausar, o tempo é gravado na produção', String(tempo));
  const t2 = await p.textContent('#dlTempo'); await H.sleep(1500); check(await p.textContent('#dlTempo') === t2, 'pausado: o tempo não avança');
  await p.fill('#dlTexto', 'A política externa brasileira baseia-se no multilateralismo.'); check((await p.textContent('#dlSaveState')).includes('Editando'), 'indicador mostra "Editando…" ao digitar'); await H.sleep(1500);
  check(await ev(() => discursivas[0].producoes[0].texto === 'A política externa brasileira baseia-se no multilateralismo.') && (await p.textContent('#dlSaveState')).includes('Salvo às'), 'autosave gravou o texto sem clicar em salvar e mostra "Salvo às"');
  await H.recarregar(p); await H.ir(p, 'discursivas'); await p.click('#dlRoot .dl-card >> text=Abrir'); await p.waitForSelector('#dlTexto');
  check(await p.inputValue('#dlTexto') === 'A política externa brasileira baseia-se no multilateralismo.' && await ev(() => discursivas[0].producoes[0].tempoSeg >= 2), 'persistência 2: texto e tempo preservados após recarregar');

  console.log('\n[Editar produção e versões]');
  await p.click('text=Salvar versão'); await p.fill('#dlTexto', 'A política externa brasileira baseia-se no multilateralismo e na autonomia.'); await p.click('text=Salvar versão');
  await p.fill('#dlTexto', 'A política externa brasileira baseia-se no multilateralismo, na autonomia e no universalismo.'); await H.sleep(1300);
  let pr = await ev(() => discursivas[0].producoes[0]); check(pr.versoes.length === 2 && pr.versoes[0].texto.endsWith('multilateralismo.') && pr.versoes[1].texto.includes('autonomia.') && pr.texto.includes('universalismo'), 'duas versões salvas e texto atual diferente delas');
  await p.click('text=Salvar versão'); check(await ev(() => discursivas[0].producoes[0].versoes.length) === 3, 'terceira versão'); await p.click('text=Salvar versão'); check((await p.textContent('#toastHost')).includes('já foi salva') && await ev(() => discursivas[0].producoes[0].versoes.length) === 3, 'salvar versão idêntica é recusado (sem duplicar)');
  await p.click('#dlRoot .subtab-btn:has-text("Versões")'); await p.selectOption('select[aria-label="Versão A"]', { index: 1 }); await p.selectOption('select[aria-label="Versão B"]', { index: 3 });
  const ins = await p.locator('.dl-diff ins.d-ins').allTextContents(), del = await p.locator('.dl-diff del.d-del').allTextContents();
  check(ins.join('').includes('na autonomia e no universalismo.') && del.join('') === 'multilateralismo.', 'diff v1→v3: acrescenta "na autonomia e no universalismo." e troca "multilateralismo." por "multilateralismo," (granularidade de palavra)', JSON.stringify({ ins, del }));
  await p.selectOption('select[aria-label="Versão A"]', { index: 3 }); await p.selectOption('select[aria-label="Versão B"]', { index: 1 }); check((await p.locator('.dl-diff del.d-del').allTextContents()).join(' ').includes('universalismo'), 'diff invertido: trechos aparecem como removidos');
  await p.locator('.rv-item', { hasText: 'v1' }).locator('text=Restaurar no editor').first().click(); await p.click('.confirm-overlay [data-r="1"]'); await H.sleep(250);
  check(await p.inputValue('#dlTexto') === 'A política externa brasileira baseia-se no multilateralismo.' && await ev(() => discursivas[0].producoes[0].texto.endsWith('multilateralismo.')), 'versão anterior (v1) restaurada no editor');
  await H.recarregar(p); check(await ev(() => discursivas[0].producoes[0].texto.endsWith('multilateralismo.') && discursivas[0].producoes[0].versoes.length >= 3), 'persistência 3: texto restaurado e versões preservados');

  console.log('\n[Limite de linhas]');
  await H.ir(p, 'discursivas'); await p.click('#dlRoot .dl-card >> text=Abrir'); await p.waitForSelector('#dlTexto'); await p.fill('#dlTexto', ('Linha de texto bem longa para ocupar o espaço da folha. ').repeat(30)); await H.sleep(300);
  check(await p.locator('#dlMLin.estourou').count() === 1 && (await p.textContent('#dlMLin')).includes('/ 5'), 'texto acima de 5 linhas: contador fica vermelho (estourou)'); await p.fill('#dlTexto', 'Curto.'); await H.sleep(300); check(await p.locator('#dlMLin.estourou').count() === 0, 'voltando ao limite o alerta some');
  await p.fill('#dlTexto', 'A política externa brasileira baseia-se no multilateralismo.'); await H.sleep(1300);

  console.log('\n[Avaliação por critérios]');
  await p.click('#dlRoot .subtab-btn:has-text("Avaliação")'); check((await p.textContent('#dlRoot')).includes('não é a avaliação oficial'), 'aviso de que não é a avaliação oficial do CACD'); check(await p.locator('.dl-crit').count() === 7, '7 critérios padrão');
  await p.click('text=Salvar avaliação'); check((await p.textContent('#toastHost')).includes('pelo menos um critério'), 'avaliação sem notas é recusada');
  await p.fill('#dc_conteudo', '8'); await p.fill('#dc_clareza', '6'); await p.fill('#dcc_clareza', 'Revisar conectivos'); check((await p.textContent('#dlAvTotal')) === '7,0', 'total ponderado calculado ao vivo (7,0)', await p.textContent('#dlAvTotal')); await p.fill('#dlAvGeral', 'Melhorar a conclusão.'); await p.click('text=Salvar avaliação'); await H.sleep(150);
  check(await ev(() => { const a = discursivas[0].producoes[0].avaliacao; return a && a.criterios.conteudo.nota === 8 && a.criterios.clareza.comentario === 'Revisar conectivos' && a.geral === 'Melhorar a conclusão.' && a.snapshot.length === 7 && Math.abs(dlTotal(a) - 7) < 1e-9; }), 'avaliação salva com notas, comentários e snapshot dos critérios (7,0)');
  await p.click('.page-actions >> text=Critérios de avaliação').catch(() => {}); await p.click('text=Configurar critérios'); await p.click('text=Novo critério'); const linhas = await p.locator('.dl-critlinha').all(); const ult = await linhas[linhas.length - 1].locator('input').all(); await ult[0].fill('Citação de fontes'); await p.click('#crModal .modal-actions >> text=Salvar'); await H.sleep(200);
  check(await ev(() => dlCriterios().length === 8 && dlCriterios()[7].nome === 'Citação de fontes' && discursivas[0].producoes[0].avaliacao.snapshot.length === 7), 'critério novo configurado; avaliação antiga mantém os critérios que usou');
  await H.recarregar(p); check(await ev(() => dlCriterios().length === 8 && discursivas[0].producoes[0].avaliacao.criterios.conteudo.nota === 8), 'persistência 4: critérios e avaliação preservados');

  console.log('\n[Produções (histórico)]');
  await H.ir(p, 'discursivas'); await p.click('#dlRoot .dl-card >> text=Abrir'); await p.waitForSelector('#dlTexto'); await p.click('text=Duplicar texto'); await H.sleep(250);
  check(await ev(() => discursivas[0].producoes.length === 2 && discursivas[0].producoes[1].texto === discursivas[0].producoes[0].texto && discursivas[0].producoes[1].avaliacao === null && discursivas[0].producoes[1].versoes.length === 0), '2ª produção criada copiando o texto, sem avaliação nem versões');
  await p.fill('#dlTexto', 'Segunda produção, reescrita.'); await H.sleep(1300); await p.click('#dlRoot .subtab-btn:has-text("Histórico")'); check(await p.locator('#dlRoot .rv-item').count() === 2, 'histórico lista as 2 produções');
  await p.locator('.rv-item', { hasText: 'Produção #1' }).locator('text=Editar').click(); await H.sleep(250); check((await p.inputValue('#dlTexto')).endsWith('multilateralismo.'), 'é possível voltar a editar a produção anterior');
  await p.fill('#dlTexto', 'Primeira produção, editada depois.'); await H.sleep(1300); await H.recarregar(p); check(await ev(() => discursivas[0].producoes[0].texto === 'Primeira produção, editada depois.' && discursivas[0].producoes[1].texto === 'Segunda produção, reescrita.'), 'persistência 5: edição de produção anterior preservada, sem afetar a outra');
  await H.ir(p, 'discursivas'); await p.click('#dlRoot .dl-card >> text=Abrir'); await p.waitForSelector('#dlTexto'); await p.click('#dlRoot .subtab-btn:has-text("Histórico")'); await p.locator('.rv-item', { hasText: 'Produção #2' }).locator('[aria-label*="Excluir produção"]').click(); await p.click('.confirm-overlay [data-r="1"]'); await H.sleep(200);
  check(await ev(() => discursivas[0].producoes.length === 1 && discursivas[0].producoes[0].texto.startsWith('Primeira')), 'excluir produção (com confirmação) mantém a outra');
  await p.click('#dlRoot >> text=Propostas'); await p.locator('.dl-card [aria-label="Excluir proposta"]').click(); await p.click('.confirm-overlay [data-r="0"]'); check(await ev(() => discursivas.length) === 1, 'cancelar exclusão da proposta mantém tudo');
  await p.locator('.dl-card [aria-label="Excluir proposta"]').click(); await p.click('.confirm-overlay [data-r="1"]'); await H.sleep(500); check(await ev(() => discursivas.length === 0) && await ev(async () => (await listarSnapshots()).some(s => s.motivo === 'antes-de-excluir-discursiva')), 'excluir proposta com produções cria snapshot de segurança e remove');
  await H.recarregar(p); check(await ev(() => load('diplo_discursivas', []).length) === 0, 'persistência 6: exclusão preservada');
  check(d.erros.length === 0, 'nenhum erro de JavaScript', d.erros.join(' | '));
  await d.b.close(); process.exit(H.resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
