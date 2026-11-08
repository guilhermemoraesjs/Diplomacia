// Sincronização contra o Firebase Emulator Suite (Firestore e Auth reais, locais). Requer emuladores em 8080/9099.
const E = require('./emu'); const { check, sleep } = E;
const nota = (id, t, ed) => ({ id, titulo: t, texto: '', criadoEm: 1, editadoEm: ed });
(async () => {
  if (!await E.emuDisponivel()) { console.log('EMULADOR INDISPONÍVEL (rode: npm run test:sync). Nada foi executado.'); process.exit(3); }
  await E.limparEmu(); const aparelhos = []; const U1 = await E.uidDe('u1'), U8 = await E.uidDe('u8'), U9 = await E.uidDe('u9');
  const novo = async () => { const d = await E.novoAparelho(); aparelhos.push(d); return d; };
  console.log('\n[1] Garantias básicas: login real, gravação e metadados');
  const A = await novo(); check(await A.p.evaluate(() => window.__EMU_ACTIVE === true), 'página usando o emulador (não a produção)');
  check(await E.login(A, 'u1'), 'login (Auth Emulator) concluído');
  check((await A.p.evaluate(() => getSyncStatus().estado)) === 'sincronizado', 'estado inicial: sincronizado');
  await A.p.evaluate(() => save('diplo_notas', [{ id: 'n1', titulo: 'T1', texto: 'a', criadoEm: 1 }]));
  check(await E.esperar(A.p, () => pendingSyncCount() === 0), 'pendência confirmada após gravação');
  let cloud = await E.fsGet(U1); check(cloud && cloud.diplo_notas && cloud.diplo_notas[0].titulo === 'T1', 'valor chegou ao Firestore real', JSON.stringify(cloud && cloud.diplo_notas));
  check(cloud.__meta && cloud.__meta.diplo_notas && cloud.__meta.diplo_notas.t > 0 && cloud.__meta.diplo_notas.d === await A.p.evaluate(() => deviceId()), 'metadados __meta[chave] = {t, d} gravados');
  check((await A.p.textContent('#syncChip')).includes('Sincronizado'), 'indicador visual mostra "Sincronizado"');

  console.log('\n[2] Alterações rápidas e consecutivas na MESMA chave');
  await A.p.evaluate(() => { for (let i = 1; i <= 25; i++) save('diplo_notas', [{ id: 'n1', titulo: 'v' + i, texto: '', criadoEm: 1 }]); });
  check(await A.p.evaluate(() => pendingSyncCount() >= 1), 'logo após 25 saves em sequência a chave está pendente');
  check(await E.esperar(A.p, () => pendingSyncCount() === 0), 'pendência zerada depois do envio');
  cloud = await E.fsGet(U1); check(cloud.diplo_notas[0].titulo === 'v25', 'nuvem tem a ÚLTIMA edição (v25), não uma intermediária', cloud.diplo_notas[0].titulo);
  await A.p.evaluate(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); for (let i = 1; i <= 40; i++) { save('diplo_notas', [{ id: 'n1', titulo: 'r' + i, texto: '', criadoEm: 1 }]); await w(Math.random() * 25); } });
  check(await E.esperar(A.p, () => pendingSyncCount() === 0), 'edições com intervalos aleatórios (durante envios em voo) também zeram a pendência');
  cloud = await E.fsGet(U1); check(cloud.diplo_notas[0].titulo === 'r40' && await A.p.evaluate(() => load('diplo_notas', [])[0].titulo) === 'r40', 'nuvem e local terminam com a última edição (r40)', cloud.diplo_notas[0].titulo);
  await A.p.evaluate(() => { save('diplo_notas', [nota1()]); function nota1() { return { id: 'n1', titulo: 'final', texto: '', criadoEm: 1 }; } save('chancelaria_theme', 'light'); save('diplo_notas', [{ id: 'n1', titulo: 'final2', texto: '', criadoEm: 1 }]); });
  await E.esperar(A.p, () => pendingSyncCount() === 0); cloud = await E.fsGet(U1);
  check(cloud.diplo_notas[0].titulo === 'final2' && cloud.chancelaria_theme === 'light', 'edições intercaladas de chaves diferentes: cada chave com seu último valor');
  const out = await A.p.evaluate(async () => { const ref = _ref(), dev = deviceId(), v0 = JSON.parse(localStorage.getItem('diplo_notas')); const snap = (await ref.get()).data(); const tNuvem = snap.__meta.diplo_notas.t;
    const d = getDirty(); d.diplo_notas = tNuvem - 5000; setDirty(d); localStorage.setItem('diplo_notas', JSON.stringify([{ id: 'n1', titulo: 'ANTIGA-NAO-DEVE-GRAVAR', texto: '', criadoEm: 1 }]));
    const r = await _enviarChave('diplo_notas'); localStorage.setItem('diplo_notas', JSON.stringify(v0)); return r; });
  cloud = await E.fsGet(U1); check(out === 'superado' && cloud.diplo_notas[0].titulo === 'final2', 'gravação antiga (carimbo menor) NÃO sobrescreve a mais nova', out + ' / ' + cloud.diplo_notas[0].titulo);

  console.log('\n[3] Falha de rede durante o envio, pendências e retorno da conexão');
  await A.p.evaluate(() => { const d = getDirty(); delete d.diplo_notas; setDirty(d); });
  await A.ctx.setOffline(true);
  await A.p.evaluate(() => save('diplo_notas', [{ id: 'n1', titulo: 'offline-1', texto: '', criadoEm: 1 }])); await sleep(500);
  await A.p.evaluate(() => save('diplo_notas', [{ id: 'n1', titulo: 'offline-2', texto: '', criadoEm: 1 }, { id: 'n2', titulo: 'novo', texto: '', criadoEm: 2 }]));
  check(await A.p.evaluate(() => load('diplo_notas', []).length === 2), 'offline: dado salvo localmente');
  check(await A.p.evaluate(() => pendingSyncCount() === 1 && ['offline', 'falha', 'pendente', 'enviando'].includes(getSyncStatus().estado)), 'offline: 1 grupo pendente e estado ≠ sincronizado', await A.p.evaluate(() => JSON.stringify(getSyncStatus())));
  check(!(await A.p.textContent('#syncChip')).includes('Sincronizado'), 'indicador NÃO diz "Sincronizado" enquanto há pendência');
  cloud = await E.fsGet(U1); check(cloud.diplo_notas[0].titulo === 'final2' && cloud.diplo_notas.length === 1, 'nuvem continua com a versão antiga enquanto offline');
  await A.ctx.setOffline(false); await A.p.evaluate(() => window.dispatchEvent(new Event('online')));
  check(await E.esperar(A.p, () => pendingSyncCount() === 0, null, 20000), 'conexão voltou: pendência enviada automaticamente');
  cloud = await E.fsGet(U1); check(cloud.diplo_notas.length === 2 && cloud.diplo_notas[0].titulo === 'offline-2', 'nuvem recebeu a versão mais recente (sem duplicar registros)', JSON.stringify(cloud.diplo_notas.map(n => n.titulo)));

  console.log('\n[4] Falha do servidor + recarregar a página: pendência sobrevive e é reenviada');
  await A.ctx.route('**/127.0.0.1:8080/**', r => r.abort());
  await A.p.evaluate(() => save('diplo_notas', [{ id: 'n1', titulo: 'apos-falha', texto: '', criadoEm: 1 }]));
  await sleep(1500); check(await A.p.evaluate(() => pendingSyncCount() === 1), 'com o servidor inacessível a chave fica pendente');
  await A.p.reload(); await A.p.waitForFunction(() => document.querySelector('#centralRoot .ct-head'));
  check(await A.p.evaluate(() => pendingSyncCount() === 1 && load('diplo_notas', [])[0].titulo === 'apos-falha'), 'após recarregar: dado local e pendência preservados');
  cloud = await E.fsGet(U1); check(cloud.diplo_notas[0].titulo === 'offline-2', 'nuvem ainda não tem a edição (servidor bloqueado)');
  await A.ctx.unroute('**/127.0.0.1:8080/**'); await A.p.evaluate(() => sincronizarAgora('teste'));
  check(await E.esperar(A.p, () => pendingSyncCount() === 0, null, 25000), 'servidor voltou: pendência reenviada após o recarregamento');
  cloud = await E.fsGet(U1); check(cloud.diplo_notas[0].titulo === 'apos-falha', 'nuvem recebeu a edição feita antes da falha');
  check(await A.p.evaluate(() => load('diplo_notas', [])[0].titulo === 'apos-falha'), 'a pendência local NÃO foi sobrescrita pelo valor antigo da nuvem ao recarregar');

  console.log('\n[5] Dois aparelhos: a versão mais recente é preservada');
  const B = await novo(); check(await E.login(B, 'u1'), 'aparelho B entrou na mesma conta');
  check(await B.p.evaluate(() => load('diplo_notas', [])[0].titulo) === 'apos-falha', 'B baixou a versão mais recente ao abrir');
  await B.p.evaluate(() => save('diplo_notas', [{ id: 'n1', titulo: 'editado-no-B', texto: '', criadoEm: 1, editadoEm: Date.now() }]));
  check(await E.esperar(B.p, () => pendingSyncCount() === 0), 'B enviou a edição');
  await A.p.evaluate(() => sincronizarAgora('teste')); check(await E.esperar(A.p, () => load('diplo_notas', [])[0].titulo === 'editado-no-B'), 'A (já aberto) recebe a edição do B ao sincronizar');
  const Cc = await novo(); await E.login(Cc, 'u1'); check(await Cc.p.evaluate(() => load('diplo_notas', [])[0].titulo) === 'editado-no-B', 'terceiro aparelho abre depois e vê a edição mais recente');

  console.log('\n[6] Conflito: edição simultânea em dois aparelhos (um offline)');
  await A.p.evaluate(() => { save('diplo_notas', [{ id: 'n1', titulo: 'base', texto: '', criadoEm: 1, editadoEm: 100 }]); }); await E.esperar(A.p, () => pendingSyncCount() === 0); await B.p.evaluate(() => sincronizarAgora('t')); await E.esperar(B.p, () => load('diplo_notas', [])[0].titulo === 'base');
  await A.ctx.setOffline(true);
  await A.p.evaluate(() => save('diplo_notas', [{ id: 'n1', titulo: 'A-offline', texto: '', criadoEm: 1, editadoEm: 1000 }, { id: 'n2', titulo: 'so-no-A', texto: '', criadoEm: 2, editadoEm: 1000 }]));
  await B.p.evaluate(() => save('diplo_notas', [{ id: 'n1', titulo: 'B-online', texto: '', criadoEm: 1, editadoEm: 2000 }, { id: 'n3', titulo: 'so-no-B', texto: '', criadoEm: 3, editadoEm: 2000 }])); await E.esperar(B.p, () => pendingSyncCount() === 0);
  await A.ctx.setOffline(false); await A.p.evaluate(() => window.dispatchEvent(new Event('online')));
  check(await E.esperar(A.p, () => pendingSyncCount() === 0 && getConflicts().length >= 1, null, 25000), 'A detecta o conflito e resolve', await A.p.evaluate(() => JSON.stringify(getSyncStatus())));
  cloud = await E.fsGet(U1); const tit = Object.fromEntries(cloud.diplo_notas.map(n => [n.id, n.titulo]));
  check(tit.n1 === 'B-online' && tit.n2 === 'so-no-A' && tit.n3 === 'so-no-B' && cloud.diplo_notas.length === 3, 'mesclagem por id: n1 vence o mais recente (B), n2 e n3 preservados, sem duplicar', JSON.stringify(tit));
  check(await A.p.evaluate(() => load('diplo_notas', []).length === 3), 'estado local de A igual ao mesclado');
  const cf = await A.p.evaluate(() => getConflicts()[0]); check(cf && cf.key === 'diplo_notas' && cf.local.includes('A-offline') && cf.remoto.includes('B-online'), 'cópia das duas versões guardada em "conflitos"');
  check((await A.p.evaluate(() => renderSeguranca().then(() => document.getElementById('cfgSeguranca').innerText))).toLowerCase().includes('conflitos entre aparelhos'), 'conflito listado em Backup e segurança');

  console.log('\n[7] Valor simples (não-lista): vence o carimbo mais recente');
  await B.p.evaluate(() => sincronizarAgora('t')); await E.esperar(B.p, () => pendingSyncCount() === 0);
  await A.ctx.setOffline(true); await A.p.evaluate(() => save('chancelaria_theme', 'light')); await sleep(300);
  await B.p.evaluate(() => save('chancelaria_theme', 'dark')); await E.esperar(B.p, () => pendingSyncCount() === 0);
  await A.ctx.setOffline(false); await A.p.evaluate(() => window.dispatchEvent(new Event('online'))); await E.esperar(A.p, () => pendingSyncCount() === 0, null, 20000);
  cloud = await E.fsGet(U1); check(cloud.chancelaria_theme === 'dark' && await A.p.evaluate(() => localStorage.getItem('chancelaria_theme')) === '"dark"', 'remoto mais recente (B) vence: nuvem e A = "dark"', cloud.chancelaria_theme);
  await B.ctx.setOffline(true); await B.p.evaluate(() => save('chancelaria_theme', 'azul-b')); await sleep(300); await A.p.evaluate(() => save('chancelaria_theme', 'azul-a')); await E.esperar(A.p, () => pendingSyncCount() === 0);
  await B.ctx.setOffline(false); await B.p.evaluate(() => window.dispatchEvent(new Event('online'))); await E.esperar(B.p, () => pendingSyncCount() === 0, null, 20000); cloud = await E.fsGet(U1);
  check(cloud.chancelaria_theme === 'azul-a', 'local mais recente que o remoto: o remoto mais recente (A, gravado depois) é mantido', cloud.chancelaria_theme);

  console.log('\n[8] Documento legado (sem metadados) e dados locais mais novos');
  await E.fsSet(U9, { diplo_notas: [{ id: 'velha', titulo: 'da nuvem antiga', texto: '', criadoEm: 1 }] });
  const D = await novo(); await D.p.evaluate(() => { localStorage.setItem('diplo_notas', JSON.stringify([{ id: 'local', titulo: 'local novo', texto: '', criadoEm: 2 }])); save('diplo_notas', load('diplo_notas', [])); });
  await E.login(D, 'u9'); await E.esperar(D.p, () => pendingSyncCount() === 0, null, 20000); cloud = await E.fsGet(U9);
  check(await D.p.evaluate(() => load('diplo_notas', []).some(n => n.id === 'local')) && cloud.diplo_notas.some(n => n.id === 'local'), 'edição local pendente prevaleceu sobre documento legado e foi enviada');
  check(cloud.__meta && cloud.__meta.diplo_notas, 'documento legado passou a ter metadados');
  await E.fsSet(U8, { diplo_notas: [{ id: 'remota', titulo: 'só na nuvem', texto: '', criadoEm: 1 }] }); const F = await novo(); await E.login(F, 'u8');
  check(await F.p.evaluate(() => load('diplo_notas', [])[0].id) === 'remota', 'aparelho sem dados locais recebe os dados do documento legado');

  console.log('\n[9] Restaurar backup sobe para a nuvem como edição mais recente');
  const r = await A.p.evaluate(async () => { const b = await montarBackup('teste'); b.dados.diplo_notas = [{ id: 'bk', titulo: 'do backup', texto: '', criadoEm: 5 }]; b.integridade.hash = await hashTexto(stableStringify({ dados: b.dados, local: b.local })); return restaurarBackup(b, 'teste', { semConfirmar: true, semRecarregar: true }); });
  check(r.ok === true, 'restauração aplicada', JSON.stringify(r)); await E.esperar(A.p, () => pendingSyncCount() === 0, null, 20000); cloud = await E.fsGet(U1);
  check(cloud.diplo_notas.length === 1 && cloud.diplo_notas[0].id === 'bk', 'nuvem refletiu o backup restaurado');

  console.log('\n[10] Regras de segurança propostas (infra/firestore.rules) contra o emulador');
  const leitura = await A.p.evaluate(async () => { const out = {}; try { await firebase.firestore().collection('chancelaria_users').doc('u2').get(); out.outro = 'permitido'; } catch (e) { out.outro = e.code; } try { await firebase.firestore().collection('chancelaria_users').doc(currentUid).get(); out.proprio = 'permitido'; } catch (e) { out.proprio = e.code; } try { await firebase.firestore().collection('outra_colecao').doc('x').get(); out.fora = 'permitido'; } catch (e) { out.fora = e.code; } return out; });
  check(leitura.proprio === 'permitido' && leitura.outro === 'permission-denied' && leitura.fora === 'permission-denied', 'só o próprio documento é acessível; outro usuário e coleções externas negados', JSON.stringify(leitura));
  const anon = await novo(); const semLogin = await anon.p.evaluate(async u => { try { await firebase.firestore().collection('chancelaria_users').doc(u).get(); return 'permitido'; } catch (e) { return e.code; } }, U1);
  check(semLogin === 'permission-denied', 'sem login: acesso negado', semLogin);
  const erros = aparelhos.flatMap(d => d.erros); check(erros.length === 0, 'nenhum erro de JavaScript em todos os aparelhos', erros.join(' | '));
  for (const d of aparelhos) await d.b.close(); process.exit(E.resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
