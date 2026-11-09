// Banco de questões: criar, editar, excluir, resolver, corrigir, histórico, estatísticas, filtros e persistência após recarregar.
const H = require('./helpers'); const { check } = H;
(async () => {
  await H.emuOuSair(); const d = await H.abrir(), p = d.p, ev = (f, a) => p.evaluate(f, a);
  await H.ir(p, 'questoes');
  const nova = async f => { await p.click('.page-actions >> text=Nova questão'); await p.fill('#qfEnun', f.enun); await p.selectOption('#qfMat', f.mat); await p.selectOption('#qfTipo', f.tipo); if (f.ass) await p.fill('#qfAss', f.ass); if (f.banca) await p.fill('#qfBanca', f.banca); if (f.ano) await p.fill('#qfAno', String(f.ano));
    if (f.tipo === 'multipla') { const ins = await p.locator('.qb-alt-edit input').all(); for (let i = 0; i < f.alts.length; i++) await ins[i].fill(f.alts[i]); if (f.gab) await p.selectOption('#qfGabSel', f.gab); }
    if (f.tipo === 'ce' && f.gab) await p.check(`input[name="qfGab"][value="${f.gab}"]`); if (f.tipo === 'discursiva' && f.gab) await p.fill('#qfGabTxt', f.gab); if (f.com) await p.fill('#qfCom', f.com); if (f.tags) await p.fill('#qfTags', f.tags);
    await p.click('.modal-actions >> text=Salvar questão'); await H.sleep(150); };
  const mats = await ev(() => materias.map(m => m.nome)), M0 = mats[0], M2 = mats[2];

  console.log('\n[Validação do formulário]');
  await p.click('.page-actions >> text=Nova questão'); await p.click('.modal-actions >> text=Salvar questão');
  check((await p.textContent('#qfErro')).includes('enunciado'), 'enunciado vazio é recusado com mensagem'); await p.fill('#qfEnun', 'x'); await p.click('.modal-actions >> text=Salvar questão');
  check((await p.textContent('#qfErro')).includes('gabarito'), 'C/E sem gabarito é recusado'); await p.selectOption('#qfTipo', 'multipla'); await p.click('.modal-actions >> text=Salvar questão');
  check((await p.textContent('#qfErro')).includes('duas alternativas'), 'múltipla escolha sem alternativas é recusada'); await p.click('.modal-actions >> text=Cancelar');
  check(await ev(() => questoes.length) === 0, 'nada foi salvo pelas tentativas inválidas');

  console.log('\n[Criar]');
  await nova({ enun: 'A OTAN foi criada em 1949.', mat: M0, tipo: 'ce', gab: 'C', ass: 'Guerra Fria', banca: 'CEBRASPE', ano: 2023, com: 'Tratado de Washington.', tags: 'otan, guerra fria' });
  await nova({ enun: 'Qual organização sucedeu o GATT?', mat: M2, tipo: 'multipla', alts: ['OMC', 'FMI', 'BIRD', 'OCDE', 'ONU'], gab: 'A', ass: 'Comércio', banca: 'FGV', ano: 2021, com: 'A OMC nasceu em 1995.' });
  await nova({ enun: 'Disserte sobre o multilateralismo.', mat: M0, tipo: 'discursiva', gab: 'Citar ONU e OMC.', ass: 'Guerra Fria', banca: 'CEBRASPE', ano: 2023 });
  await nova({ enun: 'O Mercosul foi criado em 1991.', mat: M2, tipo: 'ce', gab: 'C', ass: 'Comércio', banca: 'FGV', ano: 2022 });
  let q = await ev(() => questoes.map(x => ({ e: x.enunciado, t: x.tipo, g: x.gabarito, m: x.materia, a: x.assunto, b: x.banca, y: String(x.ano), n: x.alternativas.length, tags: x.tags })));
  check(q.length === 4 && q[3].e.startsWith('A OTAN') && q[3].t === 'ce' && q[3].g === 'C' && q[3].b === 'CEBRASPE' && q[3].y === '2023' && q[3].tags.join() === 'otan,guerra fria', 'questão C/E salva com todos os campos', JSON.stringify(q[3]));
  check(q[2].t === 'multipla' && q[2].n === 5 && q[2].g === 'A', 'múltipla escolha salva com 5 alternativas e gabarito A');
  check(q[1].t === 'discursiva' && q[1].g === 'Citar ONU e OMC.', 'discursiva salva com padrão de resposta');
  check(await p.locator('.qb-card').count() === 4 && (await p.locator('.qb-card .badge:has-text("Inédita")').count()) === 4, 'lista mostra 4 questões, todas rotuladas como Inédita');

  console.log('\n[Persistência 1: recarregar]');
  await H.recarregar(p); await H.ir(p, 'questoes');
  check(await p.locator('.qb-card').count() === 4 && await ev(() => questoes.length === 4 && questoes.some(x => x.enunciado === 'Qual organização sucedeu o GATT?' && x.alternativas[0].texto === 'OMC')), 'após recarregar: 4 questões com alternativas intactas');

  console.log('\n[Filtros]');
  const n = async () => p.locator('.qb-card').count(); const sel = (lab, v) => p.selectOption(`select[aria-label="${lab}"]`, v);
  await sel('Matéria', M0); check(await n() === 2, `filtro matéria "${M0}" → 2`, await n()); await sel('Matéria', '');
  await sel('Banca', 'FGV'); check(await n() === 2, 'filtro banca FGV → 2'); await sel('Banca', '');
  await sel('Ano', '2021'); check(await n() === 1 && (await p.textContent('.qb-card')).includes('GATT'), 'filtro ano 2021 → só a do GATT'); await sel('Ano', '');
  await sel('Matéria', M2); await sel('Assunto', 'Comércio'); check(await n() === 2, 'matéria + assunto "Comércio" → 2'); await sel('Tipo', 'multipla'); check(await n() === 1, 'matéria + assunto + tipo múltipla → 1'); await p.click('text=Limpar filtros'); check(await n() === 4, 'limpar filtros restaura as 4');
  await p.fill('#qfBusca', 'mercosul'); check(await n() === 1, 'busca textual "mercosul" → 1'); await p.fill('#qfBusca', ''); await H.sleep(100);

  console.log('\n[Resolver e corrigir]');
  const resolver = async (txt, acao) => { await p.locator('.qb-card', { hasText: txt }).locator('text=Resolver').click(); await acao(); };
  await resolver('OTAN', async () => { await p.locator('.qb-opcao').nth(1).click(); await p.click('#qsConfirmar'); });   // marca "Errado" (gabarito é Certo)
  check(await p.locator('.qb-feedback.bad').count() === 1 && (await p.textContent('.qb-feedback')).includes('Gabarito: Certo') && (await p.textContent('.qb-feedback')).includes('Tratado de Washington'), 'resposta errada: correção, gabarito e comentário exibidos');
  let h = await ev(() => questoesHist.slice()); check(h.length === 1 && h[0].correta === false && h[0].resposta === 'E' && typeof h[0].segundos === 'number' && h[0].t, 'histórico registrou erro (resposta E, tempo, data)', JSON.stringify(h));
  await p.fill('#qsObs', 'Lembrar do Tratado de Washington'); await p.click('text=Concluir'); await p.click('text=Voltar ao banco');
  check(await ev(() => questoes.find(x => x.enunciado.startsWith('A OTAN')).obs) === 'Lembrar do Tratado de Washington', 'observação do usuário salva na questão');
  await resolver('GATT', async () => { await p.locator('.qb-opcao').nth(0).click(); await p.click('#qsConfirmar'); }); check(await p.locator('.qb-feedback.ok').count() === 1, 'múltipla correta: feedback de acerto'); await p.click('text=Concluir'); await p.click('text=Voltar ao banco');
  await resolver('multilateralismo', async () => { await p.fill('#qsResp', 'ONU e OMC.'); await p.click('text=Ver gabarito e comentário'); check((await p.textContent('.qb-feedback')).includes('Citar ONU e OMC'), 'discursiva: padrão de resposta exibido'); await p.click('text=Acertei'); });
  await p.click('text=Concluir'); await p.click('text=Voltar ao banco');
  h = await ev(() => questoesHist.map(x => [x.correta, x.resposta])); check(h.length === 3 && h[1][0] === true && h[2][0] === true && h[2][1] === 'ONU e OMC.', 'histórico com 3 resoluções; discursiva guarda a resposta escrita', JSON.stringify(h));

  console.log('\n[Estatísticas]');
  const r = await ev(() => qbResumo()); check(r.total === 4 && r.resolvidas === 3 && r.ineditas === 1 && r.aRefazer === 1 && r.acerto === 67 && r.hojeBanco === 3, 'resumo: 4 total, 3 resolvidas, 1 inédita, 1 a refazer, 67% de acerto', JSON.stringify(r));
  await p.click('#qbRoot .subtab-btn >> text=Desempenho'); const txt = await p.textContent('#qbRoot'); check(txt.includes('67%') && txt.includes('resoluções'), 'aba Desempenho mostra 67% e total de resoluções');
  const porM = await ev(() => desempenhoPorMateria()); check(porM[M0].tot === 2 && porM[M0].ac === 1 && porM[M2].tot === 1 && porM[M2].ac === 1, 'desempenho por matéria correto', JSON.stringify(porM));
  await p.click('#qbRoot .subtab-btn >> text=Questões'); await sel('Desempenho', 'erradas'); check(await n() === 1 && (await p.textContent('.qb-card')).includes('OTAN'), 'filtro "última: errei" → só a OTAN'); await sel('Desempenho', 'ineditas'); check(await n() === 1 && (await p.textContent('.qb-card')).includes('Mercosul'), 'filtro inéditas → só a não resolvida'); await sel('Desempenho', 'todas');

  console.log('\n[Persistência 2: histórico após recarregar]');
  await H.recarregar(p); await H.ir(p, 'questoes');
  check(await ev(() => questoesHist.length === 3 && qbResumo().acerto === 67 && qbResumo().aRefazer === 1), 'histórico e estatísticas idênticos após recarregar');
  await p.locator('.qb-card', { hasText: 'OTAN' }).locator('.qb-badge, .badge').first().waitFor(); check((await p.locator('.qb-card', { hasText: 'OTAN' }).textContent()).includes('Já resolvida'), 'questão errada continua rotulada como já resolvida');

  console.log('\n[Refazer erradas]');
  await p.click('.qb-stat.link:has-text("refazer")'); await H.sleep(150); check((await p.textContent('.qb-modo')).includes('erradas') && await p.locator('.qb-opcao').count() === 2, 'modo refazer erradas abre só a questão errada');
  await p.locator('.qb-opcao').nth(0).click(); await p.click('#qsConfirmar'); await p.click('text=Concluir'); await p.click('text=Voltar ao banco');
  check(await ev(() => qbResumo().aRefazer === 0 && questoesHist.length === 4), 'acertar na refação zera "a refazer" e acrescenta ao histórico');

  console.log('\n[Editar]');
  await p.locator('.qb-card', { hasText: 'Mercosul' }).locator('[aria-label="Editar questão"]').click();
  await p.fill('#qfEnun', 'O Mercosul foi criado em 1991 pelo Tratado de Assunção.'); await p.fill('#qfBanca', 'CESPE'); await p.fill('#qfAno', '2020'); await p.click('.modal-actions >> text=Salvar questão'); await H.sleep(150);
  check(await ev(() => { const x = questoes.find(y => y.enunciado.includes('Assunção')); return x && x.banca === 'CESPE' && String(x.ano) === '2020' && x.editadoEm > x.criadoEm - 1; }), 'edição altera enunciado, banca e ano');
  await H.recarregar(p); check(await ev(() => questoes.length === 4 && questoes.some(x => x.enunciado.includes('Assunção') && x.banca === 'CESPE')), 'persistência 3: versão editada preservada após recarregar');

  console.log('\n[Marcar para revisar e excluir]');
  await H.ir(p, 'questoes'); await p.locator('.qb-card', { hasText: 'Assunção' }).locator('[aria-label="Marcar para revisar"]').click(); check(await ev(() => questoes.find(x => x.enunciado.includes('Assunção')).revisar === true), 'marcar para revisar grava o sinalizador');
  await p.locator('.qb-card', { hasText: 'GATT' }).locator('[aria-label="Excluir questão"]').click(); await p.click('.confirm-overlay [data-r="0"]');
  check(await ev(() => questoes.length === 4), 'cancelar a confirmação NÃO exclui');
  await p.locator('.qb-card', { hasText: 'GATT' }).locator('[aria-label="Excluir questão"]').click(); await p.click('.confirm-overlay [data-r="1"]'); await H.sleep(150);
  check(await ev(() => questoes.length === 3 && !questoes.some(x => x.enunciado.includes('GATT')) && !questoesHist.some(h => !questoes.find(q => q.id === h.qid))), 'excluir remove a questão e o histórico dela (sem órfãos)');
  await H.recarregar(p); check(await ev(() => questoes.length === 3 && questoes.find(x => x.enunciado.includes('Assunção')).revisar === true), 'exclusão e marcação persistem após recarregar');

  console.log('\n[Segurança do conteúdo]');
  await H.ir(p, 'questoes'); await nova({ enun: '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>texto', mat: M0, tipo: 'ce', gab: 'E' }); await H.sleep(200);
  check(await ev(() => !window.__xss) && (await p.textContent('#qbRoot')).includes('<img src=x'), 'HTML no enunciado aparece como texto e não executa');
  check((await p.textContent('#syncChip')).length > 0, 'indicador de sincronização presente');
  await H.esperar(p, () => pendingSyncCount() === 0); const cloud = await H.fsGet(d.uid); const loc = await ev(() => [questoes.length, questoesHist.length]); check(cloud && cloud.diplo_questoes.length === loc[0] && cloud.diplo_questoes_hist.length === loc[1] && loc[0] === 4 && loc[1] === 3, 'nuvem (emulador) igual ao local: 4 questões e 3 resoluções (a do GATT foi excluída com a questão)', JSON.stringify([loc, cloud && [cloud.diplo_questoes.length, cloud.diplo_questoes_hist.length]]));
  check(d.erros.length === 0, 'nenhum erro de JavaScript', d.erros.join(' | '));
  await d.b.close(); process.exit(H.resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
