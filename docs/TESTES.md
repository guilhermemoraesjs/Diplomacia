# Testes

## Pré-requisitos
- Node 18+ e `npm install` (instala `playwright`, o SDK `firebase` — usado só para servir o SDK oficial aos testes — e `firebase-tools`).
- Navegador: `npx playwright install chromium`. Se já houver um Chromium no sistema, use `CHROMIUM_PATH=/caminho/chromium`.
- **Java 11+** (21 recomendado) para o Firebase Emulator Suite (baixado automaticamente pelo `firebase-tools` na primeira execução).

## Comandos
| Comando | O que roda | Precisa de emulador/navegador |
|---|---|---|
| `npm test` | `test:unit` + `test:version` | não |
| `npm run test:unit` | lógica pura: SRS (adaptativo e fixo), datas, escape, mesclagem/conflito, validação e hash de backup | não |
| `npm run test:version` | `version.json` × `js/version.js` × `sw.js` × `index.html`, arquivos referenciados, pré-cache, ordem dos scripts, cabeçalhos `no-store` | não |
| `npm run test:e2e` | **todas** as suítes de navegador, com Auth + Firestore Emulator iniciados por `firebase emulators:exec` | sim |
| `npm run test:sync` | só a sincronização contra o emulador | sim |
| `npm run test:update` | só o atualizador (Service Worker real, publicações simuladas, falhas) | sim |
| `npm run test:mobile` | 4 tamanhos de tela com interação por toque | sim |
| `npm run test:all` | `npm test` + `npm run test:e2e` | sim |

Executar uma suíte avulsa com os emuladores já ligados: `node tests/e2e/run-suites.js questoes` (o servidor estático sobe sozinho).
Se os emuladores não estiverem no ar, as suítes terminam com **código 3 ("Não executado")** — nunca passam em silêncio.

## Política contra falso positivo
- Nenhum `|| true`, `check(true…)` ou asserção que sempre passe (há uma varredura por `grep` no fim deste documento).
- Toda funcionalidade é testada no ciclo **criar → verificar o valor exato → recarregar → verificar → editar → recarregar → verificar**.
- Cada teste usa um usuário novo do Auth Emulator (dados isolados).
- Verificações de "existe na tela" só valem junto com a verificação do dado gravado.
- Falhas simuladas são reais: rede bloqueada (`context.setOffline`, `route.abort`), 404/500 no servidor, `sw.js` quebrado, `localStorage` que lança erro, `indexedDB` que falha.
- Os testes já acharam e levaram a corrigir bugs reais (lista em `docs/RELATORIO_SEGUNDA_AUDITORIA.md`).

## O que é REAL e o que é simulado
| Real | Simulado / limitação |
|---|---|
| Firestore e Auth **do Emulator Suite** (mesmo SDK oficial do navegador, regras de `infra/firestore.rules`) | **Não é o Firebase de produção**: as regras reais do seu projeto não são exercitadas |
| Service Worker, Cache Storage, IndexedDB e `localStorage` do Chromium | A "publicação" de novas versões é uma cópia temporária do projeto servida em `localhost` |
| Navegador Chromium com toque e viewports | **iPhone = emulação no Chromium** (viewport/UA/toque), não o Safari/WebKit nem o PWA instalado |
| Download/upload de arquivos de backup | — |

## Suítes
`tests/unit` · `tests/version` · `tests/e2e/{navegacao, questoes, cronograma, discursivas, biblioteca, revisao, conhecimento, compatibilidade, backup, sync-emulador, migracao-emulador, atualizacao, mobile}.js`
(`helpers.js`/`emu.js` = ambiente; `server.js` = servidor estático sem cache; `run-suites.js` = executor com quadro de resultados).

## CI
`.github/workflows/testes.yml` roda `npm test` e, em seguida, `npm run test:e2e` a cada push/PR na `main`.
