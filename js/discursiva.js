/* ==========================================================================
   discursiva.js — "Laboratório de discursivas": propostas de tema por
   matéria, editor para textos longos com cronômetro, limite de linhas e
   salvamento automático, histórico de produções, versões com comparação e
   avaliação por critérios configuráveis.

   AVISO: a avaliação é uma ferramenta PESSOAL de acompanhamento e prática.
   Não reproduz nem prevê a correção oficial do CACD.

   Dados (diplo_discursivas): os registros antigos {id, materia, tema,
   linhas, tempoSeg, historyTempos} são mantidos e ganham, aditivamente:
   tipo, limiteLinhas, producoes[{id,texto,criadoEm,editadoEm,tempoSeg,
   versoes[{id,t,rotulo,texto}],avaliacao}].
   ========================================================================== */
const DISC_TIPOS = ['Redação', 'Resumo', 'Versão', 'Tradução', 'Questão discursiva'];
const DISC_CRITERIOS_PADRAO = [['conteudo', 'Conhecimento do conteúdo'], ['argumentacao', 'Argumentação'], ['organizacao', 'Organização das ideias'], ['coesao', 'Coesão e coerência'], ['clareza', 'Clareza'], ['adequacao', 'Adequação ao tema'], ['norma', 'Domínio da norma-padrão']].map(([id, nome]) => ({ id, nome, max: 10, peso: 1 }));

function dlNorm(d) {
  if (!d.tipo) d.tipo = 'Redação';
  if (d.limiteLinhas == null) { const m = String(d.linhas || '').match(/\d+/); d.limiteLinhas = m ? +m[0] : 0; }
  if (!Array.isArray(d.producoes)) d.producoes = []; if (!d.criadoEm) d.criadoEm = Date.now(); if (!Array.isArray(d.tags)) d.tags = []; if (d.fonte == null) d.fonte = '';
  return d;
}
let discursivas = (load('diplo_discursivas', []) || []).map(dlNorm);
function dlSalvar() { save('diplo_discursivas', discursivas); }
function dlCriterios() { const p = load('chancelaria_prefs', {}) || {}; return (p.discCriterios && p.discCriterios.length) ? p.discCriterios : DISC_CRITERIOS_PADRAO; }

let dlSel = null;          // { pid, prid } quando editando; null = lista
let dlFiltroMateria = '', dlBusca = '', dlTimer = null;   // dlTimer = { prid, inicio, base }

/* ---- métricas do texto ---- */
function dlPalavras(t) { return (t.trim().match(/\S+/g) || []).length; }
function dlLinhas(t, cpl) { // estimativa: cada parágrafo ocupa ceil(caracteres / caracteres-por-linha) linhas
  cpl = Math.max(20, cpl || 75); return t.split('\n').reduce((a, p) => a + (p.trim() ? Math.ceil(p.length / cpl) : 0), 0);
}
function dlDestaque() { return dlSel ? { p: discursivas.find(x => x.id === dlSel.pid), r: null } : null; }

/* ---- lista de propostas ---- */
function renderDiscursivas() {
  const el = document.getElementById('dlRoot'); if (!el) return;
  if (dlSel) { dlRenderEditor(el); return; }
  const lista = discursivas.filter(d => (!dlFiltroMateria || d.materia === dlFiltroMateria) && (!dlBusca || norm(d.tema + ' ' + d.materia + ' ' + d.tags.join(' ')).includes(norm(dlBusca))));
  const nProd = discursivas.reduce((a, d) => a + d.producoes.length, 0);
  el.innerHTML = `<div class="page-head"><div><h2>Laboratório de discursivas</h2><p>Cadastre propostas de tema, escreva com cronômetro e limite de linhas, guarde versões e avalie seus textos por critérios próprios.</p></div>
    <div class="page-actions"><button class="btn secondary small" onclick="dlConfigCriterios()">Critérios de avaliação</button><button class="btn small" onclick="dlNovaProposta()">${icon('plus', 15)} Nova proposta</button></div></div>
    <div class="card flat dl-aviso">${icon('info', 16)}<span>A avaliação por critérios é uma <b>ferramenta pessoal de acompanhamento e prática</b>. Ela não é a correção oficial do CACD e não prevê sua nota na prova.</span></div>
    <div class="qb-stats"><div class="qb-stat"><b>${discursivas.length}</b><span>propostas</span></div><div class="qb-stat"><b>${nProd}</b><span>produções</span></div><div class="qb-stat"><b>${discursivas.reduce((a, d) => a + d.producoes.filter(p => p.avaliacao).length, 0)}</b><span>avaliadas</span></div></div>
    ${discursivas.length ? `<div class="row" style="margin-bottom:12px;"><input type="search" placeholder="Buscar propostas..." value="${escAttr(dlBusca)}" oninput="dlBusca=this.value;renderDiscursivas()" style="max-width:320px" aria-label="Buscar propostas"><select aria-label="Filtrar por matéria" onchange="dlFiltroMateria=this.value;renderDiscursivas()" style="max-width:240px"><option value="">Todas as matérias</option>${[...new Set(discursivas.map(d => d.materia))].sort().map(m => `<option ${m === dlFiltroMateria ? 'selected' : ''}>${escHtml(m)}</option>`).join('')}</select></div>` : ''}
    ${!discursivas.length ? `<div class="empty-state">${icon('pen')}<b>Nenhuma proposta cadastrada</b><p>Comece cadastrando um tema ou enunciado. Cada proposta pode ter várias produções, com histórico e versões.</p><button class="btn small" onclick="dlNovaProposta()">${icon('plus', 14)} Cadastrar proposta</button></div>`
      : lista.map(d => { const ult = d.producoes[d.producoes.length - 1], nota = ult && ult.avaliacao ? dlTotal(ult.avaliacao) : null;
        return `<article class="card dl-card"><div class="qb-card-top"><span class="badge gold">${escHtml(d.materia)}</span><span class="badge">${escHtml(d.tipo)}</span>${d.limiteLinhas ? `<span class="badge">até ${d.limiteLinhas} linhas</span>` : ''}<span class="badge ${d.producoes.length ? 'ok' : ''}">${d.producoes.length} produção(ões)</span>${nota != null ? `<span class="badge blue">Última autoavaliação: ${nota.toFixed(1).replace('.', ',')}/10</span>` : ''}</div>
          <p class="qb-enun-resumo pre">${escHtml(d.tema.length > 260 ? d.tema.slice(0, 260) + '…' : d.tema)}</p>
          <div class="row"><button class="btn small" onclick="dlAbrir('${d.id}')">${d.producoes.length ? 'Abrir' : 'Escrever'}</button><button class="icon-btn" onclick="dlNovaProposta('${d.id}')" aria-label="Editar proposta">${icon('pen', 16)}</button><button class="icon-btn" onclick="dlExcluirProposta('${d.id}')" aria-label="Excluir proposta">${icon('trash', 16)}</button></div></article>`; }).join('')}`;
}
function dlNovaProposta(id) {
  const d = id ? discursivas.find(x => x.id === id) : null;
  crModal(`<h3>${d ? 'Editar proposta' : 'Nova proposta'}</h3>
    <label class="field-label" for="dlfTema">Tema / enunciado *</label><textarea id="dlfTema" style="min-height:110px;" placeholder="Cole o enunciado ou descreva o tema">${escHtml(d ? d.tema : '')}</textarea>
    <div class="row2 stack-m"><div><label class="field-label" for="dlfMat">Matéria</label><select id="dlfMat">${materias.map(m => `<option ${d && d.materia === m.nome ? 'selected' : ''}>${escHtml(m.nome)}</option>`).join('')}</select></div><div><label class="field-label" for="dlfTipo">Tipo</label><select id="dlfTipo">${DISC_TIPOS.map(t => `<option ${d && d.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="row2 stack-m"><div><label class="field-label" for="dlfLim">Limite de linhas</label><input type="number" id="dlfLim" min="0" max="500" value="${d ? d.limiteLinhas || '' : ''}" placeholder="Ex.: 30" inputmode="numeric"></div><div><label class="field-label" for="dlfFonte">Fonte (opcional)</label><input type="text" id="dlfFonte" value="${escAttr(d ? d.fonte : '')}" placeholder="CACD 2023, 3ª fase"></div></div>
    <label class="field-label" for="dlfTags">Tags (vírgulas)</label><input type="text" id="dlfTags" value="${escAttr(d ? d.tags.join(', ') : '')}"><div id="dlfErro" class="form-erro" role="alert"></div>
    <div class="modal-actions"><button class="btn ghost small" onclick="crFecharModal()">Cancelar</button><button class="btn small" onclick="dlSalvarProposta(${d ? `'${d.id}'` : 'null'})">Salvar</button></div>`);
}
function dlSalvarProposta(id) {
  const tema = document.getElementById('dlfTema').value.trim(); if (!tema) { document.getElementById('dlfErro').textContent = 'Informe o tema ou enunciado.'; return; }
  const dados = { tema, materia: document.getElementById('dlfMat').value, tipo: document.getElementById('dlfTipo').value, limiteLinhas: +document.getElementById('dlfLim').value || 0, linhas: document.getElementById('dlfLim').value ? document.getElementById('dlfLim').value + ' linhas' : '', fonte: document.getElementById('dlfFonte').value.trim(), tags: document.getElementById('dlfTags').value.split(',').map(t => t.trim()).filter(Boolean) };
  if (id) Object.assign(discursivas.find(x => x.id === id), dados); else discursivas.unshift(dlNorm(Object.assign({ id: uid(), tempoSeg: 0, historyTempos: [] }, dados)));
  dlSalvar(); crFecharModal(); renderDiscursivas(); toast('Proposta salva.');
}
async function dlExcluirProposta(id) {
  const d = discursivas.find(x => x.id === id); if (!d) return;
  if (!await confirmar(`Excluir esta proposta${d.producoes.length ? ` e suas ${d.producoes.length} produção(ões) com todas as versões` : ''}? Essa ação não pode ser desfeita.`, { titulo: 'Excluir proposta', ok: 'Excluir' })) return;
  if (d.producoes.length) await criarSnapshot('antes-de-excluir-discursiva');
  discursivas = discursivas.filter(x => x.id !== id); dlSalvar(); renderDiscursivas(); toast('Proposta excluída.');
}

/* ---- abrir / criar produção ---- */
function dlAbrir(pid, prid) {
  const d = discursivas.find(x => x.id === pid); if (!d) return;
  if (!d.producoes.length) { d.producoes.push({ id: uid(), texto: '', criadoEm: Date.now(), editadoEm: Date.now(), tempoSeg: 0, versoes: [], avaliacao: null }); dlSalvar(); }
  dlSel = { pid, prid: prid || d.producoes[d.producoes.length - 1].id, painel: 'texto', cmpA: '', cmpB: '' }; renderDiscursivas(); window.scrollTo({ top: 0 });
}
function dlNovaProducao(copiar) {
  const { d, r } = dlAtual(); dlFlush();
  d.producoes.push({ id: uid(), texto: copiar ? r.texto : '', criadoEm: Date.now(), editadoEm: Date.now(), tempoSeg: 0, versoes: [], avaliacao: null });
  dlSalvar(); dlSel.prid = d.producoes[d.producoes.length - 1].id; dlTimerParar(); renderDiscursivas(); toast('Nova produção criada.');
}
function dlAtual() { const d = discursivas.find(x => x.id === dlSel.pid), r = d && d.producoes.find(p => p.id === dlSel.prid); return { d, r }; }
function dlVoltar() { dlFlush(); dlTimerParar(); dlSel = null; renderDiscursivas(); refreshStats(); }

/* ---- editor ---- */
function dlRenderEditor(el) {
  const { d, r } = dlAtual(); if (!d || !r) { dlSel = null; return renderDiscursivas(); }
  const cpl = prefs().charsPorLinha, linhas = dlLinhas(r.texto, cpl), lim = d.limiteLinhas, tempo = dlTempoAtual(r), idx = d.producoes.indexOf(r);
  const painel = dlSel.painel;
  el.innerHTML = `<div class="row between"><button class="btn ghost small" onclick="dlVoltar()">${icon('chevron-left', 14)} Propostas</button><span id="dlSaveState" class="muted mono" style="font-size:12px;">Salvo automaticamente</span></div>
    <div class="card dl-prop"><div class="qb-card-top"><span class="badge gold">${escHtml(d.materia)}</span><span class="badge">${escHtml(d.tipo)}</span>${lim ? `<span class="badge">até ${lim} linhas</span>` : ''}</div><p class="pre" style="margin:8px 0 0;">${escHtml(d.tema)}</p></div>
    <div class="row" style="margin:10px 0;"><label class="field-label" style="margin:0;" for="dlProdSel">Produção</label><select id="dlProdSel" style="max-width:300px" onchange="dlTrocarProducao(this.value)">${d.producoes.map((p, i) => `<option value="${p.id}" ${p.id === r.id ? 'selected' : ''}>#${i + 1} · ${new Date(p.criadoEm).toLocaleDateString('pt-BR')}${p.avaliacao ? ' · ' + dlTotal(p.avaliacao).toFixed(1).replace('.', ',') : ''}</option>`).join('')}</select>
      <button class="btn ghost small" onclick="dlNovaProducao(false)">${icon('plus', 13)} Nova produção</button><button class="btn ghost small" onclick="dlNovaProducao(true)">Duplicar texto</button></div>
    <div class="subtabs" role="tablist">${[['texto', 'Texto'], ['versoes', 'Versões e comparação'], ['avaliacao', 'Avaliação'], ['historico', 'Histórico']].map(([k, l]) => `<button class="subtab-btn ${painel === k ? 'active' : ''}" role="tab" onclick="dlPainel('${k}')">${l}</button>`).join('')}</div>
    ${painel === 'texto' ? `<div class="dl-barra card flat"><div class="dl-timer"><span class="mono dl-tempo" id="dlTempo">${fmtHMS(tempo * 1000)}</span><button class="btn secondary small" id="dlTimerBtn" onclick="dlTimerAlternar()">${dlTimer ? icon('pause', 13) + ' Pausar' : icon('play', 13) + ' Iniciar'}</button><button class="btn ghost small" onclick="dlTimerZerar()">Zerar</button></div>
        <div class="dl-metricas"><span id="dlMPal">${dlPalavras(r.texto)} palavras</span><span id="dlMLin" class="${lim && linhas > lim ? 'estourou' : ''}">${linhas}${lim ? ' / ' + lim : ''} linhas (estim.)</span><label class="muted" style="font-size:12px;">caract./linha <input type="number" id="dlCpl" value="${cpl}" min="30" max="120" style="width:64px;padding:4px 6px;" onchange="setPref('charsPorLinha',+this.value||75);dlAtualizarMetricas()"></label></div>
        ${lim ? `<div class="bar" style="width:100%"><span id="dlBarLin" style="width:${Math.min(100, pct(linhas, lim))}%;${linhas > lim ? 'background:var(--bad)' : ''}"></span></div>` : ''}</div>
      <textarea id="dlTexto" class="dl-editor" spellcheck="true" lang="pt-BR" placeholder="Escreva aqui sua resposta..." oninput="dlAoDigitar()">${escHtml(r.texto)}</textarea>
      <div class="row" style="margin-top:10px;"><button class="btn secondary small" onclick="dlSalvarVersao()">${icon('bookmark', 14)} Salvar versão</button><button class="btn small" onclick="dlPainel('avaliacao')">Avaliar este texto</button></div>` : ''}
    ${painel === 'versoes' ? dlRenderVersoes(d, r) : ''}${painel === 'avaliacao' ? dlRenderAvaliacao(d, r) : ''}${painel === 'historico' ? dlRenderHistorico(d) : ''}`;
  if (dlTimer && dlTimer.prid !== r.id) dlTimerParar();
}
function dlPainel(p) { dlFlush(); dlSel.painel = p; renderDiscursivas(); }
function dlTrocarProducao(id) { dlFlush(); dlTimerParar(); dlSel.prid = id; renderDiscursivas(); }
function dlTempoAtual(r) { return (r.tempoSeg || 0) + (dlTimer && dlTimer.prid === r.id ? Math.floor((Date.now() - dlTimer.inicio) / 1000) : 0); }

/* autosave: grava 900 ms após parar de digitar, ao trocar de painel, ao sair da aba e antes de atualizar o app */
const dlAutosalvar = debounce(() => dlFlush(), 900);
function dlAoDigitar() { const s = document.getElementById('dlSaveState'); if (s) s.textContent = 'Editando…'; dlAtualizarMetricas(); dlAutosalvar(); }
function dlAtualizarMetricas() {
  const t = document.getElementById('dlTexto'); if (!t) return; const { d } = dlAtual(), cpl = prefs().charsPorLinha, l = dlLinhas(t.value, cpl), lim = d.limiteLinhas;
  const a = document.getElementById('dlMPal'), b = document.getElementById('dlMLin'), bar = document.getElementById('dlBarLin');
  if (a) a.textContent = dlPalavras(t.value) + ' palavras'; if (b) { b.textContent = `${l}${lim ? ' / ' + lim : ''} linhas (estim.)`; b.classList.toggle('estourou', !!(lim && l > lim)); }
  if (bar) { bar.style.width = Math.min(100, pct(l, lim)) + '%'; bar.style.background = l > lim ? 'var(--bad)' : ''; }
}
function dlFlush() {
  if (!dlSel) return; const t = document.getElementById('dlTexto'); if (!t) return; const { d, r } = dlAtual(); if (!r) return;
  const mudou = t.value !== r.texto; if (mudou) { r.texto = t.value; r.editadoEm = Date.now(); }
  if (dlTimer && dlTimer.prid === r.id) { r.tempoSeg = dlTempoAtual(r); dlTimer.inicio = Date.now(); }
  if (mudou || dlTimer) { dlSalvar(); const s = document.getElementById('dlSaveState'); if (s) s.textContent = 'Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
}
function flushAllEditors() { try { dlFlush(); } catch (e) {} try { if (typeof salvarRascunhoBiblioteca === 'function') salvarRascunhoBiblioteca(); } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAllEditors(); });
window.addEventListener('pagehide', flushAllEditors);

/* cronômetro da produção */
function dlTimerAlternar() { const { r } = dlAtual(); if (dlTimer) { dlFlush(); dlTimer = null; } else dlTimer = { prid: r.id, inicio: Date.now() }; const b = document.getElementById('dlTimerBtn'); if (b) b.innerHTML = dlTimer ? icon('pause', 13) + ' Pausar' : icon('play', 13) + ' Iniciar'; }
function dlTimerParar() { if (dlTimer) { dlFlush(); dlTimer = null; } }
async function dlTimerZerar() { const { r } = dlAtual(); if (r.tempoSeg > 30 && !await confirmar('Zerar o tempo registrado desta produção?', { titulo: 'Zerar cronômetro', ok: 'Zerar' })) return; dlTimer = null; r.tempoSeg = 0; dlSalvar(); renderDiscursivas(); }
setInterval(() => { if (dlTimer && dlSel) { const { r } = dlAtual(); const e = document.getElementById('dlTempo'); if (r && e) e.textContent = fmtHMS(dlTempoAtual(r) * 1000); } }, 1000);
// legado: botões antigos do cronômetro livre
function cronoStart() { estudoTimerIniciar({}); } function cronoPause() { timerPausarRetomar(); } function cronoReset() { timerDescartar(); }

/* ---- versões ---- */
function dlSalvarVersao() {
  dlFlush(); const { r } = dlAtual(); if (!r.texto.trim()) { toast('Escreva algo antes de salvar uma versão.', 'aviso'); return; }
  const ult = r.versoes[r.versoes.length - 1]; if (ult && ult.texto === r.texto) { toast('Esta versão já foi salva.', 'aviso'); return; }
  r.versoes.push({ id: uid(), t: Date.now(), rotulo: 'v' + (r.versoes.length + 1), texto: r.texto }); dlSalvar(); toast(`Versão v${r.versoes.length} salva.`);
}
function dlTodasVersoes(d) { const o = []; d.producoes.forEach((p, i) => { p.versoes.forEach(v => o.push({ id: v.id, rot: `Produção #${i + 1} · ${v.rotulo} · ${new Date(v.t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`, texto: v.texto })); o.push({ id: 'atual:' + p.id, rot: `Produção #${i + 1} · texto atual`, texto: p.texto }); }); return o; }
function dlRenderVersoes(d, r) {
  const todas = dlTodasVersoes(d), A = todas.find(v => v.id === dlSel.cmpA), B = todas.find(v => v.id === dlSel.cmpB);
  const sel = (k, atual) => `<select aria-label="Versão ${k}" onchange="dlSel.cmp${k}=this.value;renderDiscursivas()"><option value="">Escolha a versão ${k}</option>${todas.map(v => `<option value="${v.id}" ${v.id === atual ? 'selected' : ''}>${escHtml(v.rot)}</option>`).join('')}</select>`;
  return `<div class="card"><div class="panel-title">Comparar versões</div><div class="row2 stack-m">${sel('A', dlSel.cmpA)}${sel('B', dlSel.cmpB)}</div>
    ${A && B ? `<div class="dl-diff pre" aria-label="Diferenças entre as versões">${dlDiffHTML(A.texto, B.texto)}</div><p class="muted" style="font-size:12.5px;margin:8px 0 0;"><del class="d-del">vermelho</del> = presente só em A · <ins class="d-ins">verde</ins> = presente só em B</p>` : '<p class="muted" style="margin:10px 0 0;">Escolha duas versões (ou o texto atual) para ver o que foi removido e acrescentado.</p>'}</div>
    <div class="card"><div class="panel-title">Versões salvas desta produção (${r.versoes.length})</div>${r.versoes.length ? r.versoes.slice().reverse().map(v => `<div class="rv-item"><div class="grow"><b>${v.rotulo}</b> <span class="muted">${new Date(v.t).toLocaleString('pt-BR')} · ${dlPalavras(v.texto)} palavras</span></div><button class="btn ghost small" onclick="dlRestaurar('${v.id}')">Restaurar no editor</button></div>`).join('') : '<p class="muted" style="margin:0;">Nenhuma versão salva. Use "Salvar versão" no editor.</p>'}</div>`;
}
async function dlRestaurar(vid) {
  const { r } = dlAtual(), v = r.versoes.find(x => x.id === vid); if (!v) return;
  if (!await confirmar('Colocar esta versão no editor? O texto atual será guardado como uma nova versão antes.', { titulo: 'Restaurar versão', ok: 'Restaurar', perigo: false })) return;
  if (r.texto.trim() && !r.versoes.some(x => x.texto === r.texto)) r.versoes.push({ id: uid(), t: Date.now(), rotulo: 'v' + (r.versoes.length + 1) + ' (antes de restaurar)', texto: r.texto });
  r.texto = v.texto; r.editadoEm = Date.now(); dlSalvar(); dlSel.painel = 'texto'; renderDiscursivas(); toast('Versão restaurada no editor.');
}
/* diff por palavras (LCS); cai para linhas se o texto for muito grande */
function dlDiffHTML(a, b) {
  const tok = s => s.split(/(\s+)/).filter(x => x !== ''), ta = tok(a), tb = tok(b);
  if (ta.length * tb.length > 4e6) return '<p class="muted">Textos muito longos para comparação detalhada.</p>';
  const n = ta.length, m = tb.length, dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = ta[i] === tb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0, out = '';
  while (i < n && j < m) { if (ta[i] === tb[j]) { out += escHtml(ta[i]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { out += `<del class="d-del">${escHtml(ta[i])}</del>`; i++; } else { out += `<ins class="d-ins">${escHtml(tb[j])}</ins>`; j++; } }
  while (i < n) out += `<del class="d-del">${escHtml(ta[i++])}</del>`; while (j < m) out += `<ins class="d-ins">${escHtml(tb[j++])}</ins>`;
  return out;
}

/* ---- avaliação por critérios ---- */
function dlTotal(av) { const cs = av.snapshot || dlCriterios(); let num = 0, den = 0; cs.forEach(c => { const n = av.criterios[c.id]; if (n && n.nota !== '' && n.nota != null) { num += (+n.nota / c.max) * c.peso; den += c.peso; } }); return den ? 10 * num / den : 0; }
function dlRenderAvaliacao(d, r) {
  const av = r.avaliacao, cs = av ? av.snapshot : dlCriterios();
  return `<div class="card"><div class="panel-title">Autoavaliação por critérios</div><p class="muted" style="font-size:13px;margin-top:-6px;">Ferramenta pessoal de acompanhamento e prática — não é a avaliação oficial do CACD. Atribua nota e comentário a cada critério.</p>
    ${cs.map(c => { const v = av && av.criterios[c.id] || { nota: '', comentario: '' }; return `<div class="dl-crit"><div class="row between"><label for="dc_${c.id}"><b>${escHtml(c.nome)}</b> <span class="muted" style="font-size:12px;">(0 a ${c.max}${c.peso !== 1 ? ', peso ' + c.peso : ''})</span></label><input type="number" id="dc_${c.id}" min="0" max="${c.max}" step="0.5" value="${v.nota}" style="width:84px" inputmode="decimal" oninput="dlAtualizarTotalAv()"></div><textarea id="dcc_${c.id}" placeholder="Comentário sobre este critério" style="min-height:48px;">${escHtml(v.comentario || '')}</textarea></div>`; }).join('')}
    <label class="field-label" for="dlAvGeral">Comentário geral / o que melhorar na próxima produção</label><textarea id="dlAvGeral">${escHtml(av ? av.geral || '' : '')}</textarea>
    <div class="row between" style="margin-top:12px;"><b>Pontuação ponderada: <span id="dlAvTotal" class="mono">${av ? dlTotal(av).toFixed(1).replace('.', ',') : '—'}</span> / 10</b><span class="row"><button class="btn ghost small" onclick="dlConfigCriterios()">Configurar critérios</button><button class="btn small" onclick="dlSalvarAvaliacao()">Salvar avaliação</button></span></div></div>`;
}
function dlLerAvaliacao(snapshot) { const criterios = {}; snapshot.forEach(c => { const n = document.getElementById('dc_' + c.id).value; criterios[c.id] = { nota: n === '' ? '' : Math.min(c.max, Math.max(0, +n)), comentario: document.getElementById('dcc_' + c.id).value.trim() }; }); return { criterios, snapshot, geral: document.getElementById('dlAvGeral').value.trim() }; }
function dlAtualizarTotalAv() { const { r } = dlAtual(), snap = r.avaliacao ? r.avaliacao.snapshot : dlCriterios(), av = dlLerAvaliacao(snap); const e = document.getElementById('dlAvTotal'); if (e) e.textContent = Object.values(av.criterios).some(c => c.nota !== '') ? dlTotal(av).toFixed(1).replace('.', ',') : '—'; }
function dlSalvarAvaliacao() {
  const { r } = dlAtual(), snap = r.avaliacao ? r.avaliacao.snapshot : dlCriterios().map(c => ({ ...c })), av = dlLerAvaliacao(snap);
  if (!Object.values(av.criterios).some(c => c.nota !== '')) { toast('Atribua nota a pelo menos um critério.', 'aviso'); return; }
  av.em = Date.now(); r.avaliacao = av; dlSalvar(); renderDiscursivas(); toast('Avaliação salva.');
}
function dlConfigCriterios() {
  const cs = dlCriterios();
  crModal(`<h3>Critérios de avaliação</h3><p class="muted" style="margin-top:-4px;font-size:13px;">Defina o que importa para você. Avaliações já feitas guardam os critérios que usaram.</p>
    <div id="dlcList">${cs.map((c, i) => dlCritLinha(c, i)).join('')}</div><button class="btn ghost small" onclick="dlCritAdd()">${icon('plus', 13)} Novo critério</button>
    <div class="modal-actions"><button class="btn ghost small" onclick="dlCritPadrao()" style="margin-right:auto;">Restaurar padrão</button><button class="btn ghost small" onclick="crFecharModal()">Cancelar</button><button class="btn small" onclick="dlCritSalvar()">Salvar</button></div>`);
}
function dlCritLinha(c) { return `<div class="dl-critlinha" data-id="${escAttr(c.id)}"><input type="text" value="${escAttr(c.nome)}" aria-label="Nome do critério" placeholder="Nome"><input type="number" value="${c.max}" min="1" max="100" aria-label="Nota máxima" title="Nota máxima"><input type="number" value="${c.peso}" min="0.5" max="10" step="0.5" aria-label="Peso" title="Peso"><button class="icon-btn ghost" onclick="this.parentNode.remove()" aria-label="Remover critério">${icon('x', 14)}</button></div>`; }
function dlCritAdd() { document.getElementById('dlcList').insertAdjacentHTML('beforeend', dlCritLinha({ id: 'c' + uid(), nome: '', max: 10, peso: 1 })); }
function dlCritSalvar() {
  const l = [...document.querySelectorAll('.dl-critlinha')].map(row => { const [n, m, p] = row.querySelectorAll('input'); return { id: row.dataset.id, nome: n.value.trim(), max: Math.max(1, +m.value || 10), peso: Math.max(0.5, +p.value || 1) }; }).filter(c => c.nome);
  if (!l.length) { toast('Mantenha ao menos um critério.', 'aviso'); return; } setPref('discCriterios', l); crFecharModal(); if (dlSel) renderDiscursivas(); toast('Critérios salvos.');
}
function dlCritPadrao() { setPref('discCriterios', DISC_CRITERIOS_PADRAO); crFecharModal(); dlConfigCriterios(); }

/* ---- histórico da proposta ---- */
function dlRenderHistorico(d) {
  const tot = d.producoes.map(p => p.avaliacao ? dlTotal(p.avaliacao) : null);
  return `<div class="card"><div class="panel-title">Produções desta proposta</div>${d.producoes.map((p, i) => `<div class="rv-item"><div class="grow"><b>Produção #${i + 1}</b><div class="rv-s">${new Date(p.criadoEm).toLocaleDateString('pt-BR')} · ${dlPalavras(p.texto)} palavras · ${dlLinhas(p.texto, prefs().charsPorLinha)} linhas (estim.) · ${p.tempoSeg ? fmtHMS(p.tempoSeg * 1000) : 'sem tempo registrado'} · ${p.versoes.length} versão(ões)</div></div>${tot[i] != null ? `<span class="badge blue">${tot[i].toFixed(1).replace('.', ',')}/10</span>` : '<span class="badge">sem avaliação</span>'}<button class="btn ghost small" onclick="dlTrocarProducao('${p.id}');dlSel.painel='texto';renderDiscursivas()">Editar</button><button class="icon-btn ghost" onclick="dlExcluirProducao('${p.id}')" aria-label="Excluir produção #${i + 1}">${icon('trash', 15)}</button></div>`).join('')}</div>`;
}
async function dlExcluirProducao(prid) {
  const { d } = dlAtual(); const p = d.producoes.find(x => x.id === prid); if (!p) return;
  if (!await confirmar('Excluir esta produção, com suas versões e avaliação?', { titulo: 'Excluir produção', ok: 'Excluir' })) return;
  d.producoes = d.producoes.filter(x => x.id !== prid); if (!d.producoes.length) { dlSel = null; } else if (dlSel.prid === prid) dlSel.prid = d.producoes[d.producoes.length - 1].id;
  dlSalvar(); renderDiscursivas();
}
function addDiscursiva() {}   // compatibilidade: substituída por dlNovaProposta()
