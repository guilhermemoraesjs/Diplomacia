# Relatório da segunda auditoria — Chancelaria v1.1.0

Escopo: consolidar a v1.0.0 (sincronização, backup, revisão, atualizador, testes). Nenhuma funcionalidade nova de grande porte.
Todos os números abaixo vêm de execuções reais feitas nesta sessão (logs: `npm test` e `npm run test:e2e`, duas execuções completas
consecutivas sem falhas após as correções).

## 1. Problemas encontrados na auditoria

| # | Área | Problema | Gravidade |
|---|---|---|---|
| 1 | Sync | `syncKeyToCloud()` disparava um `set()` por `save()` sem fila: várias edições rápidas geravam gravações concorrentes; nenhuma versão por chave → **last-writer-wins entre aparelhos** (uma gravação antiga podia sobrescrever uma recente, e o aparelho que abria depois podia apagar edições do outro); sem indicador de estado | Alta |
| 2 | Sync | Nenhum tratamento de conflito; falhas só no `console` | Alta |
| 3 | Backup | O backup só cobria `CLOUD_KEYS`: **`biblio_rascunho` e o cronômetro ficavam de fora**; sem validação, sem hash, importação sem snapshot obrigatório, sem rollback/verificação | Alta |
| 4 | Revisão | `srsProximo` ignorava o método global: **Biblioteca e hub sempre adaptativos mesmo em "intervalos fixos"**; só os flashcards respeitavam a tabela; método não registrado no histórico | Média |
| 5 | Testes | 3 asserções com `\|\| true` (nunca falhavam); sincronização testada só com **Firebase falso em memória** (sem `runTransaction`); responsividade só checava rolagem; pouca verificação de persistência; nenhum teste de falha do atualizador | Alta |
| 6 | Atualizador | O `install` do SW **engolia erros de download** (`catch` vazio): um deploy incompleto podia ser ativado; `applyUpdate` recarregava mesmo sem o worker novo; sem checagem de coerência de versão | Alta |
| 7 | Firestore | Documento único com todos os dados (limite ~1 MiB) | Risco latente |

## 2. Correções realizadas

1. **Sincronização (`js/sync.js`, novo):** fila única serializada com coalescência; carimbo monotônico por edição; pendências persistentes
   (`chancelaria_dirty`); transação com `__meta[chave]={t,d}` — gravação antiga nunca sobrescreve a nova; **envio em lote numa só transação**
   com isolamento por chave se falhar; conflito entre aparelhos (mescla por `id`; valores simples pelo carimbo; cópia descartada guardada);
   retentativas com recuo; tempo limite; pull ao abrir/voltar à aba/voltar online; chip e painel com os estados *somente local · enviando · pendente ·
   offline · falha · sincronizado*. Detalhes e limitações em `docs/SINCRONIZACAO.md`.
2. **Backup e segurança (`js/backup.js`, `js/configuracoes.js`):** formato v2 (versão, build, schema, data, dispositivo, hash SHA-256, contagens), inclui rascunho e
   cronômetro; validação (estrutura, versão de origem, tipos incompatíveis, integridade); fluxo de restauração em 7 passos (**snapshot de segurança obrigatório → confirmação →
   aplicação com rollback → verificação chave a chave**; rollback também é verificado); histórico de 10 pontos com baixar/restaurar; verificação de integridade; conflitos listados.
3. **Revisão:** `srsAgendar()` é o ponto único (adaptativo ou fixo com 4 intervalos configuráveis); flashcards, Biblioteca e hub usam-no; histórico guarda método, dificuldade e lapsos;
   texto da UI deixa explícito que **não é o FSRS oficial**.
4. **Atualizador (`sw.js`, `js/updater.js`):** instalação atômica (todo o pré-cache + coerência de `version.js`), falhas tratadas sem ativar versão incompleta, sem ciclos
   (falha registrada por 30 min, 2 tentativas máx.), `CLAIM`/`GET_VERSION`, diagnóstico código × Service Worker.
5. **Testes:** reescritos do zero contra o **Firebase Emulator Suite** (ver §4).
6. **Bugs de produto achados pelos novos testes e corrigidos:**
   - Cronograma: foco inicial atrasado (`setTimeout`) **roubava o foco** — texto digitado caía no campo errado.
   - "Concluir atividade" **pré-preenchia o tempo estudado com o tempo planejado** (tempo real falso) → nunca mais pré-preenche.
   - Recarregar a página (atualização/sync) **voltava para a Central**; agora volta à seção em que estava.
   - Revisão: tela "Revisão concluída" persistia ao voltar; Base de conhecimento abria filtrada em "Tratados/Organizações" depois de usar esses atalhos.
   - Editor da Biblioteca **estourava a largura a 320 px** (grid sem `min-width:0`); a primeira versão do teste de responsividade excluía justamente esse elemento — removi a exclusão.
   - Mensagem de erro do atualizador era **sobrescrita** pelo aviso padrão.
   - Rollback da restauração não era verificado.
   - Primeira sincronização com muitos grupos de dados chegou a levar ~1 min no emulador (transações em série) → envio em lote (causa exata dos travamentos não foi isolada; ver §6).

## 3. Arquivos alterados / criados (principais)
Novos: `js/sync.js`, `infra/firestore.rules`, `infra/firebase.json`, `.github/workflows/testes.yml`, `docs/SINCRONIZACAO.md`, `docs/RELATORIO_SEGUNDA_AUDITORIA.md`,
`tests/e2e/{emu,helpers,server,run-suites,navegacao,questoes,cronograma,discursivas,biblioteca,revisao,conhecimento,compatibilidade,backup,sync-emulador,atualizacao,mobile}.js`,
`tests/unit/sync-backup.test.js`. Reescritos: `js/backup.js`, `js/configuracoes.js`, `sw.js` (instalação), `js/updater.js` (applyUpdate/falhas). Alterados:
`js/theme-auth.js` (sync movido), `js/srs-core.js`, `js/flashcards-srs.js`, `js/biblioteca-revisao.js`, `js/cronograma.js`, `js/navigation.js`, `js/app.js`, `js/config.js`,
`js/revisao-hub.js`, `css/modern.css`, `css/modulos.css`, `index.html`, `package.json` (+ lock), docs. Removidos: `tests/e2e/{firebase-stub,fluxos,sincronizacao}.js` (stub e testes com falso positivo).
Versão: **1.1.0 (build 2)**.

## 4. Testes executados e resultados reais

Ambiente: Node 22, Chromium (Playwright), Firebase Emulator Suite (Auth + Firestore, regras de `infra/firestore.rules`), Java 21.
Duas execuções completas consecutivas de `npm run test:e2e` com **12/12 suítes aprovadas** (a primeira execução havia reprovado `compatibilidade`; ver §2/§6).

| Teste | Resultado | Observação |
|---|---|---|
| Testes unitários (`npm run test:unit`) | **Aprovado** | 21/21: SRS adaptativo e fixo, datas locais, escape, mesclagem/conflito, carimbos, validação/hash de backup |
| Versão / Service Worker / HTML (`npm run test:version`) | **Aprovado** | 5/5 + `sync-version --check`: versões, arquivos referenciados, pré-cache, ordem dos scripts, `no-store` |
| Navegação | **Aprovado** | 27/27: 17 seções (desktop), atalhos, barra inferior e folha "Mais" |
| Banco de questões | **Aprovado** | 41/41: criar/validar/editar/excluir/resolver/corrigir/histórico/estatísticas/filtros (matéria, assunto, banca, ano, tipo, desempenho)/refazer erradas/XSS; recarrega 3× |
| Cronograma | **Aprovado** | 35/35: criar, editar, concluir com e sem tempo, reabrir, reagendar, cronômetro (sobrevive a recarga), filtros, 5 visões, histórico, exclusão + snapshot |
| Discursivas | **Aprovado** | 36/36: proposta, cronômetro, autosave, limite de linhas, versões, diff, restauração, avaliação, critérios, produções |
| Biblioteca | **Aprovado** | 38/38: pastas/subpastas/arrastar-soltar, documento com conteúdo rico, tags, mover, rascunho (gravar/recuperar/limpar), busca, destaque/fichamento/flashcard, sanitização, exclusão |
| Revisão espaçada | **Aprovado** | 29/29: hub, método adaptativo **e** fixo (2/4/6/8), consistência flashcard×documento, lapsos, dificuldade, histórico, dados antigos, manual, sync entre aparelhos |
| Atualidades e conhecimento | **Aprovado** | 39/39: criar/editar/excluir/pesquisar/filtrar/relacionar (países, fichas, acontecimentos), ficha do país |
| Persistência (ciclo criar→recarregar→editar→recarregar) + dados antigos | **Aprovado** | embutida em cada suíte acima + `compatibilidade` 16/16 (formatos anteriores à v1.0.0, nenhuma perda de campo) |
| Backup e segurança | **Aprovado** | 38/38: exportação completa (inclui rascunho), 9 validações, importação com confirmação, snapshot prévio, restauração, falhas simuladas com rollback, integridade |
| Sincronização (Firebase **Emulator**) | **Aprovado** | 46/46: alterações rápidas, gravação antiga, offline/volta, falha + recarregar, 2–3 aparelhos, conflito, local×remoto, documento legado, regras de segurança |
| Atualização | **Aprovado** | 45/45, Service Worker real: igual/menor/maior, 5 falhas de consulta, offline, falha de download (404), versão inconsistente, `sw.js` quebrado, interrupção, dados pendentes, SW×código, sem ciclos, iPhone emulado |
| Responsividade (390×844, 320×640, 820×1180, 1366×768) | **Aprovado** | 195/195 (por toque): rolagem horizontal, alvos ≥44 px, modais na tela, campos ≥16 px, editor, questões, cronômetro, navegação |
| **Provas de que os testes detectam falhas** | **Aprovado** | 3 mutações deliberadas (remover guarda de gravação antiga; ignorar método fixo; aceitar backup adulterado) → as suítes correspondentes **reprovaram** (e foram revertidas) |
| Firebase de **produção** (login Google real, regras reais) | **Não executado** | sem credenciais/ambiente; o emulador não substitui |
| Safari/iPhone **reais** e PWA na tela inicial | **Não executado** | só emulação de iPhone no Chromium |
| Workflow do GitHub Actions | **Não executado** | criado, mas não rodou no GitHub (fora do alcance desta sessão) |
| Hub Linguístico (iframe externo), importador de provas | **Não executado** | fora do escopo |

Varredura anti-falso-positivo: `grep -rE "\|\| true|check\(true" tests/` → 0 ocorrências.

## 5. Testes que não puderam ser realizados
Produção do Firebase; Safari real/iOS standalone; execução do CI no GitHub; carga com bases grandes (perto de 1 MiB) — apenas o aviso de tamanho existe; relógios dessincronizados entre aparelhos.

## 6. Riscos que permanecem
1. **Limite de ~1 MiB** do documento único: não migrado (plano completo em `docs/SINCRONIZACAO.md`; exige alterar regras de produção — sem autorização/validação não alterei nada).
2. **Conflitos:** dependem do relógio dos aparelhos; exclusões podem reaparecer ao mesclar listas por id (a versão descartada fica guardada e baixável).
3. **Tipo "C/E" legado de questões** é normalizado para `ce` ao regravar (módulo antigo era um stub e nunca salvou questões; exceção documentada no teste).
4. **Lentidão intermitente observada** na 1ª sincronização com ~14 grupos no emulador (≈60 s em 2 de 4 execuções antes do envio em lote; não reproduzida depois). A causa não foi isolada;
   o lote reduz o risco, mas vale observar em produção.
5. O modo adaptativo **não é o FSRS oficial** (declarado na UI e no código).
6. Regras de segurança de produção desconhecidas: confira se só o dono lê/escreve `chancelaria_users/{uid}` (proposta em `infra/firestore.rules`).
7. Primeiro acesso offline sem o SDK do Firebase em cache: o app roda só local (sem login).

## 7. Recomendações
1. Revisar e publicar as regras (usar `infra/firestore.rules` como base) e executar o plano de migração por documentos **depois** de validar no emulador.
2. Rodar o CI no GitHub e exigir `npm test` + `npm run test:e2e` antes de mergear na `main`.
3. Testar a atualização e a sincronização em um iPhone real (Safari e tela inicial) e em dois aparelhos com a conta real.
4. Considerar *tombstones* para exclusões e um *listener* em tempo real quando a migração por documentos estiver pronta.
5. Monitorar o tamanho dos dados (aviso em Configurações) e evitar imagens grandes embutidas nos documentos.
