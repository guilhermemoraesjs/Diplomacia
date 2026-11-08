/* ==========================================================================
   biblioteca-extras.js — melhorias da Biblioteca SEM alterar o que já existe
   (pastas, arrastar e soltar, editor, tags, relacionados, SRS continuam nos
   módulos originais). Acrescenta, de forma aditiva:
     • salvamento automático de rascunho no editor (recuperável)
     • modo leitura confortável
     • destaques (da seleção de texto) com comentário, e comentários do documento
     • fichamento estruturado
     • vínculo com matéria + assunto do edital
     • criação de flashcard a partir de um destaque
   Campos novos no documento: assunto, destaques[], comentarios[], fichamento{}.
   ========================================================================== */
const BIB_CORES = { amarelo: 'rgba(227,196,127,.38)', verde: 'rgba(52,199,123,.30)', azul: 'rgba(95,140,230,.32)', rosa: 'rgba(239,107,160,.30)' };

/* ---------- rascunho automático do editor ---------- */
function salvarRascunhoBiblioteca() {
  const ed = document.getElementById('docConteudo'), t = document.getElementById('docTitulo');
  if (!ed || !document.getElementById('biblioEditorView') || document.getElementById('biblioEditorView').style.display === 'none') return;
  const html = ed.innerHTML;
  if (!html.trim() && !(t && t.value.trim())) return;
  try { localStorage.setItem('biblio_rascunho', JSON.stringify({ docId: biblioCurrentDocId || null, titulo: t ? t.value : '', html, t: Date.now() })); } catch (e) { return; }
  const l = document.getElementById('docAutosaveLabel'); if (l) l.textContent = 'Rascunho salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
const _bibAuto = debounce(salvarRascunhoBiblioteca, 1500);
document.addEventListener('input', e => { if (e.target && (e.target.id === 'docConteudo' || e.target.id === 'docTitulo')) { const l = document.getElementById('docAutosaveLabel'); if (l) l.textContent = 'Editando…'; _bibAuto(); } });
function bibRascunho() { try { return JSON.parse(localStorage.getItem('biblio_rascunho')); } catch (e) { return null; } }
function bibOferecerRascunho() {
  const r = bibRascunho(); if (!r || (r.docId || null) !== (biblioCurrentDocId || null)) return;
  const d = r.docId ? biblioDocs.find(x => x.id === r.docId) : null;
  if (d && (d.editadoEm || 0) >= r.t) { localStorage.removeItem('biblio_rascunho'); return; }
  if (!r.html.trim() && !r.titulo.trim()) return;
  const l = document.getElementById('docAutosaveLabel');
  if (l) l.innerHTML = `Há um rascunho de ${new Date(r.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. <a href="#" onclick="bibRecuperarRascunho();return false;" style="text-decoration:underline;">Recuperar</a>`;
}
function bibRecuperarRascunho() { const r = bibRascunho(); if (!r) return; document.getElementById('docTitulo').value = r.titulo || ''; document.getElementById('docConteudo').innerHTML = sanitizarHTML(r.html); toast('Rascunho recuperado. Clique em Salvar para confirmar.'); }
const _abrirEdit = abrirDocumentoEdit, _novoDoc = novoDocumento, _saveDoc = saveDocumento;
abrirDocumentoEdit = function (id) { _abrirEdit(id); const d = biblioDocs.find(x => x.id === id); const a = document.getElementById('docAssunto'); if (a) a.value = (d && d.assunto) || ''; bibAtualizarAssuntos(); bibOferecerRascunho(); };
novoDocumento = function () { _novoDoc(); const a = document.getElementById('docAssunto'); if (a) a.value = ''; bibAtualizarAssuntos(); bibOferecerRascunho(); };
saveDocumento = function () { const a = document.getElementById('docAssunto'); const v = a ? a.value.trim() : null; const r = _saveDoc.apply(this, arguments); if (v !== null && biblioCurrentDocId) { const d = biblioDocs.find(x => x.id === biblioCurrentDocId); if (d && d.assunto !== v) { d.assunto = v; save('biblio_docs', biblioDocs); } } localStorage.removeItem('biblio_rascunho'); return r; };
function bibAtualizarAssuntos() {
  const sel = document.getElementById('docMateria'), dl = document.getElementById('docAssuntoList'); if (!sel || !dl) return;
  const m = materias.find(x => x.nome === sel.value), n = []; (m ? m.topicos : []).forEach(t => { n.push(t.nome); (t.subtopicos || []).forEach(s => n.push(s.nome)); });
  dl.innerHTML = n.map(x => `<option value="${escAttr(x)}">`).join('');
}
// campo "Assunto do edital" na aba Propriedades (logo após Matéria relacionada)
(function injetarCampoAssunto() {
  const sel = document.getElementById('docMateria'); if (!sel || document.getElementById('docAssunto')) return;
  sel.setAttribute('onchange', 'bibAtualizarAssuntos()');
  sel.insertAdjacentHTML('afterend', '<label class="field-label">Assunto do edital</label><input type="text" id="docAssunto" list="docAssuntoList" placeholder="Opcional — tema ou subtema da matéria"><datalist id="docAssuntoList"></datalist>');
})();

/* ---------- visualização: extras ---------- */
const _renderView = renderDocumentoView;
renderDocumentoView = function (d) { _renderView(d); bibRenderExtras(d); };
let bibLeitura = false;
function bibToggleLeitura() { bibLeitura = !bibLeitura; const v = document.getElementById('biblioViewMode'); if (v) v.classList.toggle('modo-leitura', bibLeitura); const b = document.getElementById('bibLeituraBtn'); if (b) b.setAttribute('aria-pressed', bibLeitura); }
function bibDoc() { return biblioDocs.find(x => x.id === biblioCurrentDocId); }

function bibRenderExtras(d) {
  let host = document.getElementById('biblioExtras');
  if (!host) { const rel = document.querySelector('#biblioViewMode .biblio-related'); host = document.createElement('div'); host.id = 'biblioExtras'; rel.parentNode.insertBefore(host, rel); }
  d.destaques = d.destaques || []; d.comentarios = d.comentarios || []; d.fichamento = d.fichamento || {};
  const campos = [['tese', 'Tese / ideia central'], ['argumentos', 'Argumentos principais'], ['conceitos', 'Conceitos-chave'], ['citacoes', 'Citações importantes (com página)'], ['prova', 'Como isso pode cair na prova']];
  host.className = 'bib-extras';
  host.innerHTML = `<div class="card"><div class="row between"><div class="panel-title" style="margin:0;">Leitura e edital</div><span class="row"><button class="btn ghost small" id="bibLeituraBtn" aria-pressed="${bibLeitura}" onclick="bibToggleLeitura()">Modo leitura</button><button class="btn ghost small" onclick="bibAbrirVinculo()">Vincular ao edital</button></span></div>
      <p class="muted" style="margin:8px 0 0;font-size:13.5px;">${d.materia ? `<b>${escHtml(d.materia)}</b>${d.assunto ? ' › ' + escHtml(d.assunto) : ''}` : 'Sem vínculo com o edital.'}</p></div>
    <div class="card"><div class="row between"><div class="panel-title" style="margin:0;">Destaques (${d.destaques.length})</div><span class="row">${Object.keys(BIB_CORES).map(c => `<button class="bib-cor" style="background:${BIB_CORES[c]}" onclick="bibDestacar('${c}')" aria-label="Destacar seleção em ${c}" title="Destacar seleção"></button>`).join('')}</span></div>
      <p class="muted" style="font-size:12.5px;margin:6px 0 8px;">Selecione um trecho do texto acima e toque em uma cor.</p>
      ${d.destaques.map(h => `<div class="bib-dest" style="border-left-color:${BIB_CORES[h.cor] || BIB_CORES.amarelo}"><p class="pre" style="margin:0 0 6px;">${escHtml(h.texto)}</p><input type="text" value="${escAttr(h.comentario || '')}" placeholder="Comentário sobre este trecho" aria-label="Comentário do destaque" onchange="bibComentarDestaque('${h.id}',this.value)"><div class="row" style="margin-top:6px;"><button class="btn ghost small" onclick="bibFlashDestaque('${h.id}')">${icon('layers', 13)} Flashcard</button><button class="btn ghost small" onclick="bibRemoverDestaque('${h.id}')">${icon('trash', 13)} Remover</button></div></div>`).join('')}</div>
    <div class="card"><div class="panel-title">Fichamento</div>${campos.map(([k, l]) => `<label class="field-label" for="fch_${k}">${l}</label><textarea id="fch_${k}" style="min-height:58px;" onchange="bibSalvarFicha('${k}',this.value)">${escHtml(d.fichamento[k] || '')}</textarea>`).join('')}</div>
    <div class="card"><div class="panel-title">Comentários (${d.comentarios.length})</div>${d.comentarios.map(c => `<div class="rv-item"><div class="grow"><p class="pre" style="margin:0;">${escHtml(c.texto)}</p><div class="rv-s">${new Date(c.t).toLocaleString('pt-BR')}</div></div><button class="icon-btn ghost" onclick="bibRemoverComentario('${c.id}')" aria-label="Remover comentário">${icon('x', 14)}</button></div>`).join('')}
      <div class="row" style="margin-top:8px;"><input type="text" id="bibNovoCom" placeholder="Adicionar comentário..." class="grow" onkeydown="if(event.key==='Enter')bibAddComentario()"><button class="btn small" onclick="bibAddComentario()">Adicionar</button></div></div>`;
  d.destaques.forEach(h => bibMarcarNoTexto(h));
  if (bibLeitura) document.getElementById('biblioViewMode').classList.add('modo-leitura');
}
function bibMarcarNoTexto(h) {      // realça o trecho no texto exibido (apenas visual; o conteúdo salvo não muda)
  const raiz = document.getElementById('viewConteudo'); if (!raiz || !h.texto) return;
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode, i = n.nodeValue.indexOf(h.texto); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + h.texto.length); const m = document.createElement('mark'); m.className = 'bib-mark'; m.style.background = BIB_CORES[h.cor] || BIB_CORES.amarelo; m.title = h.comentario || ''; r.surroundContents(m); return; } }
}
function bibDestacar(cor) {
  const sel = window.getSelection(), txt = sel ? sel.toString().trim() : '', raiz = document.getElementById('viewConteudo');
  if (!txt || !raiz || !sel.anchorNode || !raiz.contains(sel.anchorNode)) { toast('Selecione um trecho do documento para destacar.', 'aviso'); return; }
  const d = bibDoc(); if (d.destaques.some(h => h.texto === txt)) { toast('Este trecho já está destacado.', 'aviso'); return; }
  d.destaques.push({ id: uid(), texto: txt.slice(0, 1200), cor, comentario: '', t: Date.now() }); save('biblio_docs', biblioDocs); sel.removeAllRanges(); renderDocumentoView(d); toast('Trecho destacado.');
}
function bibComentarDestaque(id, v) { const d = bibDoc(), h = d.destaques.find(x => x.id === id); if (h) { h.comentario = v.trim(); save('biblio_docs', biblioDocs); } }
async function bibRemoverDestaque(id) { const d = bibDoc(); if (!await confirmar('Remover este destaque?', { titulo: 'Remover destaque', ok: 'Remover' })) return; d.destaques = d.destaques.filter(x => x.id !== id); save('biblio_docs', biblioDocs); renderDocumentoView(d); }
function bibFlashDestaque(id) {
  const d = bibDoc(), h = d.destaques.find(x => x.id === id); if (!h || typeof flashCriarCard !== 'function') return;
  flashCriarCard({ tipo: 'basico', frente: h.comentario || `Do documento "${d.titulo}": o que significa o trecho abaixo?\n\n"${h.texto.slice(0, 160)}…"`, verso: h.texto, disciplina: d.materia || '', tema: d.assunto || d.titulo || '', tags: d.tags || [], fonte: `Biblioteca — ${d.titulo || ''}`, origemTipo: 'biblioteca', origemRefId: d.id });
  toast('Flashcard criado a partir do destaque.');
}
function bibSalvarFicha(k, v) { const d = bibDoc(); d.fichamento = d.fichamento || {}; d.fichamento[k] = v; save('biblio_docs', biblioDocs); toast('Fichamento salvo.'); }
function bibAddComentario() { const i = document.getElementById('bibNovoCom'), v = i.value.trim(); if (!v) return; const d = bibDoc(); d.comentarios.push({ id: uid(), texto: v, t: Date.now() }); save('biblio_docs', biblioDocs); renderDocumentoView(d); }
function bibRemoverComentario(id) { const d = bibDoc(); d.comentarios = d.comentarios.filter(c => c.id !== id); save('biblio_docs', biblioDocs); renderDocumentoView(d); }
function bibAbrirVinculo() {
  const d = bibDoc();
  crModal(`<h3>Vincular ao edital</h3><label class="field-label" for="bvMat">Matéria</label><select id="bvMat" onchange="bibVincAssuntos()"><option value="">— nenhuma —</option>${materias.map(m => `<option ${d.materia === m.nome ? 'selected' : ''}>${escHtml(m.nome)}</option>`).join('')}</select>
    <label class="field-label" for="bvAss">Assunto</label><input type="text" id="bvAss" list="bvAssL" value="${escAttr(d.assunto || '')}"><datalist id="bvAssL"></datalist>
    <div class="modal-actions"><button class="btn ghost small" onclick="crFecharModal()">Cancelar</button><button class="btn small" onclick="bibSalvarVinculo()">Salvar</button></div>`); bibVincAssuntos();
}
function bibVincAssuntos() { const m = materias.find(x => x.nome === document.getElementById('bvMat').value), n = []; (m ? m.topicos : []).forEach(t => { n.push(t.nome); (t.subtopicos || []).forEach(s => n.push(s.nome)); }); document.getElementById('bvAssL').innerHTML = n.map(x => `<option value="${escAttr(x)}">`).join(''); }
function bibSalvarVinculo() { const d = bibDoc(); d.materia = document.getElementById('bvMat').value; d.assunto = document.getElementById('bvAss').value.trim(); save('biblio_docs', biblioDocs); crFecharModal(); renderDocumentoView(d); renderBiblioDocList(); toast('Vínculo salvo.'); }
