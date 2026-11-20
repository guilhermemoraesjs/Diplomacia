// Simulados: provas CACD 2025 (manhã e tarde) com texto de apoio e comando de cada grupo, matéria impressa no caderno,
// itens anulados/alterados, favoritos e flashcard de erro, persistência e compatibilidade com as provas antigas (formato v1).
const H = require('./helpers'); const { check } = H;
(async () => {
  await H.emuOuSair(); const d = await H.abrir(), p = d.p, ev = (f, a) => p.evaluate(f, a);
  const iniciar = (provaId, modo) => ev(async ([id, m]) => { await iniciarSessaoComIds(simuladosQuestoesIndex.filter(q => q.provaId === id).map(q => q.id), m || 'estudo', false, 'Teste ' + id); }, [provaId, modo]);
  const ir = async n => { await ev(num => irParaQuestao(simuladoSessao.questoes.findIndex(q => q.numero === num)), n); await H.sleep(150); };   // n = número do item no caderno (1..240)
  const cmd = () => p.textContent('.sim-comando p');
  const cab = () => p.textContent('.sim-q-cab');

  console.log('\n[Lista de provas]');
  await H.ir(p, 'simulados'); await H.esperar(p, () => simuladosIndexCarregado === true); await H.sleep(300);
  check(await ev(() => simuladosProvasIndex.map(x => x.id).join()) === '2019,2023,2025-manha,2025-tarde', 'quatro provas cadastradas (2019, 2023, 2025 manhã e tarde)');
  const cards = await p.locator('#simuladosProvasDisponiveis .dash-prova-card').allTextContents();
  check(cards.length === 4 && cards.some(t => /2025\s*manhã/.test(t)) && cards.some(t => /2025\s*tarde/.test(t)), 'cartões distinguem manhã e tarde de 2025', cards.join(' | '));
  check(await ev(() => [...new Set(simuladosQuestoesIndex.filter(q => q.ano === 2025).map(q => q.disciplina))].join()) === 'Língua Portuguesa,História do Brasil,História Mundial,Geografia,Língua Inglesa,Política Internacional,Economia,Direito', 'índice traz as 8 matérias do caderno (nada "A classificar")');
  check(!(await p.textContent('#simuladosTemasCobrados')).includes('A classificar'), '"Temas mais cobrados" não lista o marcador "A classificar"');

  console.log('\n[Manhã: texto de apoio + comando + item]');
  await iniciar('2025-manha'); await H.sleep(500);
  check((await cab()).trim() === 'Língua Portuguesa · Item 1', 'cabeçalho mostra a matéria e o número do item', await cab());
  const ctx = await p.textContent('.sim-ctx-col');
  check(ctx.includes('Bem antes que tentassem me convencer') && ctx.includes('Contardo Calligaris') && ctx.includes('itens 1 a 7'), 'item 1 mostra o texto-base completo, a fonte e a faixa de itens');
  check((await cmd()).includes('Julgue os itens que se seguem, relativos ao texto precedente.'), 'comando do grupo aparece acima do item');
  check((await p.textContent('.sim-enunciado')).startsWith('No quarto período, a referência às viagens'), 'enunciado do item é o do caderno oficial');
  check(await p.locator('.sim-alternativas .sim-alt').count() === 2, 'item Certo/Errado com duas opções');
  await p.click('.sim-alt >> text=Certo'); await H.sleep(250);
  check(await ev(() => simuladosProgresso.respondidas['2025-manha-q1'].correta) === true && (await p.textContent('.sim-resultado.ok')).includes('Você acertou'), 'gabarito oficial do item 1 (C) confere e aparece "Você acertou"');
  await p.click('.sim-ctx-col .sim-ctx-head button'); await H.sleep(200);
  check(await p.locator('.sim-ctx-corpo').count() === 0 && (await p.textContent('.sim-ctx-head button')).includes('Mostrar texto'), '"Recolher" esconde o texto');
  await ir(2); check(await p.locator('.sim-ctx-corpo').count() === 0, 'o texto continua recolhido ao mudar de item (preferência da sessão)');
  await p.click('.sim-ctx-col .sim-ctx-head button'); await H.sleep(200);
  check((await p.textContent('.sim-ctx-corpo')).includes('Bem antes que'), '"Mostrar texto" reabre');
  await ir(8); const c8 = await p.textContent('.sim-ctx-col');
  check(c8.includes('Carlos Alvarez Maia') && !c8.includes('Calligaris') && c8.includes('itens 8 a 14') && (await cmd()).startsWith('Em relação às ideias'), 'item 8 troca para o 2º texto e o seu comando');
  await ir(15); check((await p.textContent('.sim-ctx-col')).includes('1888'), 'título do texto (1888 / 9 de janeiro) é mostrado');
  await ir(56);
  check(await p.locator('.sim-ctx-col').count() === 0 && (await cab()).startsWith('História do Brasil · Item 56') && (await cmd()).includes('Em relação ao governo Vargas (1930-1945)'), 'matéria sem texto-base: mostra só o comando e a matéria do bloco');
  await ir(41); const c41 = await p.textContent('.sim-ctx-col');
  check(c41.includes('A independência do Brasil, formalizada em 1822') && (await cmd()).startsWith('Tendo as informações precedentes'), 'História do Brasil 41: contexto e comando separados (estavam fundidos no PDF)');
  await ir(117); check((await p.textContent('.sim-enunciado')).startsWith('Os condomínios fechados') && (await cmd()).includes('dinâmicas intraurbanas'), 'item 117 correto (antes era o comando do grupo seguinte)');
  await ir(118); check((await p.textContent('.sim-ctx-col')).includes('Halford J. Mackinder') && (await cmd()).includes('Acerca dessa teoria'), 'item 118: texto de apoio e comando do bloco Mackinder');

  console.log('\n[Itens anulados e gabarito alterado]');
  await ir(4);
  check(await p.locator('.sim-alt[disabled]').count() === 2, 'item anulado: botões desabilitados');
  const an = await p.textContent('.sim-explicacao');
  check(an.includes('Item anulado') && an.includes('extrapolam o que consta no texto'), 'item 4: mostra "anulado" e a justificativa oficial da banca');
  await ev(() => { simuladosProgresso.respondidas = {}; }); await ir(102);
  check((await p.textContent('.sim-explicacao') || '').includes('Gabarito alterado pela banca') || await p.locator('.sim-explicacao').count() === 1, 'item 102: nota de gabarito alterado');
  const nota = await p.textContent('.sim-explicacao'); check(/de Errado \(preliminar\) para Certo \(definitivo\)/.test(nota) && nota.includes('Ucrânia'), 'item 102: de Errado (preliminar) para Certo (definitivo), com a justificativa', nota);
  await p.click('.sim-alt >> text=Certo'); await H.sleep(200); check(await ev(() => simuladosProgresso.respondidas['2025-manha-q102'].correta) === true, 'item 102: vale o gabarito definitivo (C)');

  console.log('\n[Modo Estudo: resultado claro de acerto e erro]');
  await iniciar('2025-manha'); await ev(() => { simuladosProgresso.respondidas = {}; }); await ir(2); await H.sleep(150);   // gabarito oficial do item 2: Errado
  check(await p.locator('.sim-resultado').count() === 0 && await p.locator('.sim-tag').count() === 0, 'antes de responder não há resultado nem marcadores');
  await p.click('.sim-alt >> text=Certo'); await H.sleep(250);                                                    // resposta errada
  const rb = await p.textContent('.sim-resultado.bad');
  check(rb.includes('Você errou') && rb.includes('Sua resposta: Certo') && rb.includes('Gabarito oficial: Errado'), 'erro: painel "Você errou" com a sua resposta e o gabarito oficial', rb);
  check((await p.textContent('.sim-alt.incorreta .sim-tag.bad')) === 'Sua resposta' && (await p.textContent('.sim-alt.correta .sim-tag.ok')) === 'Gabarito', 'alternativas marcadas: errada = "Sua resposta" (✕), certa = "Gabarito" (✓)');
  check(await p.locator('.sim-alt.incorreta .sim-alt-l svg').count() === 1 && await p.locator('.sim-alt.correta .sim-alt-l svg').count() === 1, 'o resultado também tem ícones (não depende só da cor)');
  check(await p.locator('.sim-alt:disabled').count() === 2, 'depois do feedback as alternativas ficam travadas');
  await p.click('.sim-alt >> text=Errado', { force: true }).catch(() => {}); await H.sleep(150);
  check(await ev(() => simuladosProgresso.respondidas['2025-manha-q2'].escolha) === 'C', 'tentar trocar a resposta não altera o resultado');
  const plac = await p.textContent('.sim-placar'); check(/0\s*acertos/.test(plac) && /1\s*erros/.test(plac), 'placar da sessão: 0 acertos · 1 erro', plac);
  check(await p.locator('.sim-nav-item.errou[aria-label*="você errou"]').count() === 1 && await p.locator('.sim-legenda').count() === 1, 'grade: item errado em vermelho, com legenda');
  await p.click('text=Refazer este item'); await H.sleep(200);
  check(await ev(() => simuladosProgresso.respondidas['2025-manha-q2'] === undefined) && await p.locator('.sim-resultado').count() === 0 && await p.locator('.sim-alt:disabled').count() === 0, '"Refazer este item" limpa o resultado e libera as alternativas');
  await p.click('.sim-alt >> text=Errado'); await H.sleep(250);                                                   // resposta certa
  const ra = await p.textContent('.sim-resultado.ok');
  check(ra.includes('Você acertou!') && ra.includes('Sua resposta: Errado') && await p.locator('.sim-alt.correta .sim-tag').count() === 2 && await p.locator('.sim-nav-item.acertou').count() === 1, 'acerto: painel "Você acertou!", alternativa com "Gabarito" + "Sua resposta" e item verde na grade', ra);
  check(/1\s*acertos/.test(await p.textContent('.sim-placar')), 'placar: 1 acerto');
  await iniciar('2025-manha', 'simulado'); await ev(() => { simuladosProgresso.respondidas = {}; }); await ir(1); await H.sleep(150);
  await p.click('.sim-alt >> text=Errado'); await H.sleep(200);
  check(await p.locator('.sim-resultado').count() === 0 && await p.locator('.sim-placar').count() === 0 && await p.locator('.sim-alt.selecionada').count() === 1 && await p.locator('.sim-tag').count() === 0 && await p.locator('.sim-legenda').count() === 0, 'modo "Simulado (só no final)": nenhum feedback, só a seleção');
  await p.click('.sim-alt >> text=Certo'); await H.sleep(200);
  check(await ev(() => simuladosProgresso.respondidas['2025-manha-q1'].escolha) === 'C' && await ev(() => simuladosProgresso.respondidas['2025-manha-q1'].correta) === true, 'no modo "só no final" ainda dá para trocar a resposta; o resultado vale a resposta final');

  console.log('\n[Tarde: Inglês, Política Internacional, Economia, Direito]');
  await iniciar('2025-tarde'); await H.sleep(500);
  check((await cab()).trim() === 'Língua Inglesa · Item 121' && (await p.textContent('.sim-ctx-col')).includes('A lack of women at decision-making tables'), 'tarde começa em Língua Inglesa, item 121, com o texto em inglês');
  check((await p.textContent('.sim-ctx-col')).includes('<www.theguardian.com>'), 'endereço entre <> da fonte aparece (texto escapado, não vira tag)');
  check((await cmd()).includes('Based on the previous text, judge the following items.'), 'comando em inglês');
  await ir(149); check((await cab()).startsWith('Política Internacional · Item 149') && await p.locator('.sim-ctx-col').count() === 1 && (await p.textContent('.sim-ctx-col')).includes('As relações internacionais devem ser consideradas'), 'Política Internacional 149: texto de apoio + comando separado');
  await ir(235);
  check((await cab()).startsWith('Direito · Item 235') && (await cmd()).includes('A Constituição Federal de 1988 prevê como princípio') && (await p.textContent('.sim-enunciado')).trim() === 'o repúdio ao terrorismo e ao racismo.', 'item 235 só faz sentido com o comando: os dois aparecem');
  await ir(122); check(/de Certo \(preliminar\) para Errado \(definitivo\)/.test(await p.textContent('.sim-explicacao') || ''), 'item 122: gabarito alterado de C para E');
  await ir(157); check((await p.textContent('.sim-explicacao') || '').includes('Item anulado'), 'item 157 (tarde) anulado');

  console.log('\n[Navegação, favoritos e flashcard do erro]');
  await ir(121); await p.click('.sim-alt >> text=Errado'); await H.sleep(250);   // gabarito do item 121 é C → erro
  check(await ev(() => simuladosProgresso.respondidas['2025-tarde-q121'].correta) === false, 'resposta errada registrada (gabarito oficial do 121 é C)');
  await p.click('text=Criar flashcard do erro'); await H.sleep(400);
  const fc = await ev(() => flashCards.filter(c => c.origemRefId === '2025-tarde-q121').map(c => ({ f: c.frente, v: c.verso, d: c.disciplina, t: c.tema, fonte: c.fonte })));
  check(fc.length === 1 && fc[0].f.includes('Based on the previous text') && fc[0].f.includes('We kept looking at the Band-aid') && fc[0].v.includes('Resposta correta: C') && fc[0].d === 'Língua Inglesa' && fc[0].t === '' && /item 121/.test(fc[0].fonte), 'flashcard do erro nasce com comando + enunciado na frente (antes saía vazio)', JSON.stringify(fc));
  await p.click('.sim-icon-btn[title="Favoritar"]'); await H.sleep(150);
  check(await ev(() => simuladosProgresso.favoritas.includes('2025-tarde-q121')), 'favoritar item');
  check(await p.locator('.sim-nav-grid.grande').count() === 1 && await p.locator('.sim-nav-item').count() === 120, 'grade de 120 itens usa área rolável compacta');
  const larg = await ev(() => Math.min(...[...document.querySelectorAll('.sim-nav-item')].map(b => b.getBoundingClientRect().width)));
  check(larg >= 30, 'botões da grade comportam números de 3 dígitos', larg);
  await ir(200); check(await ev(() => { const g = document.querySelector('.sim-nav-grid.grande'), a = g.querySelector('.atual'); const gr = g.getBoundingClientRect(), ar = a.getBoundingClientRect(); return ar.top >= gr.top - 1 && ar.bottom <= gr.bottom + 1; }), 'item atual fica visível dentro da grade rolável');

  console.log('\n[Persistência e modos]');
  await H.recarregar(p); await H.ir(p, 'simulados'); await H.esperar(p, () => simuladosIndexCarregado === true);
  check(await ev(() => !!simuladosProgresso.respondidas['2025-tarde-q121'] && simuladosProgresso.favoritas.includes('2025-tarde-q121') && simuladosProgresso.respondidas['2025-manha-q1'].correta === true), 'respostas e favoritos persistem após recarregar');
  await ev(async () => { const ids = simuladosQuestoesIndex.filter(q => q.disciplina === 'Geografia').map(q => q.id); await iniciarSessaoComIds(ids, 'estudo', false, 'Geografia'); }); await H.sleep(400);
  check(await ev(() => { const qs = simuladoSessao.questoes, esperado = simuladosQuestoesIndex.filter(q => q.disciplina === 'Geografia').length; return qs.length === esperado && qs.filter(q => q.ano === 2025).length === 24 && qs.filter(q => q.ano === 2025).every(q => q.grupo && q.grupo.comando) && qs.filter(q => q.ano !== 2025).every(q => !q.grupo); }), 'sessão "Por disciplina" (Geografia): os 24 itens de 2025 vêm com o seu comando e os de 2019/2023 seguem sem'); 
  await ev(async () => { await iniciarSessaoComIds(simuladosQuestoesIndex.filter(q => q.provaId === '2019').map(q => q.id), 'estudo', false, '2019'); }); await H.sleep(400);
  check(await p.locator('.sim-ctx-col, .sim-comando').count() === 0 && (await p.textContent('.sim-enunciado')).includes('Estado Novo') && await p.locator('.sim-alt').count() === 5, 'provas antigas (formato v1, múltipla escolha) continuam iguais, sem bloco de texto/comando');

  console.log('\n[Celular 390×844]');
  await p.setViewportSize({ width: 390, height: 844 }); await H.sleep(300);
  await iniciar('2025-manha'); await H.sleep(500);
  check(await ev(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sem rolagem horizontal com o texto de apoio');
  const emp = await ev(() => { const c = document.querySelector('.sim-ctx-col').getBoundingClientRect(), i = document.querySelector('.sim-item-col').getBoundingClientRect(); return { texto: c.top < i.top, bt: document.querySelector('.sim-ctx-head button').getBoundingClientRect().height }; });
  check(emp.texto && emp.bt >= 38, 'no celular o texto vem antes do item e o botão Recolher é tocável', JSON.stringify(emp));
  await ir(5); await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.click('.btn:has-text("Próxima")'); await H.sleep(300);
  check((await cab()).includes('Item 6') && await ev(() => { const w = document.getElementById('simuladosProvaWrap').getBoundingClientRect(); return w.top >= -2 && w.top < 120; }), 'ao avançar no celular a tela volta ao início do bloco da prova');
  check(d.erros.length === 0, 'nenhum erro de JavaScript', d.erros.join(' | '));
  await d.b.close(); process.exit(H.resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
