# Chancelaria — Gabinete de Estudos

Plataforma pessoal de estudos para o CACD. Site **estático** (HTML + CSS + JavaScript puro, sem build),
com login Google e sincronização via Firebase (Auth + Firestore). Funciona offline depois da primeira visita
(Service Worker) e pode ser instalada na tela inicial do iPhone/Android.

**Versão atual:** definida em [`version.json`](version.json) (fonte única). Veja [`CHANGELOG.md`](CHANGELOG.md).

## Módulos

| Área | Arquivos | O que faz |
|---|---|---|
| Central de Estudos | `central.js`, `stats.js` | Resumo do dia, indicadores, **Despacho do Dia**, acesso rápido |
| Cronograma | `cronograma.js`, `estudo-log.js` | Semana/mês/lista/matéria/histórico; planejado × estudado; reagendar; cronômetro |
| Revisão espaçada | `srs-core.js`, `revisao-hub.js`, `revisao.js` | Motor único (inspirado no FSRS) para flashcards, Biblioteca e revisões manuais |
| Questões | `questoes.js` | Banco próprio (C/E, múltipla, discursiva), resolução, histórico, desempenho |
| Discursivas | `discursiva.js` | Propostas, editor com autosave/cronômetro/limite de linhas, versões, avaliação por critérios |
| Atualidades / Base de conhecimento | `atualidades.js`, `conhecimento.js` | Acontecimentos e fichas (organizações, tratados, acordos, conflitos, temas) ligadas a países |
| Biblioteca | `biblioteca-*.js` | Estantes, editor, tags, relacionados, SRS + destaques, fichamento, vínculo com edital |
| Flashcards, Simulados, Países, Matérias | `flashcards-*.js`, `simulados.js`, `paises.js`, `materias.js` | Já existentes (preservados) |
| Atualizador | `updater.js`, `sw.js`, `version.json`, `scripts/sync-version.js` | Ver [`docs/ATUALIZACAO.md`](docs/ATUALIZACAO.md) |
| Infra | `utils.js`, `backup.js`, `migrations.js`, `theme-auth.js`, `navigation.js`, `icons.js`, `config.js` | Datas locais, escape de HTML, backup/snapshots, sync, menu |

## Ordem de carregamento (scripts globais, sem bundler)

`version → config → utils → icons → backup → migrations → theme-auth → navigation → srs-core → materias → estudo-log →
cronograma → revisao → questoes → discursiva → atualidades → conhecimento → notas → (d3, topojson) → paises → dashboard →
simulados → biblioteca-* → flashcards-* → revisao-hub → central → stats → configuracoes → app → updater`

Cada arquivo só usa o que foi definido antes dele. `app.js` e `updater.js` são sempre os últimos. O teste
`tests/versao.test.js` valida essa ordem. Detalhes em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Publicar uma nova versão

```bash
node scripts/sync-version.js --bump patch --note "o que mudou"   # ou minor / major
npm test                                                           # unitários + consistência de versão
git add -A && git commit -m "vX.Y.Z — ..." && git push             # o host publica; os usuários recebem o aviso
```

Passo a passo completo (e o que fazer se algo der errado) em [`docs/ATUALIZACAO.md`](docs/ATUALIZACAO.md).

## Testes

`npm test` (Node puro, sem dependências) e os testes E2E em `tests/e2e/` (Playwright). Veja [`docs/TESTES.md`](docs/TESTES.md).

## Segurança e dados

- Nada de credencial privada no repositório: a configuração do Firebase Web (`config.js`) é pública por design;
  a proteção real são as **regras do Firestore** (ver `docs/ARQUITETURA.md`).
- Backup: Configurações → Dados (exportar/importar JSON e pontos de restauração automáticos).
- Backup do código antes da modernização: tag `backup-pre-modernizacao` (commit `8e640a9`) e `diplomacia.zip`.
