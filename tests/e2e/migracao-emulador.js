// Migração do Firestore (documento único → um documento por chave) contra o Firebase EMULATOR: sucesso, regras negadas, interrupção e retomada,
// edição concorrente, limite de tamanho, coexistência com cliente antigo, reversão, idempotência e segurança.
const E = require('./emu'); const { check, sleep } = E;
const N = (id, t, ed) => ({ id, titulo: t, texto: '', criadoEm: 1, editadoEm: ed || 1 });
const legado = (extra) => Object.assign({ diplo_notas: [N('n1', 'Nota do legado', 100)], diplo_kb: [{ id: 'k1', tipo: 'tema', nome: 'Tema A', paises: [], rel: [], tags: [] }], chancelaria_theme: 'dark', diplo_questoes: [{ id: 'q1', enunciado: 'Q', materia: 'M', tipo: 'ce', gabarito: 'C' }], dashboard_metas: { diaria: 15, mensal: 600 }, __meta: { diplo_notas: { t: 1000, d: 'antigo' }, chancelaria_theme: { t: 1000, d: 'antigo' } } }, extra || {});
const entrar = async (d, sub) => { const ok = await E.login(d, sub); await sleep(1500); await d.p.waitForFunction(() => document.querySelector('#centralRoot .ct-head') && typeof currentUid !== 'undefined' && currentUid && !_sync.draining, null, { timeout: 30000 }); return ok; };   // o 1º login pode recarregar a página (dados vindos da nuvem)
const esperarEst = (p, n, ms) => E.esperar(p, v => _estrutura() === v && !MIG.ocupada, n, ms || 60000);
(async () => {
  if (!await E.emuDisponivel()) { console.log('EMULADOR INDISPONÍVEL — nada foi executado.'); process.exit(3); }
  await E.limparEmu(); const aparelhos = []; const novo = async () => { const d = await E.novoAparelho(); aparelhos.push(d); return d; };
  const clicarMigrar = async p => { await p.evaluate(() => goTab('configuracoes')); await p.waitForSelector('#migBtn'); await p.click('#migBtn'); await p.waitForSelector('.confirm-overlay'); await p.click('.confirm-overlay [data-r="1"]'); };

  console.log('\n[1] Regras de produção sem a subcoleção: nada é alterado');
  const U1 = await E.uidDe('mig1'); await E.fsSet(U1, legado()); const A = await novo(); check(await entrar(A, 'mig1'), 'login'); const pa = A.p, ev = (f, a) => pa.evaluate(f, a);
  check(await ev(() => _estrutura() === 1) && (await ev(() => (async () => { await goTab('configuracoes'); await new Promise(r => setTimeout(r, 600)); return document.getElementById('segEstrutura').innerText; })())).includes('Documento único'), 'antes: estrutura original (documento único), exibida no painel');
  await ev(() => { window.__permOrig = _migTestarPermissao; _migTestarPermissao = async () => ({ ok: false, codigo: 'permission-denied' }); });
  const r1 = await ev(() => migrarEstrutura()); check(r1.ok === false && r1.etapa === 'regras' && r1.msg.includes('NADA foi alterado'), 'permissão negada (simulada): para ANTES de tocar em qualquer coisa, com mensagem clara', JSON.stringify(r1));
  check(await E.fsDoc(U1, 'dados/__controle') === null && Object.keys(await E.fsCol(U1, 'dados')).length === 0 && Object.keys(await E.fsCol(U1, 'backup')).length === 0, 'nenhum documento novo foi criado na nuvem');
  await ev(() => { _migTestarPermissao = window.__permOrig; });
  await ev(() => { const o = _dadosCol; window.__dc = o; _dadosCol = () => ({ get: async () => { const e = new Error('negado'); e.code = 'permission-denied'; throw e; }, doc: o().doc.bind(o()) }); });
  const rp = await ev(() => pullFromCloud().then(r => ({ ok: true, semSub: _sync.semSubcolecao }), e => ({ ok: false, e: String(e) }))); check(rp.ok && rp.semSub === true, 'pull com regras que negam a subcoleção "dados": segue no modo legado, sem erro (não quebra quem ainda não atualizou as regras)', JSON.stringify(rp)); await ev(() => { _dadosCol = window.__dc; });

  console.log('\n[2] Migração completa pela interface');
  const antes = await E.fsGet(U1); await clicarMigrar(pa); check(await esperarEst(pa, 2), 'migração concluída (estrutura 2)');
  const ctl = await E.fsDoc(U1, 'dados/__controle'); check(ctl && ctl.estrutura === 2 && ctl.migracao.estado === 'concluida' && ctl.migracao.chaves === 5 && ctl.migracao.validadaEm > 0, 'controle: estrutura 2, estado "concluida", 5 chaves, validada', JSON.stringify(ctl));
  const dados = await E.fsCol(U1, 'dados'); const chaves = Object.keys(dados).filter(k => k !== '__controle').sort(); check(chaves.join() === ['chancelaria_theme', 'dashboard_metas', 'diplo_kb', 'diplo_notas', 'diplo_questoes'].join(), 'um documento por chave, sem duplicatas e sem "lixo" (o teste de permissão foi apagado)', chaves.join());
  check(chaves.every(k => JSON.stringify(dados[k].valor) === JSON.stringify(antes[k]) || JSON.stringify(Object.entries(dados[k].valor).sort()) === JSON.stringify(Object.entries(antes[k]).sort())) && dados.diplo_notas.t === 1000 && dados.diplo_notas.d === 'antigo' && dados.diplo_notas.v === 1, 'valores idênticos ao legado; carimbo e aparelho de origem preservados (t=1000)');
  const bk = await E.fsCol(U1, 'backup'); const bkDoc = Object.values(bk)[0]; check(Object.keys(bk).length === 1 && Object.keys(bk)[0].startsWith('legado-') && bkDoc.diplo_notas[0].titulo === 'Nota do legado' && bkDoc.__backup.versao, 'cópia do documento legado guardada em backup/legado-AAAAMMDD');
  const depois = await E.fsGet(U1); check(JSON.stringify(depois.diplo_notas) === JSON.stringify(antes.diplo_notas) && depois.chancelaria_theme === 'dark', 'documento legado permanece intacto');
  check(await ev(() => load('diplo_notas', [])[0].titulo === 'Nota do legado'), 'dados locais não foram alterados'); check(await ev(async () => (await listarSnapshots()).some(s => s.motivo === 'pre-migracao-firestore')), 'ponto de restauração local criado antes de migrar');
  check((await pa.innerText('#segEstrutura')).includes('Um documento por grupo'), 'painel passa a mostrar a estrutura migrada');
  const r2 = await ev(() => migrarEstrutura()); check(r2.ok && r2.jaMigrada === true && Object.keys(await E.fsCol(U1, 'dados')).length === 6, 'rodar de novo é idempotente (já migrada; nada duplicado)');

  console.log('\n[3] Depois da migração: gravação, segundo aparelho, cliente antigo');
  await ev(() => save('diplo_notas', [{ id: 'n1', titulo: 'Editada após migrar', texto: '', criadoEm: 1, editadoEm: Date.now() }]));
  check(await E.esperar(pa, () => pendingSyncCount() === 0), 'edição sincronizada (modo novo)'); const d2 = await E.fsDoc(U1, 'dados/diplo_notas'); let g = await E.fsGet(U1); for (let i = 0; i < 25 && g.diplo_notas[0].titulo !== 'Editada após migrar'; i++) { await sleep(200); g = await E.fsGet(U1); }   // o espelho no legado é assíncrono (melhor esforço)
  check(d2.valor[0].titulo === 'Editada após migrar' && d2.t > 1000 && d2.v === 1 && d2.d, 'gravou no documento por chave (valor, t, d, v)'); check(g.diplo_notas[0].titulo === 'Editada após migrar' && g.__meta.diplo_notas.t === d2.t, 'e espelhou no documento legado (compatibilidade com versões 1.1.0)');
  check((await pa.textContent('#syncChip')).includes('Sincronizado'), 'indicador "Sincronizado"');
  const B = await novo(); await entrar(B, 'mig1'); check(await B.p.evaluate(() => _estrutura() === 2 && load('diplo_notas', [])[0].titulo === 'Editada após migrar'), 'segundo aparelho detecta a estrutura 2 e lê dos documentos por chave');
  await B.p.evaluate(() => save('diplo_notas', [{ id: 'n1', titulo: 'Editada no B', texto: '', criadoEm: 1, editadoEm: Date.now() }, { id: 'n2', titulo: 'Nova no B', texto: '', criadoEm: 2, editadoEm: Date.now() }])); await E.esperar(B.p, () => pendingSyncCount() === 0);
  await ev(() => sincronizarAgora('t')); check(await E.esperar(pa, () => load('diplo_notas', []).length === 2 && load('diplo_notas', [])[0].titulo === 'Editada no B'), 'edição do aparelho B chega ao A');
  await E.fsSet(U1, { chancelaria_theme: 'azul-do-cliente-antigo', __meta: { chancelaria_theme: { t: Date.now() + 1500, d: 'cliente-1.1.0' } } }); await ev(() => sincronizarAgora('t'));
  check(await E.esperar(pa, () => localStorage.getItem('chancelaria_theme') === '"azul-do-cliente-antigo"'), 'cliente 1.1.0 (ainda no documento legado) escreveu algo mais novo: o app novo enxerga e adota');

  console.log('\n[4] Interrupção no meio e retomada sem duplicar');
  const U2 = await E.uidDe('mig2'); await E.fsSet(U2, legado()); const C = await novo(); await entrar(C, 'mig2'); const pc = C.p, evc = (f, a) => pc.evaluate(f, a);
  await evc(() => { window.__MIG = { aposChave: async (k, i) => { if (i === 3) throw new Error('queda simulada'); } }; });
  const r4 = await evc(() => migrarEstrutura()); check(r4.ok === false && r4.etapa === 'erro' && r4.msg.includes('Nada foi perdido'), 'queda no meio: resultado "interrompida" e mensagem de que nada se perdeu', JSON.stringify(r4));
  const c4 = await E.fsDoc(U2, 'dados/__controle'); check(c4.estrutura === 1 && c4.migracao.estado === 'interrompida' && c4.migracao.feitas.length === 3, 'controle: estrutura segue 1; estado "interrompida"; 3 chaves já copiadas', JSON.stringify(c4));
  check(Object.keys(await E.fsCol(U2, 'dados')).filter(k => k !== '__controle').length === 3 && await evc(() => _estrutura()) === 1, 'só 3 documentos criados; o app continua no modo legado');
  await evc(() => save('diplo_notas', [{ id: 'n1', titulo: 'Editada durante a interrupção', texto: '', criadoEm: 1, editadoEm: Date.now() }])); await E.esperar(pc, () => pendingSyncCount() === 0); check((await E.fsGet(U2)).diplo_notas[0].titulo === 'Editada durante a interrupção', 'enquanto interrompida, o app segue sincronizando normalmente pelo documento legado');
  await evc(() => { window.__MIG = null; }); const r4b = await evc(() => migrarEstrutura()); check(r4b.ok === true, 'retomada conclui a migração');
  const d4 = await E.fsCol(U2, 'dados'); check(Object.keys(d4).filter(k => k !== '__controle').length === 5 && d4.diplo_notas.valor[0].titulo === 'Editada durante a interrupção' && d4.__controle.estrutura === 2, '5 documentos, sem duplicatas, e o valor mais novo (editado durante a interrupção) foi copiado');

  console.log('\n[5] Edição concorrente durante a cópia (validação detecta e recopia)');
  const U3 = await E.uidDe('mig3'); await E.fsSet(U3, legado()); const D = await novo(); await entrar(D, 'mig3'); const evd = (f, a) => D.p.evaluate(f, a);
  await D.p.exposeFunction('alterarLegado', async n => { await E.fsSet(U3, { diplo_notas: [{ id: 'n1', titulo: 'Alterada por outro aparelho no meio da migração ' + n, texto: '', criadoEm: 1, editadoEm: 5 }] }); });
  await evd(() => { window.__MIG = { antesValidar: async t => { if (t === 1) await alterarLegado(t); } }; });
  const r5 = await evd(() => migrarEstrutura()); const d5 = await E.fsDoc(U3, 'dados/diplo_notas'); check(r5.ok === true && d5.valor[0].titulo.includes('no meio da migração 1'), 'o legado mudou entre a cópia e a validação: a divergência foi detectada, recopiada, e a migração concluiu com o valor mais novo', JSON.stringify([r5, d5 && d5.valor[0].titulo]));
  const U4 = await E.uidDe('mig4'); await E.fsSet(U4, legado()); const F = await novo(); await entrar(F, 'mig4'); await F.p.exposeFunction('alterarLegado4', async n => { await E.fsSet(U4, { diplo_notas: [{ id: 'n1', titulo: 'mudança ' + n, texto: '', criadoEm: 1, editadoEm: 5 }] }); });
  await F.p.evaluate(() => { window.__MIG = { antesValidar: async t => { await alterarLegado4(t); } }; }); const r5b = await F.p.evaluate(() => migrarEstrutura()); const c5 = await E.fsDoc(U4, 'dados/__controle');
  check(r5b.ok === false && r5b.etapa === 'validacao' && r5b.divergentes.includes('diplo_notas') && c5.estrutura === 1 && c5.migracao.estado === 'interrompida' && await F.p.evaluate(() => _estrutura()) === 1, 'divergência persistente (3 tentativas): NÃO vira a chave, estado "interrompida", app segue no legado', JSON.stringify([r5b, c5]));
  check((await E.fsGet(U4)).diplo_notas[0].titulo === 'mudança 3', 'o documento legado ficou com a última alteração (nada perdido)');

  console.log('\n[6] Limite de ~1 MiB: o motivo da migração');
  const grande = 'x'.repeat(430000), U5 = await E.uidDe('mig5'); await E.fsSet(U5, legado({ biblio_docs: [{ id: 'b1', titulo: 'Grande 1', conteudo: grande, criadoEm: 1 }, { id: 'b2', titulo: 'Grande 2', conteudo: grande, criadoEm: 2 }] }));
  const G = await novo(); await entrar(G, 'mig5'); const evg = (f, a) => G.p.evaluate(f, a);
  await evg(() => save('flash_cards', [{ id: 'f1', tipo: 'basico', frente: 'F', verso: 'x'.repeat(300000), srs: {}, criadoEm: 1 }])); await sleep(4000);
  check(await evg(() => pendingSyncCount() >= 1 && ['falha', 'pendente', 'enviando'].includes(getSyncStatus().estado)) && !(await G.p.textContent('#syncChip')).includes('Sincronizado'), 'ESTRUTURA ORIGINAL: ao passar de ~1 MiB a gravação falha, o grupo fica pendente e o indicador NÃO diz "Sincronizado"', await evg(() => JSON.stringify(getSyncStatus())));
  check((await E.fsGet(U5)).flash_cards === undefined, 'a nuvem não recebeu o grupo que estourou o limite');
  await clicarMigrar(G.p); check(await esperarEst(G.p, 2, 90000), 'migração concluída mesmo com pendência (a pendência segue salva localmente)'); check(await E.esperar(G.p, () => pendingSyncCount() === 0, null, 60000), 'depois da migração a pendência (que não cabia no documento único) é enviada');
  const f5 = await E.fsDoc(U5, 'dados/flash_cards'); check(f5 && f5.valor[0].verso.length === 300000 && (await E.fsDoc(U5, 'dados/biblio_docs')).valor.length === 2, 'documentos por chave: grupo grande (300 KB) e biblio_docs (860 KB) coexistem — total > 1 MiB, cada um dentro do seu limite');
  await sleep(1500); check(await evg(() => _sync.legadoFalhando === true) && (await E.fsGet(U5)).flash_cards === undefined, 'o espelho no documento legado falhou por tamanho, sem bloquear a sincronização'); check((await G.p.textContent('#syncChip')).includes('Sincronizado'), 'indicador "Sincronizado" (estrutura nova não é afetada pelo limite do legado)');

  console.log('\n[7] Reverter');
  const rv = await ev(() => reverterEstrutura()); check(rv.ok === true, 'reversão concluída', JSON.stringify(rv)); const l1 = await E.fsGet(U1), c7 = await E.fsDoc(U1, 'dados/__controle');
  check(c7.estrutura === 1 && c7.migracao.estado === 'revertida' && await ev(() => _estrutura()) === 1, 'controle volta a estrutura 1 ("revertida")'); check(l1.diplo_notas.length === 2 && l1.diplo_notas[0].titulo === 'Editada no B' && l1.chancelaria_theme === 'azul-do-cliente-antigo', 'o documento legado foi atualizado com o estado mais recente antes de reverter');
  check(Object.keys(await E.fsCol(U1, 'dados')).length > 1, 'os documentos por chave foram mantidos como cópia (nada apagado)'); await ev(() => save('diplo_notas', [{ id: 'n1', titulo: 'Após reverter', texto: '', criadoEm: 1, editadoEm: Date.now() }])); await E.esperar(pa, () => pendingSyncCount() === 0); check((await E.fsGet(U1)).diplo_notas[0].titulo === 'Após reverter', 'depois de reverter, a gravação volta ao documento legado');
  const rv2 = await G.p.evaluate(() => reverterEstrutura()); const c7b = await E.fsDoc(U5, 'dados/__controle'); check(rv2.ok === false && rv2.etapa === 'legado' && rv2.chave === 'flash_cards' && c7b.estrutura === 2 && await G.p.evaluate(() => _estrutura()) === 2 && (await E.fsDoc(U5, 'dados/flash_cards')).valor[0].verso.length === 300000, 'reverter quando os dados NÃO cabem no documento único: RECUSADO com a chave apontada, estrutura continua 2 e nenhum dado se perde', JSON.stringify(rv2));

  console.log('\n[8] Restaurar backup e segurança na estrutura nova');
  const rs = await evc(async () => { const b = await montarBackup('t'); b.dados.diplo_notas = [{ id: 'bk', titulo: 'Do backup', texto: '', criadoEm: 5 }]; b.integridade.hash = await hashTexto(stableStringify({ dados: b.dados, local: b.local })); return restaurarBackup(b, 't', { semConfirmar: true, semRecarregar: true }); });
  await E.esperar(pc, () => pendingSyncCount() === 0, null, 20000); check(rs.ok && (await E.fsDoc(U2, 'dados/diplo_notas')).valor[0].id === 'bk', 'restaurar backup grava no documento por chave');
  const neg = await evc(async () => { const r = {}; for (const [n, ref] of [['outroDados', () => firebase.firestore().collection('chancelaria_users').doc('outro').collection('dados').doc('x')], ['outroBackup', () => firebase.firestore().collection('chancelaria_users').doc('outro').collection('backup').doc('x')], ['proprioDados', () => _dadosCol().doc('diplo_notas')]]) { try { await ref().get(); r[n] = 'permitido'; } catch (e) { r[n] = e.code; } } return r; });
  check(neg.proprioDados === 'permitido' && neg.outroDados === 'permission-denied' && neg.outroBackup === 'permission-denied', 'regras: só o próprio usuário acessa dados/ e backup/', JSON.stringify(neg));
  const erros = aparelhos.flatMap(d => d.erros).filter(e => !/negado|queda simulada|Migração interrompida|Falha ao sincronizar|permission|PERMISSION/.test(e)); check(erros.length === 0, 'nenhum erro de JavaScript inesperado', erros.join(' | '));
  for (const d of aparelhos) await d.b.close(); process.exit(E.resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
