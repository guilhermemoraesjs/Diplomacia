#!/usr/bin/env node
/* ==========================================================================
   sync-version.js — FONTE ÚNICA DE VERSÃO da Chancelaria.

   A versão vive somente em  version.json  (campos: version, build, date).
   Este script propaga para os arquivos derivados, para que nunca divirjam:
     • js/version.js   → versão INSTALADA (embutida no código que o navegador roda)
     • sw.js           → nome do cache + lista de arquivos pré-cacheados
     • index.html      → ?v=<build> nos <script>/<link> locais (quebra cache HTTP)

   Uso:
     node scripts/sync-version.js                      sincroniza com version.json
     node scripts/sync-version.js --bump patch|minor|major [--note "texto"]
     node scripts/sync-version.js --check              só valida (usado em CI/testes)

   `build` é o número inteiro que o atualizador compara (monotônico).
   ========================================================================== */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
const wr = (f, s) => fs.writeFileSync(path.join(root, f), s);
const args = process.argv.slice(2);
const CHECK = args.includes('--check');

let info = JSON.parse(rd('version.json'));
const bi = args.indexOf('--bump');
if (bi >= 0 && !CHECK) {
  const tipo = args[bi + 1]; let [M, m, p] = info.version.split('.').map(Number);
  if (tipo === 'major') { M++; m = 0; p = 0; } else if (tipo === 'minor') { m++; p = 0; } else if (tipo === 'patch') { p++; } else { console.error('Use --bump patch|minor|major'); process.exit(2); }
  info.version = `${M}.${m}.${p}`; info.build = (info.build | 0) + 1;
  const d = new Date(); info.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ni = args.indexOf('--note'); info.notes = ni >= 0 ? [args[ni + 1]] : info.notes;
  wr('version.json', JSON.stringify(info, null, 2) + '\n');
}
if (!/^\d+\.\d+\.\d+$/.test(info.version) || !Number.isInteger(info.build) || info.build < 1) { console.error('version.json inválido (version x.y.z e build inteiro >= 1).'); process.exit(2); }

/* ---- arquivos a pré-cachear (gerado a partir do disco) ---- */
/* Scripts que existem no repositório mas NÃO são carregados pelo index.html de propósito. */
const NAO_CARREGADOS = ['js/importador-provas.js'];   // ferramenta interna de importação de provas (uso manual)
function ls(dir, re) { return fs.readdirSync(path.join(root, dir)).filter(f => re.test(f) && !NAO_CARREGADOS.includes(dir + '/' + f)).sort().map(f => dir + '/' + f); }
const precache = ['./', 'index.html', 'manifest.webmanifest', ...ls('css', /\.css$/), ...ls('js', /\.js$/), ...ls('vendor', /\.js$/), 'assets/logo-32.png', 'assets/logo-64.png', 'assets/logo-96.png', 'assets/logo-180.png', 'assets/logo-192.png', 'assets/logo-512.png'];

const expected = {};
expected['js/version.js'] = `/* GERADO por scripts/sync-version.js a partir de version.json — NÃO edite à mão. */
const APP_INFO = Object.freeze({ version: ${JSON.stringify(info.version)}, build: ${info.build}, date: ${JSON.stringify(info.date)} });
`;
const gen = `/* @generated:start (scripts/sync-version.js) */
const APP_VERSION = ${JSON.stringify(info.version)};
const APP_BUILD = ${info.build};
const CACHE_APP = 'chancelaria-app-' + APP_VERSION;
const PRECACHE = ${JSON.stringify(precache, null, 2)};
/* @generated:end */`;
let sw = rd('sw.js');
expected['sw.js'] = sw.replace(/\/\* @generated:start[\s\S]*?@generated:end \*\//, gen);
let html = rd('index.html');
expected['index.html'] = html.replace(/((?:src|href)="(?:js|css)\/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?"/g, `$1?v=${info.build}"`);

let ok = true;
for (const f of Object.keys(expected)) {
  const atual = fs.existsSync(path.join(root, f)) ? rd(f) : null;
  if (atual !== expected[f]) { if (CHECK) { console.error(`✗ ${f} está dessincronizado com version.json (rode: node scripts/sync-version.js)`); ok = false; } else wr(f, expected[f]); }
}
/* ---- validações estruturais ---- */
const refs = [...html.matchAll(/(?:src|href)="((?:js|css|vendor)\/[^"?]+)/g)].map(m => m[1]);
refs.forEach(f => { if (!fs.existsSync(path.join(root, f))) { console.error('✗ index.html referencia arquivo inexistente: ' + f); ok = false; } });
ls('js', /\.js$/).filter(f => f !== 'js/version.js' || true).forEach(f => { if (!refs.includes(f)) { console.error('✗ ' + f + ' existe mas não está carregado no index.html'); ok = false; } });
precache.filter(f => f !== './').forEach(f => { if (!fs.existsSync(path.join(root, f))) { console.error('✗ pré-cache aponta para arquivo inexistente: ' + f); ok = false; } });
if (!/^\d{4}-\d{2}-\d{2}$/.test(info.date)) { console.error('✗ date inválida em version.json'); ok = false; }
if (!ok) process.exit(1);
console.log(CHECK ? `✓ versão consistente: v${info.version} (build ${info.build})` : `✓ sincronizado: v${info.version} (build ${info.build})`);
