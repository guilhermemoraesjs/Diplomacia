// Executa todas as suítes E2E em sequência (cada uma em um processo) e imprime um quadro de resultados REAL.
// Requer os emuladores (use `npm run test:e2e`, que os inicia com `firebase emulators:exec`).
const { spawnSync } = require('child_process'); const path = require('path'); const { servir } = require('./server');
const raiz = path.join(__dirname, '..', '..');
const SUITES = (process.env.SUITES ? process.env.SUITES.split(',') : ['navegacao', 'questoes', 'cronograma', 'discursivas', 'biblioteca', 'revisao', 'conhecimento', 'compatibilidade', 'backup', 'sync-emulador']);
(async () => {
  const srv = await servir(raiz, 8123), res = [];
  for (const s of SUITES) {
    process.stdout.write(`\n######## ${s} ########\n`);
    const r = spawnSync('node', [path.join(__dirname, s + '.js')], { stdio: 'inherit', env: Object.assign({}, process.env, { CHANC_URL: 'http://localhost:8123/index.html' }), timeout: 600000 });
    res.push([s, r.status === 0 ? 'Aprovado' : r.status === 3 ? 'Não executado' : 'Reprovado']);
  }
  srv.close(); console.log('\n==== RESUMO ===='); res.forEach(([s, r]) => console.log(r.padEnd(14) + s)); process.exit(res.every(x => x[1] === 'Aprovado') ? 0 : 1);
})();
