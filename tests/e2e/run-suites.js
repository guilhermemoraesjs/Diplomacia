// Executa todas as suítes E2E em sequência (cada uma em um processo) e imprime um quadro de resultados REAL.
// Requer os emuladores (use `npm run test:e2e`, que os inicia com `firebase emulators:exec`).
const { spawn } = require('child_process'); const path = require('path'); const { servir } = require('./server');
const raiz = path.join(__dirname, '..', '..');
const TODAS = ['navegacao', 'questoes', 'cronograma', 'discursivas', 'biblioteca', 'revisao', 'conhecimento', 'compatibilidade', 'backup', 'sync-emulador', 'migracao-emulador', 'atualizacao', 'mobile'];
const SUITES = process.argv.slice(2).length ? process.argv.slice(2) : TODAS;   // ex.: node run-suites.js mobile
(async () => {
  const srv = await servir(raiz, 8123), res = [];
  for (const s of SUITES) {
    process.stdout.write(`\n######## ${s} ########\n`);
    const code = await new Promise(ok => { const c = spawn('node', [path.join(__dirname, s + '.js')], { stdio: 'inherit', env: Object.assign({}, process.env, { CHANC_URL: 'http://localhost:8123/index.html' }) }); const t = setTimeout(() => c.kill('SIGKILL'), 900000); c.on('exit', n => { clearTimeout(t); ok(n); }); });   // assíncrono: o servidor estático precisa continuar respondendo
    res.push([s, code === 0 ? 'Aprovado' : code === 3 ? 'Não executado' : 'Reprovado']);
  }
  srv.close(); console.log('\n==== RESUMO ===='); res.forEach(([s, r]) => console.log(r.padEnd(14) + s)); process.exit(res.every(x => x[1] === 'Aprovado') ? 0 : 1);
})();
