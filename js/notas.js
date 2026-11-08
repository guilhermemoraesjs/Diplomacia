/* ==========================================================================
   notas.js — módulo "Anotações": notas rápidas de estudo (texto simples).
   Para textos longos, formatação e fichamentos use a Biblioteca.
   Registros antigos {id, titulo, texto, criadoEm} continuam válidos.
   ========================================================================== */
let notas = load('diplo_notas', []) || [];
let notasBusca = '';
function notasSalvar() { save('diplo_notas', notas); }
function renderNotas() {
  const el = document.getElementById('notasRoot'); if (!el) return;
  const l = notas.filter(n => !notasBusca || norm((n.titulo || '') + ' ' + (n.texto || '') + ' ' + (n.materia || '')).includes(norm(notasBusca)));
  el.innerHTML = `<div class="page-head"><div><h2>Anotações</h2><p>Notas rápidas de estudo. Para textos longos, destaques e fichamentos, use a Biblioteca.</p></div><div class="page-actions"><button class="btn small" onclick="notaAbrirForm()">${icon('plus', 15)} Nova anotação</button></div></div>
    ${notas.length ? `<input type="search" id="notasBuscaIn" placeholder="Buscar anotações..." value="${escAttr(notasBusca)}" oninput="notasBusca=this.value;notasRefiltrar()" aria-label="Buscar anotações" style="margin-bottom:12px;max-width:420px;">` : ''}
    ${!notas.length ? `<div class="empty-state">${icon('sticky-note')}<b>Nenhuma anotação</b><p>Registre ideias, dúvidas e lembretes de estudo.</p><button class="btn small" onclick="notaAbrirForm()">${icon('plus', 14)} Criar anotação</button></div>`
      : l.map(n => `<article class="card"><div class="qb-card-top">${n.materia ? `<span class="badge gold">${escHtml(n.materia)}</span>` : ''}<span class="badge">${new Date(n.criadoEm || Date.now()).toLocaleDateString('pt-BR')}</span></div><h4 style="margin:4px 0;">${escHtml(n.titulo)}</h4><p class="pre" style="margin:0 0 8px;">${escHtml(n.texto)}</p><div class="row"><button class="icon-btn" onclick="notaAbrirForm('${n.id}')" aria-label="Editar anotação">${icon('pen', 16)}</button><button class="icon-btn" onclick="notaExcluir('${n.id}')" aria-label="Excluir anotação">${icon('trash', 16)}</button></div></article>`).join('')}`;
}
function notasRefiltrar() { const foco = document.activeElement && document.activeElement.id === 'notasBuscaIn'; renderNotas(); if (foco) { const i = document.getElementById('notasBuscaIn'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
function notaAbrirForm(id) {
  const n = id ? notas.find(x => x.id === id) : null;
  crModal(`<h3>${n ? 'Editar anotação' : 'Nova anotação'}</h3><label class="field-label" for="nfTit">Título *</label><input type="text" id="nfTit" value="${escAttr(n ? n.titulo : '')}">
    <label class="field-label" for="nfMat">Matéria</label><select id="nfMat"><option value="">—</option>${materias.map(m => `<option ${n && n.materia === m.nome ? 'selected' : ''}>${escHtml(m.nome)}</option>`).join('')}</select>
    <label class="field-label" for="nfTxt">Texto</label><textarea id="nfTxt" style="min-height:140px;">${escHtml(n ? n.texto : '')}</textarea><div id="nfErro" class="form-erro" role="alert"></div>
    <div class="modal-actions"><button class="btn ghost small" onclick="crFecharModal()">Cancelar</button><button class="btn small" onclick="notaSalvar(${n ? `'${n.id}'` : 'null'})">Salvar</button></div>`);
}
function notaSalvar(id) {
  const t = document.getElementById('nfTit').value.trim(); if (!t) { document.getElementById('nfErro').textContent = 'Informe um título.'; return; }
  const d = { titulo: t, materia: document.getElementById('nfMat').value, texto: document.getElementById('nfTxt').value };
  if (id) Object.assign(notas.find(x => x.id === id), d, { editadoEm: Date.now() }); else notas.unshift(Object.assign({ id: uid(), criadoEm: Date.now() }, d));
  notasSalvar(); crFecharModal(); renderNotas(); refreshStats(); toast('Anotação salva.');
}
async function notaExcluir(id) { const n = notas.find(x => x.id === id); if (!n || !await confirmar(`Excluir "${n.titulo}"?`, { titulo: 'Excluir anotação', ok: 'Excluir' })) return; notas = notas.filter(x => x.id !== id); notasSalvar(); renderNotas(); refreshStats(); }
function addNota() { notaAbrirForm(); }
