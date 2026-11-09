/* ==========================================================================
   cronograma.js — módulo "Cronograma": planejamento real de estudos.

   Cada item (diplo_cronograma) mantém os campos ORIGINAIS (id, tema,
   estudar, semana, tempo, data "dd/mm/aaaa" ou "—", materia, feito) e
   ganha, de forma aditiva e opcional:
     assunto, prioridade ('alta'|'media'|'baixa'), duracaoMin (planejado),
     sessoes [{id,data,min}] (tempo EFETIVAMENTE estudado),
     concluidoEm, reagend (nº de reagendamentos), historico [{t,ev,det}].
   Diferenciamos: tempo PLANEJADO × tempo ESTUDADO; atividade CONCLUÍDA
   (marcada, com ou sem tempo registrado), ATRASADA (data passou e não foi
   concluída) e REAGENDADA (data movida).
   Visões: semana · mês · lista · por matéria · histórico.
   ========================================================================== */
const CRONO_KEY = 'diplo_cronograma';
const PRIORIDADES = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

function crNorm(c) {
  if (!c.prioridade) c.prioridade = 'media';
  if (c.duracaoMin == null) c.duracaoMin = parseTempoMin(c.tempo);
  if (!Array.isArray(c.sessoes)) c.sessoes = [];
  if (!Array.isArray(c.historico)) c.historico = [];
  if (!c.reagend) c.reagend = 0;
  if (c.assunto == null) c.assunto = '';
  return c;
}
let cronograma = (load(CRONO_KEY, []) || []).map(crNorm);
function crSalvar() { save(CRONO_KEY, cronograma); }

let cronoViewMode = 'semana';
let cronoStatusFiltro = 'todas';
let cronoMateriaFiltro = '';
let cronoRef = todayISO();            // data de referência da semana/mês exibidos
let calState = { year: new Date().getFullYear(), month: new Date().getMonth() };

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA_NOMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function fmtDataBR(d) { return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }

/* ---- datas e status ---- */
function cronoISO(c) { return brToISO(c.data); }                  // 'YYYY-MM-DD' | null
function crISOParaBR(iso) { return iso ? isoToBR(iso) : '—'; }
function crStatus(c) {
  if (c.feito) return 'concluida';
  const d = cronoISO(c); if (!d) return 'sem-data';
  if (d < todayISO()) return 'atrasada';
  return c.reagend > 0 ? 'reagendada' : 'planejada';
}
function isAtrasado(c) { return crStatus(c) === 'atrasada'; }
const CR_STATUS_INFO = { concluida: ['Concluída', 'ok'], atrasada: ['Atrasada', 'bad'], reagendada: ['Reagendada', 'warn'], planejada: ['Planejada', 'blue'], 'sem-data': ['Sem data', ''] };
function crTempoReal(c) { return (c.sessoes || []).reduce((a, s) => a + s.min, 0); }
function crHist(c, ev, det) { c.historico.push({ t: new Date().toISOString(), ev, det: det || '' }); }
function crPassaFiltros(c) {
  if (cronoMateriaFiltro && c.materia !== cronoMateriaFiltro) return false;
  const st = crStatus(c);
  if (cronoStatusFiltro === 'pendentes') return !c.feito && st !== 'atrasada';
  if (cronoStatusFiltro === 'atrasados') return st === 'atrasada';
  if (cronoStatusFiltro === 'concluidos') return c.feito;
  return true;
}
const PRIO_ORD = { alta: 0, media: 1, baixa: 2 };
function crOrdenar(a, b) { return (cronoISO(a) || '9999').localeCompare(cronoISO(b) || '9999') || (PRIO_ORD[a.prioridade] - PRIO_ORD[b.prioridade]) || a.tema.localeCompare(b.tema); }

/* ---- cartão de item ---- */
function crItemHTML(c, compacto) {
  const st = crStatus(c), [rot, cls] = CR_STATUS_INFO[st], real = crTempoReal(c);
  const cor = getMateriaColor(c.materia);
  const tempo = [c.duracaoMin ? `Planejado ${fmtMin(c.duracaoMin)}` : '', real ? `Estudado ${fmtMin(real)}` : (c.feito ? 'Tempo não registrado' : '')].filter(Boolean).join(' · ');
  return `<div class="cr-item ${st}" style="--mc:${cor}" data-id="${escAttr(c.id)}">
    <button class="cr-check ${c.feito ? 'on' : ''}" onclick="crAlternarConcluir('${c.id}')" aria-label="${c.feito ? 'Reabrir' : 'Concluir'}: ${escAttr(c.tema)}" aria-pressed="${c.feito}">${c.feito ? icon('check', 16) : ''}</button>
    <div class="cr-body" onclick="openCronoEditModal('${c.id}')" tabindex="0" role="button" onkeydown="if(event.key==='Enter')openCronoEditModal('${c.id}')">
      <div class="cr-tema">${escHtml(c.tema)}</div>
      <div class="cr-meta"><span class="cr-dot"></span>${escHtml(c.materia)}${c.assunto ? ' · ' + escHtml(c.assunto) : ''}</div>
      <div class="cr-badges"><span class="badge ${cls}">${rot}${c.reagend ? ` ×${c.reagend}` : ''}</span>${c.prioridade === 'alta' ? '<span class="badge gold">Prioridade alta</span>' : ''}${!compacto && cronoISO(c) ? `<span class="badge">${escHtml(c.data.slice(0, 5))}</span>` : ''}</div>
      ${tempo ? `<div class="cr-tempo">${escHtml(tempo)}</div>` : ''}
    </div>
    <div class="cr-actions">
      ${c.feito ? '' : `<button class="icon-btn ghost" onclick="crIniciarTimer('${c.id}')" aria-label="Iniciar cronômetro" title="Iniciar cronômetro">${icon('play', 16)}</button><button class="icon-btn ghost" onclick="crAbrirReagendar('${c.id}')" aria-label="Reagendar" title="Reagendar">${icon('calendar', 16)}</button>`}
    </div></div>`;
}

/* ---- semana ---- */
function crSemanaDias(ref) { const ini = inicioDaSemana(ref); return Array.from({ length: 7 }, (_, i) => addDaysISO(ini, i)); }
function crRevisoesNoDia(iso) { try { return typeof revisaoAgendadasNoDia === 'function' ? revisaoAgendadasNoDia(iso) : 0; } catch (e) { return 0; } }
function crDiaCabecalho(iso, itens) {
  const d = parseISOLocal(iso), plan = itens.reduce((a, c) => a + (c.duracaoMin || 0), 0), est = minutosNoDia(iso), rev = crRevisoesNoDia(iso);
  return `<div class="cr-dia-head"><div><b>${DIAS_CURTOS[d.getDay()]}</b> <span class="muted">${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}</span>${iso === todayISO() ? ' <span class="badge gold">Hoje</span>' : ''}</div>
    <div class="cr-dia-sum">${plan ? `<span title="Tempo planejado">${icon('calendar', 12)} ${fmtMin(plan)}</span>` : ''}${est ? `<span title="Tempo estudado" class="ok">${icon('check', 12)} ${fmtMin(est)}</span>` : ''}${rev ? `<a href="#" onclick="goTab('revisao'); return false;" class="badge blue" title="Revisões previstas">${rev} rev.</a>` : ''}</div></div>`;
}
function crRenderSemana() {
  const dias = crSemanaDias(cronoRef), ini = parseISOLocal(dias[0]), fim = parseISOLocal(dias[6]);
  const itens = cronograma.filter(crPassaFiltros);
  const titulo = `${ini.getDate()} ${MESES_NOMES[ini.getMonth()].slice(0, 3).toLowerCase()} – ${fim.getDate()} ${MESES_NOMES[fim.getMonth()].slice(0, 3).toLowerCase()} ${fim.getFullYear()}`;
  const atrasados = itens.filter(c => crStatus(c) === 'atrasada' && !dias.includes(cronoISO(c)));
  return `<div class="cr-nav"><button class="icon-btn" onclick="crMover(-7)" aria-label="Semana anterior">${icon('chevron-left')}</button><b class="cr-nav-titulo">${titulo}</b><button class="icon-btn" onclick="crMover(7)" aria-label="Próxima semana">${icon('chevron-right')}</button><button class="btn ghost small" onclick="crHoje()">Hoje</button></div>
    ${atrasados.length && cronoStatusFiltro !== 'concluidos' ? `<div class="cr-atrasadas card flat"><div class="panel-title" style="color:var(--bad)">${icon('alert', 14)} Atrasadas (${atrasados.length})</div>${atrasados.sort(crOrdenar).map(c => crItemHTML(c)).join('')}</div>` : ''}
    <div class="cr-semana">${dias.map(iso => { const doDia = itens.filter(c => cronoISO(c) === iso).sort(crOrdenar);
      return `<section class="cr-dia ${iso === todayISO() ? 'hoje' : ''}" aria-label="${DIAS_SEMANA_NOMES[parseISOLocal(iso).getDay()]}">${crDiaCabecalho(iso, doDia)}<div class="cr-dia-itens">${doDia.map(c => crItemHTML(c, true)).join('') || '<div class="cr-vazio">Nada planejado</div>'}</div><button class="cr-add" onclick="crNovo('${iso}')">${icon('plus', 14)} Adicionar</button></section>`; }).join('')}</div>`;
}
/* ---- mês ---- */
function crRenderMes() {
  const ano = calState.year, mes = calState.month, prim = new Date(ano, mes, 1), offset = (prim.getDay() + 6) % 7, total = new Date(ano, mes + 1, 0).getDate();
  const itens = cronograma.filter(crPassaFiltros), porDia = {};
  itens.forEach(c => { const d = cronoISO(c); if (d && d.startsWith(`${ano}-${String(mes + 1).padStart(2, '0')}`)) (porDia[+d.slice(8)] = porDia[+d.slice(8)] || []).push(c); });
  let h = `<div class="cr-nav"><button class="icon-btn" onclick="cronoCalPrev()" aria-label="Mês anterior">${icon('chevron-left')}</button><b class="cr-nav-titulo">${MESES_NOMES[mes]} de ${ano}</b><button class="icon-btn" onclick="cronoCalNext()" aria-label="Próximo mês">${icon('chevron-right')}</button><button class="btn ghost small" onclick="cronoCalToday()">Hoje</button></div><div class="cr-mes" role="grid">`;
  ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].forEach(n => { h += `<div class="cr-mes-h" role="columnheader">${n}</div>`; });
  for (let i = 0; i < offset; i++) h += '<div class="cr-mes-d vazio"></div>';
  for (let dia = 1; dia <= total; dia++) {
    const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`, l = (porDia[dia] || []).sort(crOrdenar), feitos = l.filter(c => c.feito).length;
    h += `<button class="cr-mes-d ${iso === todayISO() ? 'hoje' : ''}" onclick="crAbrirDia('${iso}')" aria-label="${dia} de ${MESES_NOMES[mes]}: ${l.length} atividade(s)"><span class="n">${dia}</span><span class="pills">${l.slice(0, 3).map(c => `<i class="${c.feito ? 'feito' : ''} ${crStatus(c) === 'atrasada' ? 'atras' : ''}" style="background:${getMateriaColor(c.materia)}" title="${escAttr(c.materia + ' — ' + c.tema)}"></i>`).join('')}</span>${l.length ? `<span class="cnt">${feitos}/${l.length}</span>` : ''}</button>`;
  }
  return h + '</div>';
}
function cronoCalPrev() { calState.month--; if (calState.month < 0) { calState.month = 11; calState.year--; } renderCronograma(); }
function cronoCalNext() { calState.month++; if (calState.month > 11) { calState.month = 0; calState.year++; } renderCronograma(); }
function cronoCalToday() { const n = new Date(); calState.year = n.getFullYear(); calState.month = n.getMonth(); renderCronograma(); }
function crMover(dias) { cronoRef = addDaysISO(cronoRef, dias); renderCronograma(); }
function crHoje() { cronoRef = todayISO(); cronoCalToday(); }

/* ---- lista / matéria / histórico ---- */
function crRenderLista() {
  const itens = cronograma.filter(crPassaFiltros).sort(crOrdenar); if (!itens.length) return crVazio();
  const hoje = todayISO(), grupos = {};
  itens.forEach(c => { const d = cronoISO(c); const k = !d ? 'Sem data' : (c.feito ? d : (d < hoje ? 'Atrasadas' : d)); (grupos[k] = grupos[k] || []).push(c); });
  const chaves = Object.keys(grupos).sort((a, b) => (a === 'Atrasadas' ? '0' : a === 'Sem data' ? '9' : '1' + a).localeCompare(b === 'Atrasadas' ? '0' : b === 'Sem data' ? '9' : '1' + b));
  return chaves.map(k => { const rot = /^\d{4}/.test(k) ? `${DIAS_SEMANA_NOMES[parseISOLocal(k).getDay()]}, ${isoToBR(k)}${k === hoje ? ' · Hoje' : ''}` : k;
    return `<div class="cr-grupo"><div class="panel-title">${escHtml(rot)} <span class="badge">${grupos[k].length}</span></div>${grupos[k].map(c => crItemHTML(c)).join('')}</div>`; }).join('');
}
function crRenderMateria() {
  const itens = cronograma.filter(crPassaFiltros); if (!itens.length) return crVazio();
  const por = {}; itens.forEach(c => (por[c.materia] = por[c.materia] || []).push(c));
  return Object.keys(por).sort().map(m => { const l = por[m].sort(crOrdenar), fe = l.filter(c => c.feito).length, plan = l.reduce((a, c) => a + (c.duracaoMin || 0), 0), real = l.reduce((a, c) => a + crTempoReal(c), 0);
    return `<div class="cr-grupo"><div class="panel-title"><span class="cr-dot" style="background:${getMateriaColor(m)}"></span>${escHtml(m)}</div><div class="row" style="margin-bottom:8px;"><div class="bar grow ok"><span style="width:${pct(fe, l.length)}%"></span></div><span class="muted" style="font-size:12.5px;">${fe}/${l.length} concluídas · planejado ${fmtMin(plan)} · estudado ${fmtMin(real)}</span></div>${l.map(c => crItemHTML(c)).join('')}</div>`; }).join('');
}
function crRenderHistorico() {
  const ev = []; cronograma.forEach(c => c.historico.forEach(h => ev.push({ ...h, tema: c.tema, materia: c.materia, id: c.id })));
  estudoLog.filter(e => e.origem === 'cronometro' || e.origem === 'manual').forEach(e => ev.push({ t: new Date(e.criadoEm).toISOString(), ev: 'estudo', tema: e.materia || 'Sessão livre', materia: e.materia, det: fmtMin(e.minutos) }));
  ev.sort((a, b) => b.t.localeCompare(a.t));
  if (!ev.length) return `<div class="empty-state">${icon('history')}<b>Sem histórico ainda</b><p>Conclusões, reagendamentos e sessões de estudo aparecem aqui.</p></div>`;
  const rot = { criado: 'Criada', concluido: 'Concluída', reaberto: 'Reaberta', reagendado: 'Reagendada', editado: 'Editada', estudo: 'Estudo registrado', tempo: 'Tempo registrado' };
  return `<div class="cr-hist">${ev.slice(0, 120).map(h => `<div class="cr-hist-i"><span class="badge ${h.ev === 'concluido' ? 'ok' : h.ev === 'reagendado' ? 'warn' : ''}">${rot[h.ev] || h.ev}</span><div class="grow"><b>${escHtml(h.tema)}</b><div class="muted" style="font-size:12.5px;">${escHtml(h.materia || '')}${h.det ? ' · ' + escHtml(h.det) : ''}</div></div><span class="muted mono" style="font-size:11.5px;">${new Date(h.t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>`).join('')}</div>`;
}
function crVazio() { return `<div class="empty-state">${icon('calendar')}<b>Nenhuma atividade para este filtro</b><p>Planeje o que estudar, com data, duração e prioridade. Depois registre o tempo real estudado.</p><button class="btn small" onclick="crNovo()">${icon('plus', 14)} Nova atividade</button></div>`; }

/* ---- render principal ---- */
function renderCronograma() {
  const el = document.getElementById('cronoRoot'); if (!el) return;
  const views = [['semana', 'Semana'], ['mes', 'Mês'], ['lista', 'Lista'], ['materia', 'Por matéria'], ['historico', 'Histórico']];
  const st = [['todas', 'Todas'], ['pendentes', 'Pendentes'], ['atrasados', 'Atrasadas'], ['concluidos', 'Concluídas']];
  const tot = cronograma.length, feitas = cronograma.filter(c => c.feito).length, atras = cronograma.filter(isAtrasado).length;
  const body = { semana: crRenderSemana, mes: crRenderMes, lista: crRenderLista, materia: crRenderMateria, historico: crRenderHistorico }[cronoViewMode]();
  el.innerHTML = `<div class="page-head"><div><h2>Cronograma</h2><p>Planeje por semana ou mês, registre o tempo realmente estudado e reagende o que atrasar. ${tot ? `<b>${pct(feitas, tot)}%</b> concluído (${feitas}/${tot})${atras ? ` · <span style="color:var(--bad)">${atras} atrasada(s)</span>` : ''}.` : ''}</p></div>
      <div class="page-actions"><button class="btn secondary small" onclick="estudoTimerIniciar({})">${icon('clock', 15)} Cronômetro livre</button><button class="btn small" onclick="crNovo()">${icon('plus', 15)} Nova atividade</button></div></div>
    <div class="subtabs" role="tablist" aria-label="Visão do cronograma">${views.map(([k, l]) => `<button class="subtab-btn ${cronoViewMode === k ? 'active' : ''}" role="tab" aria-selected="${cronoViewMode === k}" onclick="setCronoView('${k}')">${l}</button>`).join('')}</div>
    ${cronoViewMode === 'historico' ? '' : `<div class="cr-filtros"><div class="filters">${st.map(([k, l]) => `<button class="chip ${cronoStatusFiltro === k ? 'active' : ''}" onclick="setCronoStatusFiltro('${k}')">${l}</button>`).join('')}</div>
      <select aria-label="Filtrar por matéria" onchange="setCronoFiltroMateria(this.value)" style="max-width:260px;"><option value="">Todas as matérias</option>${materias.map(m => `<option value="${escAttr(m.nome)}" ${m.nome === cronoMateriaFiltro ? 'selected' : ''}>${escHtml(m.nome)}</option>`).join('')}</select></div>`}
    <div class="cr-corpo">${body}</div>
    ${tot ? `<div class="row" style="margin-top:22px;justify-content:flex-end;"><button class="btn danger small" onclick="limparCronogramaTudo()">${icon('trash', 14)} Excluir todo o cronograma</button></div>` : ''}`;
}
function renderCalendarStructure() { renderCronograma(); }
function setCronoView(m) { cronoViewMode = m; renderCronograma(); }
function setCronoStatusFiltro(s) { cronoStatusFiltro = s; renderCronograma(); }
function setCronoFiltroMateria(n) { cronoMateriaFiltro = n; renderCronograma(); }

/* ---- modal genérico ---- */
function crModal(html, id) { crFecharModal(id); const ov = document.createElement('div'); ov.className = 'modal-overlay show'; ov.id = id || 'crModal'; ov.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true">${html}</div>`; ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.appendChild(ov); return ov; }
/* Foco inicial do modal, sem roubar o foco se a pessoa já começou a digitar em outro campo do modal. */
function crFocoInicial(id) { requestAnimationFrame(() => { const e = document.getElementById(id), m = e && e.closest('.modal-card'); if (e && m && !m.contains(document.activeElement)) e.focus(); }); }
function crFecharModal(id) { const m = document.getElementById(id || 'crModal'); if (m) m.remove(); }

/* ---- criar / editar ---- */
function crNovo(iso) { crAbrirForm(null, iso); }
function openCronoEditModal(id) { crAbrirForm(id); }
function crAbrirForm(id, isoPadrao) {
  const c = id ? cronograma.find(x => x.id === id) : null; if (id && !c) return;
  const iso = c ? cronoISO(c) || '' : (isoPadrao || todayISO()), m0 = c ? c.materia : (cronoMateriaFiltro || (materias[0] && materias[0].nome) || '');
  crModal(`<h3>${c ? 'Editar atividade' : 'Nova atividade'}</h3>
    <label class="field-label" for="crfTema">Tema / tópico *</label><input type="text" id="crfTema" value="${escAttr(c ? c.tema : '')}" placeholder="Ex.: Guerra do Paraguai" autocomplete="off">
    <div class="row2 stack-m"><div><label class="field-label" for="crfMateria">Matéria</label><select id="crfMateria" onchange="crAtualizarAssuntos()">${materias.map(m => `<option ${m.nome === m0 ? 'selected' : ''}>${escHtml(m.nome)}</option>`).join('')}</select></div>
      <div><label class="field-label" for="crfAssunto">Assunto do edital</label><input type="text" id="crfAssunto" list="crfAssuntos" value="${escAttr(c ? c.assunto : '')}" placeholder="Opcional"><datalist id="crfAssuntos"></datalist></div></div>
    <label class="field-label" for="crfEstudar">O que estudar</label><textarea id="crfEstudar" placeholder="Leituras, capítulos, exercícios..." style="min-height:64px;">${escHtml(c ? c.estudar || '' : '')}</textarea>
    <div class="row3"><div><label class="field-label" for="crfData">Data</label><input type="date" id="crfData" value="${iso}"></div>
      <div><label class="field-label" for="crfDur">Duração estimada</label><input type="text" id="crfDur" value="${c && c.duracaoMin ? fmtMin(c.duracaoMin).replace(' min', 'min') : ''}" placeholder="1h30"></div>
      <div><label class="field-label" for="crfPrio">Prioridade</label><select id="crfPrio">${Object.entries(PRIORIDADES).map(([k, v]) => `<option value="${k}" ${(c ? c.prioridade : 'media') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
    <label class="field-label" for="crfSemana">Semana (opcional)</label><input type="text" id="crfSemana" value="${escAttr(c && c.semana !== '—' ? c.semana : '')}" placeholder="Semana 5">
    ${c ? `<div class="cr-form-info">${c.feito ? `Concluída${c.concluidoEm ? ' em ' + new Date(c.concluidoEm).toLocaleDateString('pt-BR') : ''}. ` : ''}Planejado: ${c.duracaoMin ? fmtMin(c.duracaoMin) : '—'} · Estudado: ${crTempoReal(c) ? fmtMin(crTempoReal(c)) : '—'}${c.reagend ? ` · Reagendada ${c.reagend}×` : ''}</div>` : ''}
    <div id="crfErro" class="form-erro" role="alert"></div>
    <div class="modal-actions">${c ? `<button class="btn danger small" onclick="crExcluir('${c.id}')" style="margin-right:auto;">${icon('trash', 14)} Excluir</button>` : ''}<button class="btn ghost small" onclick="crFecharModal()">Cancelar</button><button class="btn small" onclick="crSalvarForm(${c ? `'${c.id}'` : 'null'})">Salvar</button></div>`);
  crAtualizarAssuntos(); crFocoInicial('crfTema');
}
function crAtualizarAssuntos() {
  const m = materias.find(x => x.nome === (document.getElementById('crfMateria') || {}).value), dl = document.getElementById('crfAssuntos'); if (!dl) return;
  const nomes = []; (m ? m.topicos : []).forEach(t => { nomes.push(t.nome); (t.subtopicos || []).forEach(s => nomes.push(s.nome)); });
  dl.innerHTML = nomes.map(n => `<option value="${escAttr(n)}">`).join('');
}
function crSalvarForm(id) {
  const tema = document.getElementById('crfTema').value.trim(), err = document.getElementById('crfErro');
  if (!tema) { err.textContent = 'Informe o tema da atividade.'; document.getElementById('crfTema').focus(); return; }
  const durTxt = document.getElementById('crfDur').value.trim(), dur = durTxt ? parseTempoMin(durTxt) : null;
  if (durTxt && dur == null) { err.textContent = 'Duração inválida. Use formatos como 90, 45min, 1h30.'; return; }
  const iso = document.getElementById('crfData').value, dados = { tema, materia: document.getElementById('crfMateria').value, assunto: document.getElementById('crfAssunto').value.trim(), estudar: document.getElementById('crfEstudar').value.trim(), prioridade: document.getElementById('crfPrio').value, semana: document.getElementById('crfSemana').value.trim() || '—', duracaoMin: dur, tempo: dur ? fmtMin(dur).replace(' min', 'min') : '—', data: crISOParaBR(iso) };
  if (id) { const c = cronograma.find(x => x.id === id); const dAnt = c.data; Object.assign(c, dados); if (dAnt !== c.data) { c.reagend++; crHist(c, 'reagendado', `${dAnt} → ${c.data}`); } else crHist(c, 'editado'); }
  else { const c = crNorm(Object.assign({ id: uid(), feito: false }, dados)); crHist(c, 'criado'); cronograma.push(c); }
  crSalvar(); crFecharModal(); renderCronograma(); refreshStats(); toast('Atividade salva.');
}
async function crExcluir(id) {
  const c = cronograma.find(x => x.id === id); if (!c) return;
  if (!await confirmar(`Excluir "${c.tema}"? O tempo estudado registrado nela também será removido do histórico.`, { titulo: 'Excluir atividade', ok: 'Excluir' })) return;
  removerEstudoPorPrefixo('cronograma', id + ':'); cronograma = cronograma.filter(x => x.id !== id); crSalvar(); crFecharModal(); renderCronograma(); refreshStats(); toast('Atividade excluída.');
}

/* ---- concluir / reabrir (com tempo real) ---- */
function crAlternarConcluir(id) {
  const c = cronograma.find(x => x.id === id); if (!c) return;
  if (c.feito) { crReabrir(c); return; }
  const jaReg = crTempoReal(c), sug = '';   // nunca pré-preenche com o tempo planejado: tempo real só entra se você informar
  crModal(`<h3>Concluir atividade</h3><p class="muted" style="margin-top:-4px;">${escHtml(c.tema)}</p>
    ${jaReg ? `<p class="cr-form-info">Já registrado: <b>${fmtMin(jaReg)}</b> estudados.</p>` : ''}
    <label class="field-label" for="crcMin">${jaReg ? 'Tempo adicional estudado (minutos)' : 'Quanto tempo você estudou? (minutos)'}</label><input type="number" id="crcMin" min="0" max="1440" value="${sug}" placeholder="${c.duracaoMin ? 'Planejado: ' + c.duracaoMin : 'Ex.: 90'}" inputmode="numeric">
    <p class="muted" style="font-size:12.5px;margin:8px 0 0;">Deixe em branco para concluir sem registrar o tempo — a atividade ficará marcada como "tempo não registrado".</p>
    <div class="modal-actions"><button class="btn ghost small" onclick="crFecharModal()">Cancelar</button><button class="btn small" onclick="crConfirmarConcluir('${id}')">${icon('check', 14)} Concluir</button></div>`);
  crFocoInicial('crcMin');
}
function crConfirmarConcluir(id) {
  const c = cronograma.find(x => x.id === id); if (!c) return;
  const min = Math.round(+document.getElementById('crcMin').value || 0);
  if (min > 0) cronoAddTempoReal(id, min, true);
  c.feito = true; c.concluidoEm = new Date().toISOString(); crHist(c, 'concluido', min ? fmtMin(min) : 'sem tempo registrado');
  crSalvar(); crFecharModal(); renderCronograma(); refreshStats(); toast(min ? `Concluída · ${fmtMin(min)} registrados.` : 'Concluída (tempo não registrado).');
  if (typeof trackStudyDay === 'function') trackStudyDay();
}
async function crReabrir(c) {
  if (!await confirmar(`Reabrir "${c.tema}"? O tempo já registrado é mantido.`, { titulo: 'Reabrir atividade', ok: 'Reabrir', perigo: false })) return;
  c.feito = false; c.concluidoEm = null; crHist(c, 'reaberto'); crSalvar(); renderCronograma(); refreshStats();
}
/* Soma uma sessão de estudo à atividade e ao log de tempo (usada pelo cronômetro e pelo "concluir"). */
function cronoAddTempoReal(id, min, semSalvar) {
  const c = cronograma.find(x => x.id === id); if (!c || !(min > 0)) return;
  const s = { id: uid(), data: todayISO(), min: Math.round(min) }; c.sessoes.push(s);
  registrarEstudo({ materia: c.materia, minutos: s.min, origem: 'cronograma', refId: c.id + ':' + s.id, data: s.data });
  crHist(c, 'tempo', fmtMin(s.min));
  if (!semSalvar) { crSalvar(); renderCronograma(); }
}
function crIniciarTimer(id) { const c = cronograma.find(x => x.id === id); if (c) estudoTimerIniciar({ materia: c.materia, cronoId: c.id, titulo: c.tema }); }

/* ---- reagendar ---- */
function crAbrirReagendar(id) {
  const c = cronograma.find(x => x.id === id); if (!c) return;
  const amanha = addDaysISO(todayISO(), 1), seg = addDaysISO(inicioDaSemana(todayISO()), 7);
  crModal(`<h3>Reagendar</h3><p class="muted" style="margin-top:-4px;">${escHtml(c.tema)}${c.data !== '—' ? ' · hoje em ' + escHtml(c.data) : ''}</p>
    <div class="filters"><button class="chip" onclick="document.getElementById('crrData').value='${todayISO()}'">Hoje</button><button class="chip" onclick="document.getElementById('crrData').value='${amanha}'">Amanhã</button><button class="chip" onclick="document.getElementById('crrData').value='${addDaysISO(todayISO(), 7)}'">+1 semana</button><button class="chip" onclick="document.getElementById('crrData').value='${seg}'">Próxima segunda</button></div>
    <label class="field-label" for="crrData">Nova data</label><input type="date" id="crrData" value="${amanha}">
    <div class="modal-actions"><button class="btn ghost small" onclick="crFecharModal()">Cancelar</button><button class="btn small" onclick="crConfirmarReagendar('${id}')">Reagendar</button></div>`);
}
function crConfirmarReagendar(id) {
  const c = cronograma.find(x => x.id === id), iso = document.getElementById('crrData').value; if (!c || !iso) return;
  const ant = c.data; c.data = crISOParaBR(iso); c.reagend++; crHist(c, 'reagendado', `${ant} → ${c.data}`);
  crSalvar(); crFecharModal(); renderCronograma(); refreshStats(); toast('Atividade reagendada para ' + c.data + '.');
}

/* ---- dia (visão mensal) ---- */
function crAbrirDia(iso) {
  const l = cronograma.filter(c => cronoISO(c) === iso).sort(crOrdenar), d = parseISOLocal(iso), rev = crRevisoesNoDia(iso);
  crModal(`<h3>${DIAS_SEMANA_NOMES[d.getDay()]}, ${d.getDate()} de ${MESES_NOMES[d.getMonth()]}</h3>
    ${rev ? `<p><a href="#" onclick="crFecharModal(); goTab('revisao'); return false;" class="badge blue">${rev} revisão(ões) prevista(s)</a></p>` : ''}
    <div>${l.map(c => crItemHTML(c)).join('') || '<div class="cr-vazio">Nada planejado neste dia.</div>'}</div>
    <div class="modal-actions"><button class="btn ghost small" onclick="crFecharModal()">Fechar</button><button class="btn small" onclick="crNovo('${iso}')">${icon('plus', 14)} Nova atividade</button></div>`, 'crModal');
}
/* delegação: botões dentro do modal do dia reutilizam as mesmas funções, que re-renderizam a visão */

async function limparCronogramaTudo() {
  if (!cronograma.length) { toast('O cronograma já está vazio.'); return; }
  if (!await confirmar(`Isso exclui permanentemente os ${cronograma.length} itens do cronograma. Um ponto de restauração é salvo antes (Configurações → Dados). Confirma?`, { titulo: 'Excluir todo o cronograma', ok: 'Excluir tudo' })) return;
  await criarSnapshot('antes-de-limpar-cronograma');
  cronograma = []; crSalvar(); renderCronograma(); refreshStats(); toast('Cronograma excluído. Restaure em Configurações → Dados, se precisar.');
}
