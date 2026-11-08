// E2E do sistema de atualização. Copia o projeto para uma pasta temporária, serve em :8124 e simula uma nova publicação.
const { spawn, execSync } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path');
const { abrir, check, resumo } = require('./helpers');
const raiz = path.join(__dirname, '..', '..'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chanc-'));
fs.cpSync(raiz, tmp, { recursive: true, filter: src => !/[\\/](\.git|tests|diplomacia\.zip)([\\/]|$)/.test(src.slice(raiz.length)) });
const srv = spawn('python3', ['-m', 'http.server', '8124'], { cwd: tmp, stdio: 'ignore' });
const URL = 'http://localhost:8124/index.html', sleep = ms => new Promise(r => setTimeout(r, ms));
const publicarNova = (marca, tipo) => { fs.appendFileSync(path.join(tmp, 'js/utils.js'), `\nwindow.__MARCA = ${JSON.stringify(marca)};\n`); execSync(`node scripts/sync-version.js --bump ${tipo || 'minor'}`, { cwd: tmp }); };
(async () => {
  await sleep(800);
  const { b, ctx, p, erros } = await abrir({ url: URL }); const ev = (f, a) => p.evaluate(f, a);
  console.log('\n[A] Versão instalada = publicada; Service Worker e cache versionado');
  await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  check(await ev(() => !!navigator.serviceWorker.controller), 'Service Worker registrado e controlando a página');
  check(JSON.stringify(await ev(() => caches.keys())).includes('chancelaria-app-1.0.0'), 'cache versionado chancelaria-app-1.0.0 criado');
  check(await ev(async () => { const c = await caches.open('chancelaria-app-1.0.0'); return (await c.keys()).length > 30; }), 'arquivos pré-cacheados (HTML, JS, CSS, vendor)');
  const r1 = await ev(() => checkUpdate({ manual: true }));
  check(r1.status === 'atual' && !(await ev(() => !!document.getElementById('updBanner'))), 'usuário na versão mais recente: status "atual", sem aviso');
  check((await ev(() => document.getElementById('versionPanel').innerText)).includes('Sistema atualizado'), 'painel de versão informa "Sistema atualizado"');
  check(await ev(() => APP_INFO.version === '1.0.0' && APP_INFO.build === 1), 'versão instalada v1.0.0 (build 1)');

  console.log('\n[B] Sem internet');
  await ctx.setOffline(true); const r2 = await ev(() => checkUpdate({ manual: true }));
  check(r2.status === 'offline', 'sem conexão: status "offline"'); check((await ev(() => document.getElementById('toastHost').innerText)).includes('Sem conexão'), 'mensagem clara de que não foi possível verificar');
  check((await ev(() => document.getElementById('versionPanel').innerText)).includes('Sem conexão'), 'painel de versão também informa a falta de conexão');
  await ctx.setOffline(false);

  console.log('\n[C] Nova versão publicada (v1.1.0): aviso, sem interromper');
  publicarNova('v1.1.0'); await sleep(300);
  await ev(() => { save('diplo_notas', [{ id: 'n1', titulo: 'Anotação local', texto: 'não pode sumir', criadoEm: Date.now() }]); });
  const r3 = await ev(() => checkUpdate({ manual: true }));
  check(r3.status === 'nova' && r3.info.version === '1.1.0', 'detecta a nova versão publicada (version.json lido sem cache)');
  const ban = await ev(() => document.getElementById('updBanner') && document.getElementById('updBanner').innerText);
  check(ban && ban.includes('Nova versão disponível') && ban.includes('v1.0.0') && ban.includes('v1.1.0') && ban.includes('Atualizar agora'), 'aviso mostra versão instalada, nova versão e botão "Atualizar agora"', ban);
  check(await ev(() => APP_INFO.version) === '1.0.0', 'a página NÃO recarregou sozinha (sessão de estudo preservada)');
  await p.click('#updBanner >> text=Depois'); check(!(await ev(() => !!document.getElementById('updBanner'))) && await ev(() => document.body.classList.contains('has-update')), 'dispensar esconde o aviso temporariamente; menu continua indicando atualização');
  await ev(() => checkUpdate({ manual: true })); check(!(await ev(() => !!document.getElementById('updBanner'))), 'aviso dispensado não reaparece a cada verificação');

  console.log('\n[D] Alterações locais não sincronizadas + atualizar agora');
  await ev(() => { window.__FS_FAIL = true; save('diplo_notas', [{ id: 'n1', titulo: 'Anotação local', texto: 'não pode sumir', criadoEm: Date.now() }, { id: 'n2', titulo: 'Offline', texto: 'editada sem rede', criadoEm: Date.now() }]); });
  check(await ev(() => pendingSyncCount() > 0), 'edição sem rede fica marcada como pendente de sincronização');
  await ev(() => { localStorage.setItem('chancelaria_upd_dismissed', 'null'); checkUpdate({ manual: true }); }); await sleep(500);
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('__fsinit')) { sessionStorage.setItem('__fsinit', '1'); window.__FS = { doc: { diplo_notas: [{ id: 'n1', titulo: 'Anotação local', texto: 'não pode sumir', criadoEm: 1 }] } }; } });   // nuvem tem só a versão ANTIGA das notas
  await ev(() => applyUpdate()); await p.waitForFunction(() => window.__MARCA === 'v1.1.0', null, { timeout: 40000 }).catch(() => {});
  await p.waitForFunction(() => document.querySelector('#centralRoot .ct-head'), null, { timeout: 15000 });
  await sleep(1800);
  check(await ev(() => window.__MARCA) === 'v1.1.0' && await ev(() => APP_INFO.version) === '1.1.0', 'após atualizar, o código novo (v1.1.0) está carregado');
  check(await ev(() => load('diplo_notas', []).length === 2 && load('diplo_notas', [])[1].texto === 'editada sem rede'), 'dados do usuário preservados (inclusive a edição offline)');
  await sleep(600);
  check(await ev(() => window.__FS && window.__FS.doc && window.__FS.doc.diplo_notas.length === 2 && load('diplo_notas', []).length === 2), 'nuvem tinha versão antiga: a edição local pendente PREVALECEU e foi enviada (não foi sobrescrita)');
  check(!(await ev(() => localStorage.getItem('chancelaria_upd_target'))), 'confirmação pós-atualização concluída (alvo removido)');
  check((await ev(() => document.getElementById('toastHost') ? document.getElementById('toastHost').innerText : '')).includes('atualizada para a versão v1.1.0'), 'mensagem de atualização concluída só aparece depois de carregar a nova versão');
  const caches2 = JSON.stringify(await ev(() => caches.keys()));
  check(caches2.includes('chancelaria-app-1.1.0') && !caches2.includes('chancelaria-app-1.0.0'), 'cache novo criado e cache antigo da aplicação removido', caches2);
  check(await ev(async () => { const db = await new Promise(r => { const q = indexedDB.open('chancelaria_backups', 1); q.onsuccess = () => r(q.result); }); const all = await new Promise(r => { const q = db.transaction('snapshots').objectStore('snapshots').getAll(); q.onsuccess = () => r(q.result); }); return all.some(s => s.motivo.includes('pre-atualizacao')); }), 'snapshot de segurança criado antes de atualizar');
  check(!(await ev(() => !!document.getElementById('updBanner'))), 'sem aviso de atualização após estar na versão mais nova');

  console.log('\n[E] Usuário que volta dias depois (v1.2.0 publicada)');
  await ev(() => { localStorage.setItem('chancelaria_version_info', JSON.stringify({ checadoEm: Date.now() - 5 * 864e5 })); });
  publicarNova('v1.2.0'); await sleep(300);
  // (1) app aberto desde antes (ex.: PWA retomado no iPhone): ao voltar à aba, a verificação encontra a nova versão
  await ev(() => { UPD.ultimaChecagem = 0; Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForSelector('#updBanner', { timeout: 8000 }).catch(() => {});
  check((await ev(() => document.getElementById('updBanner') ? document.getElementById('updBanner').innerText : '')).includes('v1.2.0'), 'ao retornar ao app, o aviso da v1.2.0 aparece (verificação ao voltar à aba)');
  // (2) abrir o site de novo: HTML/JS vêm da rede, então não fica preso em versão antiga
  await p.reload(); await p.waitForFunction(() => document.querySelector('#centralRoot .ct-head'));
  check(await ev(() => APP_INFO.version) === '1.2.0' && await ev(() => window.__MARCA) === 'v1.2.0', 'ao abrir novamente o site, já carrega a v1.2.0 (HTML/JS não ficam presos no cache)');

  console.log('\n[F] Aba volta ao primeiro plano dispara verificação (sem excesso)');
  await sleep(4000); const n0 = await ev(() => UPD.ultimaChecagem); await ev(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(200);
  check(await ev(() => UPD.ultimaChecagem) === n0, 'verificações são limitadas a 1 por minuto (sem consultas excessivas)');

  console.log('\n[G] iPhone preso em versão antiga: atualização pedida mas não carregada');
  await ev(() => localStorage.setItem('chancelaria_upd_target', JSON.stringify({ build: 99, version: '9.9.9', em: Date.now(), tentativas: 0 })));
  await p.reload(); await p.waitForSelector('#updBanner.erro', { timeout: 8000 }).catch(() => {});
  check((await ev(() => document.querySelector('#updBanner.erro') ? document.querySelector('#updBanner').innerText : '')).includes('ainda não foi carregada'), 'não declara sucesso: avisa que a nova versão não carregou');
  await p.click('#updBanner >> text=Forçar atualização'); await p.waitForLoadState('load'); await sleep(1500);
  check(await ev(() => load('diplo_notas', []).length === 2), 'forçar atualização não apaga dados do usuário');
  check(!(await ev(() => localStorage.getItem('chancelaria_upd_target'))) || (await ev(() => JSON.parse(localStorage.getItem('chancelaria_upd_target')).tentativas)) >= 1, 'tentativas controladas (sem loop infinito de recarga)');
  const reais = erros.filter(e => !/Falha ao sincronizar/.test(e)); check(reais.length === 0, 'zero erros de JS no fluxo de atualização (ignorando a falha de rede simulada)', reais.join(' | '));
  await b.close(); srv.kill(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); srv.kill(); process.exit(2); });
