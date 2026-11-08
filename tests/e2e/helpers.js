// Ambiente padrão dos testes funcionais: navegador real + Firebase EMULATOR (Auth e Firestore reais, locais).
// Cada teste usa um usuário próprio, para isolar os dados. Veja docs/TESTES.md.
const E = require('./emu');
const { check, resumo, sleep } = E;
let contador = 0;
async function abrir(opts) {
  opts = opts || {}; const sub = opts.sub || ('t' + Date.now().toString(36) + (contador++));
  const d = await E.novoAparelho({ context: opts.context, url: opts.url });
  if (opts.login !== false) { const ok = await E.login(d, sub); if (!ok) throw new Error('login no emulador não estabilizou'); }
  d.sub = sub; d.uid = await d.p.evaluate(() => currentUid); return d;
}
/* Recarrega e espera a Central aparecer com o login já restaurado e o motor de sincronização ocioso. */
async function recarregar(p) { await p.reload(); await p.waitForFunction(() => document.querySelector('#centralRoot .ct-head') && typeof currentUid !== 'undefined' && currentUid && !_sync.draining, null, { timeout: 20000 }); await sleep(400); }
const ir = async (p, id) => { await p.evaluate(i => goTab(i), id); await sleep(200); };
const ls = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem(k)), k);
async function emuOuSair() { if (!await E.emuDisponivel()) { console.log('EMULADOR INDISPONÍVEL — esta suíte precisa do Firebase Emulator Suite (npm run test:e2e). Nada foi executado.'); process.exit(3); } }
const semErros = (d, ignorar) => d.erros.filter(e => !(ignorar && ignorar.test(e)));
module.exports = Object.assign({}, E, { abrir, recarregar, ir, ls, emuOuSair, semErros });
