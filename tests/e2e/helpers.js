// Utilitários dos testes E2E (Playwright). Uso: ver tests/e2e/README.md
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const STUB = fs.readFileSync(path.join(__dirname, 'firebase-stub.js'), 'utf8');
async function abrir(opts) {
  opts = opts || {}; const b = await chromium.launch();
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'allow' }, opts.context || {}));
  await ctx.route('**/firebasejs/**', r => r.fulfill({ contentType: 'application/javascript', body: r.request().url().includes('app-compat') ? STUB : '' }));
  await ctx.route(/fonts\.g(oogleapis|static)\.com/, r => r.abort());
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', e => erros.push('PAGEERROR ' + e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|favicon/.test(m.text())) erros.push('CONSOLE ' + m.text()); });
  p.on('dialog', d => d.dismiss());
  if (opts.url !== false) { await p.goto(opts.url || 'http://localhost:8123/index.html'); await p.waitForFunction(() => document.querySelector('#centralRoot .ct-head') || document.querySelector('#loginGate:not(.hidden)'), null, { timeout: 15000 }); }
  return { b, ctx, p, erros };
}
let ok = 0, fail = 0; const falhas = [];
function check(cond, nome, extra) { if (cond) { ok++; console.log('  ✓ ' + nome); } else { fail++; falhas.push(nome); console.log('  ✗ ' + nome + (extra ? ' → ' + extra : '')); } }
function resumo() { console.log(`\n${ok} passaram, ${fail} falharam`); if (fail) console.log('Falhas:\n - ' + falhas.join('\n - ')); return fail ? 1 : 0; }
async function confirmarModal(p, sel) { await p.click(sel || '.confirm-overlay [data-r="1"]'); }
module.exports = { abrir, check, resumo, confirmarModal };
