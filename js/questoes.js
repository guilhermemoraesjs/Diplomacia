/* ==========================================================================
   questoes.js — módulo "Banco de questões" (substitui os stubs anteriores
   addQuestao()/onQTipoChange()/renderQuestoes(), que não faziam nada).

   Dados:
   • diplo_questoes       — as questões cadastradas por você
   • diplo_questoes_hist  — cada resolução: { id, qid, t, resposta, correta, segundos }
   Tipos: 'ce' (Certo/Errado), 'multipla' (A–E…), 'discursiva' (autoavaliada).
   Registros antigos (tipo "C/E", campos contexto/itens/topico) são lidos e
   normalizados em memória, sem apagar os campos originais.
   Os Simulados do CACD continuam em módulo próprio; o desempenho dos dois
   aparece junto na Central, mas SEMPRE rotulado por origem.
   ========================================================================== */
const QTIPOS = { ce: 'Certo / Errado', multipla: 'Múltipla escolha', discursiva: 'Discursiva' };
const QESTADOS = { todas: 'Todas', ineditas: 'Inéditas', resolvidas: 'Já resolvidas', acertadas: 'Última: acertei', erradas: 'Última: errei', revisar: 'Marcadas p/ revisar' };

function qNorm(q) {
  if (q.tipo === 'C/E' || !q.tipo) q.tipo = 'ce'; else if (q.tipo === 'Discursiva') q.tipo = 'discursiva';
  if (q.enunciado == null) {
    const itens = Array.isArray(q.itens) ? q.itens.filter(i => i && i.texto) : [];
    q.enunciado = [q.contexto || '', ...itens.map((i, n) => `Item ${n + 1}: ${i.texto}`)].filter(Boolean).join('\n\n');
  }
  if (q.assunto == null) { const m = (typeof materias !== 'undefined' ? materias : []).find(x => x.nome === q.materia); const t = m && m.topicos.find(x => x.id === q.topico); q.assunto = t ? t.nome : ''; }
  ['subassunto', 'banca', 'fonte', 'gabarito', 'comentario', 'obs'].forEach(k => { if (q[k] == null) q[k] = ''; });
  if (q.ano == null) q.ano = ''; if (!Array.isArray(q.tags)) q.tags = []; if (!Array.isArray(q.alternativas)) q.alternativas = [];
  q.revisar = !!(q.revisar || q.revisada); if (!q.criadoEm) q.criadoEm = Date.now();
  return q;
}
let questoes = (load('diplo_questoes', []) || []).map(qNorm);
let questoesHist = load('diplo_questoes_hist', []) || [];
function qSalvar() { save('diplo_questoes', questoes); }
function qSalvarHist() { save('diplo_questoes_hist', questoesHist); }

/* ---- estatísticas por questão ---- */
function qHistDe(qid) { return questoesHist.filter(h => h.qid === qid); }
function qEstado(q) {
  const h = qHistDe(q.id); if (!h.length) return { estado: 'inedita', tent: 0, ac: 0, er: 0, ultima: null };
  const ultima = h[h.length - 1], ac = h.filter(x => x.correta === true).length;
  return { estado: ultima.correta ? 'acertada' : 'errada', tent: h.length, ac, er: h.length - ac, ultima };
}
function qPassa(q, f) {
  if (f.busca) { const b = norm(f.busca); if (!norm([q.enunciado, q.assunto, q.subassunto, q.banca, q.fonte, q.materia, (q.tags || []).join(' ')].join(' ')).includes(b)) return false; }
  if (f.materia && q.materia !== f.materia) return false; if (f.assunto && q.assunto !== f.assunto) return false;
  if (f.banca && q.banca !== f.banca) return false; if (f.ano && String(q.ano) !== String(f.ano)) return false; if (f.tipo && q.tipo !== f.tipo) return false;
  if (f.estado && f.estado !== 'todas') { const e = qEstado(q).estado;
    if (f.estado === 'ineditas' && e !== 'inedita') return false; if (f.estado === 'resolvidas' && e === 'inedita') return false;
    if (f.estado === 'acertadas' && e !== 'acertada') return false; if (f.estado === 'erradas' && e !== 'errada') return false; if (f.estado === 'revisar' && !q.revisar) return false; }
  return true;
}
const qf = { busca: '', materia: '', assunto: '', banca: '', ano: '', tipo: '', estado: 'todas' };
let qAba = 'lista', qLimite = 30, qSessao = null;

function qValoresUnicos(campo) { return [...new Set(questoes.map(q => q[campo]).filter(v => v !== '' && v != null))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true })); }

/* ---- resumo reutilizado por Central / Despacho ---- */
function qbResumo() {
  const hoje = todayISO(), hist = questoesHist.filter(h => isoDateTimeToLocalYMD(h.t) === hoje);
  let simHoje = 0; try { simHoje = Object.values(simuladosProgresso.respondidas).filter(r => isoDateTimeToLocalYMD(r.data) === hoje).length; } catch (e) {}
  const est = questoes.map(qEstado), resolvidas = est.filter(e => e.estado !== 'inedita').length;
  const totTent = questoesHist.length, totAc = questoesHist.filter(h => h.correta === true).length;
  return { total: questoes.length, ineditas: est.length - resolvidas, resolvidas, aRefazer: est.filter(e => e.estado === 'errada').length, revisar: questoes.filter(q => q.revisar).length, hoje: hist.length + simHoje, hojeBanco: hist.length, hojeSim: simHoje, metaDia: prefs().metaQuestoesDia, acerto: totTent ? Math.round(100 * totAc / totTent) : null, tentativas: totTent };
}
/* Desempenho por matéria: banco + simulados (quando o índice de provas já foi carregado). */
function desempenhoPorMateria() {
  const m = {}; const add = (mat, ok, origem) => { if (!mat) return; const o = m[mat] = m[mat] || { tot: 0, ac: 0, banco: 0, sim: 0 }; o.tot++; if (ok) o.ac++; o[origem]++; };
  questoesHist.forEach(h => { const q = questoes.find(x => x.id === h.qid); if (q) add(q.materia, h.correta === true, 'banco'); });
  try { const idx = {}; simuladosQuestoesIndex.forEach(q => { idx[q.id] = q; }); Object.entries(simuladosProgresso.respondidas).forEach(([id, r]) => { if (idx[id]) add(idx[id].disciplina, !!r.correta, 'sim'); }); } catch (e) {}
  return m;
}

/* ---- render principal ---- */
function renderQuestoes() {
  const el = document.getElementById('qbRoot'); if (!el) return;
  if (qSessao) { el.innerHTML = qRenderSessao(); return; }
  const r = qbResumo();
  el.innerHTML = `<div class="page-head"><div><h2>Banco de questões</h2><p>Cadastre suas próprias questões, resolva com correção imediata e acompanhe onde você mais erra. Questões inéditas e já resolvidas ficam sempre identificadas.</p></div>
    <div class="page-actions"><button class="btn secondary small" onclick="qIniciarPratica('auto')" ${r.total ? '' : 'disabled'}>${icon('play', 14)} Praticar</button><button class="btn small" onclick="qAbrirForm()">${icon('plus', 15)} Nova questão</button></div></div>
    <div class="qb-stats">
      <div class="qb-stat"><b>${r.total}</b><span>cadastradas</span></div><div class="qb-stat"><b>${r.ineditas}</b><span>inéditas</span></div>
      <div class="qb-stat"><b>${r.resolvidas}</b><span>já resolvidas</span></div><div class="qb-stat"><b>${r.acerto == null ? '—' : r.acerto + '%'}</b><span>aproveitamento</span></div>
      <button class="qb-stat link" onclick="qIniciarPratica('erradas')" ${r.aRefazer ? '' : 'disabled'}><b style="color:${r.aRefazer ? 'var(--bad)' : 'inherit'}">${r.aRefazer}</b><span>errei · refazer</span></button>
      <button class="qb-stat link" onclick="qFiltrarRapido('revisar')"><b>${r.revisar}</b><span>marcadas p/ revisar</span></button></div>
    <div class="subtabs" role="tablist"><button class="subtab-btn ${qAba === 'lista' ? 'active' : ''}" role="tab" onclick="qAba='lista';renderQuestoes()">Questões</button><button class="subtab-btn ${qAba === 'desempenho' ? 'active' : ''}" role="tab" onclick="qAba='desempenho';renderQuestoes()">Desempenho</button></div>
    ${qAba === 'lista' ? qRenderLista() : qRenderDesempenho()}`;
}
function qFiltrarRapido(estado) { qAba = 'lista'; qf.estado = estado; qLimite = 30; renderQuestoes(); }
function qOpts(lista, atual, rotulo) { return `<option value="">${rotulo}</option>` + lista.map(v => `<option value="${escAttr(v)}" ${String(v) === String(atual) ? 'selected' : ''}>${escHtml(v)}</option>`).join(''); }
function qRenderLista() {
  const filtradas = questoes.filter(q => qPassa(q, qf)).sort((a, b) => b.criadoEm - a.criadoEm), mostra = filtradas.slice(0, qLimite);
  const assuntos = [...new Set(questoes.filter(q => !qf.materia || q.materia === qf.materia).map(q => q.assunto).filter(Boolean))].sort();
  const temFiltro = qf.busca || qf.materia || qf.assunto || qf.banca || qf.ano || qf.tipo || qf.estado !== 'todas';
  return `<div class="card flat qb-filtros">
      <input type="search" id="qfBusca" placeholder="Buscar no enunciado, assunto, tags..." value="${escAttr(qf.busca)}" oninput="qfSet('busca',this.value,true)" aria-label="Buscar questões">
      <div class="qb-filtros-grid">
        <select aria-label="Matéria" onchange="qfSet('materia',this.value)">${qOpts(qValoresUnicos('materia'), qf.materia, 'Todas as matérias')}</select>
        <select aria-label="Assunto" onchange="qfSet('assunto',this.value)">${qOpts(assuntos, qf.assunto, 'Todos os assuntos')}</select>
        <select aria-label="Banca" onchange="qfSet('banca',this.value)">${qOpts(qValoresUnicos('banca'), qf.banca, 'Todas as bancas')}</select>
        <select aria-label="Ano" onchange="qfSet('ano',this.value)">${qOpts(qValoresUnicos('ano'), qf.ano, 'Todos os anos')}</select>
        <select aria-label="Tipo" onchange="qfSet('tipo',this.value)"><option value="">Todos os tipos</option>${Object.entries(QTIPOS).map(([k, v]) => `<option value="${k}" ${qf.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <select aria-label="Desempenho" onchange="qfSet('estado',this.value)">${Object.entries(QESTADOS).map(([k, v]) => `<option value="${k}" ${qf.estado === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="row between"><span class="muted" style="font-size:13px;">${filtradas.length} questão(ões)${temFiltro ? ' com os filtros atuais' : ''}</span>
        <span class="row">${temFiltro ? `<button class="btn ghost small" onclick="qLimparFiltros()">Limpar filtros</button>` : ''}<button class="btn secondary small" onclick="qIniciarPratica('filtro')" ${filtradas.length ? '' : 'disabled'}>${icon('play', 13)} Praticar estas</button></span></div></div>
    ${!questoes.length ? `<div class="empty-state">${icon('help-circle')}<b>Seu banco de questões está vazio</b><p>Cadastre questões de provas anteriores ou criadas por você: enunciado, alternativas, gabarito e comentário. Cada resolução entra no seu histórico.</p><button class="btn small" onclick="qAbrirForm()">${icon('plus', 14)} Cadastrar primeira questão</button></div>`
      : !filtradas.length ? `<div class="empty-state">${icon('filter')}<b>Nenhuma questão com esses filtros</b><p>Ajuste ou limpe os filtros para ver outras questões.</p></div>`
      : mostra.map(qCardHTML).join('') + (filtradas.length > mostra.length ? `<div style="text-align:center;margin-top:10px;"><button class="btn ghost" onclick="qLimite+=30;renderQuestoes()">Carregar mais (${filtradas.length - mostra.length})</button></div>` : '')}`;
}
function qfSet(k, v, manterFoco) {
  qf[k] = v; if (k === 'materia') qf.assunto = ''; qLimite = 30; const foco = manterFoco && document.activeElement && document.activeElement.id === 'qfBusca'; renderQuestoes();
  if (foco) { const i = document.getElementById('qfBusca'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }
}
function qLimparFiltros() { Object.assign(qf, { busca: '', materia: '', assunto: '', banca: '', ano: '', tipo: '', estado: 'todas' }); renderQuestoes(); }
function qBadgeEstado(q) {
  const e = qEstado(q);
  if (e.estado === 'inedita') return '<span class="badge blue">Inédita</span>';
  const d = new Date(e.ultima.t).toLocaleDateString('pt-BR');
  return `<span class="badge ${e.estado === 'acertada' ? 'ok' : 'bad'}" title="Última resolução em ${d}">Já resolvida · ${e.estado === 'acertada' ? 'acertou' : 'errou'}</span><span class="badge">${e.ac}/${e.tent} acertos</span>`;
}
function qCardHTML(q) {
  const resumo = q.enunciado.length > 220 ? q.enunciado.slice(0, 220) + '…' : q.enunciado;
  return `<article class="card qb-card"><div class="qb-card-top"><span class="badge gold">${escHtml(q.materia || 'Sem matéria')}</span>${q.assunto ? `<span class="badge">${escHtml(q.assunto)}</span>` : ''}<span class="badge">${QTIPOS[q.tipo]}</span>${q.banca || q.ano ? `<span class="badge">${escHtml([q.banca, q.ano].filter(Boolean).join(' · '))}</span>` : ''}${qBadgeEstado(q)}${q.revisar ? '<span class="badge warn">Revisar</span>' : ''}</div>
    <p class="qb-enun-resumo">${escHtml(resumo).replace(/\n/g, '<br>')}</p>
    <div class="row between"><div class="qb-tags">${(q.tags || []).map(t => `<span class="tag-chip">${escHtml(t)}</span>`).join('')}</div>
      <div class="row"><button class="btn small" onclick="qResolverUma('${q.id}')">Resolver</button><button class="icon-btn" onclick="qAbrirForm('${q.id}')" aria-label="Editar questão">${icon('pen', 16)}</button><button class="icon-btn" onclick="toggleRevisada('${q.id}')" aria-label="${q.revisar ? 'Desmarcar revisão' : 'Marcar para revisar'}" title="${q.revisar ? 'Desmarcar revisão' : 'Marcar para revisar'}" style="${q.revisar ? 'color:var(--warn)' : ''}">${icon('flag', 16)}</button><button class="icon-btn" onclick="delQuestao('${q.id}')" aria-label="Excluir questão">${icon('trash', 16)}</button></div></div></article>`;
}

/* ---- desempenho ---- */
function qRenderDesempenho() {
  if (!questoesHist.length) return `<div class="empty-state">${icon('bar-chart')}<b>Sem resoluções ainda</b><p>Resolva questões do banco para ver aproveitamento por matéria, assuntos com mais erros e evolução.</p></div>`;
  const por = (fn) => { const m = {}; questoesHist.forEach(h => { const q = questoes.find(x => x.id === h.qid); if (!q) return; const k = fn(q); if (!k) return; const o = m[k] = m[k] || { tot: 0, ac: 0 }; o.tot++; if (h.correta === true) o.ac++; }); return m; };
  const linhas = (m, minTent, ordem) => Object.entries(m).filter(([, v]) => v.tot >= (minTent || 1)).map(([k, v]) => ({ k, ...v, p: Math.round(100 * v.ac / v.tot) })).sort(ordem);
  const barra = r => `<div class="qb-barra"><div class="row between"><span>${escHtml(r.k)}</span><span class="mono">${r.p}% · ${r.ac}/${r.tot}</span></div><div class="bar ${r.p >= 70 ? 'ok' : ''}"><span style="width:${r.p}%;${r.p < 50 ? 'background:var(--bad)' : ''}"></span></div></div>`;
  const mat = linhas(por(q => q.materia), 1, (a, b) => a.p - b.p || b.tot - a.tot), ass = linhas(por(q => q.assunto && (q.materia + ' › ' + q.assunto)), 2, (a, b) => (b.tot - b.ac) / b.tot - (a.tot - a.ac) / a.tot || b.tot - a.tot), ban = linhas(por(q => q.banca), 1, (a, b) => b.tot - a.tot);
  const tempos = questoesHist.map(h => h.segundos).filter(s => s > 0), medio = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
  const tot = questoesHist.length, ac = questoesHist.filter(h => h.correta === true).length, dias = {};
  questoesHist.forEach(h => { const d = isoDateTimeToLocalYMD(h.t); (dias[d] = dias[d] || { t: 0, a: 0 }).t++; if (h.correta === true) dias[d].a++; });
  const ult = Array.from({ length: 14 }, (_, i) => { const iso = addDaysISO(todayISO(), -(13 - i)); return { iso, ...(dias[iso] || { t: 0, a: 0 }) }; }), mx = Math.max(1, ...ult.map(u => u.t));
  let sim = ''; try { const s = Object.values(simuladosProgresso.respondidas); if (s.length) sim = `<div class="card flat"><div class="panel-title">Simulados do CACD (módulo separado)</div><p style="margin:0;">${s.length} questões respondidas · ${pct(s.filter(r => r.correta).length, s.length)}% de acerto. <a href="#" onclick="goTab('simulados');return false;" style="text-decoration:underline;">Abrir Simulados</a></p></div>`; } catch (e) {}
  return `<div class="qb-stats"><div class="qb-stat"><b>${tot}</b><span>resoluções</span></div><div class="qb-stat"><b>${pct(ac, tot)}%</b><span>aproveitamento</span></div><div class="qb-stat"><b>${tot - ac}</b><span>erros</span></div><div class="qb-stat"><b>${medio ? fmtTempo(medio) : '—'}</b><span>tempo médio</span></div></div>
    <div class="grid-2"><div class="card"><div class="panel-title">Aproveitamento por matéria <span class="muted" style="text-transform:none;letter-spacing:0;">(piores primeiro)</span></div>${mat.map(barra).join('')}</div>
    <div class="card"><div class="panel-title">Assuntos com maior índice de erros <span class="muted" style="text-transform:none;letter-spacing:0;">(mín. 2 resoluções)</span></div>${ass.length ? ass.slice(0, 8).map(barra).join('') : '<p class="muted">Resolva ao menos 2 vezes questões de um mesmo assunto para vê-lo aqui.</p>'}</div></div>
    <div class="grid-2"><div class="card"><div class="panel-title">Últimos 14 dias</div><div class="qb-spark" role="img" aria-label="Questões resolvidas por dia nos últimos 14 dias">${ult.map(u => `<div class="qb-spark-col" title="${isoToBR(u.iso)}: ${u.a}/${u.t} acertos"><div class="qb-spark-bar"><i style="height:${Math.round(100 * u.t / mx)}%"><b style="height:${u.t ? Math.round(100 * u.a / u.t) : 0}%"></b></i></div><small>${u.iso.slice(8)}</small></div>`).join('')}</div><p class="muted" style="font-size:12px;margin:6px 0 0;">Altura = questões no dia · parte clara = acertos.</p></div>
    <div class="card"><div class="panel-title">Por banca</div>${ban.length ? ban.map(barra).join('') : '<p class="muted">Informe a banca ao cadastrar questões.</p>'}</div></div>${sim}`;
}

/* ---- formulário ---- */
let qfAlts = [];
function qAbrirForm(id) {
  const q = id ? questoes.find(x => x.id === id) : null; if (id && !q) return;
  qfAlts = q && q.alternativas.length ? q.alternativas.map(a => ({ ...a })) : ['A', 'B', 'C', 'D', 'E'].map(l => ({ letra: l, texto: '' }));
  const mat = q ? q.materia : (qf.materia || (materias[0] && materias[0].nome) || '');
  crModal(`<h3>${q ? 'Editar questão' : 'Nova questão'}</h3>
    <label class="field-label" for="qfEnun">Enunciado *</label><textarea id="qfEnun" style="min-height:110px;" placeholder="Cole ou digite o enunciado completo">${escHtml(q ? q.enunciado : '')}</textarea>
    <div class="row2 stack-m"><div><label class="field-label" for="qfMat">Matéria</label><select id="qfMat" onchange="qAtualizarAssuntos()">${materias.map(m => `<option ${m.nome === mat ? 'selected' : ''}>${escHtml(m.nome)}</option>`).join('')}</select></div>
      <div><label class="field-label" for="qfTipo">Tipo</label><select id="qfTipo" onchange="onQTipoChange()">${Object.entries(QTIPOS).map(([k, v]) => `<option value="${k}" ${q && q.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
    <div class="row2 stack-m"><div><label class="field-label" for="qfAss">Assunto</label><input type="text" id="qfAss" list="qfAssL" value="${escAttr(q ? q.assunto : '')}"><datalist id="qfAssL"></datalist></div>
      <div><label class="field-label" for="qfSub">Subassunto</label><input type="text" id="qfSub" value="${escAttr(q ? q.subassunto : '')}"></div></div>
    <div class="row3"><div><label class="field-label" for="qfBanca">Banca / instituição</label><input type="text" id="qfBanca" list="qfBancaL" value="${escAttr(q ? q.banca : '')}" placeholder="CEBRASPE"><datalist id="qfBancaL">${qValoresUnicos('banca').map(b => `<option value="${escAttr(b)}">`).join('')}</datalist></div>
      <div><label class="field-label" for="qfAno">Ano</label><input type="number" id="qfAno" min="1900" max="2100" value="${escAttr(q ? q.ano : '')}" inputmode="numeric"></div>
      <div><label class="field-label" for="qfFonte">Fonte</label><input type="text" id="qfFonte" value="${escAttr(q ? q.fonte : '')}" placeholder="CACD 2024, 1ª fase"></div></div>
    <div id="qfAltsWrap"></div><div id="qfGabWrap"></div>
    <label class="field-label" for="qfCom">Comentário / justificativa</label><textarea id="qfCom" placeholder="Por que o gabarito está correto? Fonte do comentário...">${escHtml(q ? q.comentario : '')}</textarea>
    <label class="field-label" for="qfTags">Tags (separadas por vírgula)</label><input type="text" id="qfTags" value="${escAttr(q ? q.tags.join(', ') : '')}" placeholder="Guerra Fria, OTAN">
    <div id="qfErro" class="form-erro" role="alert"></div>
    <div class="modal-actions"><button class="btn ghost small" onclick="crFecharModal()">Cancelar</button><button class="btn small" onclick="addQuestao(${q ? `'${q.id}'` : 'null'})">Salvar questão</button></div>`);
  qAtualizarAssuntos(); onQTipoChange(q ? q.gabarito : '');
}
function qAtualizarAssuntos() {
  const m = materias.find(x => x.nome === (document.getElementById('qfMat') || {}).value), dl = document.getElementById('qfAssL'); if (!dl) return;
  const n = []; (m ? m.topicos : []).forEach(t => { n.push(t.nome); (t.subtopicos || []).forEach(s => n.push(s.nome)); });
  dl.innerHTML = n.map(x => `<option value="${escAttr(x)}">`).join('');
}
function renderQTopicoOptions() { qAtualizarAssuntos(); }   // compatibilidade
/* Alterna alternativas/gabarito conforme o tipo (antes era uma função vazia). */
function onQTipoChange(gabInicial) {
  const tipo = document.getElementById('qfTipo').value, aw = document.getElementById('qfAltsWrap'), gw = document.getElementById('qfGabWrap');
  const gab = typeof gabInicial === 'string' ? gabInicial : ((document.querySelector('input[name="qfGab"]:checked') || document.getElementById('qfGabSel') || document.getElementById('qfGabTxt') || {}).value || '');
  if (tipo === 'multipla') {
    aw.innerHTML = `<label class="field-label">Alternativas</label>${qfAlts.map((a, i) => `<div class="qb-alt-edit"><b>${a.letra}</b><input type="text" value="${escAttr(a.texto)}" oninput="qfAlts[${i}].texto=this.value" aria-label="Alternativa ${a.letra}" placeholder="Texto da alternativa ${a.letra}">${qfAlts.length > 2 ? `<button class="icon-btn ghost" type="button" onclick="qRemoverAlt(${i})" aria-label="Remover alternativa ${a.letra}">${icon('x', 14)}</button>` : ''}</div>`).join('')}${qfAlts.length < 8 ? `<button class="btn ghost small" type="button" onclick="qAddAlt()">${icon('plus', 13)} Alternativa</button>` : ''}`;
    gw.innerHTML = `<label class="field-label" for="qfGabSel">Gabarito *</label><select id="qfGabSel"><option value="">Selecione a alternativa correta</option>${qfAlts.map(a => `<option value="${a.letra}" ${gab === a.letra ? 'selected' : ''}>${a.letra}</option>`).join('')}</select>`;
  } else if (tipo === 'ce') {
    aw.innerHTML = ''; gw.innerHTML = `<label class="field-label">Gabarito *</label><div class="qb-ce-opts"><label class="chip"><input type="radio" name="qfGab" value="C" ${gab === 'C' ? 'checked' : ''}> Certo</label><label class="chip"><input type="radio" name="qfGab" value="E" ${gab === 'E' ? 'checked' : ''}> Errado</label></div>`;
  } else {
    aw.innerHTML = ''; gw.innerHTML = `<label class="field-label" for="qfGabTxt">Resposta esperada / padrão de resposta</label><textarea id="qfGabTxt" placeholder="Pontos que a resposta precisa conter">${escHtml(gab)}</textarea>`;
  }
}
function qAddAlt() { const L = 'ABCDEFGH'; qfAlts.push({ letra: L[qfAlts.length], texto: '' }); onQTipoChange(); }
function qRemoverAlt(i) { qfAlts.splice(i, 1); qfAlts.forEach((a, n) => { a.letra = 'ABCDEFGH'[n]; }); onQTipoChange(); }
function addQuestao(id) {
  const err = document.getElementById('qfErro'), tipo = document.getElementById('qfTipo').value, enun = document.getElementById('qfEnun').value.trim();
  if (!enun) { err.textContent = 'O enunciado é obrigatório.'; document.getElementById('qfEnun').focus(); return; }
  let gab = '', alts = [];
  if (tipo === 'multipla') { alts = qfAlts.filter(a => a.texto.trim()).map(a => ({ letra: a.letra, texto: a.texto.trim() })); gab = (document.getElementById('qfGabSel') || {}).value || '';
    if (alts.length < 2) { err.textContent = 'Preencha ao menos duas alternativas.'; return; } if (!gab || !alts.some(a => a.letra === gab)) { err.textContent = 'Escolha o gabarito entre as alternativas preenchidas.'; return; } }
  else if (tipo === 'ce') { gab = (document.querySelector('input[name="qfGab"]:checked') || {}).value || ''; if (!gab) { err.textContent = 'Marque o gabarito (Certo ou Errado).'; return; } }
  else gab = (document.getElementById('qfGabTxt') || {}).value.trim();
  const dados = { enunciado: enun, materia: document.getElementById('qfMat').value, assunto: document.getElementById('qfAss').value.trim(), subassunto: document.getElementById('qfSub').value.trim(), banca: document.getElementById('qfBanca').value.trim(), ano: document.getElementById('qfAno').value.trim(), fonte: document.getElementById('qfFonte').value.trim(), tipo, alternativas: alts, gabarito: gab, comentario: document.getElementById('qfCom').value.trim(), tags: document.getElementById('qfTags').value.split(',').map(t => t.trim()).filter(Boolean) };
  if (id) { const q = questoes.find(x => x.id === id); Object.assign(q, dados, { editadoEm: Date.now() }); } else questoes.unshift(qNorm(Object.assign({ id: uid(), criadoEm: Date.now(), obs: '', revisar: false }, dados)));
  qSalvar(); crFecharModal(); renderQuestoes(); refreshStats(); toast('Questão salva.');
}
function addItemField() {}   // legado: itens avulsos foram substituídos pelo tipo "Certo/Errado" e alternativas
function toggleRevisada(id) { const q = questoes.find(x => x.id === id); if (!q) return; q.revisar = !q.revisar; q.revisada = q.revisar; qSalvar(); renderQuestoes(); }
async function delQuestao(id) {
  const q = questoes.find(x => x.id === id); if (!q) return; const n = qHistDe(id).length;
  if (!await confirmar(`Excluir esta questão${n ? ` e seu histórico de ${n} resolução(ões)` : ''}? Essa ação não pode ser desfeita.`, { titulo: 'Excluir questão', ok: 'Excluir' })) return;
  questoes = questoes.filter(x => x.id !== id); questoesHist = questoesHist.filter(h => h.qid !== id); qSalvar(); qSalvarHist(); renderQuestoes(); refreshStats(); toast('Questão excluída.');
}
function setFiltroMateria(n) { qf.materia = n === 'todas' ? '' : n; renderQuestoes(); }   // compatibilidade

/* ---- resolução (sessão de prática) ---- */
function qResolverUma(id) { qSessao = { modo: 'Questão avulsa', fila: [id], i: 0, fase: 'perguntando', t0: Date.now(), acertos: 0, erros: 0, escolha: '' }; renderQuestoes(); window.scrollTo({ top: 0 }); }
function qIniciarPratica(modo) {
  let lista = [], rot = '';
  const ordem = l => l.sort((a, b) => (qEstado(a).estado === 'inedita' ? 0 : 1) - (qEstado(b).estado === 'inedita' ? 0 : 1) || a.criadoEm - b.criadoEm);
  if (modo === 'erradas') { lista = questoes.filter(q => qEstado(q).estado === 'errada'); rot = 'Refazendo questões erradas'; }
  else if (modo === 'filtro') { lista = ordem(questoes.filter(q => qPassa(q, qf))); rot = 'Questões filtradas (inéditas primeiro)'; }
  else { lista = ordem(questoes.filter(q => qPassa(q, Object.assign({}, qf, { estado: qf.estado === 'todas' ? 'ineditas' : qf.estado })))); rot = qf.estado === 'todas' ? 'Questões inéditas' : 'Prática: ' + QESTADOS[qf.estado]; if (!lista.length) { lista = ordem(questoes.filter(q => qPassa(q, qf))); rot = 'Todas as questões (nenhuma inédita)'; } }
  if (!lista.length) { toast('Nenhuma questão disponível para praticar com esse critério.', 'aviso'); return; }
  qSessao = { modo: rot, fila: lista.map(q => q.id), i: 0, fase: 'perguntando', t0: Date.now(), acertos: 0, erros: 0, escolha: '' }; qAba = 'lista'; renderQuestoes(); window.scrollTo({ top: 0 });
}
function qSairSessao() { qSessao = null; renderQuestoes(); refreshStats(); }
function qRenderSessao() {
  const s = qSessao;
  if (s.i >= s.fila.length) {
    const tot = s.acertos + s.erros;
    return `<div class="card qb-fim"><div class="empty-state" style="border:none;">${icon('check')}<b>Sessão concluída</b><p>${tot ? `${s.acertos} acerto(s) e ${s.erros} erro(s) — ${pct(s.acertos, tot)}% de aproveitamento.` : 'Nenhuma questão respondida.'}</p><div class="row" style="justify-content:center;">${s.erros ? `<button class="btn small" onclick="qIniciarPratica('erradas')">Refazer erradas</button>` : ''}<button class="btn secondary small" onclick="qSairSessao()">Voltar ao banco</button></div></div></div>`;
  }
  const q = questoes.find(x => x.id === s.fila[s.i]); if (!q) { s.i++; return qRenderSessao(); }
  const e = qEstado(q), fb = s.fase === 'corrigida';
  const pastilha = e.estado === 'inedita' ? '<span class="badge blue">Inédita</span>' : `<span class="badge ${e.estado === 'acertada' ? 'ok' : 'bad'}">Já resolvida ${e.tent}× · última: ${e.estado === 'acertada' ? 'acertou' : 'errou'}</span>`;
  let corpo = '';
  if (q.tipo === 'ce') corpo = `<div class="qb-opcoes">${['C', 'E'].map(l => qOpcaoHTML(q, l, l === 'C' ? 'Certo' : 'Errado', s, fb)).join('')}</div>`;
  else if (q.tipo === 'multipla') corpo = `<div class="qb-opcoes">${q.alternativas.map(a => qOpcaoHTML(q, a.letra, a.texto, s, fb)).join('')}</div>`;
  else corpo = `<label class="field-label" for="qsResp">Sua resposta</label><textarea id="qsResp" style="min-height:140px;" ${fb ? 'readonly' : ''} placeholder="Escreva sua resposta antes de ver o padrão esperado">${escHtml(s.escolha || '')}</textarea>`;
  let acoes = '';
  if (!fb) acoes = q.tipo === 'discursiva' ? `<button class="btn" onclick="qRevelarDiscursiva()">Ver gabarito e comentário</button>` : `<button class="btn" onclick="qConfirmar()" ${s.escolha ? '' : 'disabled'} id="qsConfirmar">Confirmar resposta</button>`;
  let feedback = '';
  if (fb) {
    const ok = s.ultimo === true;
    feedback = `<div class="qb-feedback ${q.tipo === 'discursiva' ? 'neutro' : ok ? 'ok' : 'bad'}" role="status">
      ${q.tipo === 'discursiva' ? `<b>Padrão de resposta esperado</b><p class="pre">${escHtml(q.gabarito || 'Nenhum padrão cadastrado.')}</p>` : `<b>${ok ? 'Resposta correta' : 'Resposta incorreta'}</b><p>Gabarito: <b>${q.tipo === 'ce' ? (q.gabarito === 'C' ? 'Certo' : 'Errado') : escHtml(q.gabarito)}</b>${s.escolha && !ok ? ` · sua resposta: ${q.tipo === 'ce' ? (s.escolha === 'C' ? 'Certo' : 'Errado') : escHtml(s.escolha)}` : ''}</p>`}
      ${q.comentario ? `<div class="qb-coment"><b>Comentário</b><p class="pre">${escHtml(q.comentario)}</p></div>` : '<p class="muted" style="margin:6px 0 0;">Sem comentário cadastrado.</p>'}</div>
      ${q.tipo === 'discursiva' && s.ultimo === undefined ? `<div class="row" style="margin-top:12px;"><span>Como você avalia sua resposta?</span><button class="btn small" onclick="qAutoavaliar(true)">Acertei</button><button class="btn danger small" onclick="qAutoavaliar(false)">Preciso revisar</button></div>` : ''}
      <label class="field-label" for="qsObs">Minhas observações</label><textarea id="qsObs" placeholder="O que errei? O que lembrar?" onblur="qSalvarObs('${q.id}')">${escHtml(q.obs || '')}</textarea>
      <div class="row" style="margin-top:10px;"><button class="btn ghost small" onclick="toggleRevisadaSessao('${q.id}')">${icon('flag', 14)} ${q.revisar ? 'Desmarcar revisão' : 'Marcar para revisar'}</button>${s.ultimo === false ? `<button class="btn ghost small" onclick="qCriarFlashcard('${q.id}')">${icon('layers', 14)} Criar flashcard</button>` : ''}</div>`;
  }
  const proximo = fb && (q.tipo !== 'discursiva' || s.ultimo !== undefined) ? `<button class="btn" onclick="qProxima()">${s.i + 1 >= s.fila.length ? 'Concluir' : 'Próxima questão'} ${icon('chevron-right', 16)}</button>` : '';
  return `<div class="qb-sessao"><div class="row between"><button class="btn ghost small" onclick="qSairSessao()">${icon('chevron-left', 14)} Sair da prática</button><span class="muted mono" style="font-size:13px;">${s.i + 1} / ${s.fila.length}</span></div>
    <div class="bar" style="margin:10px 0;"><span style="width:${pct(s.i + (fb ? 1 : 0), s.fila.length)}%"></span></div>
    <div class="card qb-questao"><div class="qb-modo muted">${escHtml(s.modo)}</div><div class="qb-card-top"><span class="badge gold">${escHtml(q.materia)}</span>${q.assunto ? `<span class="badge">${escHtml(q.assunto)}${q.subassunto ? ' › ' + escHtml(q.subassunto) : ''}</span>` : ''}<span class="badge">${QTIPOS[q.tipo]}</span>${q.banca || q.ano ? `<span class="badge">${escHtml([q.banca, q.ano].filter(Boolean).join(' · '))}</span>` : ''}${pastilha}${q.revisar ? '<span class="badge warn">Revisar</span>' : ''}</div>
      <div class="qb-enun pre">${escHtml(q.enunciado)}</div>${q.fonte ? `<div class="muted" style="font-size:12.5px;margin-top:6px;">Fonte: ${escHtml(q.fonte)}</div>` : ''}
      <div style="margin-top:14px;">${corpo}</div><div class="row between" style="margin-top:16px;"><span class="muted mono" id="qsTimer" style="font-size:13px;">${icon('clock', 13)} ${fmtTempo(Math.floor((Date.now() - s.t0) / 1000))}</span><span class="row">${acoes}${proximo}</span></div>${feedback}</div></div>`;
}
function qOpcaoHTML(q, letra, texto, s, fb) {
  let cls = '', extra = '';
  if (fb) { if (letra === q.gabarito) { cls = 'certa'; extra = ' <span class="badge ok">Gabarito</span>'; } else if (letra === s.escolha) cls = 'errada'; }
  else if (letra === s.escolha) cls = 'sel';
  return `<button class="qb-opcao ${cls}" ${fb ? 'disabled' : ''} onclick="qEscolher('${letra}')" aria-pressed="${letra === s.escolha}"><b>${q.tipo === 'ce' ? '' : escHtml(letra)}</b><span>${escHtml(texto)}${extra}</span></button>`;
}
function qEscolher(l) { qSessao.escolha = l; renderQuestoes(); }
function qConfirmar() {
  const s = qSessao, q = questoes.find(x => x.id === s.fila[s.i]); if (!q || !s.escolha || s.fase === 'corrigida') return;
  const ok = s.escolha === q.gabarito; s.ultimo = ok; s.fase = 'corrigida'; ok ? s.acertos++ : s.erros++;
  qRegistrarResolucao(q, s.escolha, ok); renderQuestoes();
}
function qRevelarDiscursiva() { const s = qSessao; s.escolha = (document.getElementById('qsResp') || {}).value || ''; s.fase = 'corrigida'; s.ultimo = undefined; renderQuestoes(); }
function qAutoavaliar(ok) { const s = qSessao, q = questoes.find(x => x.id === s.fila[s.i]); s.ultimo = ok; ok ? s.acertos++ : s.erros++; qRegistrarResolucao(q, s.escolha, ok); renderQuestoes(); }
function qRegistrarResolucao(q, resposta, ok) {
  questoesHist.push({ id: uid(), qid: q.id, t: new Date().toISOString(), resposta, correta: ok, segundos: Math.round((Date.now() - qSessao.t0) / 1000) }); qSalvarHist();
  if (typeof trackStudyDay === 'function') trackStudyDay(); if (typeof trackActivity === 'function') trackActivity(ok ? 'acerto' : 'erro', `Questão de ${q.materia}`);
}
function qProxima() { const s = qSessao; qSalvarObs(s.fila[s.i]); s.i++; s.fase = 'perguntando'; s.escolha = ''; s.ultimo = undefined; s.t0 = Date.now(); renderQuestoes(); window.scrollTo({ top: 0 }); }
function qSalvarObs(id) { const el = document.getElementById('qsObs'), q = questoes.find(x => x.id === id); if (el && q && q.obs !== el.value) { q.obs = el.value; qSalvar(); } }
function toggleRevisadaSessao(id) { qSalvarObs(id); const q = questoes.find(x => x.id === id); q.revisar = !q.revisar; q.revisada = q.revisar; qSalvar(); renderQuestoes(); }
function qCriarFlashcard(id) {
  const q = questoes.find(x => x.id === id); if (!q || typeof flashCriarCard !== 'function') return;
  if (flashCards.some(c => c.origemTipo === 'questao' && c.origemRefId === id)) { toast('Já existe um flashcard desta questão.', 'aviso'); return; }
  const resp = q.tipo === 'ce' ? (q.gabarito === 'C' ? 'Certo' : 'Errado') : q.tipo === 'multipla' ? `${q.gabarito}) ${(q.alternativas.find(a => a.letra === q.gabarito) || {}).texto || ''}` : q.gabarito;
  flashCriarCard({ tipo: 'basico', frente: q.enunciado.slice(0, 400), verso: `Gabarito: ${resp}${q.comentario ? '\n\n' + q.comentario.slice(0, 400) : ''}`, disciplina: q.materia, tema: q.assunto, subtema: q.subassunto, tags: q.tags, fonte: q.fonte || 'Banco de questões', dificuldade: 'dificil', origemTipo: 'questao', origemRefId: id });
  toast('Flashcard criado a partir da questão.');
}
setInterval(() => { if (qSessao && qSessao.fase === 'perguntando') { const t = document.getElementById('qsTimer'); if (t) t.innerHTML = `${icon('clock', 13)} ${fmtTempo(Math.floor((Date.now() - qSessao.t0) / 1000))}`; } }, 1000);
