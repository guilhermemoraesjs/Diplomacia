// Sistema de atualização — suíte própria. Service Worker REAL, publicação simulada em cópias temporárias do projeto,
// cenários de sucesso e de FALHA (consulta, download, instalação, versão inconsistente, interrupção, dados pendentes, iPhone emulado).
// Login/dados: Firebase Emulator. Veja docs/TESTES.md.
const fs = require('fs'), os = require('os'), path = require('path'), { execSync } = require('child_process'), { servir } = require('./server');
const H = require('./helpers'); const { check } = H; const raiz = path.join(__dirname, '..', '..'); let porta = 8140;
async function ambiente() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chanc-')), n = porta++, a = { tmp, regras: [], url: `http://localhost:${n}/index.html`, abertos: [] };
  fs.cpSync(raiz, tmp, { recursive: true, filter: s => !/[\\/](\.git|node_modules|tests|infra|diplomacia\.zip)([\\/]|$)/.test(s.slice(raiz.length)) });
  // a suíte é independente da versão atual do repositório: o ambiente parte SEMPRE de v1.0.0 (build 1) e publica v1.1.0, v1.2.0...
  fs.writeFileSync(path.join(tmp, 'version.json'), JSON.stringify({ version: '1.0.0', build: 1, date: '2026-01-01', notes: ['base de teste'] })); execSync('node scripts/sync-version.js', { cwd: tmp });
  a.srv = await servir(tmp, n, { interceptar: p => { const r = a.regras.find(x => (x.re || new RegExp(x.p)).test(p)); return r ? { status: r.status, body: r.body, type: r.type } : null; } });
  a.publicar = (marca, tipo) => { fs.appendFileSync(path.join(tmp, 'js/utils.js'), `\nwindow.__MARCA = ${JSON.stringify(marca)};\n`); execSync(`node scripts/sync-version.js --bump ${tipo || 'minor'}`, { cwd: tmp }); };
  a.abrir = async o => { const d = await H.abrir(Object.assign({ url: a.url }, o || {})); a.abertos.push(d); await d.p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {}); return d; };
  a.fechar = async () => { for (const d of a.abertos) await d.b.close().catch(() => {}); a.srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); };
  return a;
}
const caches_ = p => p.evaluate(() => caches.keys());
const SEM_SYNC = /Falha ao sincronizar|WebChannel|Atualização não concluída|Failed to load|net::|status of 4|status of 5/;
(async () => {
  await H.emuOuSair();
  console.log('\n[1] Versão instalada = publicada / ausência de atualização');
  let A = await ambiente(), d = await A.abrir(), p = d.p, ev = (f, a) => p.evaluate(f, a);
  check(await ev(() => !!navigator.serviceWorker.controller), 'Service Worker REAL registrado e controlando a página');
  check((await caches_(p)).includes('chancelaria-app-1.0.0') && await ev(async () => (await (await caches.open('chancelaria-app-1.0.0')).keys()).length) > 40, 'cache versionado chancelaria-app-1.0.0 com todos os arquivos pré-cacheados');
  let r = await ev(() => checkUpdate({ manual: true })); check(r.status === 'atual' && r.info.build === 1 && !(await p.locator('#updBanner').count()), 'mesma versão: status "atual", sem aviso');
  check((await p.textContent('#versionPanel')).includes('Sistema atualizado') && await ev(() => APP_INFO.version === '1.0.0' && UPD.nova === null), 'painel mostra "Sistema atualizado"');
  const hist = JSON.parse(fs.readFileSync(path.join(A.tmp, 'version.json'), 'utf8')); fs.writeFileSync(path.join(A.tmp, 'version.json'), JSON.stringify({ ...hist, version: '0.9.0', build: 0 })); r = await ev(() => checkUpdate({ manual: true }));
  check(r.status === 'atual' && !(await p.locator('#updBanner').count()), 'versão publicada MENOR que a instalada (rollback do host) não é tratada como atualização'); fs.writeFileSync(path.join(A.tmp, 'version.json'), JSON.stringify(hist));

  console.log('\n[2] Falha ao consultar a versão publicada');
  for (const [nome, regra] of [['HTTP 500', { p: 'version\\.json', status: 500, body: 'erro' }], ['HTTP 404', { p: 'version\\.json', status: 404, body: '' }], ['JSON inválido', { p: 'version\\.json', status: 200, body: '{nao json', type: 'application/json' }], ['sem campo build', { p: 'version\\.json', status: 200, body: '{"version":"2.0.0"}', type: 'application/json' }], ['build não inteiro', { p: 'version\\.json', status: 200, body: '{"version":"2.0.0","build":"abc"}', type: 'application/json' }]]) {
    A.regras = [regra]; r = await ev(() => checkUpdate({ manual: true })); check(r.status === 'erro' && !(await p.locator('#updBanner').count()) && await ev(() => UPD.nova === null), `${nome}: status "erro", nenhum aviso falso`, JSON.stringify(r)); }
  check((await p.textContent('#versionPanel')).includes('Não foi possível verificar') && !(await p.textContent('#versionPanel')).includes('Sistema atualizado'), 'painel diz que não foi possível verificar (e NÃO diz "atualizado")'); A.regras = [];
  await d.ctx.setOffline(true); r = await ev(() => checkUpdate({ manual: true })); check(r.status === 'offline' && (await p.textContent('#toastHost')).includes('Sem conexão'), 'sem internet: status "offline" com mensagem clara'); await d.ctx.setOffline(false);
  check(await ev(() => APP_INFO.version) === '1.0.0' && await ev(() => UPD.nova === null), 'as falhas de consulta não alteram a versão instalada nem criam aviso');

  console.log('\n[3] Nova versão com o aplicativo aberto');
  await ev(() => save('diplo_notas', [{ id: 'n1', titulo: 'Anotação', texto: 'importante', criadoEm: 1 }])); A.publicar('v1.1.0');
  r = await ev(() => checkUpdate({ manual: true })); check(r.status === 'nova' && r.info.version === '1.1.0' && r.info.build === 2, 'detecta a v1.1.0 (version.json sem cache)');
  const ban = await p.textContent('#updBanner'); check(ban.includes('Nova versão disponível') && ban.includes('v1.0.0') && ban.includes('v1.1.0') && ban.includes('Atualizar agora') && ban.includes('Depois'), 'aviso: versões instalada/nova e botões', ban);
  check(await ev(() => APP_INFO.version === '1.0.0' && window.__MARCA === undefined), 'a página continua na v1.0.0 (nada recarregou sozinho)'); const reqs = await ev(() => performance.getEntriesByType('resource').filter(e => e.name.includes('version.json')).length); await ev(() => checkUpdate({})); check(await ev(n => performance.getEntriesByType('resource').filter(e => e.name.includes('version.json')).length === n, reqs), 'verificação automática repetida em menos de 1 min não consulta de novo (sem excesso)');
  await p.click('#updBanner >> text=Depois'); check(!(await p.locator('#updBanner').count()) && await ev(() => document.body.classList.contains('has-update')), '"Depois" esconde o aviso mas o menu segue indicando atualização'); await ev(() => { UPD.ultimaChecagem = 0; return checkUpdate({}); }); check(!(await p.locator('#updBanner').count()), 'aviso dispensado não volta a cada verificação');

  await A.fechar();
  console.log('\n[4] Falha ao BAIXAR arquivos: instalação atômica (nada incompleto é ativado)');
  A = await ambiente(); d = await A.abrir(); p = d.p; ev = (f, a) => p.evaluate(f, a); await ev(() => save('diplo_notas', [{ id: 'n1', titulo: 'Anotação', texto: 'importante', criadoEm: 1 }])); A.publicar('v1.1.0');
  A.regras = [{ p: 'js/notas\\.js', status: 404, body: 'nao' }]; await ev(() => checkUpdate({ manual: true }));
  await ev(() => { window.__antes = 1; applyUpdate(); }); await p.waitForSelector('#updBanner.erro', { timeout: 40000 }); const eb = await p.textContent('#updBanner');
  check(eb.includes('Não foi possível instalar a nova versão') && eb.includes('Nada foi alterado') && eb.includes('v1.0.0') && eb.includes('Tentar novamente'), 'mostra erro claro, informa que nada foi alterado e oferece "Tentar novamente"', eb);
  check(await ev(() => window.__antes === 1 && APP_INFO.version === '1.0.0' && window.__MARCA === undefined && !localStorage.getItem('chancelaria_upd_target')), 'a página NÃO recarregou e não há alvo de atualização pendente (nunca declara sucesso)');
  const ks = await caches_(p); check(ks.includes('chancelaria-app-1.0.0') && !ks.includes('chancelaria-app-1.1.0'), 'cache da v1.1.0 incompleto foi descartado; o da v1.0.0 segue intacto', JSON.stringify(ks));
  check((await ev(async () => (await swVersao((await navigator.serviceWorker.getRegistration()).active)).version)) === '1.0.0', 'o Service Worker ATIVO continua sendo o da v1.0.0 (versão incompleta não foi ativada)');
  check(await ev(() => load('diplo_notas', [])[0].texto === 'importante') && await ev(() => !!JSON.parse(localStorage.getItem('chancelaria_upd_fail')).motivo), 'dados do usuário intactos; falha registrada (evita ciclo de tentativas automáticas)');
  await ev(() => { UPD.avisoManual = false; localStorage.removeItem('chancelaria_upd_dismissed'); UPD.nova = { version: '1.1.0', build: 2 }; updAtualizarUI(); }); await ev(() => { const b = document.getElementById('updBanner'); if (b && !b.classList.contains('erro')) b.remove(); });
  check(await ev(() => updFalhaRecente(2)) && await ev(() => { UPD.avisoManual = false; return updDispensado(); }), 'após falha, o aviso automático da mesma versão fica suprimido por 30 min (sem ciclo de falhas)');
  A.regras = []; await p.click('#updBanner >> text=Tentar novamente'); await p.waitForFunction(() => window.__MARCA === 'v1.1.0', null, { timeout: 40000 }); await H.sleep(1500);
  check(await ev(() => APP_INFO.version === '1.1.0' && !localStorage.getItem('chancelaria_upd_target')) && (await caches_(p)).includes('chancelaria-app-1.1.0') && !(await caches_(p)).includes('chancelaria-app-1.0.0'), 'corrigido o problema, "Tentar novamente" instala a v1.1.0; cache antigo removido');
  check((await p.textContent('#toastHost')).includes('atualizada para a versão v1.1.0') && await ev(() => load('diplo_notas', [])[0].texto === 'importante'), 'só agora aparece "atualizada" e os dados continuam intactos');
  check(d.erros.filter(e => !SEM_SYNC.test(e)).length === 0, 'sem erros de JavaScript no cenário', d.erros.filter(e => !SEM_SYNC.test(e)).join(' | ')); await A.fechar();

  console.log('\n[5] Falha por versão inconsistente (deploy pela metade)');
  A = await ambiente(); d = await A.abrir(); p = d.p; ev = (f, a) => p.evaluate(f, a); const versionAntigo = fs.readFileSync(path.join(A.tmp, 'js/version.js'), 'utf8'); A.publicar('v1.1.0'); A.regras = [{ p: 'js/version\\.js', status: 200, body: versionAntigo, type: 'application/javascript' }];
  await ev(() => checkUpdate({ manual: true })); await ev(() => applyUpdate()); await p.waitForSelector('#updBanner.erro', { timeout: 40000 }); check((await p.textContent('#updBanner')).includes('Não foi possível instalar') && await ev(() => APP_INFO.version) === '1.0.0' && !(await caches_(p)).includes('chancelaria-app-1.1.0'), 'js/version.js de outro build no servidor: instalação recusada, nada ativado'); await A.fechar();

  console.log('\n[6] Falha na instalação/descoberta do Service Worker');
  A = await ambiente(); d = await A.abrir(); p = d.p; ev = (f, a) => p.evaluate(f, a); A.publicar('v1.1.0'); A.regras = [{ p: 'sw\\.js', status: 200, body: 'isto nao e javascript valido {{{', type: 'application/javascript' }];
  await ev(() => checkUpdate({ manual: true })); check(await ev(() => UPD.nova && UPD.nova.version) === '1.1.0', 'version.json novo foi lido mesmo com sw.js quebrado'); await ev(() => applyUpdate()); await p.waitForSelector('#updBanner.erro', { timeout: 40000 });
  check((await p.textContent('#updBanner')).includes('Não foi possível instalar') && await ev(() => APP_INFO.version) === '1.0.0' && !(await ev(() => localStorage.getItem('chancelaria_upd_target'))), 'sw.js com erro: falha informada, sem recarregar, sem declarar sucesso'); await A.fechar();

  console.log('\n[7] Atualização interrompida (aba fechada no meio)');
  A = await ambiente(); d = await A.abrir(); p = d.p; ev = (f, a) => p.evaluate(f, a); A.publicar('v1.1.0'); await ev(() => checkUpdate({ manual: true })); await ev(() => save('diplo_notas', [{ id: 'n1', titulo: 'Antes', texto: 'preservar', criadoEm: 1 }]));
  ev(() => applyUpdate()).catch(() => {}); for (let i = 0; i < 400 && !(await p.evaluate(() => localStorage.getItem('chancelaria_upd_target')).catch(() => 'x')); i++) await H.sleep(25); await p.close();
  const p2 = await d.ctx.newPage(); p2.on('pageerror', e => d.erros.push('PAGEERROR ' + e.message)); await p2.goto(A.url); await p2.waitForFunction(() => window.__MARCA === 'v1.1.0' && document.querySelector('#centralRoot .ct-head'), null, { timeout: 30000 }); await H.sleep(2500);
  const s2 = await p2.evaluate(() => ({ v: APP_INFO.version, alvo: localStorage.getItem('chancelaria_upd_target'), erro: !!document.querySelector('#updBanner.erro'), toast: (document.getElementById('toastHost') || { innerText: '' }).innerText, notas: load('diplo_notas', []) }));
  check(s2.v === '1.1.0' && s2.alvo === null && !s2.erro && s2.notas[0].texto === 'preservar', 'reabrir depois da interrupção carrega a v1.1.0, limpa o alvo pendente e preserva os dados', JSON.stringify(s2));
  check(s2.toast.includes('atualizada para a versão v1.1.0'), 'a confirmação "atualizada" aparece só depois de a v1.1.0 estar de fato carregada'); await A.fechar();

  console.log('\n[8] Atualização com dados NÃO sincronizados (servidor indisponível) e recarga na versão certa');
  A = await ambiente(); d = await A.abrir(); p = d.p; ev = (f, a) => p.evaluate(f, a); await d.ctx.route('**/127.0.0.1:8080/**', rt => rt.abort());
  await ev(() => save('diplo_notas', [{ id: 'n1', titulo: 'Offline', texto: 'editada sem rede', criadoEm: 1 }])); await H.sleep(800); check(await ev(() => pendingSyncCount() === 1), 'edição feita sem acesso ao servidor está pendente');
  A.publicar('v1.1.0'); await ev(() => checkUpdate({ manual: true })); await ev(() => applyUpdate()); await p.waitForFunction(() => window.__MARCA === 'v1.1.0', null, { timeout: 60000 }); await p.waitForFunction(() => document.querySelector('#centralRoot .ct-head') && typeof currentUid !== 'undefined' && currentUid, null, { timeout: 30000 }); await H.sleep(1500);
  check(await ev(() => APP_INFO.version === '1.1.0' && load('diplo_notas', [])[0].texto === 'editada sem rede' && pendingSyncCount() === 1), 'após atualizar: versão nova carregada, edição local preservada e ainda marcada como pendente');
  check(await ev(async () => (await listarSnapshots()).some(s => s.motivo === 'pre-atualizacao-v1.1.0' && s.dados.diplo_notas[0].texto === 'editada sem rede')), 'snapshot "pre-atualizacao" contém a edição pendente');
  await d.ctx.unroute('**/127.0.0.1:8080/**'); await ev(() => sincronizarAgora('t')); await H.esperar(p, () => pendingSyncCount() === 0, null, 25000); const cloud = await H.fsGet(await ev(() => currentUid)); check(cloud.diplo_notas[0].texto === 'editada sem rede', 'com o servidor de volta, a edição pendente chega à nuvem após a atualização');
  check(d.erros.filter(e => !SEM_SYNC.test(e)).length === 0, 'sem erros de JavaScript', d.erros.filter(e => !SEM_SYNC.test(e)).join(' | ')); await A.fechar();

  console.log('\n[9] Versão do Service Worker × código carregado');
  A = await ambiente(); d = await A.abrir(); p = d.p; ev = (f, a) => p.evaluate(f, a); A.publicar('v1.1.0'); await ev(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); await new Promise(r => { const w = reg.installing || reg.waiting; if (w.state === 'installed') return r(); w.addEventListener('statechange', () => w.state === 'installed' && r()); }); (reg.waiting || reg.installing).postMessage({ type: 'SKIP_WAITING' }); });
  await H.sleep(1500); await ev(() => updDiagnosticar()); check(await ev(() => UPD.obsoleta === true && UPD.nova.build === 2 && APP_INFO.build === 1) && (await p.textContent('#updBanner')).includes('v1.1.0'), 'SW já é v1.1.0 mas a página roda código v1.0.0: detecta a incoerência e avisa (não finge estar atualizada)');
  await ev(() => applyUpdate()); await p.waitForFunction(() => window.__MARCA === 'v1.1.0', null, { timeout: 40000 }); await H.sleep(1500); check(await ev(() => APP_INFO.version === '1.1.0' && !localStorage.getItem('chancelaria_upd_target')), 'recarregar resolve: código e Service Worker na v1.1.0'); await A.fechar();

  console.log('\n[10] Sem ciclos: alvo que nunca carrega');
  A = await ambiente(); d = await A.abrir(); p = d.p; ev = (f, a) => p.evaluate(f, a); let navs = 0; p.on('framenavigated', f => { if (f === p.mainFrame()) navs++; });
  await ev(() => localStorage.setItem('chancelaria_upd_target', JSON.stringify({ build: 99, version: '9.9.9', em: Date.now(), tentativas: 0 }))); await p.reload(); await p.waitForSelector('#updBanner.erro', { timeout: 15000 }); check((await p.textContent('#updBanner')).includes('ainda não foi carregada'), 'alvo não carregado: avisa em vez de declarar sucesso');
  const FORCAR = '#updBanner >> text=Forçar atualização', navegar = acao => Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 40000 }), acao()]);
  await navegar(() => p.dblclick(FORCAR));                                   // clique DUPLO: não pode contar duas tentativas nem recarregar duas vezes
  await p.waitForSelector('#updBanner.erro', { timeout: 20000 }); check(await ev(() => JSON.parse(localStorage.getItem('chancelaria_upd_target')).tentativas) === 1, 'clique duplo em "Forçar atualização" conta UMA tentativa (sem corrida)');
  await navegar(() => p.click(FORCAR)) ; await p.waitForFunction(() => !localStorage.getItem('chancelaria_upd_target'), null, { timeout: 30000 }); await H.sleep(2000);
  const fim = await ev(() => ({ alvo: localStorage.getItem('chancelaria_upd_target'), erro: !!document.querySelector('#updBanner.erro'), toast: (document.getElementById('toastHost') || { innerText: '' }).innerText })); check(fim.alvo === null && !fim.erro && fim.toast.includes('Não foi possível carregar a v9.9.9') && navs <= 6, 'após 2 tentativas desiste com mensagem (sem laço infinito de recarregamentos)', JSON.stringify({ ...fim, navs }));
  check(d.erros.filter(e => !SEM_SYNC.test(e)).length === 0, 'sem erros de JavaScript', d.erros.filter(e => !SEM_SYNC.test(e)).join(' | ')); await A.fechar();

  console.log('\n[11] iPhone EMULADO (Chromium com UA/viewport/toque de iPhone — não é o Safari real)');
  A = await ambiente(); const { devices } = require('playwright'); d = await H.abrir({ url: A.url, context: devices['iPhone 13'] }); A.abertos.push(d); p = d.p; ev = (f, a) => p.evaluate(f, a); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
  A.publicar('v1.1.0'); await ev(() => checkUpdate({ manual: true })); check((await p.locator('#updBanner').boundingBox()).width <= 390 && await p.locator('#updBanner >> text=Atualizar agora').isVisible(), 'aviso cabe na tela do iPhone e o botão é visível'); await p.click('#updBanner >> text=Atualizar agora'); await p.waitForFunction(() => window.__MARCA === 'v1.1.0', null, { timeout: 40000 }); await H.sleep(1500);
  check(await ev(() => APP_INFO.version) === '1.1.0' && await ev(() => document.documentElement.scrollWidth <= 391), 'iPhone emulado: atualização concluída e layout sem rolagem horizontal'); await A.fechar();
  process.exit(H.resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
