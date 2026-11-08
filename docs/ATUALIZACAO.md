# Sistema de atualização automática

Equivalente ao do projeto Minha-Leitura, com mais salvaguardas.

## Como funciona

**Fonte única da versão: `version.json`** (`version` semântica + `build` inteiro monotônico + `date`).
`scripts/sync-version.js` propaga para os arquivos derivados — que nunca devem ser editados à mão:

| Arquivo | O que recebe | Papel |
|---|---|---|
| `js/version.js` | `APP_INFO {version, build, date}` | Versão **instalada** (código que o navegador está rodando) |
| `sw.js` (bloco `@generated`) | `APP_VERSION`, `CACHE_APP = chancelaria-app-<versão>`, lista de pré-cache | Cache versionado |
| `index.html` | `?v=<build>` em todos os `<script>`/`<link>` locais | Quebra o cache HTTP |

`node scripts/sync-version.js --check` (e `npm test`) falham se algo estiver dessincronizado, se um `.js` não estiver
carregado no `index.html` ou se o pré-cache apontar para arquivo inexistente.

**Versão publicada** = `version.json` buscado com `cache: 'no-store'` + `?ts=<agora>` (e o `vercel.json` marca o arquivo como `no-store`).
Comparação por `build`.

### Quando verifica
Ao abrir (3 s depois), a cada 10 min, ao voltar à aba/app (no máximo 1×/min), ao ficar online de novo e ao abrir
Configurações. Sem internet, mostra “Sem conexão: não foi possível verificar”.

### Aviso
Cartão discreto: “Nova versão disponível — Versão instalada: vX · Nova versão: vY — [Atualizar agora] [Depois]”.
“Depois” dispensa por 2 h (o item “Versão” do menu segue indicando atualização). **Nunca recarrega sozinho.**

### Atualizar agora
1. `flushPendingSync()` — grava edições abertas e tenta enviar à nuvem (8 s). Offline: ficam salvas no aparelho e marcadas como pendentes.
2. Snapshot de segurança no IndexedDB (`pre-atualizacao-vX`).
3. `reg.update()` → espera o novo Service Worker instalar → `SKIP_WAITING` → espera `controllerchange`.
4. Recarrega a página.
5. No boot seguinte confirma `APP_INFO.build >= alvo`. **Só então** mostra “atualizada para vX”.
   Se o navegador manteve a versão antiga (iPhone), mostra “A atualização ainda não foi carregada” + **Forçar atualização**
   (remove só o Service Worker e os caches `chancelaria-app-*`; nunca `localStorage`, IndexedDB ou Firebase). Máximo 2 tentativas.

### Service Worker e cache
- HTML/JS/CSS: **rede primeiro** (revalidando), cache só como plano B offline → não fica preso em HTML/JS antigo.
- `version.json` e `sw.js`: sempre da rede.
- `data/*.json`: stale-while-revalidate no cache `chancelaria-data-v1` (preservado entre versões).
- SDK do Firebase e fontes: cache-first (abrir offline).
- Ao ativar apaga **somente** caches `chancelaria-app-*` de outras versões.
- Não chama `skipWaiting` sozinho (não interrompe uma sessão de estudo).

### Migrações de dados
Aditivas e reversíveis (`js/migrations.js`): nunca apagam/renomeiam campos; criam snapshot antes. Esquema em
`localStorage['chancelaria_schema']`.

## Como publicar a próxima versão

1. Faça as alterações de código.
2. `node scripts/sync-version.js --bump patch --note "resumo"` (`minor` para recursos, `major` para quebras).
   Isso reescreve `version.json`, `js/version.js`, `sw.js` e os `?v=` do `index.html`.
3. `npm test`.
4. Commit e push. O host (Vercel/GitHub Pages) publica; quem estiver com o app aberto vê o aviso em até 10 min
   (ou ao voltar à aba); quem abrir o site depois já carrega a versão nova.
5. Criou um arquivo `.js` novo? Adicione-o ao `index.html` na posição certa — o teste avisa se esquecer.

## Hospedagem
Site estático. O repositório inclui `vercel.json` (cabeçalhos `no-cache`/`no-store` para `index.html`, `sw.js`,
`version.json`, manifest). No GitHub Pages não é possível definir cabeçalhos, mas o fluxo continua correto porque o
cliente usa `cache: 'no-store'` + parâmetro único e o Service Worker revalida. **O host real não foi identificado a
partir do código** (`HUB_ORIGIN` aponta para um projeto na Vercel); confirme no painel.

## Problemas comuns
| Sintoma | Causa provável | Ação |
|---|---|---|
| Aviso nunca aparece | `version.json` não publicado ou `build` não aumentou | Use `--bump`; confira `https://SEU-SITE/version.json` |
| `npm test` falha em “dessincronizado” | Editou arquivo derivado à mão | `node scripts/sync-version.js` |
| iPhone continua na versão antiga | Cache do iOS | “Forçar atualização” (Configurações → Versão) ou remover e readicionar o ícone |
