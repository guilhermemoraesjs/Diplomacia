// A versão é definida SÓ em version.json; os demais arquivos são derivados e precisam estar sincronizados.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const r = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
test('versão: version.json, js/version.js, sw.js e ?v= do index.html estão sincronizados', () => {
  const out = execFileSync('node', [path.join(__dirname, '../../scripts/sync-version.js'), '--check'], { encoding: 'utf8' });
  assert.match(out, /versão consistente/);
});
test('versão: build do cliente (APP_INFO) = build do Service Worker = version.json', () => {
  const v = JSON.parse(r('version.json')), cli = r('js/version.js'), sw = r('sw.js');
  assert.equal(+cli.match(/build: (\d+)/)[1], v.build); assert.equal(+sw.match(/APP_BUILD = (\d+)/)[1], v.build);
  assert.equal(cli.match(/version: "([^"]+)"/)[1], v.version); assert.equal(sw.match(/APP_VERSION = "([^"]+)"/)[1], v.version);
  assert.match(v.version, /^\d+\.\d+\.\d+$/);
});
test('Service Worker: não chama skipWaiting sozinho e só apaga caches chancelaria-app-*', () => {
  const sw = r('sw.js').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.ok(!/addEventListener\('install'[\s\S]{0,600}skipWaiting/.test(sw.split("addEventListener('activate'")[0]), 'install não deve chamar skipWaiting');
  assert.match(sw, /n\.startsWith\('chancelaria-app-'\) && n !== CACHE_APP/);
  assert.ok(!/localStorage|indexedDB/.test(sw.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), 'SW não toca em dados do usuário');
});
test('index.html: carrega todos os scripts na ordem de dependência (app.js e updater.js por último)', () => {
  const html = r('index.html'), src = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]).filter(x => !/^https?:/.test(x));   // ignora o SDK do Firebase (CDN)
  assert.equal(src[0], 'js/version.js'); assert.equal(src[src.length - 1], 'js/updater.js'); assert.equal(src[src.length - 2], 'js/app.js');
  const pos = n => src.indexOf(n); assert.ok(pos('js/utils.js') < pos('js/srs-core.js') && pos('js/srs-core.js') < pos('js/flashcards-srs.js') && pos('js/cronograma.js') < pos('js/revisao-hub.js'));
});
test('vercel.json: version.json e sw.js nunca vêm do cache', () => {
  const v = JSON.parse(r('vercel.json')); const h = s => v.headers.find(x => x.source === s).headers.find(k => k.key === 'Cache-Control').value;
  assert.match(h('/version.json'), /no-store/); assert.match(h('/sw.js'), /no-store/);
});
