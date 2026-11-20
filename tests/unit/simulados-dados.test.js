// Integridade dos DADOS das provas de Simulados (data/simulados). Roda com `npm run test:unit`, sem navegador.
// As provas de 2025 foram extraídas do caderno oficial (CEBRASPE, Edital nº 1/2025) e conferidas com o
// "Gabarito Oficial Definitivo". As strings abaixo são a transcrição desse gabarito (X = item anulado).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', '..', 'data', 'simulados');
const ler = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const GAB = {
  '2025-manha': 'CEEXECECEECCXCCECCEECEECCECEECCECCECEEECECECCCEECECECCEECCECCEXCECXCECEECCECECCEECCCCXCXCCEECCEXCCEECCCEECCCCCCEECCECECE',
  '2025-tarde': 'CEEECECCCCEECEEECCCEEECECCCECECCECECXCCCEEXXCECECCEEEXCEXEECXCCECXEECEECCCECEECCECCCEECCEEEXCEEEECEXCCEECEEEEECCEECEECCE'
};
const INI = { '2025-manha': 1, '2025-tarde': 121 };
const DISC = {   // matéria impressa no caderno antes de cada bloco de questões
  '2025-manha': [[1, 40, 'Língua Portuguesa'], [41, 70, 'História do Brasil'], [71, 96, 'História Mundial'], [97, 120, 'Geografia']],
  '2025-tarde': [[121, 148, 'Língua Inglesa'], [149, 188, 'Política Internacional'], [189, 214, 'Economia'], [215, 240, 'Direito']]
};
const ANULADOS = { '2025-manha': [4, 13, 63, 67, 86, 88, 96], '2025-tarde': [157, 163, 164, 174, 177, 181, 186, 212, 220] };

for (const id of ['2025-manha', '2025-tarde']) {
  const prova = ler(`provas/${id}.json`), qs = prova.questoes, gr = prova.grupos;

  test(`${id}: 120 itens numerados na sequência do caderno, com gabarito oficial definitivo`, () => {
    assert.equal(prova.versao, 2); assert.equal(qs.length, 120);
    qs.forEach((q, i) => { assert.equal(q.numero, INI[id] + i); assert.equal(q.id, `${id}-q${q.numero}`); assert.equal(q.tipo, 'certo-errado'); assert.ok(q.enunciado.length > 10, `item ${q.numero} sem enunciado`); });
    const obtido = qs.map(q => q.anulado ? 'X' : q.respostaCorreta).join('');
    assert.equal(obtido, GAB[id]);
    assert.deepEqual(qs.filter(q => q.anulado).map(q => q.numero), ANULADOS[id]);
    qs.filter(q => q.anulado).forEach(q => assert.equal(q.respostaCorreta, null));
  });

  test(`${id}: a matéria de cada item é a impressa no caderno (nenhum "A classificar")`, () => {
    for (const [a, b, nome] of DISC[id]) for (let n = a; n <= b; n++) assert.equal(qs[n - INI[id]].disciplina, nome, `item ${n}`);
    assert.ok(qs.every(q => q.disciplina !== 'A classificar'));
  });

  test(`${id}: todo item pertence a um grupo com comando; faixas dos grupos são contínuas e sem sobreposição`, () => {
    const vistos = new Set();
    for (const [gid, g] of Object.entries(gr)) {
      assert.ok(g.comando && g.comando.length > 8, `${gid} sem comando`);
      const itens = qs.filter(q => q.grupoId === gid).map(q => q.numero);
      assert.ok(itens.length > 0, `${gid} sem itens`);
      assert.deepEqual(g.itens, [itens[0], itens[itens.length - 1]]);
      assert.deepEqual(itens, Array.from({ length: itens.length }, (_, k) => itens[0] + k), `${gid} descontínuo`);
      itens.forEach(n => { assert.ok(!vistos.has(n)); vistos.add(n); assert.equal(qs[n - INI[id]].disciplina, g.disciplina); });
    }
    assert.equal(vistos.size, 120);
    qs.forEach(q => assert.ok(gr[q.grupoId], `item ${q.numero}: grupo inexistente`));
  });

  test(`${id}: itens anulados e alterados trazem a justificativa oficial da banca`, () => {
    qs.filter(q => q.anulado).forEach(q => assert.ok(q.justificativaBanca && q.justificativaBanca.length > 20, `item ${q.numero}`));
    qs.filter(q => q.gabaritoPreliminar).forEach(q => assert.notEqual(q.gabaritoPreliminar, q.respostaCorreta));
  });
}

test('Português e Inglês: todo item tem o texto-base do seu grupo (as questões dependem dele)', () => {
  for (const [id, a, b] of [['2025-manha', 1, 40], ['2025-tarde', 121, 148]]) {
    const { questoes, grupos } = ler(`provas/${id}.json`);
    for (let n = a; n <= b; n++) { const g = grupos[questoes[n - INI[id]].grupoId]; assert.ok(g.texto && g.texto.length && g.fonte, `item ${n} sem texto-base/fonte`); }
  }
});

test('regressões de extração: itens que estavam errados ou incompletos no arquivo antigo', () => {
  const m = ler('provas/2025-manha.json'), t = ler('provas/2025-tarde.json');
  const q = n => (n < 121 ? m : t).questoes[n - INI[n < 121 ? '2025-manha' : '2025-tarde']];
  // o item 117 era, no arquivo antigo, o texto do COMANDO do grupo seguinte (Mackinder)
  assert.match(q(117).enunciado, /^Os condomínios fechados/);
  assert.match(m.grupos[q(118).grupoId].texto[0], /^A teoria geopolítica do poder continental/);
  assert.equal(m.grupos[q(118).grupoId].comando, 'Acerca dessa teoria, julgue os seguintes itens.');
  // referências de posição ("terceiro período") e trechos finais haviam sido cortados
  assert.match(q(22).enunciado, /segundo período do texto\.$/);
  assert.match(q(33).enunciado, /^No trecho “Tende-se a supor/);
  assert.match(q(112).enunciado, /amazônia \(rica biodiversidade/);
  assert.match(q(39).enunciado, /\(décimo quinto período\)/);
  // item que completa o comando (só faz sentido com ele)
  assert.equal(q(235).enunciado, 'o repúdio ao terrorismo e ao racismo.');
  assert.match(t.grupos[q(235).grupoId].comando, /^A Constituição Federal de 1988 prevê como princípio que rege/);
  // endereço de site entre <> preservado (a tela escapa; sem isso viraria tag)
  assert.match(t.grupos[q(121).grupoId].fonte, /<www\.theguardian\.com>/);
  // gabarito alterado após recursos
  assert.equal(q(102).respostaCorreta, 'C'); assert.equal(q(102).gabaritoPreliminar, 'E');
  assert.equal(q(122).respostaCorreta, 'E'); assert.equal(q(122).gabaritoPreliminar, 'C');
});

test('índices: provas e questões consistentes com os arquivos; provas antigas continuam no formato v1', () => {
  const idx = ler('index.json'), qi = ler('questoes-index.json');
  assert.deepEqual(idx.map(p => p.id), ['2019', '2023', '2025-manha', '2025-tarde']);
  for (const p of idx) {
    const dados = ler(`provas/${p.arquivo}`), lista = Array.isArray(dados) ? dados : dados.questoes;
    assert.equal(p.totalQuestoes, lista.length, p.id);
    const doIndice = qi.filter(x => x.provaId === p.id);
    assert.deepEqual(doIndice.map(x => x.id), lista.map(x => x.id), `ids em questoes-index (${p.id})`);
    doIndice.forEach((x, i) => assert.equal(x.disciplina, lista[i].disciplina));
    assert.deepEqual(p.disciplinas, [...new Set(lista.map(x => x.disciplina))], `disciplinas em index.json (${p.id})`);
  }
  assert.ok(Array.isArray(ler('provas/2019.json')) && Array.isArray(ler('provas/2023.json')));
  assert.equal(new Set(qi.map(x => x.id)).size, qi.length, 'ids duplicados');
});
