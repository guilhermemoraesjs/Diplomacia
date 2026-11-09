# Changelog

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
