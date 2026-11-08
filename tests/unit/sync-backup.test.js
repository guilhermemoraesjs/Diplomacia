// Lógica pura de sincronização (mesclagem/conflito/comparação) e de backup (validação, hash) — sem navegador.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
function carregar(...arquivos) {
  const store = {}, ctx = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, console, Date, Math, JSON, Promise, setTimeout, clearTimeout, setInterval: () => 0, document: { addEventListener() {}, readyState: 'complete' }, window: { addEventListener() {} }, navigator: { onLine: true }, crypto: crypto.webcrypto, TextEncoder, Blob: class {}, toast() {}, currentUid: null };
  vm.createContext(ctx); for (const f of arquivos) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8'), ctx, { filename: f }); return { ctx, store, run: c => vm.runInContext(c, ctx) };
}
const L = carregar('js/config.js', 'js/utils.js', 'js/sync.js', 'js/backup.js', 'js/srs-core.js');

test('deepEqual ignora a ordem das chaves (Firestore reordena mapas) mas não valores', () => {
  assert.equal(L.run(`deepEqual({a:1,b:[{x:1,y:2}]}, {b:[{y:2,x:1}],a:1})`), true);
  assert.equal(L.run(`deepEqual({a:1}, {a:2})`), false); assert.equal(L.run(`deepEqual([1,2],[2,1])`), false); assert.equal(L.run(`deepEqual({a:undefined,b:1},{b:1})`), true);
});
test('mesclarListas: união por id, vence o registro mais recente, sem duplicar', () => {
  const r = JSON.parse(L.run(`JSON.stringify(mesclarListas([{id:'a',t:'local',editadoEm:5},{id:'b',t:'so-local',editadoEm:1}], [{id:'a',t:'remoto',editadoEm:9},{id:'c',t:'so-remoto',editadoEm:1}]))`));
  assert.deepEqual(r.map(x => x.id), ['a', 'b', 'c']); assert.equal(r[0].t, 'remoto');
  const e = JSON.parse(L.run(`JSON.stringify(mesclarListas([{id:'a',t:'local',editadoEm:9}], [{id:'a',t:'remoto',editadoEm:5}]))`)); assert.equal(e[0].t, 'local');
});
test('mesclarListas: usa a data de revisão (srs.em) como carimbo, listas de textos viram união ordenada, listas heterogêneas não mesclam', () => {
  assert.equal(JSON.parse(L.run(`JSON.stringify(mesclarListas([{id:'c',editadoEm:1,srs:{em:100}}],[{id:'c',editadoEm:1,srs:{em:200}}]))`))[0].srs.em, 200);
  assert.deepEqual(JSON.parse(L.run(`JSON.stringify(mesclarListas(['2026-01-02','2026-01-01'],['2026-01-03','2026-01-01']))`)), ['2026-01-01', '2026-01-02', '2026-01-03']);
  assert.equal(L.run(`mesclarListas([1,{a:1}],[{id:'x'}])`), null);
});
test('resolverValor: lista mescla; valor simples vence o carimbo mais recente (empate favorece o local)', () => {
  assert.equal(L.run(`resolverValor('light','dark',10,20).valor`), 'dark'); assert.equal(L.run(`resolverValor('light','dark',30,20).valor`), 'light'); assert.equal(L.run(`resolverValor('light','dark',20,20).como`), 'local');
  assert.equal(L.run(`resolverValor([{id:'a',editadoEm:1}],[{id:'b',editadoEm:1}],1,2).como`), 'mesclado');
});
test('carimbos de edição são estritamente crescentes (mesma milissegundo não colide)', () => {
  const s = JSON.parse(L.run(`JSON.stringify(Array.from({length:50}, () => nextStamp()))`)); for (let i = 1; i < s.length; i++) assert.ok(s[i] > s[i - 1]);
});
test('markDirty/clearDirty: só limpa se o carimbo for o mesmo (edição nova durante o envio não é perdida)', () => {
  L.run(`var s1 = markDirty('diplo_notas'); var s2 = markDirty('diplo_notas');`); assert.equal(L.run(`clearDirty('diplo_notas', s1)`), false); assert.equal(L.run(`pendingSyncCount()`), 1); assert.equal(L.run(`clearDirty('diplo_notas', s2)`), true); assert.equal(L.run(`pendingSyncCount()`), 0);
});
test('estado de sincronização: local (sem login) → pendente → sincronizado', () => {
  assert.equal(L.run(`getSyncStatus().estado`), 'local'); L.run(`currentUid = 'u'; markDirty('diplo_notas')`); assert.equal(L.run(`getSyncStatus().estado`), 'pendente'); L.run(`clearDirty('diplo_notas', getDirty().diplo_notas)`); assert.equal(L.run(`getSyncStatus().estado`), 'sincronizado');
});
test('backup: stableStringify é independente da ordem das chaves e o hash detecta alteração', async () => {
  assert.equal(L.run(`stableStringify({b:1,a:[{d:1,c:2}]})`), L.run(`stableStringify({a:[{c:2,d:1}],b:1})`));
  const h1 = await L.run(`hashTexto(stableStringify({x:1}))`), h2 = await L.run(`hashTexto(stableStringify({x:2}))`); assert.match(h1, /^sha256:[0-9a-f]{64}$/); assert.notEqual(h1, h2);
});
test('backup: validação aceita íntegro e recusa adulterado/incompatível/desconhecido', async () => {
  L.run(`localStorage.setItem('diplo_notas', JSON.stringify([{id:'n',titulo:'t'}])); localStorage.setItem('biblio_rascunho', JSON.stringify({titulo:'r'}));`);
  const b = JSON.parse(JSON.stringify(await L.run(`montarBackup('t')`))); assert.equal(b.local.biblio_rascunho.titulo, 'r'); assert.equal(b.formato, 2);
  L.ctx.__b = b; assert.equal((await L.run(`validarBackup(__b)`)).ok, true);
  const adult = JSON.parse(JSON.stringify(b)); adult.dados.diplo_notas[0].titulo = 'X'; L.ctx.__b = adult; const r = await L.run(`validarBackup(__b)`); assert.equal(r.ok, false); assert.equal(r.resumo.integridade, 'falhou');
  L.ctx.__b = { app: 'chancelaria', formato: 2, dados: { diplo_notas: 'x' } }; assert.equal((await L.run(`validarBackup(__b)`)).ok, false);
  L.ctx.__b = { app: 'x', dados: {} }; assert.equal((await L.run(`validarBackup(__b)`)).ok, false);
});
test('SRS fixo: tabela configurada é respeitada e o adaptativo não usa a tabela', () => {
  const F = `{modo:'fixo', retencao:0.9, maxIntervalo:365, fixos:{again:2,hard:4,good:6,easy:8}}`;
  assert.equal(L.run(`srsAgendar(srsMemNovo('media'),'good','2026-11-08',${F}).intervalo`), 6); assert.equal(L.run(`srsAgendar(srsMemNovo('media'),'again','2026-11-08',${F}).due`), '2026-11-10'); assert.equal(L.run(`srsAgendar(srsMemNovo('media'),'again','2026-11-08',${F}).lapses`), 1);
  assert.equal(L.run(`JSON.stringify(srsPreview(srsMemNovo('media'),'2026-11-08',${F}))`), '{"again":2,"hard":4,"good":6,"easy":8}');
  assert.notEqual(L.run(`srsAgendar(srsMemNovo('media'),'good','2026-11-08',{modo:'adaptativo',retencao:0.9,maxIntervalo:365,fixos:{again:2,hard:4,good:6,easy:8}}).intervalo`), 6);
});
test('SRS: preferências lidas do armazenamento (modo e intervalos), com padrões seguros', () => {
  L.run(`localStorage.setItem('chancelaria_prefs', JSON.stringify({srsModo:'fixo', srsIntervalos:{good:11, hard:'abc'}}))`); assert.equal(L.run(`srsPrefs().modo`), 'fixo'); assert.equal(L.run(`srsPrefs().fixos.good`), 11); assert.equal(L.run(`srsPrefs().fixos.hard`), 15);
  L.run(`localStorage.setItem('chancelaria_prefs', JSON.stringify({srsModo:'lixo'}))`); assert.equal(L.run(`srsPrefs().modo`), 'adaptativo');
});
