# Arquitetura, diagnóstico e decisões (v1.0.0)

## Diagnóstico do projeto original (commit `8e640a9`)

Site estático, ~6,6 mil linhas, scripts globais sem bundler. Hospedagem: não declarada no repositório (sem `vercel.json`,
sem workflow); `HUB_ORIGIN` aponta para um projeto na Vercel. **Não havia Service Worker nem manifest.**

Problemas encontrados e tratamento:

| # | Problema | Tratamento |
|---|---|---|
| 1 | `addQuestao()`, `onQTipoChange()` e `renderQuestoes()` eram stubs vazios (a tela só mostrava “Nenhuma questão filtrada”) | Módulo reescrito (`questoes.js`) |
| 2 | Discursivas, Atualidades e Anotações só gravavam título/texto e listavam sem opções de editar/excluir | Reescritos/ampliados |
| 3 | Filtro de matéria do Cronograma não filtrava; as visões “por dia/matéria” eram iguais | Reescrito (`cronograma.js`) |
| 4 | `todayISO()`/`addDaysISO()` usavam `toISOString()` (UTC): após ~21h no Brasil o “hoje” virava amanhã | `ymdLocal()` em `utils.js`; corrigidos dashboard, flashcards e simulados (inclusive leitura de respostas antigas em UTC) |
| 5 | `syncFromCloud` sobrescrevia o localStorage com a nuvem sem considerar edições locais não enviadas, e recarregava a página sempre | Marca de pendência por chave (`chancelaria_dirty`); pendentes têm prioridade e são reenviadas; só recarrega se algo mudou |
| 6 | Sem SDK do Firebase (offline na 1ª abertura) o app quebrava | Guardas: funciona em modo local |
| 7 | Dados do usuário e HTML rico inseridos via `innerHTML` sem escape/sanitização (XSS armazenado) | `escHtml`, `sanitizarHTML` (lista de permissões) e `stripHtml` via `DOMParser` |
| 8 | Bloco de importação de PDF no fim de `simulados.js` lançava `TypeError` a cada carregamento (elementos inexistentes) | Guarda de existência dos elementos |
| 9 | Variáveis CSS `--border-color`/`--text-main` usadas mas **nunca definidas** (bordas/cores invisíveis) | Definidas em `modern.css` |
| 10 | `maximum-scale=1` impedia zoom; entradas < 16px davam zoom no iOS | Viewport corrigido; inputs 16px no celular |
| 11 | `confirm()`/`alert()` nativos | Diálogo próprio (`confirmar`) e toasts |
| 12 | Editor da Biblioteca tinha o rótulo “autosave” sem lógica | Rascunho automático recuperável |
| 13 | `layout-fix.js` quebrava (elemento removido) e `.letterhead`/`.tabbar` antigos | Arquivo removido; shell novo |
| 14 | `confirmarConfigECome车` (caractere estranho no nome) | Renomeada |

**Risco conhecido, não alterado:** todos os dados do usuário vão para **um único documento** do Firestore
(`chancelaria_users/{uid}`), limitado a ~1 MiB. Documentos grandes (imagens em base64 na Biblioteca) podem estourar o
limite e a sincronização falharia silenciosamente. Mitigações adicionadas: aviso de tamanho em Configurações →
Dados e as marcas de pendência. **Solução definitiva sugerida** (não aplicada para não migrar dados de forma
destrutiva): um documento por chave (`chancelaria_users/{uid}/dados/{chave}`) com migração gradual.

**Regras do Firestore:** não estão no repositório e **não foram alteradas**. Devem permitir ler/escrever
`chancelaria_users/{uid}` apenas quando `request.auth.uid == uid`. `importador-provas.js` (não carregado pelo
`index.html`) tem uma “senha” em texto no código — é só um portão de interface de uso interno, não segurança.

## Armazenamento

`localStorage` (JSON) espelhado no Firestore por `save()`. Chaves sincronizadas (`CLOUD_KEYS` em `config.js`):

| Chave | Conteúdo | Novidade v1.0.0 |
|---|---|---|
| `diplo_materias`, `diplo_revisao`, `diplo_notas`, `diplo_paises`, `paises_favoritos`, `simulados_progresso`, `dashboard_*`, `nav_order`, `chancelaria_theme`, `biblio_*`, `flash_*` | como antes | — |
| `diplo_cronograma` | itens (formato original mantido: `data` = `dd/mm/aaaa`, `feito`) | + `assunto`, `prioridade`, `duracaoMin`, `sessoes[]`, `concluidoEm`, `reagend`, `historico[]` |
| `diplo_questoes` | questões | + enunciado, assunto, banca, ano, alternativas, gabarito, comentário, tags, obs, revisar |
| `diplo_discursivas` | propostas | + `tipo`, `limiteLinhas`, `producoes[]` (versões, avaliação) |
| `diplo_atualidades` | acontecimentos | + data, escopo, contexto, países, organizações, tratados, fonte, tags, obs |
| `diplo_questoes_hist`, `diplo_kb`, `diplo_estudo_log`, `srs_log`, `chancelaria_prefs` | — | **novas** |

Só locais (`LOCAL_ONLY_KEYS`): `chancelaria_dirty`, `chancelaria_schema`, `chancelaria_timer`, `chancelaria_version_seen`,
`chancelaria_version_info`, `chancelaria_upd_*`, `biblio_rascunho`. IndexedDB: `chancelaria_backups` (snapshots).

**Compatibilidade:** nenhum campo existente foi renomeado/removido; os módulos normalizam registros antigos em memória
(`crNorm`, `qNorm`, `dlNorm`, `atNorm`, `kbNorm`) e só regravam quando você edita. Flashcards e documentos da Biblioteca
ganham `stab`/`dif`/`lapsos` ao serem revisados, mantendo `intervalo`, `proximaRevisao`, `nextReview`, etc.

## Decisões técnicas

- **Sem dependências novas** (nem bundler). SRS implementado do zero (`srs-core.js`, pesos padrão do FSRS-5, sem treino).
  O modo antigo de intervalos fixos 7/15/30/60 continua disponível em Configurações.
- **Datas** de calendário sempre no fuso local; `data` do cronograma segue em `dd/mm/aaaa` (não migrado).
- **Ícones SVG** (`icons.js`) no lugar de emojis na interface. Emojis que fazem parte de **dados** seus (nomes de matérias
  e estantes, tipo do documento) foram preservados; `ico()` converte o tipo de documento antigo em ícone ao exibir.
- **Layout:** `style.css` original + `modern.css` (tokens/shell/componentes) + `modulos.css` (módulos novos).
- **Backup:** tag `backup-pre-modernizacao` (local; o push da tag foi recusado pelo proxy desta sessão — o commit `8e640a9`
  permanece no histórico) e snapshots automáticos antes de migração, atualização e exclusões em massa.
