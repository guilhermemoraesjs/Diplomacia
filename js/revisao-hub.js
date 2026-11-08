/* ==========================================================================
   revisao-hub.js — "Revisão espaçada": visão ÚNICA de tudo que precisa ser
   revisado, vinda de três fontes que continuam existindo e guardando seus
   dados do jeito de sempre:
     f = Flashcards (flash_cards)         d = Documentos da Biblioteca (biblio_docs)
     m = Revisões manuais D+1/D+7/D+30 (diplo_revisao)
   O agendamento dos flashcards e documentos usa o motor srs-core.js.
   Telas: Hoje · Atrasadas · Próximas · Histórico · Retenção.
   ========================================================================== */
let rvAba = 'hoje', rvSessao = null;

function rvManualItens() {
  const out = [];
  (typeof revisao !== 'undefined' ? revisao : []).forEach(r => {
    [['r1', 1], ['r2', 7], ['r3', 30]].forEach(([k, d]) => {
      if (r[k]) return; const iso = r[k + 'Data'] || (r.dataEstudo ? addDaysISO(r.dataEstudo, d) : null);
      if (iso) out.push({ kind: 'm', id: r.id + ':' + k, rid: r.id, campo: k, titulo: r.tema, sub: (r.materia || '') + ' · ' + ({ r1: '1ª', r2: '2ª', r3: '3ª' })[k] + ' revisão', due: iso, novo: false });
    });
  });
  return out;
}
function revisaoItens() {
  const itens = [];
  (typeof flashCards !== 'undefined' ? flashCards : []).forEach(c => { if (!c.srs || !c.srs.proximaRevisao) return;
    const t = c.tipo === 'cloze' ? stripHtml(flashRenderClozeTexto(c.clozeTexto, c.clozeIndex, false)) : (c.frente || (c.comparacaoA && c.comparacaoA.titulo) || 'Flashcard');
    itens.push({ kind: 'f', id: c.id, titulo: t.slice(0, 140), sub: [c.disciplina, c.tema].filter(Boolean).join(' · ') || 'Flashcard', due: c.srs.proximaRevisao, novo: !c.srs.ultimaRevisao, ref: c }); });
  (typeof biblioDocs !== 'undefined' ? biblioDocs : []).forEach(d => { if (d.srsAtivo && d.srs && d.srs.nextReview) itens.push({ kind: 'd', id: d.id, titulo: d.titulo || '(sem título)', sub: [d.materia, 'Biblioteca'].filter(Boolean).join(' · '), due: d.srs.nextReview, novo: !d.srs.lastReview, ref: d }); });
  return itens.concat(rvManualItens());
}
function revisaoContagens() {
  const hoje = todayISO(), it = revisaoItens();
  const atrasadas = it.filter(i => i.due < hoje).length, hojeN = it.filter(i => i.due === hoje).length;
  return { devidas: atrasadas + hojeN, atrasadas, hoje: hojeN, proximas: it.filter(i => i.due > hoje && i.due <= addDaysISO(hoje, 7)).length, total: it.length };
}
function revisaoAgendadasNoDia(iso) { const hoje = todayISO(), it = revisaoItens(); return it.filter(i => iso === hoje ? i.due <= hoje : i.due === iso).length; }
const RV_TIPO = { f: ['Flashcard', 'gold', 'layers'], d: ['Biblioteca', 'blue', 'library'], m: ['Manual', '', 'repeat'] };

function rvLinha(i) {
  const [rot, cls] = RV_TIPO[i.kind], atras = i.due < todayISO();
  return `<div class="rv-item"><div class="grow"><div class="rv-t">${escHtml(i.titulo)}</div><div class="rv-s"><span class="badge ${cls}">${rot}</span>${i.novo ? '<span class="badge blue">Novo</span>' : ''} ${escHtml(i.sub)}</div></div>
    <div class="rv-due ${atras ? 'atras' : ''}">${atras ? 'Atrasada · ' : ''}${isoToBR(i.due).slice(0, 5)}</div><button class="btn ghost small" onclick="rvAbrirOrigem('${i.kind}','${escAttr(i.rid || i.id)}')">Abrir</button></div>`;
}
function rvAbrirOrigem(kind, id) {
  if (kind === 'f') { goTab('flashcards'); flashShowPanel('lista'); const c = flashGetById(id); const b = document.getElementById('flashListaBusca'); if (b && c) { b.value = (c.frente || c.clozeTexto || '').slice(0, 40); flashAplicarFiltrosLista(); } }
  else if (kind === 'd') { goTab('biblioteca'); abrirDocumento(id); }
  else { goTab('cronograma'); }
}
function renderRevisaoHub() {
  const el = document.getElementById('revisaoRoot'); if (!el) return;
  if (rvSessao) { el.innerHTML = rvRenderSessao(); return; }
  const hoje = todayISO(), it = revisaoItens().sort((a, b) => a.due.localeCompare(b.due)), c = revisaoContagens();
  const abas = [['hoje', `Hoje (${c.hoje})`], ['atrasadas', `Atrasadas (${c.atrasadas})`], ['proximas', 'Próximas'], ['historico', 'Histórico'], ['retencao', 'Retenção']];
  let corpo = '';
  if (rvAba === 'hoje') { const l = it.filter(i => i.due === hoje); corpo = l.length ? l.map(rvLinha).join('') : rvVazio('Nada para revisar hoje', c.atrasadas ? `Você tem ${c.atrasadas} revisão(ões) atrasada(s).` : 'Quando houver flashcards, documentos ou revisões manuais vencendo, eles aparecem aqui.'); }
  else if (rvAba === 'atrasadas') { const l = it.filter(i => i.due < hoje); corpo = l.length ? l.map(rvLinha).join('') : rvVazio('Nenhuma revisão atrasada', 'Ótimo: você está em dia.'); }
  else if (rvAba === 'proximas') { const l = it.filter(i => i.due > hoje); corpo = l.length ? rvAgrupar(l) : rvVazio('Nenhuma revisão futura agendada', 'Crie flashcards ou ative a revisão espaçada em documentos da Biblioteca.'); }
  else if (rvAba === 'historico') corpo = rvHistorico(); else corpo = rvRetencao();
  el.innerHTML = `<div class="page-head"><div><h2>Revisão espaçada</h2><p>Flashcards, documentos da Biblioteca e revisões manuais em um só lugar. Avalie cada item e o sistema calcula quando você deve revê-lo, com base em acertos, erros, dificuldade e tempo desde a última revisão.</p></div>
      <div class="page-actions"><button class="btn" onclick="rvIniciar()" ${c.devidas ? '' : 'disabled'}>${icon('play', 15)} Iniciar revisão${c.devidas ? ` (${c.devidas})` : ''}</button></div></div>
    <div class="qb-stats"><div class="qb-stat"><b>${c.hoje}</b><span>para hoje</span></div><div class="qb-stat"><b style="color:${c.atrasadas ? 'var(--bad)' : 'inherit'}">${c.atrasadas}</b><span>atrasadas</span></div><div class="qb-stat"><b>${c.proximas}</b><span>próximos 7 dias</span></div><div class="qb-stat"><b>${rvRetencaoGeral()}</b><span>retenção (30 dias)</span></div></div>
    <div class="subtabs" role="tablist">${abas.map(([k, l]) => `<button class="subtab-btn ${rvAba === k ? 'active' : ''}" role="tab" onclick="rvAba='${k}';renderRevisaoHub()">${l}</button>`).join('')}</div><div>${corpo}</div>`;
}
function rvVazio(t, p) { return `<div class="empty-state">${icon('repeat')}<b>${t}</b><p>${p}</p></div>`; }
function rvAgrupar(l) { const g = {}; l.forEach(i => (g[i.due] = g[i.due] || []).push(i)); return Object.keys(g).sort().slice(0, 30).map(d => `<div class="cr-grupo"><div class="panel-title">${DIAS_SEMANA_NOMES[parseISOLocal(d).getDay()]}, ${isoToBR(d)} <span class="badge">${g[d].length}</span></div>${g[d].map(rvLinha).join('')}</div>`).join(''); }
function rvTitulo(k, id) {
  try { if (k === 'f') { const c = flashGetById(id); return c ? (c.frente || stripHtml(flashRenderClozeTexto(c.clozeTexto, c.clozeIndex, false)) || 'Flashcard').slice(0, 90) : '(removido)'; }
    if (k === 'd') { const d = biblioDocs.find(x => x.id === id); return d ? d.titulo : '(removido)'; } } catch (e) {} return 'Revisão manual';
}
function rvHistorico() {
  const log = load('srs_log', []).slice(-80).reverse(); if (!log.length) return rvVazio('Sem histórico de revisões', 'Cada avaliação que você fizer fica registrada aqui.');
  const nome = { 1: 'Errei', 2: 'Difícil', 3: 'Bom', 4: 'Fácil' }, cls = { 1: 'bad', 2: 'warn', 3: 'ok', 4: 'blue' };
  return `<div class="card">${log.map(l => `<div class="rv-item"><div class="grow"><div class="rv-t">${escHtml(rvTitulo(l.k, l.id))}</div><div class="rv-s">${RV_TIPO[l.k][0]} · ${isoToBR(l.t)}${l.R != null ? ` · lembrança estimada ${Math.round(l.R * 100)}%` : ''}</div></div><span class="badge ${cls[l.r]}">${nome[l.r]}</span><span class="muted" style="font-size:12.5px;white-space:nowrap;">próx. em ${l.i} d</span></div>`).join('')}</div>`;
}
function rvRetencaoGeral() {
  const ini = addDaysISO(todayISO(), -30), l = load('srs_log', []).filter(x => x.t >= ini && x.R != null);   // só revisões de itens já conhecidos
  return l.length >= 5 ? Math.round(100 * l.filter(x => x.r > 1).length / l.length) + '%' : '—';
}
function rvRetencao() {
  const log = load('srs_log', []).filter(x => x.R != null); if (log.length < 5) return rvVazio('Dados insuficientes', 'A curva de retenção aparece depois de pelo menos 5 revisões de itens já estudados.');
  const semanas = Array.from({ length: 8 }, (_, i) => { const ini = addDaysISO(inicioDaSemana(todayISO()), -7 * (7 - i)), fim = addDaysISO(ini, 6), l = log.filter(x => x.t >= ini && x.t <= fim); return { ini, n: l.length, p: l.length ? Math.round(100 * l.filter(x => x.r > 1).length / l.length) : null }; });
  const alvo = Math.round(srsPrefs().retencao * 100);
  return `<div class="card"><div class="panel-title">Retenção semanal <span class="muted" style="text-transform:none;letter-spacing:0;">(% de revisões em que você lembrou · meta ${alvo}%)</span></div>
    <div class="rv-chart" role="img" aria-label="Retenção por semana">${semanas.map(s => `<div class="rv-col" title="${isoToBR(s.ini)}: ${s.p == null ? 'sem revisões' : s.p + '% de ' + s.n + ' revisões'}"><div class="rv-bar"><i style="height:${s.p || 0}%;${s.p != null && s.p < alvo - 10 ? 'background:var(--bad)' : ''}"></i><u style="bottom:${alvo}%"></u></div><b>${s.p == null ? '—' : s.p + '%'}</b><small>${isoToBR(s.ini).slice(0, 5)}</small></div>`).join('')}</div></div>`;
}

/* ---- sessão unificada ---- */
function rvIniciar() {
  const hoje = todayISO(), fila = revisaoItens().filter(i => i.due <= hoje).sort((a, b) => a.due.localeCompare(b.due) || (a.novo ? 1 : 0) - (b.novo ? 1 : 0));
  if (!fila.length) { toast('Nada para revisar agora.'); return; }
  rvSessao = { fila, i: 0, rev: false, t0: Date.now(), cont: { again: 0, hard: 0, good: 0, easy: 0 } }; renderRevisaoHub(); window.scrollTo({ top: 0 });
}
function rvSair() { rvSessao = null; renderRevisaoHub(); refreshStats(); }
function rvRevelar() { rvSessao.rev = true; renderRevisaoHub(); }
function rvRenderSessao() {
  const s = rvSessao;
  if (s.i >= s.fila.length) { const t = Object.values(s.cont).reduce((a, b) => a + b, 0); return `<div class="card qb-fim"><div class="empty-state" style="border:none;">${icon('check')}<b>Revisão concluída</b><p>${t} item(ns) revisado(s): ${s.cont.again} errei · ${s.cont.hard} difícil · ${s.cont.good} bom · ${s.cont.easy} fácil.</p><button class="btn secondary small" onclick="rvSair()">Voltar</button></div></div>`; }
  const it = s.fila[s.i], [rot, cls] = RV_TIPO[it.kind];
  let frente = '', verso = '', prev = null;
  if (it.kind === 'f') { frente = flashRenderFrenteHTML(it.ref); verso = flashRenderVersoHTML(it.ref); prev = srsPreview(srsMemDeFlash(it.ref), todayISO(), srsPrefs(), it.ref.dificuldade); }
  else if (it.kind === 'd') { frente = `<h3 style="margin:0;">${escHtml(it.titulo)}</h3><p class="muted">Lembre-se do conteúdo deste documento antes de revelar.</p>`; verso = `<div class="biblio-body-editable" style="border:none;background:none;padding:0;max-height:46vh;overflow:auto;">${it.ref.conteudo && it.ref.conteudo.trim() ? sanitizarHTML(it.ref.conteudo) : '<p class="muted">Documento vazio.</p>'}</div>`; prev = srsPreview(srsMemDeDoc(it.ref), todayISO(), srsPrefs(), 'media'); }
  else { frente = `<h3 style="margin:0;">${escHtml(it.titulo)}</h3><p class="muted">${escHtml(it.sub)}</p>`; verso = ''; }
  const botoes = it.kind === 'm' ? `<button class="btn" onclick="rvAvaliar('good')">${icon('check', 15)} Concluir revisão</button>`
    : s.rev ? ['again', 'hard', 'good', 'easy'].map((k, n) => `<button class="btn ${k === 'again' ? 'danger' : k === 'good' || k === 'easy' ? 'secondary' : 'ghost'} rv-rate" onclick="rvAvaliar('${k}')">${SRS_NOMES[k]} <small>${flashFormatDias(prev[k])}</small><kbd class="kbd">${n + 1}</kbd></button>`).join('')
      : `<button class="btn" onclick="rvRevelar()">Mostrar resposta <kbd class="kbd">Espaço</kbd></button>`;
  const dica = it.kind === 'm' ? '' : (it.ref && it.ref.dificuldade ? '' : '');
  return `<div class="qb-sessao"><div class="row between"><button class="btn ghost small" onclick="rvSair()">${icon('chevron-left', 14)} Encerrar</button><span class="muted mono">${s.i + 1} / ${s.fila.length}</span></div><div class="bar" style="margin:10px 0;"><span style="width:${pct(s.i, s.fila.length)}%"></span></div>
    <div class="card qb-questao"><div class="qb-card-top"><span class="badge ${cls}">${rot}</span>${it.novo ? '<span class="badge blue">Novo</span>' : ''}${it.due < todayISO() ? '<span class="badge bad">Atrasada</span>' : ''}<span class="muted" style="font-size:12.5px;">${escHtml(it.sub)}</span></div>
      <div class="rv-face">${frente}</div>${s.rev && verso ? `<div class="rv-face rv-verso">${verso}</div>` : ''}<div class="rv-botoes">${botoes}</div>${dica}</div></div>`;
}
function rvAvaliar(rating) {
  const s = rvSessao, it = s.fila[s.i]; if (!it) return;
  if (it.kind === 'f') { flashRate(it.ref, rating); flashSaveAll(); flashTempos.push({ data: todayISO(), cardId: it.ref.id, segundos: Math.max(1, Math.round((Date.now() - s.t0) / 1000)) }); save(FLASH_TEMPOS_KEY, flashTempos.slice(-2000)); if (typeof flashTrackStudyDay === 'function') flashTrackStudyDay(); }
  else if (it.kind === 'd') { docRate(it.ref, rating); save('biblio_docs', biblioDocs); }
  else { const r = revisao.find(x => x.id === it.rid); if (r) { r[it.campo] = true; save(REVISAO_KEY, revisao); } srsRegistrarLog('m', it.rid, 'good', null, 0); }
  if (typeof trackStudyDay === 'function') trackStudyDay();
  s.cont[rating]++; s.i++; s.rev = false; s.t0 = Date.now(); renderRevisaoHub(); if (typeof renderRevisao === 'function') renderRevisao();
}
document.addEventListener('keydown', e => {
  if (!rvSessao || !document.getElementById('view-revisao').classList.contains('active')) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const it = rvSessao.fila[rvSessao.i]; if (!it) return;
  if (e.key === ' ' && !rvSessao.rev && it.kind !== 'm') { e.preventDefault(); rvRevelar(); }
  else if (rvSessao.rev && '1234'.includes(e.key) && e.key) rvAvaliar(['again', 'hard', 'good', 'easy'][+e.key - 1]);
});
