// Todas as páginas abrem, o menu funciona (desktop e "Mais" no celular) e não há erro de JavaScript.
const H = require('./helpers'); const { check } = H;
(async () => {
  await H.emuOuSair(); const d = await H.abrir(), p = d.p;
  console.log('\n[Navegação desktop]');
  const itens = await p.evaluate(() => NAV_ITEMS.map(i => [i.id, i.label]));
  for (const [id, label] of itens) {
    await p.click(`#sidebarNavScroll button[data-tab="${id}"]`); await H.sleep(250);
    const r = await p.evaluate(() => ({ tab: document.body.dataset.activeTab, titulo: document.getElementById('topbarTitle').textContent, atual: document.querySelector('#sidebarNavScroll button[aria-current="page"]')?.dataset.tab, visiveis: [...document.querySelectorAll('.view.active')].filter(v => v.offsetParent !== null).length }));
    check(r.tab === id && r.titulo === label && r.atual === id && r.visiveis === 1, `clicar em "${label}" abre a seção, mostra o título e marca o item atual`, JSON.stringify(r));
  }
  console.log('\n[Redesign 2026: regressões cobertas]');
  await p.evaluate(() => goTab('questoes')); await H.sleep(200); await p.evaluate(() => goTab('paises')); await H.sleep(400);
  check(await p.locator('#sub-paisesLista').isVisible() && await p.locator('#paisesGrid .pais-card').count() > 0, 'Países continua visível depois de abrir uma subaba de outro módulo (bug antigo do goSub)');
  await p.click('#paisesFiltrosAvancadosBtn'); await H.sleep(200);
  check(await p.locator('#paisesFiltrosAvancados select').count() >= 4, '"Mais filtros" de Países abre os filtros avançados (antes chamava função inexistente)');
  const nAntes = await p.locator('#paisesGrid .pais-card').count();
  await p.selectOption('#paisesFiltrosAvancados select >> nth=0', { index: 1 }); await H.sleep(200);
  check(await p.locator('#paisesGrid .pais-card').count() < nAntes, 'filtro avançado reduz a lista de países');
  await p.click('#paisesFiltrosAvancados >> text=Limpar filtros avançados'); await H.sleep(200);
  await p.click('#paisesGrid .pais-card >> nth=0 >> .pc-fav'); await H.sleep(200);
  check(await p.evaluate(() => (load('paises_favoritos', []) || []).length) === 1 && await p.evaluate(() => document.body.dataset.activeTab) === 'paises' && await p.locator('#paisesDetalheWrap').isHidden(), 'estrela favorita o país sem abrir a ficha (salvo em paises_favoritos)');
  await p.click('#paisesFavToggleBtn'); await H.sleep(200);
  check(await p.locator('#paisesGrid .pais-card').count() === 1, '"Favoritos" mostra só os favoritos');
  await p.click('#paisesFavToggleBtn'); await H.sleep(150);
  check(await p.evaluate(() => document.getElementById('topbarCrumb').textContent) === 'Conhecimento', 'barra superior mostra o grupo da página atual');
  await p.evaluate(() => goTab('inicio')); await H.sleep(300);
  check(await p.locator('#centralRoot .ct-hoje .ct-ring').count() === 1 && await p.locator('#centralRoot .ct-despacho').count() === 1 && await p.locator('#centralRoot .ct-chart-col').count() === 14, 'Central: anel da meta, Despacho do Dia e gráfico de 14 dias');
  console.log('\n[Atalhos de teclado]');
  await p.evaluate(() => goTab('inicio')); await p.keyboard.press('g'); await p.keyboard.press('q'); await H.sleep(200);
  check(await p.evaluate(() => document.body.dataset.activeTab) === 'questoes', 'atalho "g q" abre Questões');
  await p.keyboard.press('?'); await H.sleep(150); check(await p.locator('.modal-card:has-text("Atalhos de teclado")').count() === 1, 'tecla "?" abre a ajuda de atalhos'); await p.keyboard.press('Escape'); await p.click('.modal-card:has-text("Atalhos") >> text=Fechar');
  console.log('\n[Navegação celular]');
  await p.setViewportSize({ width: 390, height: 844 }); await H.sleep(300);
  check(await p.locator('.sidebar').isVisible() === false && await p.locator('#bottomNav').isVisible(), 'celular: sidebar oculta, barra inferior visível');
  for (const id of ['cronograma', 'simulados', 'flashcards', 'revisao', 'inicio']) { await p.click(`#bottomNav button[aria-label*="${(await p.evaluate(i => NAV_ITEMS.find(x => x.id === i).label, id))}"]`); await H.sleep(200); check(await p.evaluate(() => document.body.dataset.activeTab) === id, `barra inferior abre "${id}"`); }
  await p.click('#bottomNav button[aria-label="Mais opções"]'); await H.sleep(300);
  check(await p.locator('#moreSheet.show').count() === 1, 'botão "Mais" abre a folha de seções');
  await p.click('#moreGrid button:has-text("Biblioteca")'); await H.sleep(300);
  check(await p.evaluate(() => document.body.dataset.activeTab) === 'biblioteca' && await p.locator('#moreSheet.show').count() === 0, 'escolher item da folha navega e fecha a folha');
  check(d.erros.length === 0, 'nenhum erro de JavaScript', d.erros.join(' | '));
  await d.b.close(); process.exit(H.resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
