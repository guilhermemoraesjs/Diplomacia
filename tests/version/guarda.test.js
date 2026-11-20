// Regra "toda atualização gera uma versão" (scripts/verificar-versao-alterada.js): lógica pura.
const test = require('node:test'), assert = require('node:assert/strict');
const { avaliar, EH_DO_APP } = require('../../scripts/verificar-versao-alterada.js');
test('arquivo do app alterado sem subir a versão reprova', () => {
  const r = avaliar(['js/simulados.js', 'docs/X.md'], 6, 6); assert.equal(r.ok, false); assert.deepEqual(r.arquivos, ['js/simulados.js']);
  assert.equal(avaliar(['css/style.css'], 6, 5).ok, false);   // versão menor também reprova
});
test('arquivo do app alterado com a versão maior passa', () => assert.equal(avaliar(['js/central.js', 'index.html', 'data/simulados/index.json'], 6, 7).ok, true));
test('só testes, docs, scripts e infra: a versão não precisa subir', () => {
  assert.equal(avaliar(['tests/e2e/x.js', 'docs/Y.md', 'README.md', 'CHANGELOG.md', 'scripts/z.js', 'infra/firestore.rules', 'package.json'], 6, 6).ok, true);
  assert.equal(avaliar([], 6, 6).ok, true);
});
test('o que conta como arquivo do app', () => {
  for (const f of ['js/app.js', 'css/modern.css', 'data/paises/index.json', 'assets/logo-32.png', 'vendor/d3.min.js', 'index.html', 'manifest.webmanifest', 'vercel.json']) assert.ok(EH_DO_APP(f), f);
  for (const f of ['sw.js', 'version.json', 'tests/a.js', 'docs/a.md', 'scripts/a.js', 'package.json', 'infra/a.json']) assert.ok(!EH_DO_APP(f), f);
});
