// Backup e segurança: exportação completa, validação, restauração segura (com snapshot, confirmação, rollback e verificação), histórico e integridade.
const H = require('./helpers'); const { check } = H; const fs = require('fs'), os = require('os'), path = require('path');
(async () => {
  await H.emuOuSair(); const d = await H.abrir(), p = d.p, ev = (f, a) => p.evaluate(f, a); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
  const estado = () => ev(() => { const o = {}; CLOUD_KEYS.concat(LOCAL_RECUPERAVEIS).forEach(k => { o[k] = localStorage.getItem(k); }); return o; });
  await ev(() => { save('diplo_notas', [{ id: 'n1', titulo: 'Nota A', texto: 'a', criadoEm: 1 }]); save('diplo_questoes', [{ id: 'q1', enunciado: 'Q', materia: 'M', tipo: 'ce', gabarito: 'C' }]); save('diplo_kb', [{ id: 'k1', tipo: 'tema', nome: 'Tema', paises: [], rel: [], tags: [] }]); save('chancelaria_theme', 'dark'); localStorage.setItem('biblio_rascunho', JSON.stringify({ docId: null, titulo: 'Rascunho no backup', html: '<p>não salvo</p>', t: Date.now() })); localStorage.setItem('chancelaria_timer', JSON.stringify({ rodando: false, acumuladoMs: 60000, materia: '', cronoId: null, titulo: 'Sessão' })); });
  await H.ir(p, 'configuracoes');

  console.log('\n[Exportação completa]');
  check((await p.textContent('#cfgSeguranca')).includes('Backup e segurança'), 'área "Backup e segurança" existe em Configurações');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#cfgSeguranca >> text=Exportar backup completo')]); const arq = path.join(tmp, 'b.json'); await dl.saveAs(arq); const bk = JSON.parse(fs.readFileSync(arq, 'utf8'));
  check(/^chancelaria-backup-\d{4}-\d{2}-\d{2}-v1\.0\.0\.json$/.test(dl.suggestedFilename()), 'nome do arquivo traz data e versão', dl.suggestedFilename());
  check(bk.app === 'chancelaria' && bk.formato === 2 && bk.versao === '1.0.0' && bk.build === 1 && /^\d{4}-\d{2}-\d{2}T/.test(bk.exportadoEm) && typeof bk.schema === 'number', 'cabeçalho: app, formato 2, versão, build, schema, data');
  check(bk.dados.diplo_notas[0].titulo === 'Nota A' && bk.dados.diplo_kb[0].nome === 'Tema' && bk.dados.chancelaria_theme === 'dark', 'dados incluem todos os grupos existentes');
  check(bk.local.biblio_rascunho && bk.local.biblio_rascunho.titulo === 'Rascunho no backup' && bk.local.chancelaria_timer.acumuladoMs === 60000, 'o rascunho da Biblioteca e o cronômetro (estado local recuperável) estão no backup');
  check(/^sha256:[0-9a-f]{64}$/.test(bk.integridade.hash) && bk.integridade.chaves === Object.keys(bk.dados).length && bk.integridade.registros > 0, 'bloco de integridade: hash SHA-256, nº de grupos e de registros');
  const cobertura = await ev(b => CLOUD_KEYS.filter(k => localStorage.getItem(k) != null && !(k in b.dados)), bk); check(cobertura.length === 0, 'nenhum grupo de dados presente no aparelho ficou fora do backup', JSON.stringify(cobertura));

  console.log('\n[Validação de arquivos]');
  const val = (obj) => ev(async o => { const r = await validarBackup(o); return { ok: r.ok, erros: r.erros, avisos: r.avisos, integ: r.resumo.integridade }; }, obj);
  let r = await val(bk); check(r.ok && r.integ === 'ok' && r.erros.length === 0, 'backup íntegro: aprovado, integridade conferida');
  r = await val(null); check(!r.ok, 'null é recusado'); r = await val([1, 2]); check(!r.ok, 'array é recusado'); r = await val({ app: 'outro', formato: 2, dados: {} }); check(!r.ok && r.erros[0].includes('não é um backup da Chancelaria'), 'arquivo de outro aplicativo é recusado');
  r = await val({ app: 'chancelaria', formato: 2 }); check(!r.ok && r.erros.some(e => e.includes('dados')), 'sem seção "dados" é recusado'); r = await val({ app: 'chancelaria', formato: 99, dados: { diplo_notas: [] } }); check(!r.ok && r.erros.some(e => e.includes('Formato')), 'formato desconhecido é recusado');
  r = await val({ ...bk, dados: { ...bk.dados, diplo_notas: 'texto' }, integridade: undefined }); check(!r.ok && r.erros.some(e => e.includes('incompatíveis') && e.includes('diplo_notas')), 'tipo incompatível (notas como texto) é recusado e nomeado');
  const adulterado = JSON.parse(JSON.stringify(bk)); adulterado.dados.diplo_notas[0].titulo = 'ADULTERADO'; r = await val(adulterado); check(!r.ok && r.integ === 'falhou' && r.erros.some(e => e.includes('integridade')), 'conteúdo adulterado: hash não confere → recusado');
  r = await val({ ...bk, dados: { ...bk.dados, chave_estranha: [1] }, integridade: undefined }); check(r.ok && r.avisos.some(a => a.includes('chave_estranha')), 'grupos desconhecidos viram aviso (serão ignorados)');
  r = await val({ app: 'chancelaria', formato: 1, exportadoEm: '2026-01-01', dados: { diplo_notas: [{ id: 'x', titulo: 'v1' }] } }); check(r.ok && r.avisos.some(a => a.includes('formato antigo')), 'backup no formato antigo (v1) é aceito com aviso de que não tem integridade');
  r = await val({ ...bk, build: 999, versao: '9.9.9', integridade: undefined }); check(r.ok && r.avisos.some(a => a.includes('9.9.9')), 'backup de versão mais nova gera aviso de versão de origem');

  console.log('\n[Importar pela interface: arquivo inválido e arquivo corrompido]');
  const snapsAntes = await ev(async () => (await listarSnapshots()).length), antes = await estado();
  fs.writeFileSync(path.join(tmp, 'lixo.json'), '{ isto nao e json'); await p.setInputFiles('#cfgImportInput', path.join(tmp, 'lixo.json')); await H.sleep(300);
  check((await p.textContent('#toastHost')).includes('não é um JSON legível') && JSON.stringify(await estado()) === JSON.stringify(antes), 'JSON ilegível: recusado, nada alterado');
  fs.writeFileSync(path.join(tmp, 'adult.json'), JSON.stringify(adulterado)); await p.setInputFiles('#cfgImportInput', path.join(tmp, 'adult.json')); await H.sleep(400);
  check((await p.textContent('#toastHost')).includes('Backup recusado') && JSON.stringify(await estado()) === JSON.stringify(antes) && await p.locator('.confirm-overlay').count() === 0 && await ev(async () => (await listarSnapshots()).length) === snapsAntes, 'arquivo adulterado: recusado antes de qualquer alteração (e sem abrir confirmação)');

  console.log('\n[Importar: confirmação, snapshot de segurança, restauração e verificação]');
  const novo = JSON.parse(JSON.stringify(bk)); novo.dados.diplo_notas = [{ id: 'n9', titulo: 'Nota do backup', texto: 'b', criadoEm: 9 }]; novo.dados.diplo_cronograma = [{ id: 'c9', tema: 'Do backup', estudar: '', semana: '—', tempo: '1h', data: '01/12/2026', materia: 'M', feito: false }]; delete novo.dados.diplo_kb; novo.local.biblio_rascunho = { docId: null, titulo: 'Rascunho restaurado', html: '<p>x</p>', t: 1 };
  novo.integridade.hash = await ev(async o => hashTexto(stableStringify({ dados: o.dados, local: o.local })), novo); fs.writeFileSync(path.join(tmp, 'novo.json'), JSON.stringify(novo));
  await p.setInputFiles('#cfgImportInput', path.join(tmp, 'novo.json')); await p.waitForSelector('.confirm-overlay'); const dlg = await p.textContent('.confirm-overlay');
  check(dlg.includes('Gerado em') && dlg.includes('1.0.0') && dlg.includes('conferida') && /substituir\s*\d+ grupo/.test(dlg) && dlg.includes('já foi criado'), 'diálogo mostra origem, data, versão, integridade e quantos grupos serão substituídos', dlg.slice(0, 300));
  check(await ev(async n => (await listarSnapshots()).length > n, snapsAntes) && await ev(async () => (await listarSnapshots())[0].motivo) === 'antes-de-restaurar', 'o backup de segurança do estado atual foi criado ANTES de pedir confirmação');
  await p.click('.confirm-overlay [data-r="0"]'); await H.sleep(200); check(JSON.stringify(await estado()) === JSON.stringify(antes), 'cancelar: nada foi substituído');
  await p.setInputFiles('#cfgImportInput', path.join(tmp, 'novo.json')); await p.waitForSelector('.confirm-overlay'); await ev(() => { window.__semReload = 1; }); await p.click('.confirm-overlay [data-r="1"]'); await p.waitForFunction(() => !window.__semReload, null, { timeout: 20000 }); await p.waitForFunction(() => document.querySelector('#centralRoot .ct-head') && typeof currentUid !== 'undefined' && currentUid && !_sync.draining, null, { timeout: 20000 }); await H.sleep(500);
  check(true, 'a restauração recarregou o aplicativo automaticamente');
  check(await ev(() => load('diplo_notas', [])[0].id === 'n9' && load('diplo_cronograma', [])[0].tema === 'Do backup' && JSON.parse(localStorage.getItem('biblio_rascunho')).titulo === 'Rascunho restaurado'), 'restauração aplicada: notas, cronograma e rascunho vêm do backup');
  check(await ev(() => load('diplo_kb', []).length === 1 && load('diplo_questoes', []).length === 1), 'grupos que NÃO estavam no backup (kb, questões) foram mantidos intactos');
  await H.esperar(p, () => pendingSyncCount() === 0, null, 20000); const cloud = await H.fsGet(d.uid); check(cloud.diplo_notas[0].id === 'n9' && cloud.diplo_kb.length === 1, 'nuvem recebeu os grupos restaurados');

  console.log('\n[Restaurar a partir do histórico (volta ao estado de antes)]');
  await H.ir(p, 'configuracoes'); await p.waitForSelector('#cfgSnaps .rv-item'); const itens = await p.locator('#cfgSnaps .rv-item').allTextContents(); check(itens.length >= 2 && itens.some(t => t.includes('antes-de-restaurar') && t.includes('v1.0.0') && t.includes('grupos')), 'histórico lista pontos com data, motivo, versão e tamanho', itens[0]);
  await p.locator('#cfgSnaps .rv-item', { hasText: 'antes-de-restaurar' }).first().locator('button:has-text("Restaurar")').click(); await p.waitForSelector('.confirm-overlay [data-r="1"]', { timeout: 8000 }).catch(async e => { console.log('DIAG', await ev(() => JSON.stringify({ toast: document.getElementById('toastHost') && document.getElementById('toastHost').innerText, overlays: document.querySelectorAll('.confirm-overlay').length, html: (document.querySelector('.confirm-overlay') || {}).innerText }))); throw e; }); await ev(() => { window.__semReload = 1; }); await p.click('.confirm-overlay [data-r="1"]'); await p.waitForFunction(() => !window.__semReload, null, { timeout: 20000 }); await p.waitForFunction(() => document.querySelector('#centralRoot .ct-head') && typeof currentUid !== 'undefined' && currentUid && !_sync.draining, null, { timeout: 20000 }); await H.sleep(500);
  check(await ev(() => load('diplo_notas', [])[0].titulo === 'Nota A'), 'restaurar o ponto anterior devolve a "Nota A"');
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.locator('#cfgSnaps .rv-item').first().locator('button:has-text("Baixar")').click()]); const sn = JSON.parse(fs.readFileSync(await dl2.path(), 'utf8')); check(sn.app === 'chancelaria' && sn.integridade.hash.startsWith('sha256:') && (await H.ir(p, 'configuracoes'), true), 'ponto de restauração pode ser baixado como backup válido');

  console.log('\n[Falhas durante a restauração: rollback automático]');
  const antes2 = await estado(), alvo = JSON.parse(JSON.stringify(novo));
  let rr = await ev(async o => { const orig = Storage.prototype.setItem; let n = 0; Storage.prototype.setItem = function (k, v) { if (k === 'diplo_cronograma') throw new Error('disco cheio simulado'); return orig.call(this, k, v); }; try { return await restaurarBackup(o, 'teste', { semConfirmar: true, semRecarregar: true }); } finally { Storage.prototype.setItem = orig; } }, alvo);
  check(rr.ok === false && rr.etapa === 'aplicacao' && JSON.stringify(await estado()) === JSON.stringify(antes2), 'erro de gravação no meio: restauração desfeita, estado idêntico ao anterior', JSON.stringify(rr));
  rr = await ev(async o => { const orig = Storage.prototype.setItem; let uma = true; Storage.prototype.setItem = function (k, v) { if (k === 'diplo_notas' && uma) { uma = false; return orig.call(this, k, '[]'); } return orig.call(this, k, v); }; try { return await restaurarBackup(o, 'teste', { semConfirmar: true, semRecarregar: true }); } finally { Storage.prototype.setItem = orig; } }, alvo);
  check(rr.ok === false && rr.etapa === 'aplicacao' && rr.erro.includes('verificação') && JSON.stringify(await estado()) === JSON.stringify(antes2), 'verificação pós-restauração detecta divergência e desfaz tudo', JSON.stringify(rr));
  rr = await ev(async o => { const orig = indexedDB.open; indexedDB.open = () => { throw new Error('idb quebrado'); }; try { return await restaurarBackup(o, 'teste', { semConfirmar: true, semRecarregar: true }); } finally { indexedDB.open = orig; } }, alvo);
  check(rr.ok === false && rr.etapa === 'seguranca' && JSON.stringify(await estado()) === JSON.stringify(antes2), 'sem conseguir criar o backup de segurança: restauração CANCELADA, nada alterado', JSON.stringify(rr));

  console.log('\n[Verificação de integridade do que está salvo]');
  await H.ir(p, 'configuracoes'); await p.click('#cfgSeguranca >> text=Verificar integridade'); check((await p.textContent('#segIntegridade')).includes('Integridade verificada'), 'dados sadios: integridade verificada');
  await ev(() => localStorage.setItem('diplo_notas', '{quebrado')); await p.click('#cfgSeguranca >> text=Verificar integridade'); check((await p.textContent('#segIntegridade')).includes('diplo_notas: JSON inválido'), 'dado corrompido é apontado pelo nome'); await ev(() => localStorage.setItem('diplo_notas', '"string"')); await p.click('#cfgSeguranca >> text=Verificar integridade'); check((await p.textContent('#segIntegridade')).includes('esperado array'), 'tipo errado é apontado');

  console.log('\n[Rascunho e backup]');
  await ev(() => { save('diplo_notas', [{ id: 'n1', titulo: 'Nota A', texto: 'a', criadoEm: 1 }]); localStorage.setItem('biblio_rascunho', JSON.stringify({ docId: null, titulo: 'Rascunho final', html: '<p>z</p>', t: Date.now() })); }); await H.ir(p, 'configuracoes'); check((await p.textContent('#cfgSeguranca')).includes('Rascunho final'), 'rascunho recuperável é mostrado em Backup e segurança');
  const snap = await ev(async () => { const id = await criarSnapshot('teste-rascunho'); return (await listarSnapshots()).find(s => s.id === id); }); check(snap.local.biblio_rascunho.titulo === 'Rascunho final', 'snapshots automáticos também guardam o rascunho');
  check(d.erros.length === 0, 'nenhum erro de JavaScript', d.erros.join(' | '));
  await d.b.close(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(H.resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
