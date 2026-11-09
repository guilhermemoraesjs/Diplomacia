// Biblioteca: pastas, documentos (editor rico), tags, mover, rascunho recuperável, busca, destaques/fichamento, exclusão e persistência.
const H = require('./helpers'); const { check } = H;
(async () => {
  await H.emuOuSair(); const d = await H.abrir(), p = d.p, ev = (f, a) => p.evaluate(f, a);
  await H.ir(p, 'biblioteca');
  const novoDoc = async (titulo, texto, tags, extra) => { await p.click('#biblioListView >> text=+ Novo documento'); await p.fill('#docTitulo', titulo); await p.click('#docConteudo'); if (texto) await p.keyboard.type(texto); for (const t of tags || []) { await p.fill('#docTagNovo', t); await p.press('#docTagNovo', 'Enter'); } if (extra) await extra(); };
  const salvar = async () => { await p.click('.biblio-editor-actions >> text=Salvar'); await H.sleep(250); };
  const voltar = async () => { await p.click('#biblioViewMode >> text=Voltar'); await H.sleep(150); };

  console.log('\n[Pastas]');
  await p.fill('#novaAreaInput', 'Direito Internacional Público'); await p.click('.biblio-add-row >> text=+'); await p.fill('#novaAreaInput', 'Minhas leituras'); await p.click('.biblio-add-row >> text=+'); await H.sleep(150);
  let pastas = await ev(() => biblioPastas.map(x => [x.nome, x.parentId])); check(pastas.length === 2 && pastas[0][0].includes('Direito Internacional Público') && pastas[1][0].includes('Minhas leituras'), 'duas estantes criadas', JSON.stringify(pastas));
  const idDireito = await ev(() => biblioPastas[0].id), idLeit = await ev(() => biblioPastas[1].id);
  await p.locator('.biblio-node', { hasText: 'Minhas leituras' }).click(); p.once('dialog', dlg => dlg.accept('Livros de 2026')); await p.click('#biblioAddSubpastaBtn'); await H.sleep(200);
  check(await ev(l => biblioPastas.some(x => x.nome.includes('Livros de 2026') && x.parentId === l), idLeit), 'subpasta criada dentro da estante selecionada');
  await p.locator('.biblio-node', { hasText: 'Minhas leituras' }).dragTo(p.locator('.biblio-node', { hasText: 'Direito Internacional Público' }), { targetPosition: { x: 40, y: 3 } }); await H.sleep(250);
  const ordem = await ev(() => biblioPastas.filter(x => !x.parentId).map(x => x.nome.replace(/^\S+\s/, ''))); check(ordem[0] === 'Minhas leituras', 'arrastar e soltar reordena as estantes (Minhas leituras antes de Direito...)', JSON.stringify(ordem));
  await H.recarregar(p); check(await ev(() => biblioPastas.length === 3 && biblioPastas.filter(x => !x.parentId)[0].nome.includes('Minhas leituras')), 'persistência 1: pastas e nova ordem preservadas');

  console.log('\n[Documento com conteúdo rico]');
  await H.ir(p, 'biblioteca'); await p.locator('.biblio-node', { hasText: 'Direito Internacional Público' }).click();
  await novoDoc('Convenção de Viena <b>1969</b>', 'Tratados são acordos regidos pelo direito internacional.', ['direito', 'tratados']);
  await p.keyboard.press('Control+End'); await p.keyboard.press('Enter');
  await p.selectOption('#docToolbar select[title="Blocos"]', 'check'); await p.keyboard.press('Control+End'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); await p.selectOption('#docToolbar select[title="Listas"]', 'ul'); await p.keyboard.type('item da lista');
  await ev(() => { const ed = document.getElementById('docConteudo'), w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue.startsWith('Tratados')) { const r = document.createRange(); r.selectNodeContents(n); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } });
  await p.click('#docToolbar button[title^="Negrito"]');
  check(await p.locator('#docTagsInput .tag-chip').count() === 2, 'duas tags aplicadas'); check((await p.textContent('#docWordCount')).match(/\d+/)[0] > 0, 'contador de palavras do editor atualiza');
  await salvar(); let doc = await ev(() => biblioDocs[0]);
  check(doc.titulo === 'Convenção de Viena <b>1969</b>' && doc.pastaId === await ev(() => biblioPastas.find(x => x.nome.includes('Direito')).id) && doc.tags.join() === 'direito,tratados', 'documento salvo na pasta escolhida com título literal (sem interpretar HTML) e tags');
  check(/<b>[^<]*Tratados são acordos/.test(doc.conteudo) && /<li>[^<]*item da lista/.test(doc.conteudo) && /type="checkbox"/.test(doc.conteudo), 'conteúdo rico: negrito no texto, lista e checklist gravados', doc.conteudo.slice(0, 300));
  check((await p.textContent('#viewTitulo')).includes('<b>1969</b>') && await p.locator('#viewTitulo b').count() === 0, 'título exibido como texto (não injeta HTML)');
  await H.recarregar(p); await H.ir(p, 'biblioteca'); check(await ev(() => biblioDocs.length === 1 && /type="checkbox"/.test(biblioDocs[0].conteudo) && biblioDocs[0].tags.length === 2), 'persistência 2: documento com conteúdo rico preservado');

  console.log('\n[Editar]');
  await p.locator('.biblio-doc-card', { hasText: 'Convenção' }).click(); await p.click('#biblioViewMode >> text=Editar'); await p.fill('#docTitulo', 'Convenção de Viena (1969)'); await p.click('#docConteudo'); await p.keyboard.press('Control+End'); await p.keyboard.type(' Acréscimo posterior.'); await salvar();
  check(await ev(() => biblioDocs[0].titulo === 'Convenção de Viena (1969)' && biblioDocs[0].conteudo.includes('Acréscimo posterior.') && biblioDocs[0].editadoEm >= biblioDocs[0].criadoEm), 'edição de título e conteúdo salva'); await H.recarregar(p); check(await ev(() => biblioDocs[0].titulo === 'Convenção de Viena (1969)' && biblioDocs[0].conteudo.includes('Acréscimo posterior.')), 'persistência 3: versão editada preservada');

  console.log('\n[Mover entre pastas]');
  await H.ir(p, 'biblioteca'); await p.locator('.biblio-doc-card', { hasText: 'Convenção' }).click(); await p.click('#biblioViewMode >> text=Editar'); await p.click('#biblioEditorView .bp-tab:has-text("Propriedades")'); await p.selectOption('#docPasta', idLeit); await salvar();
  check(await ev(l => biblioDocs[0].pastaId === l, idLeit), 'documento movido para outra estante via Propriedades'); await voltar();
  await p.locator('.biblio-node', { hasText: 'Direito Internacional Público' }).click(); check(await p.locator('.biblio-doc-card').count() === 0, 'a estante de origem não lista mais o documento'); await p.locator('.biblio-node', { hasText: 'Minhas leituras' }).first().click(); check(await p.locator('.biblio-doc-card').count() === 1, 'a estante de destino lista o documento');
  await H.recarregar(p); check(await ev(l => biblioDocs[0].pastaId === l, idLeit), 'persistência 4: movimentação preservada');

  console.log('\n[Rascunho recuperável]');
  await H.ir(p, 'biblioteca'); await p.click('#biblioListView >> text=+ Novo documento'); await p.fill('#docTitulo', 'Rascunho importante'); await p.click('#docConteudo'); await p.keyboard.type('Texto que ainda não foi salvo.'); await H.sleep(1900);
  check(await ev(() => { const r = JSON.parse(localStorage.getItem('biblio_rascunho')); return r && r.titulo === 'Rascunho importante' && r.html.includes('ainda não foi salvo') && r.docId === null; }), 'rascunho gravado automaticamente enquanto digita');
  check((await p.textContent('#docAutosaveLabel')).includes('Rascunho salvo'), 'editor mostra "Rascunho salvo às…"'); await H.recarregar(p);
  await H.ir(p, 'biblioteca'); await p.click('#biblioListView >> text=+ Novo documento'); check((await p.textContent('#docAutosaveLabel')).includes('Recuperar') && await p.inputValue('#docTitulo') === '', 'após recarregar, o editor oferece "Recuperar" e não sobrescreve nada sozinho');
  await p.click('#docAutosaveLabel a'); check(await p.inputValue('#docTitulo') === 'Rascunho importante' && (await p.innerText('#docConteudo')).includes('ainda não foi salvo'), 'recuperar restaura título e conteúdo'); await salvar();
  check(await ev(() => biblioDocs.length === 2 && biblioDocs.some(x => x.titulo === 'Rascunho importante') && localStorage.getItem('biblio_rascunho') === null), 'rascunho virou documento e o rascunho foi limpo');
  await p.click('#biblioViewMode >> text=Editar'); await p.click('#docConteudo'); await p.keyboard.press('Control+End'); await p.keyboard.type(' ALTERAÇÃO NÃO SALVA.'); await H.sleep(1900); await H.recarregar(p);
  check(await ev(() => biblioDocs.find(x => x.titulo === 'Rascunho importante').conteudo.includes('NÃO SALVA')) === false, 'edição não salva NÃO altera o documento'); await H.ir(p, 'biblioteca'); await p.locator('.biblio-doc-card', { hasText: 'Rascunho importante' }).click(); await p.click('#biblioViewMode >> text=Editar'); check((await p.textContent('#docAutosaveLabel')).includes('Recuperar'), 'rascunho da edição de documento existente é oferecido'); await p.click('#docAutosaveLabel a'); check((await p.innerText('#docConteudo')).includes('NÃO SALVA'), 'recuperar traz a alteração que não tinha sido salva');
  await p.click('#biblioEditorView >> text=← Biblioteca'); await H.sleep(200);

  console.log('\n[Busca]');
  await p.fill('#biblioSearch', 'viena'); check(await p.locator('#biblioSearchResults .biblio-doc-card').count() === 1, 'busca por título'); await p.fill('#biblioSearch', 'acréscimo posterior'); check(await p.locator('#biblioSearchResults .biblio-doc-card').count() === 1, 'busca por conteúdo'); await p.fill('#biblioSearch', 'tratados'); check(await p.locator('#biblioSearchResults .biblio-doc-card').count() === 1, 'busca por tag'); await p.fill('#biblioSearch', 'inexistente-xyz'); check(await p.locator('#biblioSearchResults .biblio-doc-card').count() === 0, 'busca sem resultado'); await p.fill('#biblioSearch', '<img src=x onerror=window.__x=1>'); await H.sleep(150); check(await ev(() => !window.__x), 'termo de busca com HTML não executa'); await p.fill('#biblioSearch', '');

  console.log('\n[Destaques, fichamento e flashcard]');
  await H.ir(p, 'biblioteca'); await p.locator('.biblio-doc-card', { hasText: 'Convenção' }).click(); await H.sleep(200);
  await ev(() => { const el = document.getElementById('viewConteudo'); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.nodeValue.indexOf('Tratados'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 'Tratados são acordos'.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } } });
  await p.click('.bib-cor >> nth=1'); await H.sleep(150); check(await ev(() => biblioDocs.find(x => x.titulo.includes('Convenção')).destaques[0].texto === 'Tratados são acordos' && !!document.querySelector('.bib-mark')), 'trecho selecionado vira destaque e é realçado');
  await p.fill('.bib-dest input', 'conceito central'); await p.dispatchEvent('.bib-dest input', 'change'); await p.fill('#fch_tese', 'Tratados obrigam as partes (pacta sunt servanda).'); await p.dispatchEvent('#fch_tese', 'change');
  await H.recarregar(p); check(await ev(() => { const x = biblioDocs.find(y => y.titulo.includes('Convenção')); return x.destaques[0].comentario === 'conceito central' && x.fichamento.tese.includes('pacta sunt servanda'); }), 'persistência 5: destaque, comentário e fichamento preservados');
  await H.ir(p, 'biblioteca'); await p.locator('.biblio-doc-card', { hasText: 'Convenção' }).click(); await p.click('.bib-dest >> text=Flashcard'); check(await ev(() => flashCards.some(c => c.origemTipo === 'biblioteca' && c.verso === 'Tratados são acordos' && c.frente === 'conceito central')), 'destaque virou flashcard (frente = comentário, verso = trecho)');

  console.log('\n[Segurança do conteúdo]');
  await ev(() => { biblioDocs.push({ id: 'mal', titulo: 'Malicioso', conteudo: '<p>ok</p><img src=x onerror="window.__xss=1"><script>window.__xss=1<\/script><a href="javascript:window.__xss=1">x</a><iframe src="about:blank"></iframe>', tags: [], criadoEm: Date.now(), pastaId: null }); save('biblio_docs', biblioDocs); abrirDocumento('mal'); }); await H.sleep(300);
  check(await ev(() => !window.__xss && !document.querySelector('#viewConteudo script, #viewConteudo iframe, #viewConteudo [onerror]') && !(document.querySelector('#viewConteudo a') || { href: '' }).href.startsWith('javascript:')), 'HTML malicioso é sanitizado ao exibir (script, iframe, onerror, javascript:)');

  console.log('\n[Excluir]');
  await p.click('#biblioViewMode >> text=Excluir'); await p.click('.confirm-overlay [data-r="0"]'); check(await ev(() => biblioDocs.some(x => x.id === 'mal')), 'cancelar mantém o documento');
  await p.click('#biblioViewMode >> text=Excluir'); await p.click('.confirm-overlay [data-r="1"]'); await H.sleep(500); check(await ev(() => !biblioDocs.some(x => x.id === 'mal')) && await ev(async () => (await listarSnapshots()).some(s => s.motivo === 'antes-de-excluir-documento')), 'excluir remove o documento e cria snapshot de segurança');
  await H.recarregar(p); check(await ev(() => biblioDocs.length === 2 && !biblioDocs.some(x => x.id === 'mal')), 'persistência 6: exclusão preservada');
  await H.esperar(p, () => pendingSyncCount() === 0); const cloud = await H.fsGet(d.uid); check(cloud.biblio_docs.length === 2 && cloud.biblio_pastas.length === 3, 'nuvem igual ao local');
  check(d.erros.length === 0, 'nenhum erro de JavaScript', d.erros.join(' | '));
  await d.b.close(); process.exit(H.resumo());
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
