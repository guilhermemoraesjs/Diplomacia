# Changelog

## v1.5.0 — navegação do celular, feedback dos Simulados e atualização no estilo Minha-Leitura
**Navegação:** a barra inferior do celular agora é Central · Cronograma · **Simulados** · **Flashcards** · Revisão · Mais. Questões passa para a folha "Mais".
**Simulados (modo Estudo):** o resultado ficou impossível de confundir. Painel grande "Você acertou!" (verde, ✓) ou "Você errou" (vermelho, ✕) com a sua resposta e o gabarito oficial; as alternativas dizem "Sua resposta" e "Gabarito" (com ícones, sem depender só da cor); placar de acertos/erros da sessão; grade de itens verde/vermelha com legenda. Depois do feedback a resposta fica travada (evita trocar por clique acidental) e há "Refazer este item". No modo "Simulado (só no final)" nada muda: sem feedback e com troca de resposta.
**Atualização (como no Minha-Leitura):** aviso no **topo** "Nova versão disponível (vX) · Atualizar agora", que fica até atualizar (o "Depois" de 2 h foi removido, pois escondia a atualização de quem voltava ao site); linha "Versão do app vX · Verificar atualização" abaixo do título da Central, que vira "Atualizar para vY" quando há versão nova. **Toda mudança no app exige versão nova:** `scripts/verificar-versao-alterada.js` roda em `npm test` e no CI de cada Pull Request.
**Testes:** suíte `simulados` com o bloco de feedback (57 verificações), `atualizacao` com aviso no topo/sem "Depois"/linha de versão, `tests/version/guarda.test.js` e navegação do celular com os 6 botões.

## v1.4.0 — Simulados com texto de apoio e comando; provas de 2025 completas
**Simulados:** cada item mostra o **texto de apoio** (com título e fonte) e o **comando** do seu bloco, como no caderno da banca. No computador o texto fica numa coluna ao lado, com rolagem própria; no celular vem antes do item e pode ser recolhido. A matéria impressa no caderno aparece no cabeçalho do item ("Língua Portuguesa · Item 14"). Itens anulados mostram a justificativa oficial e itens com gabarito alterado mostram "de X (preliminar) para Y (definitivo)". A grade de navegação de provas longas ganhou área rolável compacta, comporta números de 3 dígitos e acompanha o item atual; ao avançar no celular a tela volta ao início do item.
**Dados:** 1ª fase do CACD 2025 refeita a partir do caderno oficial e do Gabarito Oficial Definitivo: **manhã** (120 itens; 20 divergiam do caderno, entre eles o 117, que era o comando do grupo seguinte) e **tarde** (120 itens, nova). As 8 matérias do caderno substituem o "A classificar", e os filtros "Por disciplina" passam a funcionar para 2025. Formato v2 com grupos (`docs/SIMULADOS.md`); provas antigas (v1) seguem iguais.
**Correções:** o flashcard criado a partir de um erro nos Simulados saía com a frente vazia e "Resposta correta: undefined" (lia o índice leve em vez da questão); o marcador "A classificar" aparecia como tema nos rankings, na busca global e nas questões relacionadas da Biblioteca; o Service Worker servia a cópia antiga dos dados das provas por uma sessão depois de uma correção (agora rede primeiro, com cache como plano B).
**Testes:** `tests/unit/simulados-dados.test.js` (gabarito oficial, anulados, matérias por faixa, grupos, justificativas e regressões de extração); suíte E2E `simulados` (44 verificações) e bloco de cache de dados na suíte `atualizacao`.

## v1.3.0 — Redesign 2026
**Design system:** tokens únicos em `modern.css` (paleta navy/grafite/dourado refinada, tipografia Inter + Source Serif 4, espaçamento, raios, sombras, movimento), contraste WCAG AA verificado nos dois temas, componentes padronizados (botões, campos, abas sublinhadas, chips, badges, faixas de indicadores, estados vazios, alertas, seção recolhível, modais com ações fixas). `style.css` não declara mais tokens; cores fixas trocadas por tokens; ~20 KB de CSS morto removidos (só seletores sem uso comprovado). Ver `docs/DESIGN_SYSTEM.md`.
**Central de Estudos:** cabeçalho com contexto do dia, resumo com anel da meta + tarefas/questões/revisões + matérias previstas, Despacho do Dia agrupado (prioritárias, hoje, revisões, questões, concluídas), Desempenho com KPIs e gráfico de 14 dias com linha de meta, desempenho por matéria e acesso rápido.
**Navegação:** barra superior com grupo/página, menu lateral compacto (todos os itens visíveis em 1366×900), item ativo mais claro, barra inferior com pílula no item ativo, folha "Mais" em grade de 4.
**Módulos:** cabeçalhos uniformes (Países, Flashcards, Simulados, Biblioteca), Flashcards com chamada principal, Simulados/Flashcards com grade de indicadores sem órfãos, Biblioteca em duas colunas, Países com cartões neutros, Matérias sem verde/emoji, Cronograma com revisões manuais recolhíveis, nomes de matéria exibidos sem emoji (dados intactos).
**Celular:** filtros e abas em linha rolável, dias vazios compactos, indicadores em 3 colunas, filtros de questões em 2 colunas, revisão com botões largos, margem de 12 px em telas ≤360 px.
**Correções:** Países ficava em branco depois de usar subabas de outro módulo (`goSub` desativava subabas de todas as telas); filtros avançados e favoritos de Países chamavam funções inexistentes; lista da Biblioteca não atualizava ao abrir a aba; regra fora de ordem anulava as duas colunas da Biblioteca; nomes de matéria/estante sem escape de HTML.

## v1.2.1 — correções do atualizador (achadas pelo CI do GitHub)
O aviso "a atualização ainda não foi carregada" (com **Forçar atualização**) era apagado/sobrescrito pela verificação periódica; clique duplo em Forçar contava duas tentativas. O CI do GitHub reprovou `atualizacao` por uma corrida no teste; ela revelou os dois bugs. Teste agora aguarda a navegação e cobre o clique duplo.

## v1.2.0 — migração do Firestore
Migração gradual e reversível do documento único para um documento por chave (botão em Backup e segurança): teste de permissão, snapshot obrigatório, cópia de segurança na nuvem, validação transacional, retomada, reversão, coexistência com clientes 1.1.0. Suíte `migracao-emulador` (47 verificações).

## v1.1.0 — segunda rodada (confiabilidade e proteção de dados)
**Sincronização:** fila serializada, carimbos por edição, transação com `__meta`, conflito entre aparelhos (mesclagem por id), retentativas,
indicador de estado (local/pendente/enviando/offline/falha/sincronizado). **Backup e segurança:** formato v2 com hash, validação,
backup de segurança obrigatório, confirmação, rollback e verificação, rascunho incluído, histórico de 10 pontos, verificação de integridade.
**Revisão:** método global adaptativo/fixo (intervalos configuráveis) usado por flashcards, Biblioteca e hub; lapsos, dificuldade e método no histórico.
**Atualizador:** instalação atômica, falhas tratadas, sem ciclos, diagnóstico código × Service Worker. **Testes:** suíte E2E real com Firebase Emulator,
falhas simuladas, persistência em ciclo, 4 tamanhos de tela. **Correções:** ver `docs/RELATORIO_SEGUNDA_AUDITORIA.md`.

## v1.0.0 — 2026-11-08 (primeira versão modernizada)
**Visual:** nova identidade (azul-marinho/grafite/dourado), menu lateral no desktop, barra inferior + folha “Mais” no celular,
tema claro/escuro, ícones SVG, estados vazios, toasts e confirmações próprias.
**Novo:** Central de Estudos + Despacho do Dia; banco de questões completo; motor de revisão espaçada adaptativo e hub de Revisão;
cronograma com semana/mês/histórico, tempo planejado × estudado e reagendamento; cronômetro de estudo; laboratório de discursivas;
Atualidades e Base de conhecimento ligadas aos países; destaques, fichamento e vínculo com o edital na Biblioteca; busca global ampliada;
backup/snapshots; atalhos de teclado (`g`+letra, `?`).
**Atualização:** `version.json` como fonte única, Service Worker versionado, aviso e atualização segura (ver `docs/ATUALIZACAO.md`).
**Correções:** datas em UTC, sync que sobrescrevia edições pendentes, XSS armazenado, erros de JS no carregamento, filtros do
cronograma, variáveis CSS indefinidas, zoom bloqueado no iOS (ver `docs/ARQUITETURA.md`).
