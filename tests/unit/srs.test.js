// Testes do motor de revisão espaçada e utilitários de data (Node puro, sem dependências).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
function carregar(...arquivos) {
  const store = {};
  const ctx = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, console, Date, Math, JSON, document: {}, window: {} };
  vm.createContext(ctx);
  for (const f of arquivos) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8') + '\n;this.__exports = Object.assign(this.__exports||{});', ctx, { filename: f });
  return { ctx, store, run: code => vm.runInContext(code, ctx) };
}
const L = carregar('js/utils.js', 'js/srs-core.js');

test('datas: ymdLocal usa o fuso local (não UTC)', () => {
  // 23:30 locais de 31/12 não podem virar 01/01 (isso aconteceria com toISOString em UTC-3)
  const d = new Date(2026, 11, 31, 23, 30);
  assert.equal(L.run('ymdLocal(new Date(2026, 11, 31, 23, 30))'), '2026-12-31');
  assert.equal(L.run("addDaysISO('2026-12-31', 1)"), '2027-01-01');
  assert.equal(L.run("addDaysISO('2026-03-01', -1)"), '2026-02-28');
  assert.equal(L.run("diffDaysISO('2026-01-01','2026-01-31')"), 30);
  assert.equal(L.run("brToISO('05/11/2026')"), '2026-11-05');
});
test('tempo: parseTempoMin entende formatos comuns', () => {
  assert.equal(L.run("parseTempoMin('2h30')"), 150);
  assert.equal(L.run("parseTempoMin('1h')"), 60);
  assert.equal(L.run("parseTempoMin('45min')"), 45);
  assert.equal(L.run("parseTempoMin('90')"), 90);
  assert.equal(L.run("parseTempoMin('—')"), null);
  assert.equal(L.run("parseTempoMin('abc')"), null);
});
test('escape: escHtml neutraliza HTML', () => {
  assert.equal(L.run(`escHtml('<img src=x onerror="a()">')`), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
});
test('SRS: item novo — ordem dos intervalos errei ≤ difícil < bom < fácil', () => {
  const p = L.run(`srsPreview(srsMemNovo('media'), '2026-11-08')`);
  assert.ok(p.again <= p.hard && p.hard < p.good && p.good < p.easy, JSON.stringify(p));
  assert.equal(p.again, 1);
});
test('SRS: acertos sucessivos aumentam o intervalo; erro derruba a estabilidade', () => {
  let m = L.run(`srsMemNovo('media')`); let hoje = '2026-11-08'; const ints = [];
  for (let i = 0; i < 5; i++) {
    L.ctx._m = m; L.ctx._h = hoje;
    m = L.run(`srsProximo(_m, 'good', _h)`); ints.push(m.intervalo); hoje = m.due;
  }
  for (let i = 1; i < ints.length; i++) assert.ok(ints[i] > ints[i - 1], 'intervalos crescentes: ' + ints);
  L.ctx._m = m; L.ctx._h = hoje;
  const f = L.run(`srsProximo(_m, 'again', _h)`);
  assert.equal(f.intervalo, 1); assert.ok(f.S < m.S); assert.equal(f.lapses, 1);
});
test('SRS: revisar atrasado cresce mais do que revisar no prazo (R menor → ganho maior)', () => {
  const base = { S: 10, D: 5, ultima: '2026-10-01', reps: 3, lapses: 0, acertos: 3, erros: 0 };
  L.ctx._b = base;
  const noPrazo = L.run(`srsProximo(_b, 'good', '2026-10-11')`);
  const atrasado = L.run(`srsProximo(_b, 'good', '2026-11-10')`);
  assert.ok(atrasado.S > noPrazo.S);
});
test('SRS: retenção-alvo maior gera intervalos menores', () => {
  L.ctx._b = { S: 20, D: 5, ultima: '2026-10-01', reps: 3, lapses: 0, acertos: 3, erros: 0 };
  const a = L.run(`srsProximo(_b, 'good', '2026-10-21', {retencao:0.85, maxIntervalo:365, modo:'adaptativo'})`).intervalo;
  const b = L.run(`srsProximo(_b, 'good', '2026-10-21', {retencao:0.95, maxIntervalo:365, modo:'adaptativo'})`).intervalo;
  assert.ok(a > b);
});
test('SRS: respeita teto de intervalo', () => {
  L.ctx._b = { S: 900, D: 3, ultima: '2026-01-01', reps: 9, lapses: 0, acertos: 9, erros: 0 };
  const r = L.run(`srsProximo(_b, 'easy', '2026-06-01', {retencao:0.9, maxIntervalo:180, modo:'adaptativo'})`);
  assert.equal(r.intervalo, 180);
});
test('SRS: converte cartão antigo (intervalos fixos) sem perder histórico', () => {
  L.ctx._c = { dificuldade: 'dificil', srs: { intervalo: 30, fatorFacilidade: 2.5, repeticoes: 4, acertos: 5, erros: 1, ultimaRevisao: '2026-10-01', proximaRevisao: '2026-10-31' } };
  const m = L.run('srsMemDeFlash(_c)');
  assert.equal(m.S, 30); assert.equal(m.acertos, 5); assert.equal(m.erros, 1);
});
test('SRS: dificuldade informada altera a dificuldade inicial', () => {
  const f = L.run("srsMemNovo('facil').D"), d = L.run("srsMemNovo('dificil').D");
  assert.ok(d > f);
});
