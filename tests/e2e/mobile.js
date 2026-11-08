// Verifica rolagem horizontal e elementos cortados em telas pequenas (iPhone 390x844 e 320x640) e tablet.
const { abrir, check, resumo } = require('./helpers');
(async () => {
  for (const [nome, vp] of [['iPhone 390', { width: 390, height: 844 }], ['iPhone SE 320', { width: 320, height: 640 }], ['tablet 820', { width: 820, height: 1180 }]]) {
    console.log('\n[' + nome + ']');
    const { b, p, erros } = await abrir({ context: { viewport: vp, isMobile: true, hasTouch: true } });
    await p.evaluate(() => { const m = materias; const h = todayISO();
      cronograma = [crNorm({ id: 'a', tema: 'Guerra do Paraguai e a formação do estado nacional brasileiro', estudar: '', semana: '—', tempo: '1h30', data: crISOParaBR(h), materia: m[0].nome, feito: false, prioridade: 'alta' })]; crSalvar();
      questoes = [qNorm({ id: 'q1', enunciado: 'Enunciado longo '.repeat(40), materia: m[0].nome, tipo: 'multipla', alternativas: ['A', 'B', 'C', 'D'].map(l => ({ letra: l, texto: 'Alternativa extensa '.repeat(12) })), gabarito: 'A', banca: 'CEBRASPE', ano: 2022 })]; qSalvar();
      discursivas = [dlNorm({ id: 'd1', materia: m[2].nome, tema: 'Tema ', limiteLinhas: 30, producoes: [{ id: 'p1', texto: 'x', criadoEm: Date.now(), editadoEm: Date.now(), tempoSeg: 0, versoes: [], avaliacao: null }] })]; dlSalvar();
      biblioDocs.push({ id: 'd1', titulo: 'Doc', conteudo: '<table><tr><td>' + 'celula '.repeat(60) + '</td></tr></table><p>' + 'a'.repeat(200) + '</p>', tags: [], criadoEm: Date.now() }); save('biblio_docs', biblioDocs); flashCriarCard({ frente: 'F', verso: 'V', disciplina: 'X' }); reloadStateFromLocalStorage(); });
    const ids = await p.evaluate(() => NAV_ITEMS.map(i => i.id).filter(i => i !== 'palavras'));
    for (const id of ids) {
      await p.evaluate(i => goTab(i), id); await p.waitForTimeout(450);
      const r = await p.evaluate(() => { const w = document.documentElement.clientWidth; const largos = [...document.querySelectorAll('.view.active *, .topbar *, .bottomnav *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > w + 1 && !e.closest('.subtabs, .table-scroll, .filters, svg, .mapa-mundi-wrap, .mapa-mundi, .crono-cal, [style*="overflow"]') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map(e => e.tagName + '.' + String(e.className).slice(0, 30)); return { sw: document.documentElement.scrollWidth, w, largos }; });
      check(r.sw <= r.w + 1, `${id}: sem rolagem horizontal (scrollWidth ${r.sw} ≤ ${r.w})`, r.largos.join(', '));
    }
    await p.evaluate(() => { goTab('questoes'); qResolverUma('q1'); }); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'resolução de questão cabe na tela');
    check(await p.evaluate(() => { const b = document.querySelector('.qb-opcao'); return b && b.getBoundingClientRect().height >= 44; }), 'alternativas têm alvo de toque ≥ 44px');
    check(await p.evaluate(() => [...document.querySelectorAll('.bottomnav button')].every(b => b.getBoundingClientRect().height >= 44)), 'botões da barra inferior ≥ 44px');
    await p.evaluate(() => abrirMais()); check(await p.evaluate(() => document.querySelectorAll('#moreGrid button').length >= 10), 'folha "Mais" lista as demais seções');
    check(erros.length === 0, 'sem erros de JS', erros.join(' | ')); await b.close();
  }
  process.exit(resumo());
})();
