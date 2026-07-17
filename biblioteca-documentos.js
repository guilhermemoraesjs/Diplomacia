/* ==========================================================================
   biblioteca-documentos.js — módulo "Biblioteca → Documentos": CRUD de
   fichamentos/documentos, painéis de lista/visualização/edição, tags e
   documentos relacionados.
   ========================================================================== */

let biblioDocs = load('biblio_docs', []);
migrarRevisaoAntigaBiblioteca();
let biblioCurrentPasta = null;
let biblioCurrentDocId = null;
let docTagsAtual = [];

/* Alterna entre lista, visualização, edição e revisão de um documento */
function showBiblioPanel(panel) {
  document.getElementById('biblioListView').style.display = panel === 'list' ? 'block' : 'none';
  document.getElementById('biblioViewMode').style.display = panel === 'view' ? 'block' : 'none';
  document.getElementById('biblioEditorView').style.display = panel === 'edit' ? 'block' : 'none';
  document.getElementById('biblioReviewMode').style.display = panel === 'review' ? 'block' : 'none';
  if (panel !== 'edit') {
    document.getElementById('docConteudoWrap').classList.remove('fullscreen-mode');
    document.body.classList.remove('editor-fullscreen-active');
  }
}

function renderBiblioDocList() {
  const el = document.getElementById('biblioDocList'); if (!el) return;
  const list = biblioCurrentPasta ? biblioDocs.filter(d => d.pastaId === biblioCurrentPasta) : biblioDocs;
  if (!list.length) { el.innerHTML = '<div class="biblio-empty">Nenhum documento aqui ainda. Clique em "+ Novo documento" para começar.</div>'; return; }
  el.innerHTML = list.map(d => `
    <div class="card biblio-doc-card" onclick="abrirDocumento('${d.id}')">
      <div class="bd-icon">${d.tipo || '📄'}</div>
      <div class="bd-body">
        <div class="bd-title">${d.titulo || '(sem título)'}</div>
        <div class="bd-meta">${d.autor ? d.autor + ' · ' : ''}${pastaNome(d.pastaId)}${d.data ? ' · ' + isoToBR(d.data) : ''}</div>
        ${d.tags && d.tags.length ? `<div class="bd-tags">${d.tags.map(t => `<span class="tag-chip">${t}</span>`).join('')}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function novoDocumento() {
  biblioCurrentDocId = null; docTagsAtual = [];
  renderDocPastaOptions(); renderDocMateriaOptions();
  document.getElementById('docTitulo').value = '';
  document.getElementById('docTipo').value = '📄';
  document.getElementById('docPasta').value = biblioCurrentPasta || '';
  document.getElementById('docAutor').value = '';
  document.getElementById('docFonte').value = '';
  document.getElementById('docMateria').value = '';
  document.getElementById('docData').value = '';
  document.getElementById('docSrsAtivo').checked = false;
  document.getElementById('docSrsStatus').textContent = '';
  document.getElementById('docConteudo').innerHTML = '';
  document.getElementById('docObservacoes').value = '';
  renderTagsInput();
  document.getElementById('biblioRelatedList').innerHTML = '<div class="biblio-empty" style="padding:14px;">Adicione tags para ver documentos relacionados.</div>';
  showBiblioPanel('edit');
  updateWordCount();
}

/* Clicar num card abre a visualização — só entra em modo de edição pelo botão "Editar" */
function abrirDocumento(id) {
  const d = biblioDocs.find(x => x.id === id); if (!d) return;
  biblioCurrentDocId = id;
  renderDocumentoView(d);
  showBiblioPanel('view');
}
function renderDocumentoView(d) {
  document.getElementById('viewIcon').textContent = d.tipo || '📄';
  document.getElementById('viewTitulo').textContent = d.titulo || '(sem título)';
  const metaParts = [];
  if (d.autor) metaParts.push(d.autor);
  metaParts.push(pastaNome(d.pastaId));
  if (d.materia) metaParts.push(d.materia);
  if (d.data) metaParts.push(isoToBR(d.data));
  document.getElementById('viewMeta').textContent = metaParts.join(' · ');
  document.getElementById('viewFonte').textContent = d.fonte ? ('Fonte: ' + d.fonte) : '';
  const revWrap = document.getElementById('viewRevisaoWrap');
  if (d.srsAtivo && d.srs) {
    revWrap.style.display = 'flex';
    document.getElementById('viewRevisaoData').textContent = isoToBR(d.srs.nextReview);
    document.getElementById('viewRevisaoIntervalo').textContent = d.srs.interval;
  } else { revWrap.style.display = 'none'; }
  document.getElementById('viewTags').innerHTML = (d.tags || []).map(t => `<span class="tag-chip">${t}</span>`).join('');
  const conteudoEl = document.getElementById('viewConteudo');
  conteudoEl.innerHTML = d.conteudo && d.conteudo.trim() ? d.conteudo : '<p style="color:var(--text-muted);">Documento vazio.</p>';
  conteudoEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.disabled = true);
  const obsWrap = document.getElementById('viewObservacoesWrap');
  if (d.observacoes && d.observacoes.trim()) { obsWrap.style.display = 'block'; document.getElementById('viewObservacoes').textContent = d.observacoes; }
  else { obsWrap.style.display = 'none'; }
  renderRelacionados(d, 'biblioRelatedListView');
}

function editarDocumentoAtual() {
  if (biblioCurrentDocId) abrirDocumentoEdit(biblioCurrentDocId);
}
function abrirDocumentoEdit(id) {
  const d = biblioDocs.find(x => x.id === id); if (!d) return;
  biblioCurrentDocId = id; docTagsAtual = [...(d.tags || [])];
  renderDocPastaOptions(); renderDocMateriaOptions();
  document.getElementById('docTitulo').value = d.titulo || '';
  document.getElementById('docTipo').value = d.tipo || '📄';
  document.getElementById('docPasta').value = d.pastaId || '';
  document.getElementById('docAutor').value = d.autor || '';
  document.getElementById('docFonte').value = d.fonte || '';
  document.getElementById('docMateria').value = d.materia || '';
  document.getElementById('docData').value = d.data || '';
  document.getElementById('docSrsAtivo').checked = !!d.srsAtivo;
  document.getElementById('docSrsStatus').textContent = d.srs
    ? `Próxima revisão: ${isoToBR(d.srs.nextReview)} · intervalo atual: ${d.srs.interval}d · ${d.srs.reps} revisão(ões) feita(s)`
    : '';
  document.getElementById('docConteudo').innerHTML = d.conteudo || '';
  document.getElementById('docObservacoes').value = d.observacoes || '';
  renderTagsInput();
  renderRelacionados(d, 'biblioRelatedList');
  showBiblioPanel('edit');
  updateWordCount();
}

function fecharDocumento() {
  showBiblioPanel('list');
  renderBiblioDocList(); renderBiblioTree();
}

function saveDocumento() {
  const titulo = document.getElementById('docTitulo').value.trim();
  if (!titulo) { alert('Dê um título ao documento.'); return; }
  const srsAtivo = document.getElementById('docSrsAtivo').checked;
  const dados = {
    titulo,
    tipo: document.getElementById('docTipo').value,
    pastaId: document.getElementById('docPasta').value || null,
    autor: document.getElementById('docAutor').value.trim(),
    fonte: document.getElementById('docFonte').value.trim(),
    materia: document.getElementById('docMateria').value,
    data: document.getElementById('docData').value,
    srsAtivo,
    conteudo: document.getElementById('docConteudo').innerHTML,
    observacoes: document.getElementById('docObservacoes').value,
    tags: [...docTagsAtual]
  };
  let d;
  if (biblioCurrentDocId) {
    d = biblioDocs.find(x => x.id === biblioCurrentDocId); Object.assign(d, dados);
  } else {
    d = { id: uid(), criadoEm: Date.now(), ...dados }; biblioDocs.unshift(d); biblioCurrentDocId = d.id;
  }
  if (srsAtivo && !d.srs) {
    d.srs = { interval: 1, reps: 0, nextReview: todayISO(), lastReview: null };
  }
  save('biblio_docs', biblioDocs);
  refreshStats();
  renderBiblioDocList(); renderBiblioTree(); renderBiblioReviewBar();
  renderDocumentoView(d);
  showBiblioPanel('view');
}
function deleteDocumentoAtual() {
  if (!biblioCurrentDocId) { fecharDocumento(); return; }
  if (!confirm('Excluir este documento definitivamente?')) return;
  biblioDocs = biblioDocs.filter(x => x.id !== biblioCurrentDocId);
  save('biblio_docs', biblioDocs); refreshStats(); renderBiblioReviewBar(); fecharDocumento();
}

/* Migra dados do antigo esquema (data única sincronizada com o Cronograma) para o novo SRS */
function migrarRevisaoAntigaBiblioteca() {
  let changed = false;
  biblioDocs.forEach(d => {
    if (d.cronogramaId) {
      cronograma = cronograma.filter(c => c.id !== d.cronogramaId);
      d.cronogramaId = null;
      changed = true;
    }
    if (d.proximaRevisao && !d.srs) {
      d.srsAtivo = true;
      d.srs = { interval: 1, reps: 0, nextReview: d.proximaRevisao, lastReview: null };
      delete d.proximaRevisao;
      changed = true;
    }
  });
  if (changed) { save('biblio_docs', biblioDocs); save('diplo_cronograma', cronograma); }
}

function renderTagsInput() {
  const wrap = document.getElementById('docTagsInput'); if (!wrap) return;
  const input = document.getElementById('docTagNovo');
  wrap.querySelectorAll('.tag-chip').forEach(c => c.remove());
  docTagsAtual.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${tag}<button type="button" onclick="removeTagDoc('${tag.replace(/'/g, "\\'")}')">✕</button>`;
    wrap.insertBefore(chip, input);
  });
}
function addTagDoc() {
  const input = document.getElementById('docTagNovo');
  const val = input.value.trim().replace(/^#/, '');
  if (!val) return;
  if (!docTagsAtual.includes(val)) docTagsAtual.push(val);
  input.value = ''; renderTagsInput();
}
function removeTagDoc(tag) { docTagsAtual = docTagsAtual.filter(t => t !== tag); renderTagsInput(); }

function renderRelacionados(doc, targetId) {
  const el = document.getElementById(targetId || 'biblioRelatedList'); if (!el) return;
  if (!doc || !doc.tags || !doc.tags.length) { el.innerHTML = '<div class="biblio-empty" style="padding:14px;">Adicione tags para ver documentos relacionados.</div>'; return; }
  const related = biblioDocs.filter(d => d.id !== doc.id && d.tags && d.tags.some(t => doc.tags.includes(t)));
  el.innerHTML = related.length
    ? related.map(d => `<div class="biblio-related-item" onclick="abrirDocumento('${d.id}')">${d.tipo || '📄'} ${d.titulo}</div>`).join('')
    : '<div class="biblio-empty" style="padding:14px;">Nenhum documento relacionado ainda.</div>';
}
