# Relatório — Redesign 2026 (v1.3.0)

Este relatório cobre a modernização visual e estrutural. As funções, os dados, a sincronização, os backups e o atualizador foram preservados. Nenhuma estrutura do Firestore, nome de coleção, campo ou chave foi alterado.

## 1. Principais mudanças visuais

- **Paleta refinada:**
  - base em azul-marinho (`#0B1220` / `#101A30`) e grafite (`#202B3D`);
  - dourado discreto (`#C5A66A`) só como destaque: ação principal, item ativo, meta do dia;
  - branco suave (`#E9EDF4`) para o texto;
  - tema claro equivalente.
- **Contraste verificado (WCAG AA):** o texto auxiliar, o dourado e o verde do tema claro foram escurecidos para passar de 4,5:1.
- **Tipografia:** Inter para a interface e Source Serif 4 para títulos de página, saudação e marca. IBM Plex Mono ficou só para código e atalhos. Os números usam algarismos tabulares. Nenhum texto fica abaixo de 11,5 px.
- **Fundos mais limpos:** removi os gradientes decorativos, a textura de ruído e a grade dourada de fundo. As sombras pesadas viraram elevação sutil.
- **Componentes unificados:**
  - abas sublinhadas;
  - chips em pílula;
  - faixa de indicadores com células unidas;
  - estados vazios com ícone e ação;
  - seção recolhível;
  - modais com ações fixas no rodapé;
  - toasts com marcador de estado.

## 2. Módulos modernizados

| Módulo | O que mudou |
|---|---|
| **Central de Estudos** | Reconstruída, com cinco blocos: (1) cabeçalho com data, saudação e uma frase de contexto (itens pendentes, atrasos, minutos que faltam para a meta); (2) resumo do dia com anel da meta, linhas de progresso de tarefas, questões e revisões, "próximo passo" clicável e matérias previstas; (3) **Despacho do Dia** agrupado em Prioritárias, Agendadas para hoje, Revisões, Questões e Concluídas hoje; (4) Desempenho com 4 indicadores (semana com média diária, mês, cronograma, acerto) e gráfico de 14 dias com **linha da meta** e destaque para dias cumpridos; (5) desempenho por matéria e acesso rápido a 8 módulos. Todos os números vêm dos dados reais; nada é fictício. |
| Cronograma | Revisões manuais em seção recolhível (o formulário não ocupa mais o fim da página), dia de hoje destacado, dias vazios compactos no celular, retorno visual ao concluir uma atividade, nomes de matéria sem emoji na exibição. |
| Matérias | Título sem o verde e sem emoji, percentual com algarismos tabulares, barra de progresso no padrão. |
| Banco de questões | Faixa de indicadores unida (3 colunas no celular) e filtros em 2 colunas no celular. |
| Revisão espaçada | Faixa de indicadores unida; no celular, "Mostrar resposta" ocupa a largura toda e as notas têm botões maiores. |
| Flashcards | Cabeçalho padrão; **chamada principal** "N cartões prontos" com botão dourado no topo; 6 indicadores em grade sem "órfão" (2, 3 ou 6 colunas); ícones neutros no lugar de 6 cores diferentes; filtros de "Meus Cards" em uma linha. |
| Simulados | Cabeçalho padrão, grade de indicadores, cartões de modo alinhados à esquerda com ícone em caixa, tipografia de números unificada (sem mono). |
| Biblioteca | Layout em **duas colunas** (estantes à esquerda, fixas ao rolar), árvore sem azul saturado nem emoji, estado vazio com ação, controle segmentado neutro, "Salvar" como ação principal. |
| Países | Cabeçalho padrão; cartões neutros (sem barra colorida, badges sem mono); **filtros avançados e favoritos funcionando** (veja a seção 5); contagem de países discreta. |
| Discursivas, Atualidades, Conhecimento, Anotações, Configurações | Herdam os componentes novos (indicadores, botões, chips, estados vazios, controle deslizante dourado). |
| Login | Cartão com subtítulo e botão principal. |

## 3. Arquivos modificados

- **CSS:**
  - `css/modern.css`: tokens, base, shell e componentes; é a fonte única do design system;
  - `css/modulos.css`: Central nova, Países, Flashcards, grade de indicadores, ajustes de celular;
  - `css/style.css`: tokens removidos, cores fixas trocadas por tokens, CSS morto removido (~72 → ~51 KB), regras duplicadas que o `modern.css` já redefinia retiradas.
- **HTML:** `index.html`, com cabeçalhos de página, rodapé da barra lateral, migalha na barra superior, filtros de Países, painel de Flashcards, revisões manuais recolhíveis e fonte Source Serif 4.
- **JS (apresentação):**
  - `central.js` (reescrito);
  - `navigation.js` (migalha e `goSub` corrigido; Biblioteca e Anotações atualizam ao abrir);
  - `paises.js` (favoritos, filtros, escape);
  - `materias.js` e `biblioteca-pastas.js` (escape de HTML, nomes sem emoji na exibição);
  - `biblioteca-documentos.js` (estado vazio);
  - `flashcards-ui.js` e `simulados.js` (ícones neutros, números);
  - `stats.js` (rodapé compacto);
  - `cronograma.js` (retorno ao concluir);
  - `utils.js` (`nomeSemEmoji` centralizado, agora também com bandeiras);
  - `questoes.js`, `revisao.js`, `notas.js`, `discursiva.js`, `atualidades.js`, `biblioteca-extras.js` (nomes de matéria sem emoji na exibição).
- **Versão:** `version.json`, `js/version.js`, `sw.js` e os `?v=` do `index.html` (1.3.0, build 5), sincronizados por `scripts/sync-version.js`.
- **Testes:**
  - `tests/e2e/navegacao.js`: +7 verificações de regressão;
  - `tests/e2e/biblioteca.js` e `tests/e2e/mobile.js`: o seletor do botão "Novo documento" passou a ser o id `#biblioNovoDocBtn`, porque o texto perdeu o "+";
  - `tests/visual/capturas.js`: novo, gera capturas para revisão visual.
- **Docs:** `docs/DESIGN_SYSTEM.md` (novo), este relatório, `docs/TESTES.md`, `README.md`, `CHANGELOG.md`.

## 4. Navegação e responsividade

- **Barra superior:** mostra o grupo e a página ("Estudo / Cronograma"). No desktop, a busca fica em campo próprio.
- **Barra lateral:** itens mais compactos (todos os 17 visíveis em 1366×900, sem rolagem), item ativo com fundo, barra e ícone dourados, rodapé com "Sequência" e "Questões hoje" lado a lado. Em telas baixas o rodapé se recolhe, e uma máscara indica quando há rolagem.
- **Barra inferior (celular):** pílula dourada atrás do ícone ativo e selo de pendências com contorno.
- **Folha "Mais":** grade de 4 colunas com ícones em caixa, agrupada por finalidade.
- **A reordenação do menu em Configurações foi preservada.**
- **Celular:**
  - filtros e abas em uma linha com rolagem lateral;
  - botões de ação em largura total no cabeçalho;
  - alvos de toque de 44 px;
  - dias vazios compactos no cronograma;
  - margem lateral de 12 px em telas ≤ 360 px (mantém as células do calendário mensal ≥ 38 px a 320 px);
  - ações do modal sempre visíveis.
- **Desktop:** largura máxima de 1200 px (1280 px em telas ≥ 1440 px), Biblioteca em duas colunas, filtros de Flashcards em linha.

## 5. Ajustes técnicos e correções

- **Bug:** a aba **Países abria em branco** depois de usar qualquer subaba de outro módulo, porque `goSub` desativava as subabas de todas as telas. Agora ele age só na tela que contém a subaba. Há teste de regressão, e um teste de mutação confirmou que ele detecta o bug.
- **Bug:** os 4 seletores de filtro e o botão "Favoritos" de Países chamavam **funções inexistentes**: ficavam vazios e davam erro ao clicar. Agora os filtros avançados (código que já existia) aparecem em "Mais filtros". Os favoritos foram implementados com a chave `paises_favoritos`, que já constava nas chaves sincronizadas e não muda de formato.
- **Bug:** a lista da Biblioteca não era atualizada ao abrir a aba. Dados vindos de outro módulo ou da nuvem só apareciam depois de recarregar a página.
- **Bug:** uma regra fora de ordem anulava o layout de duas colunas da Biblioteca.
- **Segurança:** nomes de matéria, tópico, estante e país passaram a ser escapados (`escHtml`) na exibição.
- **CSS:**
  - remoção de seletores sem uso, verificada automaticamente: cada classe foi procurada no HTML e em todos os JS, incluindo classes montadas dinamicamente;
  - remoção de regras legadas duplicadas (botões, chips, abas, campos, cartões) que conflitavam com `modern.css` (por exemplo, `label.field-label` em caixa alta vencia por especificidade);
  - cores fixas e `rgba(255,255,255,…)` (invisíveis no tema claro) trocadas por tokens.
- **Dados:** nomes de matéria com emoji continuam gravados como estão. Só a **exibição** remove o emoji. Seletores cujo valor é o próprio texto da opção não foram alterados, justamente para não mudar o valor salvo.

## 6. Testes executados e resultados

Todos os testes foram executados neste ambiente em 17/11/2026, com Chromium e o Firebase Emulator Suite (Auth e Firestore locais).

| Suíte | Resultado |
|---|---|
| Unitários (`npm run test:unit`) | **Aprovado**: 22/22 (também com `TZ=America/Sao_Paulo`) |
| Versão (`npm run test:version`) | **Aprovado**: 5/5 |
| navegacao | **Aprovado**: 34 (7 novas) |
| questoes | **Aprovado**: 41 |
| cronograma | **Aprovado**: 35 |
| discursivas | **Aprovado**: 36 |
| biblioteca | **Aprovado**: 38 |
| revisao | **Aprovado**: 29 |
| conhecimento | **Aprovado**: 39 |
| compatibilidade (dados antigos) | **Aprovado**: 16 |
| backup | **Aprovado**: 38 |
| sync-emulador | **Aprovado**: 46 |
| migracao-emulador | **Aprovado**: 47 |
| atualizacao (atualizador e Service Worker) | **Aprovado**: 46 |
| mobile (390×844, 320×640, 820×1180, 1366×768) | **Aprovado**: 195 |

Ao todo foram 640 verificações E2E. A primeira rodada reprovou 1 verificação: a 320 px, as células do calendário mensal ficaram com 37,7 px por causa da nova margem lateral. Corrigi e a segunda rodada passou inteira.

Além disso, gerei capturas de todos os módulos e de 8 estados internos, nos temas escuro e claro, em 1366 px e 390 px. Revisei as telas manualmente, sem erros de JavaScript no console.

## 7. O que ainda precisa de atenção

- **Não executado:**
  - teste em iPhone ou Safari reais (só emulação no Chromium);
  - teste no Firebase de produção (só no emulador);
  - CI do GitHub para a v1.3.0;
  - auditoria com leitor de tela (o contraste e o foco foram verificados, mas sem uma auditoria formal).
- **Fontes:** nos testes o Google Fonts fica bloqueado, então as capturas usam Georgia no lugar de Source Serif 4. Em produção a fonte vem do Google Fonts, como a Inter já vinha.
- **Bandeiras de países:** as imagens vêm de um serviço externo bloqueado neste ambiente, por isso aparecem quebradas nas capturas. Não verifiquei em produção.
- **Parcial:**
  - o editor da Biblioteca e os formulários internos de Simulados (resolução de prova) receberam só os tokens e componentes globais, sem redesenho de layout;
  - a ficha detalhada do país também foi só parcialmente revisada;
  - as opções de matéria dentro dos `<select>` ainda mostram emoji, de propósito, porque o valor salvo é o próprio texto.
- O CSS legado ainda soma ~51 KB em `style.css`. A próxima etapa natural é mover cada módulo antigo para seu próprio bloco em `modulos.css`.
