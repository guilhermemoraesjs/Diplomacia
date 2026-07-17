# Chancelaria — Gabinete de Estudos

Refatoração do app original (arquivo único `.html`) em uma estrutura de
projeto organizada, sem alterar funcionalidade, comportamento ou design.

## Estrutura de pastas

```
chancelaria/
├── index.html                    # Apenas marcação (HTML) + <link>/<script> externos
├── css/
│   └── style.css                 # Todo o CSS original, inalterado
└── js/
    ├── config.js                 # Config do Firebase + constantes globais (HUB_ORIGIN)
    ├── utils.js                  # Helpers genéricos: uid, load/save, datas
    ├── theme-auth.js             # Tema claro/escuro + autenticação Firebase
    ├── navigation.js             # Troca de abas (tabbar) e sub-abas (subtabs)
    ├── materias.js                # Diplomacia → Matérias (edital em árvore)
    ├── cronograma.js              # Diplomacia → Cronograma (+ calendário + modal)
    ├── revisao.js                 # Diplomacia → Revisão espaçada (manual, D+1/D+7/D+30)
    ├── questoes.js                # Diplomacia → Questões
    ├── discursiva.js              # Diplomacia → Discursiva (+ cronômetro)
    ├── atualidades.js             # Diplomacia → Atualidades
    ├── notas.js                   # Diplomacia → Anotações
    ├── biblioteca-pastas.js       # Biblioteca → Estantes (árvore, drag & drop)
    ├── biblioteca-documentos.js  # Biblioteca → Documentos (CRUD, tags, relacionados)
    ├── biblioteca-editor.js      # Biblioteca → Editor de texto rico (toolbar)
    ├── biblioteca-revisao.js     # Biblioteca → Revisão espaçada (SRS de fichamentos)
    ├── biblioteca-busca.js       # Biblioteca → Busca
    ├── stats.js                   # Início → estatísticas e Despacho do Dia
    └── app.js                     # Bootstrap: orquestra a renderização inicial
```

## Ordem de carregamento dos scripts

Os módulos usam escopo global compartilhado (sem bundler/módulos ES), então
a ordem em `index.html` importa: cada arquivo pode usar funções/variáveis
definidas nos arquivos carregados **antes** dele. `app.js` é sempre o
último, pois é o único que dispara a renderização inicial
(`reloadStateFromLocalStorage()`), momento em que todas as funções já
existem no escopo global.

## O que foi feito na refatoração

- **Separação de camadas**: HTML (marcação), CSS (apresentação) e JS
  (comportamento) agora vivem em arquivos próprios.
- **Modularização por domínio**: cada aba/sub-aba da aplicação tem seu
  próprio arquivo JS, ao invés de um único bloco de +1500 linhas.
- **Eliminação de duplicação**: a função `populateMateriaSelect(id)` em
  `materias.js` centraliza o preenchimento dos `<select>` de matéria
  (usados em Cronograma, Revisão, Discursiva e Questões), que antes tinha
  lógica repetida em mais de um lugar.
- **Nenhuma mudança de funcionalidade ou design**: todo o CSS foi mantido
  byte a byte; toda a lógica JS foi preservada função por função, apenas
  reorganizada em arquivos.

## Preparado para expansão futura

- Novos módulos (ex.: uma futura aba "Simulados") podem ser adicionados
  como um novo arquivo `js/simulados.js`, incluído no `index.html` na
  posição correta da cadeia de dependências.
- Como cada domínio (Matérias, Cronograma, Biblioteca, etc.) já é isolado
  em seu próprio arquivo, é possível evoluir cada um independentemente —
  por exemplo, trocar o armazenamento local (`localStorage`) por Firestore
  primeiro em um módulo, sem tocar nos demais.
- Caso o projeto cresça o suficiente para justificar um bundler (Vite,
  esbuild) ou módulos ES (`import`/`export`), a divisão atual em arquivos
  por responsabilidade já está pronta para virar `import`s nomeados sem
  necessidade de reescrever a lógica interna de cada módulo.
