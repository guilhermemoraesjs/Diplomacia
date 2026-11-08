/* ==========================================================================
   atualidades.js — módulo "Atualidades": acontecimentos internacionais e
   nacionais organizados por data, matéria, países, organizações e tratados.
   Conteúdo é SEU: nada é preenchido automaticamente nem inventado; cite a
   fonte de cada registro. Os vínculos alimentam a Base de conhecimento e a
   aba "Meu acervo" da ficha de cada país.

   Registros antigos {id, titulo, resumo, criadoEm} continuam válidos.
   ========================================================================== */
function atNorm(a) {
  if (!a.data) a.data = ymdLocal(new Date(a.criadoEm || Date.now()));
  if (!a.escopo) a.escopo = 'internacional';
  ['resumo', 'contexto', 'materia', 'fonte', 'url', 'obs'].forEach(k => { if (a[k] == null) a[k] = ''; });
  ['paises', 'organizacoes', 'tratados', 'outros', 'tags'].forEach(k => { if (!Array.isArray(a[k])) a[k] = []; });
  if (!a.criadoEm) a.criadoEm = Date.now();
  return a;
}
let atualidades = (load('diplo_atualidades', []) || []).map(atNorm);
function atSalvar() { save('diplo_atualidades', atualidades); }
const atFiltro = { busca: '', escopo: '', materia: '', tag: '' };

function atUrlSegura(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
function renderAtualidades() {
  const el = document.getElementById('atRoot'); if (!el) return;
  const l = atualidades.filter(a => (!atFiltro.escopo || a.escopo === atFiltro.escopo) && (!atFiltro.materia || a.materia === atFiltro.materia) && (!atFiltro.tag || a.tags.includes(atFiltro.tag)) &&
    (!atFiltro.busca || norm([a.titulo, a.resumo, a.contexto, a.fonte, a.tags.join(' ')].join(' ')).includes(norm(atFiltro.busca)))).sort((a, b) => b.data.localeCompare(a.data));
  const tags = [...new Set(atualidades.flatMap(a => a.tags))].sort();
  el.innerHTML = `<div class="page-head"><div><h2>Atualidades</h2><p>Registre acontecimentos internacionais e nacionais com contexto, fonte e vínculos a países, organizações e tratados.</p></div><div class="page-actions"><button class="btn small" onclick="atAbrirForm()">${icon('plus', 15)} Novo acontecimento</button></div></div>
    ${atualidades.length ? `<div class="card flat qb-filtros"><input type="search" id="atBusca" placeholder="Buscar por título, resumo, fonte ou tag..." value="${escAttr(atFiltro.busca)}" oninput="atFiltro.busca=this.value;atRefiltrar()" aria-label="Buscar atualidades">
      <div class="qb-filtros-grid"><select aria-label="Escopo" onchange="atFiltro.escopo=this.value;renderAtualidades()"><option value="">Internacional e nacional</option><option value="internacional" ${atFiltro.escopo === 'internacional' ? 'selected' : ''}>Internacional</option><option value="nacional" ${atFiltro.escopo === 'nacional' ? 'selected' : ''}>Nacional</option></select>
        <select aria-label="Matéria" onchange="atFiltro.materia=this.value;renderAtualidades()"><option value="">Todas as matérias</option>${[...new Set(atualidades.map(a => a.materia).filter(Boolean))].sort().map(m => `<option ${m === atFiltro.materia ? 'selected' : ''}>${escHtml(m)}</option>`).join('')}</select>
        <select aria-label="Tag" onchange="atFiltro.tag=this.value;renderAtualidades()"><option value="">Todas as tags</option>${tags.map(t => `<option ${t === atFiltro.tag ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}</select></div></div>` : ''}
    <div id="atLista">${atListaHTML(l)}</div>`;
}
function atRefiltrar() { const foco = document.activeElement && document.activeElement.id === 'atBusca'; renderAtualidades(); if (foco) { const i = document.getElementById('atBusca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
function atChips(a) {
  const nomeP = id => { const p = (typeof paises !== 'undefined' ? paises : []).find(x => x.id === id); return p ? p.nome : id; };
  return [...a.paises.map(id => `<button class="chip" onclick="goTab('paises');setTimeout(()=>abrirPaisDetalhe(${jsArg(id)}),60)">${icon('globe', 12)} ${escHtml(nomeP(id))}</button>`),
    ...[...a.organizacoes, ...a.tratados, ...a.outros].map(id => { const e = kbPorId(id); return e ? `<button class="chip" onclick="goTab('conhecimento');kbAbrir(${jsArg(id)})">${escHtml(e.sigla || e.nome)}</button>` : ''; })].join('');
}
function atListaHTML(l) {
  if (!atualidades.length) return `<div class="empty-state">${icon('newspaper')}<b>Nenhum acontecimento registrado</b><p>Cadastre fatos relevantes com data, resumo, contexto e fonte. Depois relacione-os a países, organizações e tratados.</p><button class="btn small" onclick="atAbrirForm()">${icon('plus', 14)} Registrar o primeiro</button></div>`;
  if (!l.length) return `<div class="empty-state">${icon('filter')}<b>Nada encontrado</b><p>Ajuste os filtros de busca.</p></div>`;
  return l.map(a => `<article class="card at-card"><div class="qb-card-top"><span class="badge ${a.escopo === 'nacional' ? 'ok' : 'blue'}">${a.escopo === 'nacional' ? 'Nacional' : 'Internacional'}</span><span class="badge">${isoToBR(a.data)}</span>${a.materia ? `<span class="badge gold">${escHtml(a.materia)}</span>` : ''}</div>
    <h4 style="margin:6px 0 4px;">${escHtml(a.titulo)}</h4>${a.resumo ? `<p class="pre" style="margin:0 0 8px;">${escHtml(a.resumo)}</p>` : ''}
    <div class="filters" style="margin-bottom:8px;">${atChips(a)}</div>
    ${(a.contexto || a.obs || a.fonte) ? `<details class="at-det"><summary>Contexto, fonte e observações</summary>${a.contexto ? `<div class="field-label">Contexto histórico</div><p class="pre">${escHtml(a.contexto)}</p>` : ''}${a.fonte ? `<div class="field-label">Fonte</div><p>${atUrlSegura(a.url) ? `<a href="${escAttr(a.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;">${escHtml(a.fonte)}</a>` : escHtml(a.fonte)}</p>` : ''}${a.obs ? `<div class="field-label">Observações pessoais</div><p class="pre">${escHtml(a.obs)}</p>` : ''}</details>` : ''}
    <div class="row between"><div class="qb-tags">${a.tags.map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('')}</div><div class="row"><button class="icon-btn" onclick="atAbrirForm('${a.id}')" aria-label="Editar">${icon('pen', 16)}</button><button class="icon-btn" onclick="atCriarFlashcard('${a.id}')" aria-label="Criar flashcard" title="Criar flashcard">${icon('layers', 16)}</button><button class="icon-btn" onclick="atExcluir('${a.id}')" aria-label="Excluir">${icon('trash', 16)}</button></div></div></article>`).join('');
}
function atAbrirForm(id) {
  const a = id ? atualidades.find(x => x.id === id) : null;
  crModal(`<h3>${a ? 'Editar acontecimento' : 'Novo acontecimento'}</h3>
    <label class="field-label" for="atfTit">Título *</label><input type="text" id="atfTit" value="${escAttr(a ? a.titulo : '')}" autocomplete="off">
    <div class="row3"><div><label class="field-label" for="atfData">Data</label><input type="date" id="atfData" value="${a ? a.data : todayISO()}"></div><div><label class="field-label" for="atfEsc">Escopo</label><select id="atfEsc"><option value="internacional" ${a && a.escopo === 'internacional' ? 'selected' : ''}>Internacional</option><option value="nacional" ${a && a.escopo === 'nacional' ? 'selected' : ''}>Nacional</option></select></div>
      <div><label class="field-label" for="atfMat">Matéria relacionada</label><select id="atfMat"><option value="">—</option>${materias.map(m => `<option ${a && a.materia === m.nome ? 'selected' : ''}>${escHtml(m.nome)}</option>`).join('')}</select></div></div>
    <label class="field-label" for="atfRes">Resumo</label><textarea id="atfRes" placeholder="O que aconteceu?">${escHtml(a ? a.resumo : '')}</textarea>
    <label class="field-label" for="atfCtx">Contexto histórico</label><textarea id="atfCtx" placeholder="Antecedentes e relação com outros processos">${escHtml(a ? a.contexto : '')}</textarea>
    ${kbPickerHTML('atP', 'Países envolvidos', 'pais', a ? a.paises : [])}${kbPickerHTML('atO', 'Organizações envolvidas', ['organizacao'], a ? a.organizacoes : [])}${kbPickerHTML('atT', 'Tratados e acordos relacionados', ['tratado', 'acordo'], a ? a.tratados : [])}${kbPickerHTML('atX', 'Conflitos e temas de RI relacionados', ['conflito', 'tema'], a ? a.outros : [])}
    <div class="row2 stack-m"><div><label class="field-label" for="atfFonte">Fonte</label><input type="text" id="atfFonte" value="${escAttr(a ? a.fonte : '')}" placeholder="Jornal, órgão, data de acesso"></div><div><label class="field-label" for="atfUrl">Link (opcional)</label><input type="url" id="atfUrl" value="${escAttr(a ? a.url : '')}" placeholder="https://"></div></div>
    <label class="field-label" for="atfTags">Tags (vírgulas)</label><input type="text" id="atfTags" value="${escAttr(a ? a.tags.join(', ') : '')}">
    <label class="field-label" for="atfObs">Observações pessoais</label><textarea id="atfObs" style="min-height:60px;">${escHtml(a ? a.obs : '')}</textarea><div id="atfErro" class="form-erro" role="alert"></div>
    <div class="modal-actions"><button class="btn ghost small" onclick="crFecharModal()">Cancelar</button><button class="btn small" onclick="atSalvarForm(${a ? `'${a.id}'` : 'null'})">Salvar</button></div>`);
}
function atSalvarForm(id) {
  const tit = document.getElementById('atfTit').value.trim(); if (!tit) { document.getElementById('atfErro').textContent = 'Informe o título.'; return; }
  const url = document.getElementById('atfUrl').value.trim(); if (url && !atUrlSegura(url)) { document.getElementById('atfErro').textContent = 'O link deve começar com http:// ou https://'; return; }
  const dados = { titulo: tit, data: document.getElementById('atfData').value || todayISO(), escopo: document.getElementById('atfEsc').value, materia: document.getElementById('atfMat').value, resumo: document.getElementById('atfRes').value.trim(), contexto: document.getElementById('atfCtx').value.trim(),
    paises: kbPickerValores('atP'), organizacoes: kbPickerValores('atO'), tratados: kbPickerValores('atT'), outros: kbPickerValores('atX'), fonte: document.getElementById('atfFonte').value.trim(), url, tags: document.getElementById('atfTags').value.split(',').map(t => t.trim()).filter(Boolean), obs: document.getElementById('atfObs').value.trim(), editadoEm: Date.now() };
  if (id) Object.assign(atualidades.find(x => x.id === id), dados); else atualidades.unshift(atNorm(Object.assign({ id: uid(), criadoEm: Date.now() }, dados)));
  atSalvar(); crFecharModal(); renderAtualidades(); refreshStats(); toast('Acontecimento salvo.');
}
async function atExcluir(id) { const a = atualidades.find(x => x.id === id); if (!a) return; if (!await confirmar(`Excluir "${a.titulo}"?`, { titulo: 'Excluir acontecimento', ok: 'Excluir' })) return; atualidades = atualidades.filter(x => x.id !== id); atSalvar(); renderAtualidades(); refreshStats(); toast('Acontecimento excluído.'); }
function atCriarFlashcard(id) {
  const a = atualidades.find(x => x.id === id); if (!a || typeof flashCriarCard !== 'function') return;
  flashCriarCard({ tipo: 'basico', frente: a.titulo, verso: [a.resumo, a.contexto].filter(Boolean).join('\n\n') || '(complete o verso)', disciplina: a.materia, tema: 'Atualidades', tags: a.tags, fonte: a.fonte || 'Atualidades', origemTipo: 'manual' });
  toast('Flashcard criado a partir do acontecimento.');
}
function addAtualidade() { atAbrirForm(); }   // compatibilidade
