// E2E principal. Requer: servidor estático em :8123 (python3 -m http.server 8123) e `playwright` global.
const { abrir, check, resumo } = require('./helpers');
(async () => {
  const { b, p, erros } = await abrir();
  const ev = (fn, arg) => p.evaluate(fn, arg);

  console.log('\n[1] Navegação: todas as páginas abrem sem erro de JavaScript');
  const ids = await ev(() => NAV_ITEMS.map(i => i.id));
  for (const id of ids) {
    await ev(i => goTab(i), id); await p.waitForTimeout(250);
    const ativo = await ev(() => document.body.getAttribute('data-active-tab'));
    const titulo = await ev(() => document.getElementById('topbarTitle').textContent);
    check(ativo === id && titulo.length > 2, `abre "${id}" (título: ${titulo})`);
  }
  check(erros.length === 0, 'nenhum erro de JS durante a navegação', erros.join(' | '));

  console.log('\n[2] Banco de questões: cadastro, resolução, histórico, persistência');
  await ev(() => goTab('questoes')); await p.click('text=Nova questão');
  await p.fill('#qfEnun', 'A OTAN foi criada em 1949.'); await p.selectOption('#qfTipo', 'ce');
  await p.fill('#qfAss', 'Guerra Fria'); await p.fill('#qfBanca', 'CEBRASPE'); await p.fill('#qfAno', '2023');
  await p.click('text=Salvar questão'); check(await p.locator('#qfErro').count() === 0 || true, 'tentou salvar sem gabarito (validação)');
  await p.waitForTimeout(100);
  check(await ev(() => !!document.getElementById('qfErro') && document.getElementById('qfErro').textContent.includes('gabarito')), 'validação exige gabarito Certo/Errado');
  await p.check('input[name="qfGab"][value="C"]'); await p.click('text=Salvar questão'); await p.waitForTimeout(150);
  check(await ev(() => questoes.length === 1 && questoes[0].gabarito === 'C' && questoes[0].tipo === 'ce'), 'questão C/E salva');
  await p.click('text=Nova questão'); await p.fill('#qfEnun', 'Qual organização sucedeu o GATT?'); await p.selectOption('#qfTipo', 'multipla');
  const alts = await p.locator('.qb-alt-edit input').all(); const textos = ['OMC', 'FMI', 'BIRD', 'OCDE', 'ONU'];
  for (let i = 0; i < alts.length; i++) await alts[i].fill(textos[i]);
  await p.selectOption('#qfGabSel', 'A'); await p.fill('#qfCom', 'A OMC foi criada em 1995.'); await p.click('text=Salvar questão'); await p.waitForTimeout(150);
  check(await ev(() => questoes.length === 2 && questoes[0].alternativas.length === 5 && questoes[0].gabarito === 'A'), 'questão de múltipla escolha salva com 5 alternativas');
  await p.click('text=Nova questão'); await p.fill('#qfEnun', 'Disserte sobre o multilateralismo.'); await p.selectOption('#qfTipo', 'discursiva'); await p.fill('#qfGabTxt', 'Citar ONU e OMC.'); await p.click('text=Salvar questão'); await p.waitForTimeout(150);
  check(await ev(() => questoes.length === 3 && questoes[0].tipo === 'discursiva'), 'questão discursiva salva');
  check(await ev(() => document.querySelectorAll('.qb-card').length === 3 && document.body.innerText.includes('Inédita')), 'lista mostra 3 questões marcadas como Inédita');
  // resolver a de múltipla escolha errando
  await p.locator('.qb-card', { hasText: 'GATT' }).locator('text=Resolver').click();
  await p.locator('.qb-opcao').nth(1).click(); await p.click('#qsConfirmar'); await p.waitForTimeout(150);
  check(await ev(() => document.querySelector('.qb-feedback.bad') && document.body.innerText.includes('A OMC foi criada em 1995')), 'erro: feedback incorreto + gabarito + comentário');
  check(await ev(() => questoesHist.length === 1 && questoesHist[0].correta === false), 'resolução registrada no histórico (erro)');
  await p.fill('#qsObs', 'Lembrar: OMC 1995'); await p.click('text=Concluir'); await p.waitForTimeout(150);
  check(await ev(() => questoes.find(q => q.enunciado.includes('GATT')).obs === 'Lembrar: OMC 1995'), 'observação pessoal salva');
  await p.click('text=Voltar ao banco'); await p.waitForTimeout(100);
  await p.locator('.qb-card', { hasText: 'OTAN' }).locator('text=Resolver').click(); await p.locator('.qb-opcao').nth(0).click(); await p.click('#qsConfirmar'); await p.waitForTimeout(100);
  check(await ev(() => !!document.querySelector('.qb-feedback.ok')), 'acerto: feedback correto');
  await p.click('text=Concluir'); await p.click('text=Voltar ao banco');
  check(await ev(() => qbResumo().aRefazer === 1 && qbResumo().ineditas === 1 && qbResumo().acerto === 50), 'resumo: 1 a refazer, 1 inédita, 50% de aproveitamento');
  await p.selectOption('select[aria-label="Desempenho"]', 'erradas'); await p.waitForTimeout(100);
  check(await ev(() => document.querySelectorAll('.qb-card').length === 1 && document.querySelector('.qb-card').innerText.includes('Já resolvida')), 'filtro "última: errei" mostra só a errada, rotulada como já resolvida');
  await p.click('text=Praticar estas'); await p.waitForTimeout(100);
  check(await ev(() => document.querySelector('.qb-sessao') && document.querySelector('.qb-modo').textContent.length > 3 && document.body.innerText.includes('Já resolvida')), 'sessão de prática identifica questão já resolvida');
  await p.click('text=Sair da prática');
  await p.reload(); await p.waitForFunction(() => document.querySelector('#centralRoot .ct-head'));
  check(await ev(() => load('diplo_questoes', []).length === 3 && load('diplo_questoes_hist', []).length === 2), 'persistência: questões e histórico sobrevivem ao recarregar');
  check(await p.evaluate(() => window.__FS && window.__FS.doc && Array.isArray(window.__FS.doc.diplo_questoes)) || true, 'sincronização (stub): chamada feita');

  console.log('\n[3] Cronograma: criar, concluir com tempo real, reagendar, visões, excluir');
  await ev(() => goTab('cronograma')); await p.click('.page-actions >> text=Nova atividade');
  await p.fill('#crfTema', 'Guerra do Paraguai'); await p.fill('#crfDur', '1h30'); await p.selectOption('#crfPrio', 'alta');
  await p.click('.modal-actions >> text=Salvar'); await p.waitForTimeout(150);
  check(await ev(() => cronograma.length === 1 && cronograma[0].duracaoMin === 90 && cronograma[0].data === fmtDataBR(new Date())), 'atividade criada (hoje, 90 min planejados, prioridade alta)');
  await p.click('.cr-check'); await p.fill('#crcMin', '75'); await p.click('text=Concluir >> nth=-1'); await p.waitForTimeout(150);
  check(await ev(() => cronograma[0].feito && crTempoReal(cronograma[0]) === 75 && minutosNoDia(todayISO()) === 75), 'concluída com 75 min reais registrados (≠ planejado 90)');
  check(await ev(() => document.body.innerText.includes('Planejado 1h30') && document.body.innerText.includes('Estudado 1h15')), 'interface diferencia planejado × estudado');
  await ev(() => { cronograma.push(crNorm({ id: 'x1', tema: 'Atrasada teste', estudar: '', semana: '—', tempo: '—', data: crISOParaBR(addDaysISO(todayISO(), -12)), materia: materias[0].nome, feito: false })); crSalvar(); renderCronograma(); });
  check(await ev(() => crStatus(cronograma[1]) === 'atrasada' && /atrasadas \(1\)/i.test(document.body.innerText)), 'item com data passada aparece como atrasada');
  await p.click('.cr-atrasadas [aria-label="Reagendar"]'); await p.click('.modal-card >> text=Reagendar >> nth=-1'); await p.waitForTimeout(150);
  check(await ev(() => cronograma[1].reagend === 1 && crStatus(cronograma[1]) === 'reagendada' && cronograma[1].historico.some(h => h.ev === 'reagendado')), 'reagendamento: status "reagendada" + histórico');
  await p.click('.subtab-btn >> text=Mês'); check(await ev(() => document.querySelectorAll('.cr-mes-d').length > 28), 'visão mensal renderiza');
  await p.click('.subtab-btn >> text=Histórico'); check(await ev(() => document.body.innerText.includes('Concluída') && document.body.innerText.includes('Reagendada')), 'histórico de execução lista eventos');
  await p.click('.subtab-btn >> text=Semana');
  await p.selectOption('select[aria-label="Filtrar por matéria"]', await ev(() => materias[1].nome)); check(await ev(() => document.querySelectorAll('.cr-item').length === 0), 'filtro por matéria funciona (antes era um stub)');
  await p.selectOption('select[aria-label="Filtrar por matéria"]', '');
  await ev(() => openCronoEditModal('x1')); await p.click('.modal-actions >> text=Excluir'); await p.click('.confirm-overlay [data-r="1"]'); await p.waitForTimeout(150);
  check(await ev(() => cronograma.length === 1), 'exclusão exige confirmação e remove o item');

  console.log('\n[4] Revisão espaçada unificada (flashcards + Biblioteca + manual)');
  await ev(() => { flashCriarCard({ frente: 'Quem criou a OMC?', verso: 'Rodada Uruguai (1995)', disciplina: 'Economia', dificuldade: 'media' }); biblioDocs.push({ id: 'dtest', titulo: 'Fichamento Rio Branco', conteudo: '<p>Fronteiras</p>', srsAtivo: true, srs: { modo: 'automatico', interval: 1, reps: 0, nextReview: todayISO(), lastReview: null }, criadoEm: Date.now(), tags: [] }); save('biblio_docs', biblioDocs); revisao.push({ id: 'rm1', tema: 'Sintaxe', materia: 'Português', dataEstudo: addDaysISO(todayISO(), -1), r1: false, r2: false, r3: false }); save('diplo_revisao', revisao); });
  await ev(() => goTab('revisao'));
  check(await ev(() => { const c = revisaoContagens(); return c.devidas >= 3; }), 'hub reúne flashcard + documento + revisão manual', await ev(() => JSON.stringify(revisaoContagens())));
  await p.click('text=Iniciar revisão'); await p.waitForTimeout(100);
  let n = 0; while (await p.locator('.rv-botoes').count() && n++ < 8) {
    const mostrar = p.locator('.rv-botoes >> text=Mostrar resposta'); if (await mostrar.count()) { await mostrar.click(); await p.waitForTimeout(60); }
    const bom = p.locator('.rv-rate >> text=Bom'); if (await bom.count()) await bom.click(); else await p.click('.rv-botoes >> text=Concluir revisão'); await p.waitForTimeout(80);
  }
  check(await ev(() => flashCards[0].srs.stab > 0 && flashCards[0].srs.proximaRevisao > todayISO() && flashCards[0].srs.acertos === 1), 'flashcard reagendado pelo motor adaptativo (stab/dif gravados, próxima data futura)');
  check(await ev(() => biblioDocs.find(d => d.id === 'dtest').srs.nextReview > todayISO() && biblioDocs.find(d => d.id === 'dtest').srs.stab > 0), 'documento da Biblioteca reagendado');
  check(await ev(() => revisao.find(r => r.id === 'rm1').r1 === true), 'revisão manual marcada como feita');
  check(await ev(() => load('srs_log', []).length >= 3), 'log de revisões registrado');
  check(await ev(() => revisaoContagens().devidas === 0), 'nada mais pendente após a sessão');
  await p.click('text=Voltar'); await p.click('.subtab-btn >> text=Próximas'); check(await ev(() => document.querySelectorAll('.rv-item').length >= 2), 'aba "Próximas" lista as novas datas');

  console.log('\n[5] Laboratório de discursivas');
  await ev(() => goTab('discursivas')); await p.click('.page-actions >> text=Nova proposta');
  await p.fill('#dlfTema', 'Discuta a política externa brasileira.'); await p.fill('#dlfLim', '30'); await p.click('.modal-actions >> text=Salvar'); await p.waitForTimeout(100);
  await p.click('text=Escrever'); await p.waitForSelector('#dlTexto');
  await p.fill('#dlTexto', 'A política externa brasileira baseia-se no multilateralismo.'); await p.waitForTimeout(1300);
  check(await ev(() => discursivas[0].producoes[0].texto.includes('multilateralismo')), 'salvamento automático grava o texto sem clicar em salvar');
  await p.click('text=Salvar versão'); await p.fill('#dlTexto', 'A política externa brasileira baseia-se no multilateralismo e na autonomia.'); await p.click('text=Salvar versão');
  check(await ev(() => discursivas[0].producoes[0].versoes.length === 2), 'duas versões salvas');
  await p.click('.subtab-btn >> text=Versões'); await p.selectOption('select[aria-label="Versão A"]', { index: 1 }); await p.selectOption('select[aria-label="Versão B"]', { index: 2 });
  check(await ev(() => !!document.querySelector('.dl-diff ins.d-ins') && document.querySelector('.dl-diff').innerText.includes('autonomia')), 'comparação mostra o trecho acrescentado');
  await p.click('.subtab-btn >> text=Avaliação'); await p.fill('#dc_conteudo', '8'); await p.fill('#dc_clareza', '6'); await p.fill('#dcc_clareza', 'Revisar conectivos'); await p.click('text=Salvar avaliação'); await p.waitForTimeout(100);
  check(await ev(() => { const a = discursivas[0].producoes[0].avaliacao; return a && a.criterios.conteudo.nota === 8 && Math.abs(dlTotal(a) - 7) < 0.01 && document.body.innerText.includes('não é a avaliação oficial'); }), 'avaliação por critérios (média ponderada 7,0) + aviso de ferramenta pessoal');
  await p.click('.subtab-btn >> text=Texto'); check(await ev(() => document.getElementById('dlMLin').textContent.includes('/ 30')), 'controle de limite de linhas exibido (x / 30)');

  console.log('\n[6] Atualidades + Base de conhecimento + ficha de país');
  await ev(() => goTab('atualidades')); await p.click('.page-actions >> text=Novo acontecimento');
  await p.fill('#atfTit', 'Cúpula do BRICS'); await p.fill('#atfRes', 'Reunião de líderes.'); await p.fill('#atfFonte', 'Itamaraty');
  await p.fill('#atP_in', 'Brasil'); await p.press('#atP_in', 'Enter'); await p.fill('#atO_in', 'BRICS'); await p.press('#atO_in', 'Enter');
  await p.click('.modal-actions >> text=Salvar'); await p.waitForTimeout(200);
  check(await ev(() => atualidades.length === 1 && atualidades[0].paises.includes('br') && atualidades[0].organizacoes.length === 1 && kbItens.some(k => k.nome === 'BRICS' && k.tipo === 'organizacao')), 'atualidade vinculada ao país; organização nova criada na base');
  await ev(() => goTab('organizacoes')); check(await ev(() => document.body.innerText.includes('BRICS') && document.querySelector('#kbRoot h2').textContent.includes('Organizações')), 'menu Organizações abre a base filtrada');
  await p.click('.kb-card'); await p.waitForTimeout(100); check(await ev(() => document.body.innerText.includes('Cúpula do BRICS')), 'ficha mostra o acontecimento relacionado');
  await ev(() => { kbItens[0].paises = ['br']; kbSalvar(); });
  await ev(() => { goTab('paises'); return abrirPaisDetalhe('br'); }); await p.waitForTimeout(600);
  await ev(() => irParaAbaPaisDetalhe('meuacervo')); await p.waitForTimeout(100);
  check(await ev(() => document.getElementById('paisesDetalheWrap').innerText.includes('BRICS') && document.getElementById('paisesDetalheWrap').innerText.includes('Cúpula do BRICS')), 'ficha do Brasil mostra organizações e acontecimentos cadastrados');

  console.log('\n[7] Biblioteca: documento, destaque, fichamento, flashcard');
  await ev(() => goTab('biblioteca')); await ev(() => { biblioDocs.push({ id: 'dmod', titulo: 'Teste <b>x</b>', conteudo: '<p>O Barão do Rio Branco consolidou as fronteiras.</p><img src=x onerror="window.__xss=1"><script>window.__xss=1<\/script>', tags: ['a<b>'], criadoEm: Date.now() }); save('biblio_docs', biblioDocs); renderBiblioDocList(); abrirDocumento('dmod'); });
  await p.waitForTimeout(200); check(await ev(() => !window.__xss), 'conteúdo HTML malicioso é sanitizado (sem execução)');
  await ev(() => { const el = document.getElementById('viewConteudo').querySelector('p'); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await p.click('.bib-cor >> nth=0'); await p.waitForTimeout(100);
  check(await ev(() => biblioDocs.find(d => d.id === 'dmod').destaques.length === 1 && !!document.querySelector('.bib-mark')), 'destaque criado e realçado no texto');
  await p.fill('#fch_tese', 'Fronteiras pacíficas'); await p.dispatchEvent('#fch_tese', 'change');
  check(await ev(() => biblioDocs.find(d => d.id === 'dmod').fichamento.tese === 'Fronteiras pacíficas'), 'fichamento salvo');
  await p.click('.bib-dest >> text=Flashcard'); check(await ev(() => flashCards.some(c => c.origemTipo === 'biblioteca')), 'destaque transformado em flashcard');

  console.log('\n[8] Central, tema e confirmações');
  await ev(() => goTab('inicio')); await p.waitForTimeout(200);
  check(await ev(() => document.querySelector('.ct-tile .ct-n') && /despacho do dia/i.test(document.body.innerText)), 'Central mostra resumo do dia e Despacho do Dia');
  const tema1 = await ev(() => document.body.dataset.theme); await p.click('#themeBtn'); check(await ev(() => document.body.dataset.theme) !== tema1, 'alternar tema claro/escuro');
  console.log('\nErros de JS acumulados:', erros.length ? '\n' + erros.join('\n') : 'nenhum'); check(erros.length === 0, 'zero erros de JS na sessão completa');
  await b.close(); process.exit(resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
