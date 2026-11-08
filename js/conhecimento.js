/* ==========================================================================
   conhecimento.js — "Base de conhecimento": fichas SUAS de organizações
   internacionais, tratados, acordos, conflitos e temas de Relações
   Internacionais, ligadas entre si, a países e a acontecimentos
   (Atualidades). Nenhum conteúdo é pré-carregado: o objetivo é organizar o
   seu material, sempre com fonte. (diplo_kb)

   Ficha: { id, tipo, nome, sigla, ano, resumo, contexto, paises[ids de país],
   rel[ids de outras fichas], tags, fonte, obs }.
   Vínculos são exibidos nos dois sentidos (A→B aparece também em B).
   ========================================================================== */
const KB_TIPOS = { organizacao: ['Organização', 'landmark'], tratado: ['Tratado', 'file-text'], acordo: ['Acordo', 'link'], conflito: ['Conflito', 'flag'], tema: ['Tema de RI', 'network'] };
function kbNorm(e) { ['sigla', 'ano', 'resumo', 'contexto', 'fonte', 'obs'].forEach(k => { if (e[k] == null) e[k] = ''; }); ['paises', 'rel', 'tags'].forEach(k => { if (!Array.isArray(e[k])) e[k] = []; }); if (!e.criadoEm) e.criadoEm = Date.now(); return e; }
let kbItens = (load('diplo_kb', []) || []).map(kbNorm);
function kbSalvar() { save('diplo_kb', kbItens); }
function kbPorId(id) { return kbItens.find(e => e.id === id); }
const kbEstado = { tipo: '', busca: '', aberto: null };
function kbDefinirFiltro(tipo) { kbEstado.tipo = tipo || ''; kbEstado.aberto = null; renderKB(); }
function kbNomePais(id) { const p = (typeof paises !== 'undefined' ? paises : []).find(x => x.id === id); return p ? p.nome : id; }
/* vínculos nos dois sentidos */
function kbRelacionadas(id) { const e = kbPorId(id); const dir = e ? e.rel : []; return kbItens.filter(x => x.id !== id && (dir.includes(x.id) || x.rel.includes(id))); }
function kbAtualidadesDe(id) { return atualidades.filter(a => [...a.organizacoes, ...a.tratados, ...a.outros].includes(id)); }
function kbDoPais(paisId) { return kbItens.filter(e => e.paises.includes(paisId)); }
function kbAtualidadesDoPais(paisId) { return atualidades.filter(a => a.paises.includes(paisId)); }

/* ---- seletor de vínculos (chips + busca) ---- */
const _kbPick = {};
function kbOpcoes(tipos) {
  if (tipos === 'pais') return (typeof paises !== 'undefined' ? paises : []).map(p => ({ v: p.id, l: p.nome }));
  return kbItens.filter(e => tipos.includes(e.tipo)).map(e => ({ v: e.id, l: e.sigla ? `${e.nome} (${e.sigla})` : e.nome, alt: e.sigla }));
}
function kbPickerHTML(id, rotulo, tipos, valores) {
  _kbPick[id] = { tipos, valores: [...(valores || [])], novos: [] };
  return `<div class="kb-picker"><label class="field-label" for="${id}_in">${rotulo}</label><div class="filters" id="${id}_chips"></div>
    <input type="text" id="${id}_in" list="${id}_dl" placeholder="${tipos === 'pais' ? 'Digite e escolha um país' : 'Digite para buscar ou criar'}" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();kbPickerAdd('${id}')}" onchange="kbPickerAdd('${id}')"><datalist id="${id}_dl">${kbOpcoes(tipos).map(o => `<option value="${escAttr(o.l)}">`).join('')}</datalist></div>${kbPickerChipsScript(id)}`;
}
function kbPickerChipsScript(id) { setTimeout(() => kbPickerRender(id), 0); return ''; }
function kbPickerRender(id) {
  const st = _kbPick[id], el = document.getElementById(id + '_chips'); if (!el) return;
  el.innerHTML = st.valores.map(v => { const o = st.tipos === 'pais' ? { l: kbNomePais(v) } : (kbPorId(v) ? { l: kbPorId(v).nome } : { l: String(v).replace(/^novo:\w+:/, '') }); return `<span class="chip active">${escHtml(o.l)}<button type="button" onclick="kbPickerRemover('${id}',${jsArg(v)})" aria-label="Remover ${escAttr(o.l)}" style="background:none;border:none;color:inherit;cursor:pointer;padding:0 0 0 4px;">${icon('x', 12)}</button></span>`; }).join('');
}
function kbPickerAdd(id) {
  const st = _kbPick[id], inp = document.getElementById(id + '_in'), txt = inp.value.trim(); if (!txt) return;
  const n = norm(txt), o = kbOpcoes(st.tipos).find(x => norm(x.l) === n || (x.alt && norm(x.alt) === n) || norm(x.l).startsWith(n + ' ('));
  if (o) { if (!st.valores.includes(o.v)) st.valores.push(o.v); }
  else if (st.tipos === 'pais') { toast('País não encontrado na lista. Escolha uma opção sugerida.', 'aviso'); return; }
  else { const v = 'novo:' + st.tipos[0] + ':' + txt; if (!st.valores.includes(v)) st.valores.push(v); }       // será criado ao salvar
  inp.value = ''; kbPickerRender(id);
}
function kbPickerRemover(id, v) { const st = _kbPick[id]; st.valores = st.valores.filter(x => x !== v); kbPickerRender(id); }
/* Resolve os valores: fichas novas digitadas à mão são criadas na base (com aviso). */
function kbPickerValores(id) {
  const inp = document.getElementById(id + '_in'); if (inp && inp.value.trim()) kbPickerAdd(id);
  const st = _kbPick[id], out = [];
  st.valores.forEach(v => { if (/^novo:/.test(v)) { const [, tipo, ...r] = v.split(':'); const nome = r.join(':'); let e = kbItens.find(x => x.tipo === tipo && norm(x.nome) === norm(nome)); if (!e) { e = kbNorm({ id: uid(), tipo, nome }); kbItens.push(e); kbSalvar(); toast(`Ficha "${nome}" criada na Base de conhecimento. Complete-a depois.`); } out.push(e.id); } else out.push(v); });
  return [...new Set(out)];
}

/* ---- tela ---- */
function renderKB() {
  const el = document.getElementById('kbRoot'); if (!el) return;
  if (kbEstado.aberto && kbPorId(kbEstado.aberto)) { el.innerHTML = kbDetalheHTML(kbPorId(kbEstado.aberto)); return; }
  kbEstado.aberto = null;
  const l = kbItens.filter(e => (!kbEstado.tipo || e.tipo === kbEstado.tipo) && (!kbEstado.busca || norm([e.nome, e.sigla, e.resumo, e.tags.join(' ')].join(' ')).includes(norm(kbEstado.busca)))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const rotulo = kbEstado.tipo ? { organizacao: 'Organizações internacionais', tratado: 'Tratados', acordo: 'Acordos', conflito: 'Conflitos', tema: 'Temas de Relações Internacionais' }[kbEstado.tipo] : 'Base de conhecimento';
  el.innerHTML = `<div class="page-head"><div><h2>${rotulo}</h2><p>Fichas pessoais ligadas a países, acontecimentos e entre si. Ao abrir uma ficha você vê tudo o que cadastrou relacionado a ela. Cite sempre a fonte.</p></div><div class="page-actions"><button class="btn small" onclick="kbAbrirForm(null, '${kbEstado.tipo || ''}')">${icon('plus', 15)} Nova ficha</button></div></div>
    <div class="filters"><button class="chip ${!kbEstado.tipo ? 'active' : ''}" onclick="kbDefinirFiltro('')">Todas (${kbItens.length})</button>${Object.entries(KB_TIPOS).map(([k, [n]]) => `<button class="chip ${kbEstado.tipo === k ? 'active' : ''}" onclick="kbDefinirFiltro('${k}')">${n}s (${kbItens.filter(e => e.tipo === k).length})</button>`).join('')}</div>
    ${kbItens.length ? `<input type="search" id="kbBusca" placeholder="Buscar fichas..." value="${escAttr(kbEstado.busca)}" oninput="kbEstado.busca=this.value;kbRefiltrar()" aria-label="Buscar fichas" style="margin-bottom:12px;">` : ''}
    ${!kbItens.length ? `<div class="empty-state">${icon('network')}<b>Sua base de conhecimento está vazia</b><p>Crie fichas de organizações, tratados, acordos, conflitos e temas. Relacione-as a países e acontecimentos para enxergar as conexões.</p><button class="btn small" onclick="kbAbrirForm()">${icon('plus', 14)} Criar primeira ficha</button></div>`
      : !l.length ? `<div class="empty-state">${icon('filter')}<b>Nenhuma ficha neste filtro</b><p>Crie uma nova ou mude o filtro.</p></div>`
      : `<div class="kb-grid">${l.map(e => `<button class="card kb-card" onclick="kbAbrir('${e.id}')"><div class="qb-card-top"><span class="badge gold">${icon(KB_TIPOS[e.tipo][1], 12)} ${KB_TIPOS[e.tipo][0]}</span>${e.ano ? `<span class="badge">${escHtml(e.ano)}</span>` : ''}</div><h4 style="margin:4px 0;">${escHtml(e.nome)}${e.sigla ? ` <span class="muted">(${escHtml(e.sigla)})</span>` : ''}</h4>${e.resumo ? `<p class="muted" style="margin:0 0 8px;font-size:13.5px;">${escHtml(e.resumo.length > 130 ? e.resumo.slice(0, 130) + '…' : e.resumo)}</p>` : ''}<div class="muted" style="font-size:12.5px;">${e.paises.length} país(es) · ${kbRelacionadas(e.id).length} ficha(s) · ${kbAtualidadesDe(e.id).length} acontecimento(s)</div></button>`).join('')}</div>`}`;
}
function kbRefiltrar() { const foco = document.activeElement && document.activeElement.id === 'kbBusca'; renderKB(); if (foco) { const i = document.getElementById('kbBusca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
function kbAbrir(id) { kbEstado.aberto = id; renderKB(); window.scrollTo({ top: 0 }); }
function kbFechar() { kbEstado.aberto = null; renderKB(); }
function kbDetalheHTML(e) {
  const rel = kbRelacionadas(e.id), ats = kbAtualidadesDe(e.id).sort((a, b) => b.data.localeCompare(a.data));
  const sec = (t, corpo) => corpo ? `<div class="card"><div class="panel-title">${t}</div>${corpo}</div>` : '';
  return `<div class="row between"><button class="btn ghost small" onclick="kbFechar()">${icon('chevron-left', 14)} Voltar</button><span class="row"><button class="btn secondary small" onclick="kbAbrirForm('${e.id}')">${icon('pen', 14)} Editar</button><button class="btn danger small" onclick="kbExcluir('${e.id}')">${icon('trash', 14)} Excluir</button></span></div>
    <div class="page-head" style="margin-top:14px;"><div><div class="qb-card-top"><span class="badge gold">${icon(KB_TIPOS[e.tipo][1], 12)} ${KB_TIPOS[e.tipo][0]}</span>${e.ano ? `<span class="badge">${escHtml(e.ano)}</span>` : ''}</div><h2 style="margin-top:6px;">${escHtml(e.nome)}${e.sigla ? ` <span class="muted">(${escHtml(e.sigla)})</span>` : ''}</h2></div></div>
    ${sec('Resumo', e.resumo ? `<p class="pre" style="margin:0;">${escHtml(e.resumo)}</p>` : '')}${sec('Contexto', e.contexto ? `<p class="pre" style="margin:0;">${escHtml(e.contexto)}</p>` : '')}
    ${sec('Países relacionados', e.paises.length ? `<div class="filters" style="margin:0;">${e.paises.map(p => `<button class="chip" onclick="goTab('paises');setTimeout(()=>abrirPaisDetalhe(${jsArg(p)}),60)">${icon('globe', 12)} ${escHtml(kbNomePais(p))}</button>`).join('')}</div>` : '')}
    ${sec('Fichas relacionadas', rel.length ? `<div class="filters" style="margin:0;">${rel.map(r => `<button class="chip" onclick="kbAbrir('${r.id}')">${icon(KB_TIPOS[r.tipo][1], 12)} ${escHtml(r.sigla || r.nome)} <span class="muted">· ${KB_TIPOS[r.tipo][0]}</span></button>`).join('')}</div>` : '')}
    ${sec('Acontecimentos (Atualidades)', ats.length ? ats.map(a => `<div class="rv-item"><div class="grow"><b>${escHtml(a.titulo)}</b><div class="rv-s">${isoToBR(a.data)}${a.fonte ? ' · ' + escHtml(a.fonte) : ''}</div></div><button class="btn ghost small" onclick="goTab('atualidades')">Ver</button></div>`).join('') : '')}
    ${sec('Fonte', e.fonte ? `<p style="margin:0;">${escHtml(e.fonte)}</p>` : '<p class="muted" style="margin:0;">Nenhuma fonte informada. Registrar a fonte ajuda a confiar no seu material.</p>')}${sec('Observações pessoais', e.obs ? `<p class="pre" style="margin:0;">${escHtml(e.obs)}</p>` : '')}
    ${e.tags.length ? `<div class="qb-tags">${e.tags.map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('')}</div>` : ''}`;
}
function kbAbrirForm(id, tipoPadrao) {
  const e = id ? kbPorId(id) : null;
  crModal(`<h3>${e ? 'Editar ficha' : 'Nova ficha'}</h3>
    <div class="row2 stack-m"><div><label class="field-label" for="kbfTipo">Tipo</label><select id="kbfTipo">${Object.entries(KB_TIPOS).map(([k, [n]]) => `<option value="${k}" ${(e ? e.tipo : tipoPadrao) === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div><label class="field-label" for="kbfAno">Ano / período</label><input type="text" id="kbfAno" value="${escAttr(e ? e.ano : '')}" placeholder="1945 ou 1947–1991"></div></div>
    <div class="row2 stack-m"><div><label class="field-label" for="kbfNome">Nome *</label><input type="text" id="kbfNome" value="${escAttr(e ? e.nome : '')}" autocomplete="off"></div><div><label class="field-label" for="kbfSigla">Sigla</label><input type="text" id="kbfSigla" value="${escAttr(e ? e.sigla : '')}"></div></div>
    <label class="field-label" for="kbfRes">Resumo</label><textarea id="kbfRes">${escHtml(e ? e.resumo : '')}</textarea><label class="field-label" for="kbfCtx">Contexto</label><textarea id="kbfCtx">${escHtml(e ? e.contexto : '')}</textarea>
    ${kbPickerHTML('kbP', 'Países relacionados', 'pais', e ? e.paises : [])}${kbPickerHTML('kbR', 'Outras fichas relacionadas', ['organizacao', 'tratado', 'acordo', 'conflito', 'tema'], e ? e.rel : [])}
    <label class="field-label" for="kbfFonte">Fonte</label><input type="text" id="kbfFonte" value="${escAttr(e ? e.fonte : '')}" placeholder="Livro, documento oficial, site..."><label class="field-label" for="kbfTags">Tags (vírgulas)</label><input type="text" id="kbfTags" value="${escAttr(e ? e.tags.join(', ') : '')}">
    <label class="field-label" for="kbfObs">Observações pessoais</label><textarea id="kbfObs" style="min-height:60px;">${escHtml(e ? e.obs : '')}</textarea><div id="kbfErro" class="form-erro" role="alert"></div>
    <div class="modal-actions"><button class="btn ghost small" onclick="crFecharModal()">Cancelar</button><button class="btn small" onclick="kbSalvarForm(${e ? `'${e.id}'` : 'null'})">Salvar</button></div>`);
}
function kbSalvarForm(id) {
  const nome = document.getElementById('kbfNome').value.trim(); if (!nome) { document.getElementById('kbfErro').textContent = 'Informe o nome.'; return; }
  const tipo = document.getElementById('kbfTipo').value;
  if (!id && kbItens.some(x => x.tipo === tipo && norm(x.nome) === norm(nome))) { document.getElementById('kbfErro').textContent = 'Já existe uma ficha com este nome e tipo.'; return; }
  const dados = { tipo, nome, sigla: document.getElementById('kbfSigla').value.trim(), ano: document.getElementById('kbfAno').value.trim(), resumo: document.getElementById('kbfRes').value.trim(), contexto: document.getElementById('kbfCtx').value.trim(), paises: kbPickerValores('kbP'), rel: kbPickerValores('kbR').filter(r => r !== id), fonte: document.getElementById('kbfFonte').value.trim(), tags: document.getElementById('kbfTags').value.split(',').map(t => t.trim()).filter(Boolean), obs: document.getElementById('kbfObs').value.trim(), editadoEm: Date.now() };
  let alvo = id; if (id) Object.assign(kbPorId(id), dados); else { alvo = uid(); kbItens.push(kbNorm(Object.assign({ id: alvo }, dados))); }
  kbSalvar(); crFecharModal(); kbEstado.aberto = alvo; renderKB(); toast('Ficha salva.');
}
async function kbExcluir(id) {
  const e = kbPorId(id); if (!e) return; const refs = kbAtualidadesDe(id).length + kbRelacionadas(id).length;
  if (!await confirmar(`Excluir a ficha "${e.nome}"?${refs ? ` Os ${refs} vínculo(s) com outras fichas e acontecimentos serão desfeitos (os registros em si são mantidos).` : ''}`, { titulo: 'Excluir ficha', ok: 'Excluir' })) return;
  kbItens = kbItens.filter(x => x.id !== id); kbItens.forEach(x => { x.rel = x.rel.filter(r => r !== id); });
  let mudou = false; atualidades.forEach(a => ['organizacoes', 'tratados', 'outros'].forEach(k => { if (a[k].includes(id)) { a[k] = a[k].filter(x => x !== id); mudou = true; } })); if (mudou) atSalvar();
  kbSalvar(); kbEstado.aberto = null; renderKB(); toast('Ficha excluída.');
}
/* ---- usada pela ficha do país (paises.js) ---- */
function kbRenderMeuAcervoPais(paisId) {
  const fichas = kbDoPais(paisId), ats = kbAtualidadesDoPais(paisId).sort((a, b) => b.data.localeCompare(a.data));
  if (!fichas.length && !ats.length) return `<div class="biblio-empty">Nada cadastrado por você relacionado a este país ainda. Ao criar fichas na <a href="#" onclick="goTab('conhecimento');return false;" style="text-decoration:underline;">Base de conhecimento</a> ou em <a href="#" onclick="goTab('atualidades');return false;" style="text-decoration:underline;">Atualidades</a>, escolha este país em "Países relacionados".</div>`;
  const grupo = (t, l) => l.length ? `<div class="panel-title" style="margin-top:14px;">${t}</div><div class="filters">${l.map(e => `<button class="chip" onclick="goTab('conhecimento');kbAbrir('${e.id}')">${escHtml(e.sigla || e.nome)}</button>`).join('')}</div>` : '';
  return grupo('Organizações', fichas.filter(e => e.tipo === 'organizacao')) + grupo('Tratados', fichas.filter(e => e.tipo === 'tratado')) + grupo('Acordos', fichas.filter(e => e.tipo === 'acordo')) + grupo('Conflitos', fichas.filter(e => e.tipo === 'conflito')) + grupo('Temas de RI', fichas.filter(e => e.tipo === 'tema'))
    + (ats.length ? `<div class="panel-title" style="margin-top:14px;">Acontecimentos</div>${ats.map(a => `<div class="rv-item"><div class="grow"><b>${escHtml(a.titulo)}</b><div class="rv-s">${isoToBR(a.data)}${a.fonte ? ' · ' + escHtml(a.fonte) : ''}</div></div><button class="btn ghost small" onclick="goTab('atualidades')">Ver</button></div>`).join('')}` : '');
}
