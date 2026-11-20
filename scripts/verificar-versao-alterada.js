#!/usr/bin/env node
/* Garante "toda atualização gera uma versão": se algum arquivo do app mudou em relação à base (origin/main) e
   version.json não subiu de build, reprova. Os arquivos derivados (js/version.js, sw.js, ?v= do index.html) saem
   de version.json por scripts/sync-version.js, então o que se confere aqui é a ORIGEM da versão.
   Uso: node scripts/verificar-versao-alterada.js [refBase]   (padrão: origin/<GITHUB_BASE_REF> ou origin/main)
   Sem git ou sem a base (clone raso, offline): avisa e não reprova. */
const { execSync } = require('child_process'), fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const EH_DO_APP = f => /^(js|css|data|assets|vendor)\//.test(f) || /^(index\.html|manifest\.webmanifest|vercel\.json)$/.test(f);

/* Função pura (testada em tests/version/guarda.test.js). */
function avaliar(alterados, buildBase, buildAtual) {
  const doApp = alterados.filter(EH_DO_APP);
  if (!doApp.length) return { ok: true, motivo: 'nenhum arquivo do app mudou; a versão não precisa subir', arquivos: [] };
  if (!(buildAtual > buildBase)) return { ok: false, motivo: `${doApp.length} arquivo(s) do app mudaram, mas a versão não subiu (build ${buildBase} → ${buildAtual}).`, arquivos: doApp };
  return { ok: true, motivo: `versão subiu (build ${buildBase} → ${buildAtual})`, arquivos: doApp };
}
module.exports = { avaliar, EH_DO_APP };

if (require.main === module) {
  const sh = c => execSync(c, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const base = process.argv[2] || (process.env.GITHUB_BASE_REF ? 'origin/' + process.env.GITHUB_BASE_REF : 'origin/main');
  let mb, alterados, buildBase;
  try {
    mb = sh(`git merge-base ${base} HEAD`);
    alterados = [...new Set([...sh(`git diff --name-only ${mb}`).split('\n'), ...sh('git ls-files --others --exclude-standard').split('\n')])].filter(Boolean);
    buildBase = JSON.parse(sh(`git show ${mb}:version.json`)).build;
  } catch (e) { console.log(`- verificação de versão ignorada: não foi possível comparar com ${base} (${e.message.split('\n')[0]}).`); process.exit(0); }
  const buildAtual = JSON.parse(fs.readFileSync(path.join(RAIZ, 'version.json'), 'utf8')).build;
  const r = avaliar(alterados, buildBase, buildAtual);
  if (r.ok) { console.log('✓ ' + r.motivo); process.exit(0); }
  console.error('✗ ' + r.motivo + '\n  Arquivos: ' + r.arquivos.slice(0, 8).join(', ') + (r.arquivos.length > 8 ? ', …' : '') +
    '\n  Rode `npm run release:patch` (correção) ou `npm run release:minor` (novidade) e descreva a mudança em "notes" no version.json.');
  process.exit(1);
}
