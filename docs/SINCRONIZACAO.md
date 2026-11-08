# Sincronização, conflitos e plano para o limite do Firestore

## Como funciona hoje (v1.1.0) — `js/sync.js`

Armazenamento: `localStorage` é a fonte de verdade no aparelho; o Firestore guarda uma cópia no documento
`chancelaria_users/{uid}` (um campo por chave de dados, lista em `CLOUD_KEYS`) mais o mapa `__meta`.

```
chancelaria_users/{uid} = { diplo_notas: [...], flash_cards: [...], ..., __meta: { diplo_notas: {t, d}, ... } }
                          t = carimbo da edição (ms, monotônico por aparelho)   d = id do aparelho
```

### Garantias
| Requisito | Como é atendido |
|---|---|
| Serialização das gravações | **Fila única** (`_drenar`): nunca há duas gravações em voo; chaves são enviadas uma a uma |
| Várias edições rápidas | Coalescência: cada envio lê o valor MAIS RECENTE do `localStorage`; a pendência só é limpa se o carimbo enviado for o mesmo (edição nova durante o voo continua pendente) |
| Gravação antiga não sobrescreve a nova | Transação Firestore: se `__meta[chave]` é do mesmo aparelho e mais novo que o carimbo a enviar, a gravação é descartada (`superado`) |
| Controle de pendências | `chancelaria_dirty` = `{chave: carimbo}` persistente (sobrevive a recarregar/fechar) |
| Falha de conexão | Mantém pendente; retentativas com recuo exponencial (2 s … 60 s), ao voltar `online`, a cada 30 s e ao voltar à aba; tempo limite de 15 s por envio |
| Sem duplicações | Envio idempotente (valor + carimbo); documento e chave determinísticos |
| Conflito entre aparelhos | Se a nuvem mudou desde a última sincronização (`__meta.t > base`) **e** o valor difere: listas de registros com `id` são **mescladas por id** (vence o registro mais recente por `editadoEm/atualizadoEm/criadoEm/srs.em`); listas de textos viram união; demais valores vencem pelo carimbo mais recente. A versão descartada é guardada em `chancelaria_conflicts` (visível/baixável em *Configurações → Backup e segurança*) |
| Local mais novo que o remoto | Edições pendentes têm prioridade no login e no `pullFromCloud`; documentos antigos sem `__meta` são tratados como "desconhecidos" (o local pendente vence) |
| Indicadores | Chip na barra superior e painel: **Somente local · Enviando · Pendente (n) · Offline · Falha · Sincronizado** (não mostra "Sincronizado" enquanto houver pendência) |
| Editei no celular, abri no computador | Ao abrir, ao voltar à aba (>60 s) e ao voltar a conexão, `pullFromCloud` baixa as mudanças (sem interromper um campo em edição) |

### Limitações conhecidas (honestas)
1. **Relógios**: o "mais recente" usa o relógio de cada aparelho. Diferenças grandes (minutos) podem inverter o vencedor de
   valores simples. Listas com `id` usam o carimbo do registro, também de relógio.
2. **Exclusões em conflito**: ao mesclar listas por id, um registro excluído num aparelho pode **reaparecer** se o outro
   aparelho ainda o tinha. A cópia da versão descartada fica guardada. (Tombstones seriam a solução; ver "Fase 4".)
3. **Um documento só**: limite de ~1 MiB para tudo (abaixo).
4. Não há *listener* em tempo real: as mudanças de outros aparelhos chegam ao abrir/voltar à aba/voltar online.

## Limite de ~1 MiB do Firestore — avaliação e plano

**Situação:** todas as chaves (inclusive `biblio_docs`, com HTML e imagens em base64, e `flash_cards`) vão no MESMO documento.
Ao passar de ~1 MiB, **todas** as gravações falham (a pendência fica, o chip mostra "Falha"). Hoje o app mostra o tamanho
em *Configurações → Backup e segurança* e avisa acima de 800 KB. Nada é perdido: os dados continuam no aparelho e no backup.

**Estrutura alvo:** `chancelaria_users/{uid}/dados/{chave}` com `{ valor, t, d, v:1 }` — um documento por chave
(limite de 1 MiB **por chave**). Chaves que ainda possam estourar (`biblio_docs`, `flash_cards`) podem depois ser
divididas em `dados/{chave}/itens/{id}` (um documento por registro).

### Plano de migração gradual, sem perda (NÃO executado nesta rodada — motivo ao final)
| Fase | O que muda | Reversão |
|---|---|---|
| 0 (atual) | Documento único + `__meta` | — |
| 1 — backup | Antes de qualquer coisa: snapshot local + exportação JSON do estado; cópia do documento legado em `chancelaria_users/{uid}/backup/legado-AAAAMMDD` | Nada a desfazer |
| 2 — cópia | Para cada chave: criar `dados/{chave}` **somente se não existir ou se o `t` for mais antigo** (idempotente; id do documento = chave → sem duplicação). Progresso por chave em `__migracao = {estado:'copiando', feitas:[...]}`; interrompida? recomeça de onde parou | Apagar a subcoleção `dados` (o legado segue intacto) |
| 3 — validação | Ler os dois lados e comparar com `deepEqual` chave a chave; só então gravar `__estrutura: 2` | Não gravar a flag |
| 4 — dupla gravação | Clientes novos gravam nos dois lugares e leem `dados/*` quando `__estrutura == 2`, senão o legado | Voltar `__estrutura` para 1 |
| 5 — consolidação | Parar de gravar no legado após N semanas sem divergência; **manter** o documento legado como backup (nunca apagar automaticamente) | Reativar a dupla gravação |

**Compatibilidade:** versões antigas do app continuam lendo/gravando o documento legado; por isso a fase 4 (dupla gravação)
precisa ser publicada antes de a fase 5 existir. **Duplicações:** evitadas por id determinístico + comparação de `t`.

**Regras de segurança necessárias** (ver `infra/firestore.rules`, usada só no emulador): permitir
`read, write` em `chancelaria_users/{uid}` **e** em `chancelaria_users/{uid}/dados/{chave}` apenas quando
`request.auth.uid == uid`. As regras de PRODUÇÃO não estão neste repositório e **não foram alteradas**; hoje, se elas só
cobrem o documento `chancelaria_users/{uid}`, as gravações na subcoleção seriam negadas — é preciso você revisar e
publicar as regras (e validar no emulador com `npm run test:sync`) antes da fase 2.

**Por que não foi executada agora:** a migração depende de (a) atualizar as regras de produção — fora do que posso fazer
sem sua autorização e sem poder testar contra o projeto real — e (b) uma rodada própria de testes de interrupção/rollback
no emulador. Executar às cegas arriscaria justamente os dados que esta rodada procura proteger.
