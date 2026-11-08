# Testes

## Unitários e consistência (Node 18+, sem dependências)
```bash
npm test      # node --test tests/*.test.js
```
- `tests/srs.test.js` — motor de revisão (ordem dos intervalos, crescimento, erro, retenção-alvo, teto, conversão de cartões antigos),
  datas locais (virada de dia), parse de tempo, escape de HTML.
- `tests/versao.test.js` — versão sincronizada (version.json × js/version.js × sw.js × index.html), SW sem `skipWaiting` automático,
  ordem dos scripts, cabeçalhos `no-store` do `vercel.json`.

## E2E (Playwright + Chromium; Firebase substituído por um stub em memória)
```bash
python3 -m http.server 8123 &           # na raiz do projeto
cd tests/e2e
node fluxos.js          # navegação, questões, cronograma, revisão, discursivas, atualidades/KB/país, Biblioteca, tema
node sincronizacao.js   # nuvem↔local, offline, pendências
node atualizacao.js     # sistema de atualização (copia o projeto p/ pasta temporária e publica v1.1.0/v1.2.0)
node mobile.js          # sem rolagem horizontal em 390 px, 320 px e 820 px; alvos de toque
```

## Resultados desta entrega
| Suíte | Resultado |
|---|---|
| `npm test` | 15/15 |
| `fluxos.js` | 65/65 |
| `sincronizacao.js` | 7/7 |
| `atualizacao.js` | 30/30 |
| `mobile.js` | 63/63 |

## O que NÃO foi validado (depende de ambiente real)
- **Firebase real** (login Google, Firestore, regras de segurança): os testes usam stub. Teste com sua conta após publicar.
- **iPhone real / Safari / PWA instalado:** só emulação de viewport em Chromium. O comportamento do Service Worker no iOS
  (cache agressivo, atualização em PWA) precisa ser conferido em aparelho; o botão “Forçar atualização” existe para esse caso.
- **Hospedagem real:** servidor local de teste; confirme em produção que `/version.json` e `/sw.js` retornam `no-store`.
- **Hub Linguístico (Palavras)** é um iframe de outro projeto: não testado.
- Telas legadas (Flashcards, Simulados, Países/mapa, editor rico da Biblioteca, importador) foram verificadas apenas por
  abertura sem erro de JavaScript e sem rolagem horizontal, não funcionalidade por funcionalidade.
- Emojis ainda presentes na interface herdada: apenas dentro de dados do usuário e alguns textos internos do editor/simulados.
