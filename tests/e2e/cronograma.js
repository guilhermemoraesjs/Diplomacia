// Cronograma: criar, editar, concluir (com/sem tempo real), reagendar, cronômetro, filtros, visões, histórico, exclusão e persistência.
const H = require('./helpers'); const { check } = H;
(async () => {
  await H.emuOuSair(); const d = await H.abrir(), p = d.p, ev = (f, a) => p.evaluate(f, a);
  await H.ir(p, 'cronograma'); const mats = await ev(() => materias.map(m => m.nome)), M0 = mats[0], M1 = mats[1], hoje = await ev(() => todayISO()), br = await ev(() => crISOParaBR(todayISO()));
  const nova = async f => { await p.click('.page-actions >> text=Nova atividade'); await p.fill('#crfTema', f.tema); if (f.mat) await p.selectOption('#crfMateria', f.mat); if (f.ass) await p.fill('#crfAssunto', f.ass); if (f.data !== undefined) await p.fill('#crfData', f.data); if (f.dur) await p.fill('#crfDur', f.dur); if (f.prio) await p.selectOption('#crfPrio', f.prio); await p.click('.modal-actions >> text=Salvar'); await H.sleep(150); };

  console.log('\n[Validação e criação]');
  await p.click('.page-actions >> text=Nova atividade'); await p.click('.modal-actions >> text=Salvar'); check((await p.textContent('#crfErro')).includes('tema'), 'tema vazio é recusado'); await p.fill('#crfTema', 'x'); await p.fill('#crfDur', 'abc'); await p.click('.modal-actions >> text=Salvar'); check((await p.textContent('#crfErro')).includes('Duração inválida'), 'duração inválida é recusada'); await p.click('.modal-actions >> text=Cancelar');
  check(await ev(() => cronograma.length) === 0, 'nenhuma atividade criada por entradas inválidas');
  await nova({ tema: 'Guerra do Paraguai', mat: M0, ass: 'Império', dur: '1h30', prio: 'alta' });
  await nova({ tema: 'Direito do Mar', mat: M1, dur: '45min', data: await ev(() => addDaysISO(todayISO(), -12)) });
  await nova({ tema: 'BRICS', mat: M1, dur: '1h', prio: 'baixa' });
  let c = await ev(() => cronograma.map(x => ({ t: x.tema, m: x.materia, a: x.assunto, d: x.data, dur: x.duracaoMin, p: x.prioridade, f: x.feito, h: x.historico.map(h => h.ev) })));
  check(c.length === 3 && c[0].t === 'Guerra do Paraguai' && c[0].m === M0 && c[0].a === 'Império' && c[0].d === br && c[0].dur === 90 && c[0].p === 'alta' && c[0].f === false && c[0].h.join() === 'criado', 'atividade criada com todos os campos e histórico "criado"', JSON.stringify(c[0]));
  check(await ev(() => [crStatus(cronograma[0]), crStatus(cronograma[1]), crStatus(cronograma[2])].join()) === 'planejada,atrasada,planejada', 'status derivados: planejada, atrasada (data passada), planejada');

  console.log('\n[Persistência 1]');
  await H.recarregar(p); await H.ir(p, 'cronograma'); check(await ev(() => cronograma.length === 3 && cronograma[0].duracaoMin === 90 && cronograma[0].data === crISOParaBR(todayISO())) && await p.locator('.cr-item').count() >= 2, 'após recarregar: 3 atividades com dados e datas preservados');

  console.log('\n[Editar]');
  await p.locator('.cr-item', { hasText: 'BRICS' }).locator('.cr-body').click(); await p.fill('#crfTema', 'BRICS e G20'); await p.fill('#crfDur', '2h'); await p.click('.modal-actions >> text=Salvar'); await H.sleep(150);
  check(await ev(() => { const x = cronograma.find(y => y.tema === 'BRICS e G20'); return x && x.duracaoMin === 120 && x.historico.some(h => h.ev === 'editado'); }), 'edição altera tema/duração e registra "editado" no histórico', JSON.stringify(await ev(() => cronograma.map(x => [x.tema, x.duracaoMin, x.historico.map(h => h.ev)]))));
  await H.recarregar(p); check(await ev(() => cronograma.some(x => x.tema === 'BRICS e G20' && x.duracaoMin === 120)), 'persistência 2: versão editada preservada');

  console.log('\n[Concluir com tempo real]');
  await H.ir(p, 'cronograma'); await p.locator('.cr-item', { hasText: 'Guerra do Paraguai' }).locator('.cr-check').click(); await p.fill('#crcMin', '75'); await p.click('.modal-actions >> text=Concluir'); await H.sleep(150);
  check(await ev(() => { const x = cronograma[0]; return x.feito && x.sessoes.length === 1 && x.sessoes[0].min === 75 && x.sessoes[0].data === todayISO() && x.concluidoEm && crTempoReal(x) === 75; }), 'concluída: feito + sessão de 75 min (≠ 90 planejados) + data de conclusão');
  check(await ev(() => estudoLog.length === 1 && estudoLog[0].minutos === 75 && estudoLog[0].origem === 'cronograma' && estudoLog[0].materia === materias[0].nome && minutosNoDia(todayISO()) === 75), 'log de estudo recebeu 75 min na matéria certa');
  const card = await p.locator('.cr-item', { hasText: 'Guerra do Paraguai' }).innerText(); check(card.includes('Planejado 1h30') && card.includes('Estudado 1h15') && card.includes('Concluída'), 'cartão distingue planejado × estudado e mostra "Concluída"', card);
  console.log('\n[Concluir sem tempo]');
  await p.locator('.cr-item', { hasText: 'BRICS' }).locator('.cr-check').click(); await p.click('.modal-actions >> text=Concluir'); await H.sleep(150);
  check(await ev(() => { const x = cronograma.find(y => y.tema === 'BRICS e G20'); return x.feito && x.sessoes.length === 0 && estudoLog.length === 1; }), 'concluir sem tempo marca feito, não cria sessão nem log');
  check((await p.locator('.cr-item', { hasText: 'BRICS' }).innerText()).includes('Tempo não registrado'), 'interface avisa "Tempo não registrado"');
  console.log('\n[Reabrir]');
  await p.locator('.cr-item', { hasText: 'BRICS' }).locator('.cr-check').click(); await p.click('.confirm-overlay [data-r="1"]'); await H.sleep(100); check(await ev(() => cronograma.find(y => y.tema === 'BRICS e G20').feito === false), 'reabrir desmarca (com confirmação)');
  await H.recarregar(p); check(await ev(() => cronograma[0].feito && crTempoReal(cronograma[0]) === 75 && estudoLog.length === 1 && minutosNoDia(todayISO()) === 75), 'persistência 3: conclusão e tempo real preservados');

  console.log('\n[Reagendar]');
  await H.ir(p, 'cronograma'); await p.click('#cronoRoot .subtab-btn:has-text("Lista")'); await p.locator('.cr-item', { hasText: 'Direito do Mar' }).locator('[aria-label="Reagendar"]').click(); const alvo = await ev(() => addDaysISO(todayISO(), 3)); await p.fill('#crrData', alvo); await p.click('.modal-actions >> text=Reagendar'); await H.sleep(150);
  check(await ev(a => { const x = cronograma.find(y => y.tema === 'Direito do Mar'); return x.reagend === 1 && cronoISO(x) === a && crStatus(x) === 'reagendada' && x.historico.some(h => h.ev === 'reagendado' && h.det.includes('→')); }, alvo), 'reagendar: nova data, contador 1, status "reagendada", histórico com "de → para"');
  await H.recarregar(p); check(await ev(() => cronograma.find(y => y.tema === 'Direito do Mar').reagend === 1), 'persistência 4: reagendamento preservado');

  console.log('\n[Cronômetro de estudo]');
  await H.ir(p, 'cronograma'); await p.click('#cronoRoot .subtab-btn:has-text("Semana")'); await p.locator('.cr-item', { hasText: 'BRICS' }).locator('[aria-label="Iniciar cronômetro"]').click(); await H.sleep(300);
  check(await p.locator('#timerPill').count() === 1 && await ev(() => !!timerLer() && timerLer().rodando === true && timerLer().cronoId === cronograma.find(x => x.tema === 'BRICS e G20').id), 'cronômetro iniciado e vinculado à atividade; indicador no topo');
  await H.recarregar(p); check(await ev(() => document.body.dataset.activeTab) === 'cronograma', 'após recarregar, o app volta para a seção em que estava'); check(await p.locator('#timerPill').count() === 1 && await ev(() => timerLer() && timerLer().rodando), 'o cronômetro sobrevive ao recarregamento');
  await ev(() => { const t = timerLer(); t.acumuladoMs = 5 * 60000; t.rodando = false; timerGravar(t); }); await p.click('#timerPill'); await p.click('.modal-actions >> text=Finalizar e registrar'); await H.sleep(250);
  check(await ev(() => { const x = cronograma.find(y => y.tema === 'BRICS e G20'); return crTempoReal(x) === 5 && estudoLog.filter(e => e.minutos === 5).length === 1 && !timerLer(); }), 'finalizar registrou 5 min na atividade e no log; cronômetro limpo');

  console.log('\n[Filtros e visões]');
  const cont = () => p.locator('.cr-item').count();
  await p.click('#cronoRoot .subtab-btn:has-text("Lista")'); await p.click('.chip:has-text("Atrasadas")'); check(await cont() === 0, 'após reagendar, "Atrasadas" não lista a atividade reagendada (nenhuma atrasada)');
  await ev(() => { cronograma.push(crNorm({ id: 'old', tema: 'Antiga', estudar: '', semana: '—', tempo: '—', data: crISOParaBR(addDaysISO(todayISO(), -20)), materia: materias[2].nome, feito: false })); crSalvar(); renderCronograma(); });
  check(await cont() === 1 && (await p.textContent('.cr-corpo')).includes('Antiga'), '"Atrasadas" lista a atividade com data passada'); await p.click('.chip:has-text("Concluídas")'); check(await cont() === 1 && (await p.textContent('.cr-corpo')).includes('Guerra'), '"Concluídas" lista só a concluída'); await p.click('.chip:has-text("Todas")');
  await p.selectOption('select[aria-label="Filtrar por matéria"]', M1); check(await cont() === 2, 'filtro de matéria: 2 atividades da matéria escolhida'); await p.selectOption('select[aria-label="Filtrar por matéria"]', '');
  await p.click('#cronoRoot .subtab-btn:has-text("Por matéria")'); check((await p.textContent('.cr-corpo')).includes(M0.replace(/^\S+\s/, '')) && (await p.locator('.cr-grupo').count()) >= 3, 'visão por matéria agrupa por matéria');
  await p.click('#cronoRoot .subtab-btn:has-text("Mês")'); check(await p.locator('.cr-mes-d:not(.vazio)').count() >= 28 && await p.locator('.cr-mes-d.hoje .pills i').count() >= 1, 'visão mensal: dias do mês e marcador de atividade hoje');
  await p.locator('.cr-mes-d.hoje').click(); check((await p.textContent('#crModal')).includes('Guerra do Paraguai'), 'clicar no dia abre a lista do dia'); await p.click('#crModal .modal-actions >> text=Fechar');
  await p.click('#cronoRoot .subtab-btn:has-text("Histórico")'); const hist = await p.textContent('.cr-hist'); check(hist.includes('Concluída') && hist.includes('Reagendada') && hist.includes('Editada') && hist.includes('Tempo registrado'), 'histórico lista conclusão, reagendamento, edição e tempo registrado');

  console.log('\n[Excluir]');
  await p.click('#cronoRoot .subtab-btn:has-text("Semana")'); await ev(() => openCronoEditModal('old')); await p.click('.modal-actions >> text=Excluir'); await p.click('.confirm-overlay [data-r="0"]'); check(await ev(() => cronograma.length) === 4, 'cancelar não exclui');
  await ev(() => openCronoEditModal(cronograma[0].id)); await p.click('.modal-actions >> text=Excluir'); await p.click('.confirm-overlay [data-r="1"]'); await H.sleep(150);
  check(await ev(() => cronograma.length === 3 && !cronograma.some(x => x.tema === 'Guerra do Paraguai') && !estudoLog.some(e => e.minutos === 75)), 'excluir remove a atividade e o tempo estudado dela do log');
  await p.click('text=Excluir todo o cronograma'); await p.click('.confirm-overlay [data-r="1"]'); await H.sleep(600);
  check(await ev(() => cronograma.length === 0) && (await ev(async () => (await listarSnapshots()).some(s => s.motivo === 'antes-de-limpar-cronograma'))), 'excluir tudo cria snapshot de segurança antes e esvazia');
  await H.recarregar(p); check(await ev(() => cronograma.length === 0 && load('diplo_cronograma', []).length === 0), 'persistência 5: exclusão preservada');
  await H.esperar(p, () => pendingSyncCount() === 0); const cloud = await H.fsGet(d.uid); check(cloud.diplo_cronograma.length === 0 && cloud.diplo_estudo_log.length === 1, 'nuvem igual ao local', JSON.stringify([cloud.diplo_cronograma.length, cloud.diplo_estudo_log.length]));
  check(d.erros.length === 0, 'nenhum erro de JavaScript', d.erros.join(' | '));
  await d.b.close(); process.exit(H.resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
