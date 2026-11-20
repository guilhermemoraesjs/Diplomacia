# Simulados — formato dos dados e origem das provas

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `data/simulados/index.json` | Metadados leves das provas (id, ano, período, título, total, matérias, arquivo). |
| `data/simulados/questoes-index.json` | Metadados leves de **todas** as questões (id, prova, ano, matéria, tema, dificuldade). Alimenta filtros, desempenho por matéria e busca, sem baixar as provas. |
| `data/simulados/provas/{id}.json` | Conteúdo completo de uma prova, carregado sob demanda. |

## Formato v2 (provas CEBRASPE, a partir de 2025)

Nas provas do CACD cada item está **vinculado ao comando que o antecede** e, quando há, ao texto-base do bloco. Por isso o arquivo tem grupos:

```json
{
  "versao": 2,
  "prova": "2025-manha",
  "grupos": {
    "2025-manha-g01": {
      "disciplina": "Língua Portuguesa",
      "itens": [1, 7],
      "titulo": ["1888", "9 de janeiro"],
      "texto": ["parágrafo 1", "parágrafo 2"],
      "fonte": "Autor. Obra. Editora, ano.",
      "comando": "Julgue os itens que se seguem, relativos ao texto precedente."
    }
  },
  "questoes": [
    { "id": "2025-manha-q1", "numero": 1, "grupoId": "2025-manha-g01", "disciplina": "Língua Portuguesa",
      "enunciado": "…", "tipo": "certo-errado", "respostaCorreta": "C", "anulado": false }
  ]
}
```

- `texto`, `titulo` e `fonte` são opcionais (blocos como "Em relação ao governo Vargas, julgue…" não têm texto).
- `comando` existe em todo grupo. Em alguns blocos o item **só faz sentido com ele**: por exemplo, os itens 235 e 236 de Direito ("o repúdio ao terrorismo e ao racismo.") completam o comando "A Constituição Federal de 1988 prevê como princípio que rege…".
- Itens anulados: `anulado: true`, `respostaCorreta: null` e `justificativaBanca` (motivo oficial).
- Itens com gabarito alterado depois dos recursos: `respostaCorreta` é o **definitivo**, `gabaritoPreliminar` o anterior e `justificativaBanca` o motivo.
- `tema` fica como `"A classificar"` enquanto as questões não forem classificadas por assunto. A interface não exibe esse marcador.

O carregador (`simNormalizarProva` em `js/simulados.js`) aceita também o **formato v1**, um array simples de questões, usado pelas provas de 2019 e 2023 e gerado pelo Importador de Provas. Nesse caso não há bloco de texto nem comando.

## Provas de 2025 (1ª fase)

Extraídas do caderno oficial (CEBRASPE, Edital nº 1/2025) e do **Gabarito Oficial Definitivo**:

| Prova | Itens | Blocos (matéria impressa no caderno) |
|---|---|---|
| `2025-manha` | 1 a 120 | Língua Portuguesa (1–40), História do Brasil (41–70), História Mundial (71–96), Geografia (97–120) |
| `2025-tarde` | 121 a 240 | Língua Inglesa (121–148), Política Internacional (149–188), Economia (189–214), Direito (215–240) |

A numeração dos itens da tarde continua a da manhã, como no caderno e no gabarito.

### Como a extração foi verificada

1. **Gabarito:** os 240 itens conferem com a tabela oficial, incluindo os 7 anulados da manhã e os 9 da tarde.
2. **Texto:** cada item, texto-base, fonte e comando foi procurado como sequência contínua no fluxo de texto do PDF (`pdftotext -raw`). Nenhum ficou de fora.
3. **Completude:** tirando tudo o que foi extraído do texto bruto, sobrou só o preâmbulo de instruções da página 1.
4. O caderno não usa hifenização no fim de linha, então todos os hifens do texto são reais.

`tests/unit/simulados-dados.test.js` repete as verificações de gabarito, anulados, matérias por faixa, grupos e justificativas, e fixa os casos que estavam errados no arquivo antigo.

### O que mudou em relação ao arquivo anterior da manhã

O arquivo anterior não tinha texto-base, comando nem matéria, e **20 dos 120 itens divergiam do caderno**: referências como "(quarto período)" haviam sido cortadas, alguns itens estavam reescritos (33 a 35, 50 e 112) e o item 117 era, na verdade, o texto do comando do grupo seguinte. O gabarito e as anulações já estavam corretos.

## Publicação e cache

Os arquivos em `data/simulados/` são servidos com **rede primeiro** pelo Service Worker (`sw.js`), com o cache como plano B sem rede ou com erro do servidor. Assim, uma correção de prova chega já na primeira abertura depois da publicação. Os demais JSON de `data/` continuam com *stale-while-revalidate*.

## Adicionar uma nova prova

1. Gere `data/simulados/provas/{id}.json` (v2 se a prova tiver comandos/textos-base).
2. Acrescente a prova em `index.json` e suas questões em `questoes-index.json`.
3. Rode `npm run test:unit` e atualize a transcrição do gabarito no teste.

O Importador de Provas (área administrativa) ainda gera apenas o formato v1; os grupos de uma prova nova precisam ser montados à parte.
