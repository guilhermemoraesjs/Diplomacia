# Changelog

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
