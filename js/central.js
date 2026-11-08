/* ==========================================================================
   central.js — "Central de Estudos": a tela inicial como painel de
   acompanhamento da preparação. Só LÊ dados dos demais módulos (cronograma,
   estudo-log, questões, simulados, revisão); nada é inventado nem gravado.
   Inclui o "Despacho do Dia" (prioridades do dia, clicáveis).
   ========================================================================== */
let _centralSimCarregado = false;

/* nomes de matéria podem trazer emoji (dado do usuário); na interface nova mostramos só o texto */
function nomeSemEmoji(n) { return String(n || '').replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, ''); }
function saudacao() { const h = new Date().getHours(); return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
function fmtHoras(min) { return (min / 60).toFixed(min >= 600 ? 0 : 1).replace('.', ',') + ' h'; }

function centralDesempenho() {
  const m = desempenhoPorMateria(), l = Object.entries(m).map(([k, v]) => ({ k, ...v, p: Math.round(100 * v.ac / v.tot) })).filter(x => x.tot >= 3);
  const tot = Object.values(m).reduce((a, v) => a + v.tot, 0), ac = Object.values(m).reduce((a, v) => a + v.ac, 0);
  return { geral: tot ? Math.round(100 * ac / tot) : null, tot, melhores: [...l].sort((a, b) => b.p - a.p || b.tot - a.tot).slice(0, 3), atencao: [...l].filter(x => x.p < 70).sort((a, b) => a.p - b.p || b.tot - a.tot).slice(0, 3) };
}
function centralDespacho(hoje) {
  const itens = [], pend = cronograma.filter(c => !c.feito);
  const atras = pend.filter(isAtrasado).sort((a, b) => PRIO_ORD[a.prioridade] - PRIO_ORD[b.prioridade] || (cronoISO(a) || '').localeCompare(cronoISO(b) || ''));
  const dia = pend.filter(c => cronoISO(c) === hoje).sort((a, b) => PRIO_ORD[a.prioridade] - PRIO_ORD[b.prioridade]);
  atras.slice(0, 3).forEach(c => itens.push({ ic: 'alert', cls: 'bad', t: c.tema, s: `${nomeSemEmoji(c.materia)} · atrasada desde ${c.data.slice(0, 5)}`, tag: 'Atrasada', ac: `openCronoEditModal('${c.id}')` }));
  if (atras.length > 3) itens.push({ ic: 'alert', cls: 'bad', t: `Mais ${atras.length - 3} atividade(s) atrasada(s)`, s: 'Reagende ou conclua no Cronograma', tag: '', ac: "setCronoStatusFiltro('atrasados'); goTab('cronograma')" });
  dia.slice(0, 4).forEach(c => itens.push({ ic: 'calendar', cls: c.prioridade === 'alta' ? 'gold' : '', t: c.tema, s: `${nomeSemEmoji(c.materia)}${c.duracaoMin ? ' · ' + fmtMin(c.duracaoMin) : ''}`, tag: c.prioridade === 'alta' ? 'Prioridade alta' : 'Hoje', ac: `openCronoEditModal('${c.id}')` }));
  if (dia.length > 4) itens.push({ ic: 'calendar', cls: '', t: `Mais ${dia.length - 4} atividade(s) hoje`, s: 'Ver no Cronograma', tag: '', ac: "setCronoStatusFiltro('todas'); goTab('cronograma')" });
  const rc = revisaoContagens(); if (rc.devidas) itens.push({ ic: 'repeat', cls: 'blue', t: `${rc.devidas} revisão(ões) pendente(s)`, s: `${rc.hoje} para hoje${rc.atrasadas ? ` · ${rc.atrasadas} atrasada(s)` : ''}`, tag: 'Revisão', ac: "goTab('revisao')" });
  const q = qbResumo(); if (q.aRefazer) itens.push({ ic: 'help-circle', cls: '', t: `${q.aRefazer} questão(ões) para refazer`, s: 'Você errou na última resolução', tag: 'Questões', ac: "goTab('questoes'); qIniciarPratica('erradas')" });
  if (q.hoje < q.metaDia && q.total) itens.push({ ic: 'target', cls: '', t: `Meta de questões: ${q.hoje}/${q.metaDia}`, s: q.ineditas ? `${q.ineditas} inédita(s) no banco` : 'Resolva ou cadastre mais questões', tag: 'Questões', ac: "goTab('questoes')" });
  return itens;
}

function renderCentral() {
  const el = document.getElementById('centralRoot'); if (!el) return;
  const hoje = todayISO(), p = prefs(), minHoje = minutosNoDia(hoje), meta = p.metaDiariaMin;
  const iniSem = inicioDaSemana(hoje), minSem = minutosEntre(iniSem, addDaysISO(iniSem, 6)), minMes = minutosEntre(hoje.slice(0, 8) + '01', hoje.slice(0, 8) + '31');
  const pend = cronograma.filter(c => !c.feito), doDia = cronograma.filter(c => cronoISO(c) === hoje), feitasDia = doDia.filter(c => c.feito).length, atras = pend.filter(isAtrasado).length;
  const mats = [...new Set(doDia.map(c => c.materia))], rc = revisaoContagens(), q = qbResumo(), dp = centralDesempenho();
  const serie = serieDiaria(14), mx = Math.max(60, ...serie.map(s => s.min));
  const totC = cronograma.length, feitoC = cronograma.filter(c => c.feito).length, timer = timerLer();
  const despacho = centralDespacho(hoje);
  el.innerHTML = `
  <div class="ct-head"><div><div class="ct-data">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div><h2 class="ct-titulo">${saudacao()}${window.chancelariaUser && window.chancelariaUser.nome ? ', ' + escHtml(window.chancelariaUser.nome.split(' ')[0]) : ''}.</h2></div>
    <div class="page-actions">${timer ? `<button class="btn secondary" onclick="abrirTimerModal()">${icon('clock', 16)} Sessão em andamento</button>` : `<button class="btn" onclick="estudoTimerIniciar({})">${icon('play', 16)} Iniciar sessão de estudo</button>`}</div></div>

  <section aria-label="Resumo do dia"><div class="panel-title">Resumo do dia</div>
  <div class="ct-grid5">
    <button class="ct-tile" onclick="goTab('cronograma')"><span class="ct-l">Meta de estudo</span><b class="ct-n">${fmtMin(minHoje)}</b><span class="ct-s">de ${fmtMin(meta)} · ${Math.min(100, pct(minHoje, meta))}%</span><div class="bar ${minHoje >= meta ? 'ok' : ''}"><span style="width:${Math.min(100, pct(minHoje, meta))}%"></span></div></button>
    <button class="ct-tile" onclick="goTab('cronograma')"><span class="ct-l">Tarefas de hoje</span><b class="ct-n">${feitasDia}/${doDia.length}</b><span class="ct-s">${atras ? `<span style="color:var(--bad)">${atras} atrasada(s)</span>` : doDia.length ? 'concluídas' : 'nada agendado'}</span><div class="bar ok"><span style="width:${pct(feitasDia, doDia.length)}%"></span></div></button>
    <div class="ct-tile static"><span class="ct-l">Matérias previstas</span>${mats.length ? `<div class="ct-mats">${mats.slice(0, 4).map(m => `<span class="badge" style="border-color:${getMateriaColor(m)}66"><span class="cr-dot" style="background:${getMateriaColor(m)}"></span>${escHtml(nomeSemEmoji(m))}</span>`).join('')}${mats.length > 4 ? `<span class="badge">+${mats.length - 4}</span>` : ''}</div>` : '<span class="ct-s">Sem matérias agendadas hoje</span>'}</div>
    <button class="ct-tile" onclick="goTab('revisao')"><span class="ct-l">Revisões pendentes</span><b class="ct-n" style="${rc.atrasadas ? 'color:var(--bad)' : ''}">${rc.devidas}</b><span class="ct-s">${rc.hoje} hoje${rc.atrasadas ? ` · ${rc.atrasadas} atrasada(s)` : ''}</span></button>
    <button class="ct-tile" onclick="goTab('questoes')"><span class="ct-l">Questões</span><b class="ct-n">${q.hoje}/${q.metaDia}</b><span class="ct-s">${q.aRefazer ? q.aRefazer + ' para refazer · ' : ''}${q.ineditas} inédita(s)</span><div class="bar"><span style="width:${Math.min(100, pct(q.hoje, q.metaDia))}%"></span></div></button>
  </div></section>

  <div class="ct-cols">
    <section class="card ct-despacho" aria-label="Despacho do Dia"><div class="panel-title">Despacho do Dia <span class="muted" style="text-transform:none;letter-spacing:0;">· suas prioridades</span></div>
      ${despacho.length ? despacho.slice(0, 9).map(d => `<button class="ct-desp ${d.cls}" onclick="${d.ac}"><span class="ct-desp-ic">${icon(d.ic, 18)}</span><span class="grow"><b>${escHtml(d.t)}</b><small>${escHtml(d.s)}</small></span>${d.tag ? `<span class="badge ${d.cls}">${escHtml(d.tag)}</span>` : ''}${icon('chevron-right', 16)}</button>`).join('')
        : `<div class="empty-state" style="padding:24px 8px;">${icon('check')}<b>Nenhuma obrigação pendente</b><p>Planeje a semana no Cronograma ou comece uma sessão de estudo livre.</p><button class="btn small" onclick="goTab('cronograma')">Abrir Cronograma</button></div>`}</section>

    <section class="card" aria-label="Indicadores"><div class="panel-title">Indicadores</div>
      <div class="ct-ind"><div><b>${fmtHoras(minSem)}</b><span>nesta semana</span></div><div><b>${fmtHoras(minMes)}</b><span>neste mês</span></div><div><b>${totC ? pct(feitoC, totC) + '%' : '—'}</b><span>cronograma concluído</span></div><div><b>${dp.geral == null ? '—' : dp.geral + '%'}</b><span>acerto em questões</span></div></div>
      <div class="panel-title" style="margin-top:16px;">Evolução do tempo de estudo · 14 dias</div>
      <div class="qb-spark" role="img" aria-label="Minutos estudados por dia nos últimos 14 dias">${serie.map(s => `<div class="qb-spark-col" title="${isoToBR(s.iso)}: ${fmtMin(s.min)}"><div class="qb-spark-bar"><i class="${s.iso === hoje ? 'hoje' : ''}" style="height:${Math.round(100 * s.min / mx)}%"></i></div><small>${s.iso.slice(8)}</small></div>`).join('')}</div>
      ${estudoLog.length ? '' : '<p class="muted" style="font-size:12.5px;margin:8px 0 0;">O tempo estudado aparece aqui quando você conclui atividades com tempo registrado ou usa o cronômetro.</p>'}</section>
  </div>

  <div class="grid-2">
    <section class="card"><div class="panel-title">${icon('trending', 14)} Melhor desempenho</div>${dp.melhores.length ? dp.melhores.map(centralBarra).join('') : '<p class="muted" style="margin:0;">Resolva ao menos 3 questões em uma matéria (banco ou simulados) para ver o ranking.</p>'}</section>
    <section class="card"><div class="panel-title">${icon('alert', 14)} Precisam de atenção</div>${dp.atencao.length ? dp.atencao.map(centralBarra).join('') : `<p class="muted" style="margin:0;">${dp.melhores.length ? 'Nenhuma matéria abaixo de 70% de acerto.' : 'Sem dados suficientes ainda.'}</p>`}</section>
  </div>

  <div class="panel-title" style="margin-top:6px;">Acesso rápido</div>
  <div class="ct-quick">
    ${[['palavras', 'type', 'Palavras', 'Hub linguístico: latim, francês, inglês e espanhol'], ['flashcards', 'layers', 'Flashcards', `${typeof flashCards !== 'undefined' ? flashCards.length : 0} cartões`], ['biblioteca', 'library', 'Biblioteca', `${biblioDocs.length} documento(s)`], ['simulados', 'clipboard', 'Simulados', 'Provas do CACD'], ['paises', 'globe', 'Países', 'Fichas e mapa-múndi'], ['atualidades', 'newspaper', 'Atualidades', `${atualidades.length} registro(s)`]].map(([id, ic, t, s]) => `<button class="ct-q" onclick="goTab('${id}')">${icon(ic, 20)}<span><b>${t}</b><small>${escHtml(s)}</small></span></button>`).join('')}
  </div>`;
  if (!_centralSimCarregado && typeof carregarSimuladosIndex === 'function' && !simuladosIndexCarregado) { _centralSimCarregado = true; carregarSimuladosIndex().then(() => { if (document.getElementById('view-inicio').classList.contains('active')) renderCentral(); }).catch(() => {}); }
}
function centralBarra(r) { return `<div class="qb-barra"><div class="row between"><span>${escHtml(r.k)}</span><span class="mono">${r.p}% · ${r.ac}/${r.tot}</span></div><div class="bar ${r.p >= 70 ? 'ok' : ''}"><span style="width:${r.p}%;${r.p < 50 ? 'background:var(--bad)' : ''}"></span></div></div>`; }
