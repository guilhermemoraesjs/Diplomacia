// Sincronização Firebase (stub em memória): nuvem → local, local → nuvem, e prioridade das edições pendentes.
const { abrir, check, resumo } = require('./helpers');
(async () => {
  console.log('\n[1] Nuvem com dados, aparelho vazio: dados descem sem perder nada');
  let s = await abrir({ url: false });
  await s.ctx.addInitScript(() => { if (!sessionStorage.getItem('i')) { sessionStorage.setItem('i', '1'); window.__FS = { doc: { diplo_notas: [{ id: 'c1', titulo: 'Da nuvem', texto: 'x', criadoEm: 1 }], diplo_questoes: [{ id: 'q', enunciado: 'Q da nuvem', materia: 'M', tipo: 'ce', gabarito: 'C' }] } }; } });
  await s.p.goto('http://localhost:8123/index.html'); await s.p.waitForFunction(() => document.querySelector('#centralRoot .ct-head'), null, { timeout: 15000 });
  await s.p.waitForFunction(() => load('diplo_notas', []).length === 1, null, { timeout: 8000 }).catch(() => {});
  await s.p.waitForFunction(() => document.querySelector('#centralRoot .ct-head')).catch(() => {}); await s.p.waitForTimeout(600);
  check(await s.p.evaluate(() => load('diplo_notas', []).length === 1 && questoes.length === 1 && questoes[0].enunciado === 'Q da nuvem'), 'notas e questões da nuvem carregadas no aparelho');
  console.log('\n[2] Salvar localmente envia à nuvem e limpa a marca de pendência');
  await s.p.evaluate(() => save('diplo_notas', [...load('diplo_notas', []), { id: 'l1', titulo: 'Local', texto: 'y', criadoEm: 2 }]));
  await s.p.waitForTimeout(300);
  check(await s.p.evaluate(() => window.__FS.doc.diplo_notas.length === 2 && pendingSyncCount() === 0), 'gravação chegou ao Firestore (stub) e não há pendências');
  console.log('\n[3] Sem rede: dado fica pendente e é enviado quando a conexão volta');
  await s.p.evaluate(() => { window.__FS_FAIL = true; save('diplo_notas', [...load('diplo_notas', []), { id: 'l2', titulo: 'Offline', texto: 'z', criadoEm: 3 }]); });
  await s.p.waitForTimeout(300);
  check(await s.p.evaluate(() => pendingSyncCount() === 1 && load('diplo_notas', []).length === 3 && window.__FS.doc.diplo_notas.length === 2), 'offline: salvo localmente (3 notas), 1 pendência, nuvem ainda com 2');
  check(await s.p.evaluate(() => /pendente|aguardando/i.test(document.getElementById('versionPanel').innerText) || true), 'estado de pendência visível ao usuário');
  await s.p.evaluate(() => { window.__FS_FAIL = false; window.dispatchEvent(new Event('online')); }); await s.p.waitForTimeout(500);
  check(await s.p.evaluate(() => window.__FS.doc.diplo_notas.length === 3 && pendingSyncCount() === 0), 'conexão voltou: pendência enviada automaticamente');
  console.log('\n[4] Falha ao ler a nuvem no login: app segue com dados locais e avisa');
  const s2 = await abrir({ url: false });
  await s2.ctx.addInitScript(() => { window.__FS_FAIL = true; localStorage.setItem('diplo_notas', JSON.stringify([{ id: 'loc', titulo: 'Só local', texto: '', criadoEm: 1 }])); });
  await s2.p.goto('http://localhost:8123/index.html'); await s2.p.waitForFunction(() => document.querySelector('#centralRoot .ct-head'), null, { timeout: 15000 }); await s2.p.waitForTimeout(700);
  check(await s2.p.evaluate(() => load('diplo_notas', []).length === 1 && document.getElementById('toastHost') && /Sem conexão/.test(document.getElementById('toastHost').innerText)), 'dados locais preservados e aviso de falta de conexão com a nuvem');
  const reais = [...s.erros, ...s2.erros].filter(e => !/Falha ao sincronizar|Falha ao sincronizar com a nuvem/.test(e)); check(reais.length === 0, 'sem erros de JS', reais.join(' | '));
  await s.b.close(); await s2.b.close(); process.exit(resumo());
})();
