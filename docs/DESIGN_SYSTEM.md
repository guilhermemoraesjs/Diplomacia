# Design System — Chancelaria 2026

Este documento descreve a identidade visual e os componentes da interface. Ele vale para todo código novo e para qualquer ajuste nos módulos antigos.

## Onde fica cada coisa

| Arquivo | Papel |
|---|---|
| `css/modern.css` | **Fonte única dos tokens** (cores, tipografia, espaçamento, raios, sombras, movimento), da base e do *shell* (barra lateral, barra superior, barra inferior, folha "Mais"). Também contém os componentes globais: botões, campos, abas, chips, badges, cartões, modais, toasts, estados vazios, alertas e seção recolhível. |
| `css/modulos.css` | Layout específico dos módulos novos: Central, Cronograma, Questões, Revisão, Discursivas, Conhecimento e Países. Usa somente `var(--…)`. |
| `css/style.css` | Estilos dos módulos legados (Biblioteca, Flashcards, Simulados, Países, mapa). **Não declara tokens.** As cores fixas foram trocadas por tokens, e as regras duplicadas ou sem uso foram removidas na versão 1.3.0. |

A ordem de carregamento é `style.css`, `modern.css` e por último `modulos.css`.

Regras para código novo:

- Nada de cores hexadecimais fora de `modern.css`.
- Nada de `font-family` literal: use `var(--font-sans)`, `var(--font-display)` ou `var(--font-mono)`.
- Antes de criar um componente, verifique se ele já existe na lista abaixo.

## Paleta

O azul-marinho e o grafite formam a base. O dourado é **apenas destaque**: a ação principal da tela, o item ativo da navegação e a meta do dia. Ele nunca é a cor de fundo dominante.

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--surface-0` / `--bg` | `#0B1220` | `#F3F4F7` | fundo da página |
| `--surface-1` | `#101A30` | `#FFFFFF` | cartões, barra lateral, modais |
| `--surface-2` | `#16213A` | `#F0F2F6` | elementos dentro de cartões, item ativo |
| `--surface-3` | `#202B3D` | `#E5E8EF` | trilhos de progresso, hover forte |
| `--text-main` | `#E9EDF4` | `#101A30` | títulos e valores |
| `--text-light` | `#D5DCE8` | `#202B3D` | texto corrido |
| `--text-muted` | `#929DB3` | `#5A6478` | descrições |
| `--text-faint` | `#7F8AA3` | `#646D80` | rótulos de seção, legendas (≥ 4,5:1) |
| `--gold` / `--gold-strong` | `#C5A66A` / `#D8BD86` | `#86662A` / `#6E5320` | destaque |
| `--accent` | `#7D9BE0` | `#3A5FB8` | links, foco, informação |
| `--ok` / `--bad` / `--warn` | verde / vermelho / âmbar | idem, mais escuros | estados |

Cada cor de estado tem as variantes `-soft` (fundo) e `-line` (borda), por exemplo `--ok-soft` e `--ok-line`.

Os nomes antigos (`--ink-*`, `--brass*`, `--seal*`, `--parchment*`, `--ub-*`) continuam definidos e apontam para a paleta nova, para não quebrar os módulos legados.

O contraste foi verificado por cálculo (WCAG 2.1) para texto pequeno sobre `--surface-1` nos dois temas. Ainda falta uma auditoria com leitor de tela.

## Tipografia

| Token | Fonte | Uso |
|---|---|---|
| `--font-sans` | Inter | toda a interface |
| `--font-display` | Source Serif 4 | títulos de página (`.page-head h2`), saudação da Central, marca, modo leitura da Biblioteca |
| `--font-mono` | IBM Plex Mono | apenas código e atalhos (`code`, `kbd`, `.code`) |

Os números usam `font-variant-numeric: tabular-nums`, pelas classes `.tnum` e `.mono`. **A classe `.mono` não troca mais a fonte**: ela era usada para números e rótulos e agora só alinha os algarismos.

A escala vai de `--fs-xs` (11,5 px) a `--fs-3xl` (34 px). Nenhum texto da interface deve ficar abaixo de 11,5 px.

## Espaçamento, raios, sombras e movimento

- **Espaçamento:** `--sp-1` (4 px) a `--sp-10` (40 px).
- **Raios:** `--radius-sm` (10 px) para campos e botões, `--radius-ui` (14 px) para cartões, `--radius-lg` (18 px) para modais e `--radius-pill` para chips e badges.
- **Sombras:** `--shadow-sm` para cartões em repouso, `--shadow` para hover e elevação leve, `--shadow-lg` para modais e toasts. Sombras pesadas não são usadas.
- **Movimento:** `--ease`, `--dur-1` (0,12 s), `--dur-2` (0,2 s) e `--dur-3` (0,32 s). Tudo é desativado com `prefers-reduced-motion`.

## Componentes

| Componente | Classe | Observações |
|---|---|---|
| Cabeçalho de página | `.page-head` + `h2` + `p` + `.page-actions` | `.page-eyebrow` para a linha acima do título |
| Título de seção | `.section-title` (h3), `.panel-title` (rótulo em caixa alta) | |
| Cartão | `.card`, `.card.flat` | |
| Botões | `.btn` (principal, dourado), `.btn.secondary`, `.btn.ghost`, `.btn.danger`, `.btn.small`, `.btn.block` | **um** `.btn` principal por área |
| Campos | `input`, `select`, `textarea`, `.field-label`, `.row2`, `.row3` | foco com anel `--focus-ring` |
| Abas de página | `.subtabs` + `.subtab-btn` | sublinhado dourado na aba ativa |
| Controle segmentado | `.biblio-panel-tabs` + `.bp-tab` | |
| Filtros | `.filters` + `.chip` | no celular, uma linha com rolagem lateral |
| Badges | `.badge` `.ok` `.bad` `.warn` `.gold` `.blue` | |
| Progresso | `.bar` (`.bar.ok`), anel `.ct-ring` | |
| Indicadores | `.qb-stats` + `.qb-stat` (faixa unida), `.stat-grid` + `.dash-stat` (com ícone) | |
| Chamada principal | `.hero-cta` | |
| Estado vazio | `.empty-state` com ícone, `b`, `p` e botão | |
| Alerta | `.alert` `.ok` `.bad` `.warn` `.info` | |
| Carregando | `.loading`, `.skeleton` | |
| Seção recolhível | `details.disclosure` > `summary` + `.disclosure-body` | |
| Modal | `.modal-overlay` > `.modal-card` > `.modal-actions` | no celular vira folha inferior; as ações ficam fixas no rodapé |
| Toast | `toast(msg, 'ok' \| 'erro' \| 'aviso')` | |

## Navegação

- **Desktop (≥ 900 px):** barra lateral agrupada em Estudo, Prática, Conhecimento e Sistema. O item ativo tem fundo `--surface-2`, ícone dourado e uma barra dourada à esquerda. A barra superior mostra o grupo e a página atual.
- **Celular:** a barra inferior tem 4 destinos fixos (Central, Cronograma, Questões e Revisão) e o botão "Mais", que abre uma folha com os demais módulos agrupados. O item ativo ganha uma pílula dourada atrás do ícone.
- A ordem dos itens continua configurável em **Configurações → Ordem do menu lateral** (chave `nav_order`).

## Capturas para revisão visual

```bash
# com o emulador e o servidor estático rodando (veja docs/TESTES.md)
CHROMIUM_PATH=/opt/pw-browsers/chromium node tests/visual/capturas.js /tmp/capturas dark   # ou light
```

O script gera telas de todos os módulos e de estados internos (modais, editor, sessão de revisão), em desktop (1366 px) e celular (390 px). Os dados de exemplo são criados apenas no usuário de teste do emulador.
