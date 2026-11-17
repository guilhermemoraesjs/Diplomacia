/* ==========================================================================
   central.js — "Central de Estudos": a tela inicial como painel de
   acompanhamento da preparação. Só LÊ dados dos demais módulos (cronograma,
   estudo-log, questões, simulados, revisão); nada é inventado nem gravado.
   Inclui o "Despacho do Dia" (prioridades do dia, clicáveis).
   ========================================================================== */
let _centralSimCarregado = false;

function saudacao() { const h = new Date().getHours(); return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
function fmtHoras(min) { return (min / 60).toFixed(min >= 600 ? 0 : 1).replace('.', ',') + ' h'; }

function centralDesempenho() {
  const m = desempenhoPorMateria(), l = Object.entries(m).map(([k, v]) => ({ k, ...v, p: Math.round(100 * v.ac / v.tot) })).filter(x => x.tot >= 3);
  const tot = Object.values(m).reduce((a, v) => a + v.tot, 0), ac = Object.values(m).reduce((a, v) => a + v.ac, 0);
  return { geral: tot ? Math.round(100 * ac / tot) : null, tot, melhores: [...l].sort((a, b) => b.p - a.p || b.tot - a.tot).slice(0, 3), atencao: [...l].filter(x => x.p < 70).sort((a, b) => a.p - b.p || b.tot - a.tot).slice(0, 3) };
}
/* Despacho do Dia: itens agrupados por natureza (prioridade · hoje · revisões · questões · concluídas).
   Cada item: { grupo, ic, cls, t, s, tag, ac }. Só lê dados reais dos módulos. */
const CT_GRUPOS = [
  { id: 'prioridade', rotulo: 'Prioritárias' },
  { id: 'hoje', rotulo: 'Agendadas para hoje' },
  { id: 'revisao', rotulo: 'Revisões' },
  { id: 'questoes', rotulo: 'Questões' },
  { id: 'feito', rotulo: 'Concluídas hoje' }
];
function centralDespacho(hoje) {
  const itens = [], pend = cronograma.filter(c => !c.feito);
  const atras = pend.filter(isAtrasado).sort((a, b) => PRIO_ORD[a.prioridade] - PRIO_ORD[b.prioridade] || (cronoISO(a) || '').localeCompare(cronoISO(b) || ''));
  const dia = pend.filter(c => cronoISO(c) === hoje).sort((a, b) => PRIO_ORD[a.prioridade] - PRIO_ORD[b.prioridade]);
  const altaHoje = dia.filter(c => c.prioridade === 'alta'), restoHoje = dia.filter(c => c.prioridade !== 'alta');
  atras.slice(0, 3).forEach(c => itens.push({ grupo: 'prioridade', ic: 'alert', cls: 'bad', t: c.tema, s: `${nomeSemEmoji(c.materia)} · atrasada desde ${c.data.slice(0, 5)}`, tag: 'Atrasada', ac: `openCronoEditModal('${c.id}')` }));
  if (atras.length > 3) itens.push({ grupo: 'prioridade', ic: 'alert', cls: 'bad', t: `Mais ${atras.length - 3} atividade(s) atrasada(s)`, s: 'Reagende ou conclua no Cronograma', tag: '', ac: "setCronoStatusFiltro('atrasados'); goTab('cronograma')" });
  altaHoje.slice(0, 3).forEach(c => itens.push({ grupo: 'prioridade', ic: 'flag', cls: 'gold', t: c.tema, s: `${nomeSemEmoji(c.materia)}${c.duracaoMin ? ' · ' + fmtMin(c.duracaoMin) : ''}`, tag: 'Prioridade alta', ac: `openCronoEditModal('${c.id}')` }));
  restoHoje.slice(0, 4).forEach(c => itens.push({ grupo: 'hoje', ic: 'calendar', cls: '', t: c.tema, s: `${nomeSemEmoji(c.materia)}${c.duracaoMin ? ' · ' + fmtMin(c.duracaoMin) : ''}`, tag: 'Hoje', ac: `openCronoEditModal('${c.id}')` }));
  const sobra = Math.max(0, altaHoje.length - 3) + Math.max(0, restoHoje.length - 4);
  if (sobra) itens.push({ grupo: 'hoje', ic: 'calendar', cls: '', t: `Mais ${sobra} atividade(s) hoje`, s: 'Ver no Cronograma', tag: '', ac: "setCronoStatusFiltro('todas'); goTab('cronograma')" });
  const rc = revisaoContagens(); if (rc.devidas) itens.push({ grupo: 'revisao', ic: 'repeat', cls: rc.atrasadas ? 'bad' : 'blue', t: `${rc.devidas} revisão(ões) pendente(s)`, s: `${rc.hoje} para hoje${rc.atrasadas ? ` · ${rc.atrasadas} atrasada(s)` : ''}`, tag: 'Revisão', ac: "goTab('revisao')" });
  const q = qbResumo(); if (q.aRefazer) itens.push({ grupo: 'questoes', ic: 'refresh', cls: '', t: `${q.aRefazer} questão(ões) para refazer`, s: 'Você errou na última resolução', tag: 'Refazer', ac: "goTab('questoes'); qIniciarPratica('erradas')" });
  if (q.hoje < q.metaDia && q.total) itens.push({ grupo: 'questoes', ic: 'target', cls: '', t: `Meta de questões: ${q.hoje}/${q.metaDia}`, s: q.ineditas ? `${q.ineditas} inédita(s) no banco` : 'Resolva ou cadastre mais questões', tag: 'Questões', ac: "goTab('questoes')" });
  cronograma.filter(c => c.feito && cronoISO(c) === hoje).slice(0, 4).forEach(c => itens.push({ grupo: 'feito', ic: 'check', cls: 'ok', t: c.tema, s: nomeSemEmoji(c.materia), tag: '', ac: `openCronoEditModal('${c.id}')` }));
  return itens;
}

function ctAnel(pctv, centro, sub) {
  const r = 46, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pctv));
  return `<div class="ct-ring ${v >= 100 ? 'ok' : ''}" role="img" aria-label="${v}% da meta diária">
    <svg viewBox="0 0 108 108" aria-hidden="true"><circle cx="54" cy="54" r="${r}" class="ct-ring-trilho"/><circle cx="54" cy="54" r="${r}" class="ct-ring-valor" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - v / 100)).toFixed(1)}"/></svg>
    <div class="ct-ring-centro"><b>${centro}</b><small>${sub}</small></div></div>`;
}
function ctLinha(rotulo, valor, sub, pctv, cls, ac) {
  const tag = ac ? 'button' : 'div';
  return `<${tag} class="ct-linha" ${ac ? `onclick="${ac}"` : ''}><span class="ct-linha-top"><span>${rotulo}</span><b class="tnum">${valor}</b></span>${pctv == null ? '' : `<span class="bar ${cls || ''}"><span style="width:${Math.max(0, Math.min(100, pctv))}%"></span></span>`}<small>${sub}</small></${tag}>`;
}
function ctItem(d) {
  return `<button class="ct-desp ${d.cls}" onclick="${d.ac}"><span class="ct-desp-ic">${icon(d.ic, 17)}</span><span class="grow"><b>${escHtml(d.t)}</b><small>${escHtml(d.s)}</small></span>${d.tag ? `<span class="badge ${d.cls}">${escHtml(d.tag)}</span>` : ''}<span class="ct-desp-go">${icon('chevron-right', 16)}</span></button>`;
}

function renderCentral() {
  const el = document.getElementById('centralRoot'); if (!el) return;
  const hoje = todayISO(), p = prefs(), minHoje = minutosNoDia(hoje), meta = p.metaDiariaMin;
  const iniSem = inicioDaSemana(hoje), minSem = minutosEntre(iniSem, addDaysISO(iniSem, 6)), minMes = minutosEntre(hoje.slice(0, 8) + '01', hoje.slice(0, 8) + '31');
  const pend = cronograma.filter(c => !c.feito), doDia = cronograma.filter(c => cronoISO(c) === hoje), feitasDia = doDia.filter(c => c.feito).length, atras = pend.filter(isAtrasado).length;
  const mats = [...new Set(doDia.map(c => c.materia))], rc = revisaoContagens(), q = qbResumo(), dp = centralDesempenho();
  const serie = serieDiaria(14), mx = Math.max(meta * 1.15, 60, ...serie.map(s => s.min));
  const totC = cronograma.length, feitoC = cronograma.filter(c => c.feito).length, timer = timerLer();
  const despacho = centralDespacho(hoje), abertos = despacho.filter(d => d.grupo !== 'feito');
  const pMeta = pct(minHoje, meta), nome = window.chancelariaUser && window.chancelariaUser.nome ? ', ' + escHtml(window.chancelariaUser.nome.split(' ')[0]) : '';
  const contexto = [
    abertos.length ? `${abertos.length} ${abertos.length === 1 ? 'item pede' : 'itens pedem'} atenção hoje` : 'Nada pendente para hoje',
    atras ? `<span class="ct-ctx-bad">${atras} atividade(s) atrasada(s)</span>` : '',
    minHoje >= meta ? 'meta de estudo cumprida' : `${fmtMin(Math.max(0, meta - minHoje))} para a meta diária`
  ].filter(Boolean).join(' · ');
  const proximo = abertos[0];
  const semMedia = Math.round(minSem / Math.max(1, ((parseISOLocal(hoje).getDay() + 6) % 7) + 1));

  el.innerHTML = `
  <header class="ct-head">
    <div class="ct-head-txt"><div class="page-eyebrow ct-data">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <h2 class="ct-titulo">${saudacao()}${nome}.</h2><p class="ct-ctx">${contexto}</p></div>
    <div class="page-actions">${timer ? `<button class="btn secondary" onclick="abrirTimerModal()">${icon('clock', 16)} Sessão em andamento</button>` : `<button class="btn" onclick="estudoTimerIniciar({})">${icon('play', 16)} Iniciar sessão de estudo</button>`}</div>
  </header>

  <section class="ct-hoje card" aria-label="Resumo do dia">
    <div class="ct-hoje-meta">${ctAnel(pMeta, fmtMin(minHoje), `de ${fmtMin(meta)}`)}
      <div class="ct-hoje-meta-txt"><span class="panel-title" style="margin:0 0 4px;">Meta de estudo</span><b>${minHoje >= meta ? 'Meta cumprida' : pMeta + '% concluído'}</b>
        <small>${proximo ? `Próximo passo: <button class="ct-link" onclick="${proximo.ac}">${escHtml(proximo.t)}</button>` : 'Use o cronômetro ou conclua atividades para registrar tempo.'}</small></div></div>
    <div class="ct-hoje-linhas">
      ${ctLinha('Tarefas de hoje', `${feitasDia}/${doDia.length}`, atras ? `<span style="color:var(--bad)">${atras} atrasada(s)</span>` : doDia.length ? (feitasDia === doDia.length ? 'todas concluídas' : 'concluídas') : 'nada agendado', pct(feitasDia, doDia.length), 'ok', "goTab('cronograma')")}
      ${ctLinha('Questões', `${q.hoje}/${q.metaDia}`, `${q.aRefazer ? q.aRefazer + ' para refazer · ' : ''}${q.ineditas} inédita(s)`, pct(q.hoje, q.metaDia), q.hoje >= q.metaDia ? 'ok' : '', "goTab('questoes')")}
      ${ctLinha('Revisões pendentes', `${rc.devidas}`, `${rc.hoje} para hoje${rc.atrasadas ? ` · <span style="color:var(--bad)">${rc.atrasadas} atrasada(s)</span>` : ''}${rc.proximas ? ` · ${rc.proximas} nos próximos 7 dias` : ''}`, null, '', "goTab('revisao')")}
    </div>
    <div class="ct-hoje-mats"><span class="panel-title" style="margin:0;">Matérias previstas</span>${mats.length ? `<div class="ct-mats">${mats.slice(0, 5).map(m => `<span class="ct-mat"><span class="cr-dot" style="background:${getMateriaColor(m)}"></span>${escHtml(nomeSemEmoji(m))}</span>`).join('')}${mats.length > 5 ? `<span class="ct-mat">+${mats.length - 5}</span>` : ''}</div>` : '<span class="muted" style="font-size:13px;">Nenhuma matéria agendada hoje</span>'}</div>
  </section>

  <div class="ct-cols">
    <section class="card ct-despacho" aria-label="Despacho do Dia">
      <div class="ct-sec-head"><div><h3>Despacho do Dia</h3><p>O que merece sua atenção hoje, em ordem de prioridade.</p></div>${abertos.length ? `<span class="badge gold tnum">${abertos.length} pendente(s)</span>` : ''}</div>
      ${despacho.length ? CT_GRUPOS.map(g => { const its = despacho.filter(d => d.grupo === g.id); return its.length ? `<div class="ct-grupo ct-grupo-${g.id}"><div class="ct-grupo-t">${g.rotulo}<span>${its.length}</span></div>${its.map(ctItem).join('')}</div>` : ''; }).join('')
        : `<div class="empty-state" style="padding:28px 12px;">${icon('check')}<b>Nenhuma obrigação pendente</b><p>Planeje a semana no Cronograma ou comece uma sessão de estudo livre.</p><button class="btn small" onclick="goTab('cronograma')">Abrir Cronograma</button></div>`}
    </section>

    <section class="card ct-desempenho" aria-label="Desempenho">
      <div class="ct-sec-head"><div><h3>Desempenho</h3><p>Tempo estudado e aproveitamento.</p></div></div>
      <div class="ct-kpis">
        <div><span>Esta semana</span><b class="tnum">${fmtHoras(minSem)}</b><small>média de ${fmtMin(semMedia)}/dia</small></div>
        <div><span>Este mês</span><b class="tnum">${fmtHoras(minMes)}</b><small>${estudoLog.filter(e => e.data.slice(0, 7) === hoje.slice(0, 7)).length} registro(s)</small></div>
        <div><span>Cronograma</span><b class="tnum">${totC ? pct(feitoC, totC) + '%' : '—'}</b><small>${feitoC}/${totC} concluídas</small></div>
        <div><span>Acerto em questões</span><b class="tnum" style="${dp.geral != null && dp.geral < 60 ? 'color:var(--bad)' : ''}">${dp.geral == null ? '—' : dp.geral + '%'}</b><small>${dp.tot} resolução(ões)</small></div>
      </div>
      <div class="ct-chart-head"><span class="panel-title" style="margin:0;">Últimos 14 dias</span><span class="ct-legenda"><i></i>Meta diária · ${fmtMin(meta)}</span></div>
      <div class="ct-chart" role="img" aria-label="Minutos estudados por dia nos últimos 14 dias">
        <div class="ct-chart-meta" style="bottom:${(100 * meta / mx).toFixed(1)}%"></div>
        ${serie.map(s => `<div class="ct-chart-col ${s.iso === hoje ? 'hoje' : ''} ${s.min >= meta ? 'ok' : ''}" title="${isoToBR(s.iso)}: ${fmtMin(s.min)}"><div class="ct-chart-bar"><i style="height:${s.min ? Math.max(3, Math.round(100 * s.min / mx)) : 0}%"></i></div><small>${s.iso.slice(8)}</small></div>`).join('')}
      </div>
      ${estudoLog.length ? '' : '<p class="muted" style="font-size:12.5px;margin:10px 0 0;">O tempo estudado aparece aqui quando você conclui atividades com tempo registrado ou usa o cronômetro.</p>'}
    </section>
  </div>

  <section class="card ct-materias" aria-label="Desempenho por matéria">
    <div class="ct-sec-head"><div><h3>Desempenho por matéria</h3><p>Questões do banco e dos simulados (mínimo de 3 por matéria).</p></div></div>
    <div class="grid-2">
      <div><div class="panel-title">${icon('trending', 14)} Melhor desempenho</div>${dp.melhores.length ? dp.melhores.map(centralBarra).join('') : '<p class="muted" style="margin:0;font-size:13.5px;">Resolva ao menos 3 questões em uma matéria para ver o ranking.</p>'}</div>
      <div><div class="panel-title">${icon('alert', 14)} Precisam de atenção</div>${dp.atencao.length ? dp.atencao.map(centralBarra).join('') : `<p class="muted" style="margin:0;font-size:13.5px;">${dp.melhores.length ? 'Nenhuma matéria abaixo de 70% de acerto.' : 'Sem dados suficientes ainda.'}</p>`}</div>
    </div>
  </section>

  <section aria-label="Acesso rápido"><div class="ct-sec-head ct-sec-head-solta"><div><h3>Acesso rápido</h3></div></div>
  <div class="ct-quick">
    ${[['flashcards', 'layers', 'Flashcards', `${typeof flashCards !== 'undefined' ? flashCards.length : 0} cartões`], ['simulados', 'clipboard', 'Simulados', 'Provas do CACD'], ['discursivas', 'pen', 'Discursivas', 'Laboratório de redação'], ['biblioteca', 'library', 'Biblioteca', `${biblioDocs.length} documento(s)`], ['atualidades', 'newspaper', 'Atualidades', `${atualidades.length} registro(s)`], ['paises', 'globe', 'Países', 'Fichas e mapa-múndi'], ['conhecimento', 'network', 'Conhecimento', 'Conceitos e conexões'], ['palavras', 'type', 'Palavras', 'Hub linguístico']].map(([id, ic, t, s]) => `<button class="ct-q" onclick="goTab('${id}')"><span class="ct-q-ic">${icon(ic, 19)}</span><span class="grow"><b>${t}</b><small>${escHtml(s)}</small></span></button>`).join('')}
  </div></section>`;
  if (!_centralSimCarregado && typeof carregarSimuladosIndex === 'function' && !simuladosIndexCarregado) { _centralSimCarregado = true; carregarSimuladosIndex().then(() => { if (document.getElementById('view-inicio').classList.contains('active')) renderCentral(); }).catch(() => {}); }
}
function centralBarra(r) { return `<div class="qb-barra"><div class="row between"><span>${escHtml(nomeSemEmoji(r.k))}</span><span class="mono tnum">${r.p}% · ${r.ac}/${r.tot}</span></div><div class="bar ${r.p >= 70 ? 'ok' : ''}"><span style="width:${r.p}%;${r.p < 50 ? 'background:var(--bad)' : ''}"></span></div></div>`; }
