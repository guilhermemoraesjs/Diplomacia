// Utilitários dos testes com o FIREBASE EMULATOR SUITE (Auth + Firestore REAIS, rodando localmente).
// Usa o SDK oficial do Firebase (devDependency "firebase") servido no lugar do CDN — nada toca a produção.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const SDK = path.join(__dirname, '..', '..', 'node_modules', 'firebase'), PROJ = 'estudamais-e8a60', URL = process.env.CHANC_URL || 'http://localhost:8123/index.html';
let ok = 0, fail = 0; const falhas = [];
function check(cond, nome, extra) { if (cond) { ok++; console.log('  ✓ ' + nome); } else { fail++; falhas.push(nome); console.log('  ✗ ' + nome + (extra !== undefined ? ' → ' + extra : '')); } }
function resumo() { console.log(`\n${ok} aprovados, ${fail} reprovados`); if (fail) console.log('Reprovados:\n - ' + falhas.join('\n - ')); return fail ? 1 : 0; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function req(method, host, port, p, body, headers) { return new Promise((res, rej) => { const r = http.request({ host, port, path: p, method, headers: Object.assign({ 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, headers || {}) }, rs => { let d = ''; rs.on('data', c => d += c); rs.on('end', () => res({ status: rs.statusCode, body: d })); }); r.on('error', rej); if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body)); r.end(); }); }
async function emuDisponivel() { try { const a = await req('GET', '127.0.0.1', 8080, '/'), b = await req('GET', '127.0.0.1', 9099, '/'); return a.status > 0 && b.status > 0; } catch (e) { return false; } }
async function limparEmu() { await req('DELETE', '127.0.0.1', 8080, `/emulator/v1/projects/${PROJ}/databases/(default)/documents`); await req('DELETE', '127.0.0.1', 9099, `/emulator/v1/projects/${PROJ}/accounts`); }
/* conversão Firestore REST <-> JS */
function deFs(v) { if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return +v.integerValue; if ('doubleValue' in v) return v.doubleValue; if ('booleanValue' in v) return v.booleanValue; if ('nullValue' in v) return null; if ('arrayValue' in v) return (v.arrayValue.values || []).map(deFs); if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, deFs(x)])); return undefined; }
function paraFs(v) { if (v === null) return { nullValue: null }; if (typeof v === 'string') return { stringValue: v }; if (typeof v === 'boolean') return { booleanValue: v }; if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }; if (Array.isArray(v)) return { arrayValue: { values: v.map(paraFs) } }; return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, paraFs(x)])) } }; }
async function fsGet(uid) { const r = await req('GET', '127.0.0.1', 8080, `/v1/projects/${PROJ}/databases/(default)/documents/chancelaria_users/${uid}`); if (r.status === 404) return null; const j = JSON.parse(r.body); return Object.fromEntries(Object.entries(j.fields || {}).map(([k, v]) => [k, deFs(v)])); }
async function fsSet(uid, obj) { await req('PATCH', '127.0.0.1', 8080, `/v1/projects/${PROJ}/databases/(default)/documents/chancelaria_users/${uid}`, { fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, paraFs(v)])) }); }
/* uid que o Auth Emulator atribui a uma identidade Google falsa (estável para o mesmo "sub"). */
async function uidDe(sub) { const tok = JSON.stringify({ sub, email: sub + '@teste.local', email_verified: true, name: 'Teste ' + sub }); const r = await req('POST', '127.0.0.1', 9099, '/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake', { postBody: 'id_token=' + encodeURIComponent(tok) + '&providerId=google.com', requestUri: 'http://localhost', returnIdpCredential: true, returnSecureToken: true }); return JSON.parse(r.body).localId; }
async function novoAparelho(opts) {
  opts = opts || {}; const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, opts.context || {}));
  await ctx.route('**/firebasejs/**', r => { const f = path.join(SDK, path.basename(new globalThis.URL(r.request().url()).pathname)); fs.existsSync(f) ? r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.fulfill({ contentType: 'application/javascript', body: '' }); });
  await ctx.route(/fonts\.g(oogleapis|static)\.com/, r => r.abort());
  await ctx.addInitScript(() => { window.__FIREBASE_EMULATOR__ = { firestore: '127.0.0.1:8080', auth: 'http://127.0.0.1:9099' }; });
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|favicon|Falha ao sincronizar|WebChannel|transport errored|Failed to load resource|\[code=/.test(m.text())) erros.push('CONSOLE ' + m.text()); });
  await p.goto(opts.url || URL); await p.waitForFunction(() => window.__EMU_ACTIVE === true, null, { timeout: 15000 });
  return { b, ctx, p, erros };
}
async function estavel(p, fn) { for (let i = 0; i < 90; i++) { try { if (await p.evaluate(fn) && await (async () => { await sleep(350); return p.evaluate(fn); })()) return true; } catch (e) { await sleep(300); } } return false; }
async function login(d, uid, opts) {
  await d.p.evaluate(async u => { const c = firebase.auth.GoogleAuthProvider.credential(JSON.stringify({ sub: u, email: u + '@teste.local', email_verified: true, name: 'Teste ' + u })); await firebase.auth().signInWithCredential(c); }, uid);
  const sem = !!(opts && opts.semDrenar);   // true: não exige o fim do envio inicial (muitos grupos de dados na 1ª sincronização podem demorar)
  return estavel(d.p, sem ? () => typeof currentUid !== 'undefined' && currentUid && document.readyState === 'complete' && !!document.querySelector('#centralRoot .ct-head')
    : () => typeof currentUid !== 'undefined' && currentUid && document.readyState === 'complete' && !_sync.draining && !!document.querySelector('#centralRoot .ct-head'));
}
const esperar = async (p, fn, arg, ms) => { try { await p.waitForFunction(fn, arg, { timeout: ms || 15000 }); return true; } catch (e) { return false; } };
module.exports = { uidDe, check, resumo, sleep, req, emuDisponivel, limparEmu, fsGet, fsSet, novoAparelho, login, esperar, estavel };
