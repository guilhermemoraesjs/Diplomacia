/* ==========================================================================
   biblioteca-documentos.js — módulo "Biblioteca → Documentos": CRUD de
   fichamentos/documentos, painéis de lista/visualização/edição, tags,
   painel lateral (revisão/conexões/relacionados/estatísticas) e
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
        <div class="bd-title">${d.favorita ? '★ ' : ''}${d.titulo || '(sem título)'}</div>
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
  document.getElementById('docDescricao').value = '';
  document.getElementById('docTipo').value = '📄';
  document.getElementById('docPasta').value = biblioCurrentPasta || '';
  document.getElementById('docAutor').value = '';
  document.getElementById('docFonte').value = '';
  document.getElementById('docMateria').value = '';
  document.getElementById('docData').value = '';
  document.getElementById('docPrioridade').value = '';
  document.getElementById('docSrsAtivo').checked = false;
  document.getElementById('docSrsAutomatico').checked = true;
  document.getElementById('docSrsData').value = addDaysISO(todayISO(), 7);
  document.getElementById('docSrsHora').value = '09:00';
  document.getElementById('docSrsPreset').value = '7';
  document.getElementById('docSrsStatus').textContent = '';
  document.getElementById('docConteudo').innerHTML = '';
  document.getElementById('docObservacoes').value = '';
  document.getElementById('docFavBtn').textContent = '☆ Favorita';
  document.getElementById('docFavBtn').classList.remove('active');
  document.getElementById('docMetaCriado').textContent = 'Ainda não salvo';
  document.getElementById('docMetaEditado').textContent = '';
  renderTagsInput();
  atualizarControlesRevisao();
  atualizarBreadcrumbTitulo();
  setBiblioPanelTab('painel');
  renderPainelConexoes(null);
  renderPainelRelacionados(null);
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
  if (d.srsAtivo && d.srs && d.srs.nextReview) {
    revWrap.style.display = 'flex';
    document.getElementById('viewRevisaoData').textContent = isoToBR(d.srs.nextReview);
    document.getElementById('viewRevisaoIntervalo').textContent = d.srs.interval || '—';
  } else { revWrap.style.display = 'none'; }
  document.getElementById('viewTags').innerHTML = (d.tags || []).map(t => `<span class="tag-chip">${t}</span>`).join('');
  const conteudoEl = document.getElementById('viewConteudo');
  conteudoEl.innerHTML = destacarConexoesTexto(d.conteudo && d.conteudo.trim() ? d.conteudo : '<p style="color:var(--text-muted);">Documento vazio.</p>');
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
  document.getElementById('docDescricao').value = d.descricao || '';
  document.getElementById('docTipo').value = d.tipo || '📄';
  document.getElementById('docPasta').value = d.pastaId || '';
  document.getElementById('docAutor').value = d.autor || '';
  document.getElementById('docFonte').value = d.fonte || '';
  document.getElementById('docMateria').value = d.materia || '';
  document.getElementById('docData').value = d.data || '';
  document.getElementById('docPrioridade').value = d.prioridade || '';
  document.getElementById('docSrsAtivo').checked = !!d.srsAtivo;
  const modoAuto = !d.srs || d.srs.modo !== 'manual';
  document.getElementById('docSrsAutomatico').checked = modoAuto;
  document.getElementById('docSrsData').value = (d.srs && d.srs.nextReview) || addDaysISO(todayISO(), 7);
  document.getElementById('docSrsHora').value = (d.srs && d.srs.nextReviewHora) || '09:00';
  document.getElementById('docSrsPreset').value = '7';
  document.getElementById('docSrsStatus').textContent = d.srs
    ? `Última revisão: ${d.srs.lastReview ? isoToBR(d.srs.lastReview) : 'ainda não revisado'} · ${d.srs.reps || 0} revisão(ões) feita(s)`
    : '';
  document.getElementById('docConteudo').innerHTML = d.conteudo || '';
  document.getElementById('docObservacoes').value = d.observacoes || '';
  const favBtn = document.getElementById('docFavBtn');
  favBtn.textContent = d.favorita ? '★ Favorita' : '☆ Favorita';
  favBtn.classList.toggle('active', !!d.favorita);
  document.getElementById('docMetaCriado').textContent = 'Criada em ' + isoToBR(new Date(d.criadoEm).toISOString().slice(0, 10));
  document.getElementById('docMetaEditado').textContent = d.editadoEm ? '· Editada ' + tempoRelativo(new Date(d.editadoEm).toISOString()) : '';
  renderTagsInput();
  atualizarControlesRevisao();
  atualizarBreadcrumbTitulo();
  setBiblioPanelTab('painel');
  renderPainelConexoes(d);
  renderPainelRelacionados(d);
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
  const srsAutomatico = document.getElementById('docSrsAutomatico').checked;
  const dados = {
    titulo,
    descricao: document.getElementById('docDescricao').value.trim(),
    tipo: document.getElementById('docTipo').value,
    pastaId: document.getElementById('docPasta').value || null,
    autor: document.getElementById('docAutor').value.trim(),
    fonte: document.getElementById('docFonte').value.trim(),
    materia: document.getElementById('docMateria').value,
    data: document.getElementById('docData').value,
    prioridade: document.getElementById('docPrioridade').value,
    srsAtivo,
    conteudo: document.getElementById('docConteudo').innerHTML,
    observacoes: document.getElementById('docObservacoes').value,
    tags: [...docTagsAtual],
    editadoEm: Date.now()
  };
  let d;
  if (biblioCurrentDocId) {
    d = biblioDocs.find(x => x.id === biblioCurrentDocId); Object.assign(d, dados);
  } else {
    d = { id: uid(), criadoEm: Date.now(), favorita: false, ...dados }; biblioDocs.unshift(d); biblioCurrentDocId = d.id;
  }
  if (srsAtivo) {
    if (srsAutomatico) {
      if (!d.srs || d.srs.modo === 'manual') d.srs = { modo: 'automatico', interval: 1, reps: 0, nextReview: todayISO(), lastReview: null };
      else d.srs.modo = 'automatico';
    } else {
      d.srs = {
        modo: 'manual',
        interval: d.srs ? d.srs.interval || 1 : 1,
        reps: d.srs ? d.srs.reps || 0 : 0,
        nextReview: document.getElementById('docSrsData').value || todayISO(),
        nextReviewHora: document.getElementById('docSrsHora').value || '09:00',
        lastReview: d.srs ? d.srs.lastReview || null : null
      };
    }
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
      d.srs = { modo: 'automatico', interval: 1, reps: 0, nextReview: d.proximaRevisao, lastReview: null };
      delete d.proximaRevisao;
      changed = true;
    }
    if (d.srs && !d.srs.modo) d.srs.modo = 'automatico';
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

/* ==========================================================================
   Painel lateral novo — favoritar/prioridade, revisão customizável,
   conexões com Países (dados reais), relacionados e estatísticas.
   ========================================================================== */
function setBiblioPanelTab(tab) {
  document.querySelectorAll('.bp-tab').forEach(b => b.classList.toggle('active', b.dataset.ptab === tab));
  document.getElementById('bpPainel').style.display = tab === 'painel' ? 'block' : 'none';
  document.getElementById('bpPropriedades').style.display = tab === 'propriedades' ? 'block' : 'none';
}
function atualizarBreadcrumbTitulo() {
  const bcP = document.getElementById('bcPastaLabel'); const bcT = document.getElementById('bcTituloLabel');
  const pastaSel = document.getElementById('docPasta');
  if (bcP) bcP.textContent = pastaSel && pastaSel.value ? pastaNome(pastaSel.value) : 'Sem pasta';
  if (bcT) bcT.textContent = document.getElementById('docTitulo').value.trim() || 'Novo documento';
}
function toggleDocFavorita() {
  const btn = document.getElementById('docFavBtn');
  const ativo = !btn.classList.contains('active');
  btn.classList.toggle('active', ativo);
  btn.textContent = ativo ? '★ Favorita' : '☆ Favorita';
  if (biblioCurrentDocId) { const d = biblioDocs.find(x => x.id === biblioCurrentDocId); if (d) { d.favorita = ativo; save('biblio_docs', biblioDocs); } }
}
function atualizarControlesRevisao() {
  const ativo = document.getElementById('docSrsAtivo').checked;
  const automatico = document.getElementById('docSrsAutomatico').checked;
  const controles = document.getElementById('docSrsControles');
  controles.style.opacity = ativo ? '1' : '.4';
  controles.style.pointerEvents = ativo ? 'auto' : 'none';
  ['docSrsData', 'docSrsHora', 'docSrsPreset'].forEach(id => { document.getElementById(id).disabled = !ativo || automatico; });
}
function aplicarIntervaloPreset(dias) {
  if (!dias) return;
  document.getElementById('docSrsData').value = addDaysISO(todayISO(), parseInt(dias));
}

/* Varre o texto em busca de nomes de países já cadastrados no módulo
   Países e devolve os que aparecem — base real de "Conexões". */
function paisesMencionadosNoTexto(texto) {
  if (typeof paises === 'undefined' || !texto) return [];
  const plano = texto.replace(/<[^>]+>/g, ' ').toLowerCase();
  return paises.filter(p => plano.includes(p.nome.toLowerCase()));
}
function renderPainelConexoes(d) {
  const el = document.getElementById('painelConexoes'); if (!el) return;
  const conteudo = document.getElementById('docConteudo') ? document.getElementById('docConteudo').innerHTML : (d ? d.conteudo : '');
  const paisesEncontrados = paisesMencionadosNoTexto(conteudo || '');
  el.innerHTML = `
    <div class="panel-conn-row" ${paisesEncontrados.length ? `onclick="mostrarConexoesPaises()"` : ''}>
      <span>🌍 Países</span><span class="mono">${paisesEncontrados.length}</span>
    </div>
    <div class="panel-conn-row disabled"><span>🏛️ Organizações</span><span class="mono">em breve</span></div>
    <div class="panel-conn-row disabled"><span>📜 Tratados</span><span class="mono">em breve</span></div>
  `;
  window._paisesConectados = paisesEncontrados;
}
function mostrarConexoesPaises() {
  const lista = window._paisesConectados || [];
  if (!lista.length) return;
  if (lista.length === 1) { goTab('paises'); goSub('paisesLista'); setTimeout(() => abrirPaisDetalhe(lista[0].id), 50); return; }
  alert('Países mencionados: ' + lista.map(p => p.nome).join(', ') + '\n\nClique num nome de país destacado no texto (modo visualização) para abrir a ficha dele diretamente.');
}
function abrirTodasConexoes() { mostrarConexoesPaises(); }

function renderPainelRelacionados(d) {
  const el = document.getElementById('painelRelacionados'); if (!el) return;
  const tags = docTagsAtual || [];
  const outrasNotas = d ? biblioDocs.filter(x => x.id !== d.id && x.tags && x.tags.some(t => tags.includes(t))) : [];
  const questoesRelacionadas = (typeof simuladosQuestoesIndex !== 'undefined')
    ? simuladosQuestoesIndex.filter(q => tags.some(t => q.tema.toLowerCase().includes(t.toLowerCase())))
    : [];
  el.innerHTML = `
    <div class="panel-conn-row"><span>❓ Questões relacionadas</span><span class="mono">${questoesRelacionadas.length}</span></div>
    <div class="panel-conn-row disabled"><span>🔁 Flashcards relacionados</span><span class="mono">em breve</span></div>
    <div class="panel-conn-row disabled"><span>📰 Notícias relacionadas</span><span class="mono">em breve</span></div>
    <div class="panel-conn-row" onclick="document.querySelector('.biblio-related')?.scrollIntoView({behavior:'smooth'})"><span>📄 Outras anotações</span><span class="mono">${outrasNotas.length}</span></div>
  `;
}

/* Envolve nomes de países reconhecidos em links clicáveis, só no modo
   de VISUALIZAÇÃO (não mexe no HTML salvo, é aplicado na hora de exibir). */
function destacarConexoesTexto(html) {
  if (typeof paises === 'undefined') return html;
  let out = html;
  paises.forEach(p => {
    const re = new RegExp(`\\b(${p.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'g');
    out = out.replace(re, `<a href="#" class="wikilink" onclick="event.preventDefault(); goTab('paises'); goSub('paisesLista'); setTimeout(()=>abrirPaisDetalhe('${p.id}'),50);">$1</a>`);
  });
  return out;
}

function acaoIAEmBreve(nome) {
  alert(`"${nome}" ainda não está disponível — essa função vai exigir uma chave de API de IA configurada no projeto. Assim que decidirmos isso juntos, eu ligo esse botão de verdade.`);
}
