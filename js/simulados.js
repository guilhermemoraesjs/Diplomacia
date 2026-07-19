/* ==========================================================================
   simulados.js — módulo "Simulados": banco de questões do CACD resolvido
   diretamente na plataforma (substitui PDFs de provas antigas).

   Arquitetura:
   - data/simulados/index.json          → metadados leves das provas.
   - data/simulados/questoes-index.json → metadados leves de TODAS as
     questões (id, provaId, disciplina, tema, dificuldade), carregado uma
     vez e usado para filtros sem precisar baixar o conteúdo pesado.
   - data/simulados/provas/{id}.json    → conteúdo completo (enunciado,
     alternativas, explicação) de uma prova específica, carregado SOB
     DEMANDA apenas quando aquela prova é necessária para a sessão atual.
     Isso permite crescer para milhares de questões sem pesar o carregamento
     inicial nem exigir mudança de estrutura.
   - Progresso do usuário (respostas, favoritas, marcadas p/ revisão,
     anotações) é dado do usuário: vai por save()/load(), sincronizando
     com a nuvem como todo o resto da Chancelaria.
   ========================================================================== */

const SIMULADOS_INDEX_URL = 'data/simulados/index.json';
const SIMULADOS_QINDEX_URL = 'data/simulados/questoes-index.json';
const SIMULADOS_PROVA_DIR = 'data/simulados/provas/';

let simuladosProvasIndex = [];
let simuladosQuestoesIndex = [];
let simuladosIndexCarregado = false;
let simuladosProvasCache = {}; // provaId -> array de questões completas

function progressoDefault() { return { respondidas: {}, favoritas: [], revisao: [], anotacoes: {} }; }
let simuladosProgresso = load('simulados_progresso', null) || progressoDefault();
function salvarProgresso() { save('simulados_progresso', simuladosProgresso); }

/* Sessão de prova em andamento */
let simuladoSessao = null; // { questoes:[], modo, cronometro, indiceAtual, inicioMs, tempos:{id:seg} }
let simuladoTimerInterval = null;
let simuladoConfigModoAtual = null; // 'disciplina' | 'ano' | 'personalizado' | 'provaCompleta'

async function initSimuladosTab() {
  if (!simuladosIndexCarregado) await carregarSimuladosIndex();
  showSimuladosPanel('home');
  renderSimuladosHome();
}

async function carregarSimuladosIndex() {
  try {
    const [provasResp, qResp] = await Promise.all([fetch(SIMULADOS_INDEX_URL), fetch(SIMULADOS_QINDEX_URL)]);
    simuladosProvasIndex = await provasResp.json();
    simuladosQuestoesIndex = await qResp.json();
    simuladosIndexCarregado = true;
  } catch (e) {
    console.error('Falha ao carregar índice de Simulados:', e);
  }
}

async function carregarProva(provaId) {
  if (simuladosProvasCache[provaId]) return simuladosProvasCache[provaId];
  const prova = simuladosProvasIndex.find(p => p.id === provaId);
  if (!prova) return [];
  const resp = await fetch(SIMULADOS_PROVA_DIR + prova.arquivo);
  const dados = await resp.json();
  simuladosProvasCache[provaId] = dados;
  return dados;
}

/* Dado um conjunto de ids de questões (de qualquer prova), descobre quais
   provas precisam ser baixadas e retorna só as questões pedidas, na ordem
   dos ids recebidos. */
async function carregarQuestoesPorIds(ids) {
  const idsSet = new Set(ids);
  const provaIds = [...new Set(simuladosQuestoesIndex.filter(q => idsSet.has(q.id)).map(q => q.provaId))];
  const provas = await Promise.all(provaIds.map(carregarProva));
  const todas = provas.flat();
  const porId = Object.fromEntries(todas.map(q => [q.id, q]));
  return ids.map(id => porId[id]).filter(Boolean);
}

function showSimuladosPanel(panel) {
  ['home', 'config', 'prova', 'resultado'].forEach(p => {
    const el = document.getElementById('simuladosPanel' + p.charAt(0).toUpperCase() + p.slice(1));
    if (el) el.style.display = p === panel ? 'block' : 'none';
  });
}

/* ---- Estatísticas ---- */
function simuladosCalcularStats() {
  const respostas = Object.values(simuladosProgresso.respondidas);
  const total = simuladosQuestoesIndex.length;
  const respondidas = respostas.length;
  const corretas = respostas.filter(r => r.correta).length;
  const pctAcerto = respondidas ? Math.round((corretas / respondidas) * 100) : 0;
  const tempos = respostas.map(r => r.tempoSeg || 0).filter(t => t > 0);
  const tempoMedio = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
  return { total, respondidas, pendentes: total - respondidas, pctAcerto, tempoMedio };
}
function fmtSeg(s) { const m = Math.floor(s / 60); const r = s % 60; return `${m}m ${r}s`; }

function renderSimuladosHome() {
  const st = simuladosCalcularStats();
  const streak = typeof calcularStreakAtual === 'function' ? calcularStreakAtual() : 0;
  const melhorStreak = typeof calcularMelhorStreak === 'function' ? calcularMelhorStreak() : 0;

  const statsEl = document.getElementById('simuladosStats');
  if (statsEl) statsEl.innerHTML = `
    <div class="dash-stat"><span class="dash-stat-ic" style="background:#2E5BFF22; color:#6C8DFF;">📄</span><div><div class="dash-stat-label">Provas cadastradas</div><div class="dash-stat-n">${simuladosProvasIndex.length}</div><div class="dash-stat-sub">${simuladosProvasIndex.map(p => p.ano).sort()[0] || '—'} - ${simuladosProvasIndex.map(p => p.ano).sort().slice(-1)[0] || '—'}</div></div></div>
    <div class="dash-stat"><span class="dash-stat-ic" style="background:#B490FF22; color:#B490FF;">🧩</span><div><div class="dash-stat-label">Questões disponíveis</div><div class="dash-stat-n">${st.total}</div><div class="dash-stat-sub">Todas as disciplinas</div></div></div>
    <div class="dash-stat"><span class="dash-stat-ic" style="background:#2EC4B622; color:#2EC4B6;">✅</span><div><div class="dash-stat-label">Questões respondidas</div><div class="dash-stat-n">${st.respondidas}</div><div class="dash-stat-sub">${st.total ? Math.round((st.respondidas / st.total) * 100) : 0}% do total</div></div></div>
    <div class="dash-stat"><span class="dash-stat-ic" style="background:#5C7A4F22; color:#7FA36A;">🎯</span><div><div class="dash-stat-label">Taxa de acerto</div><div class="dash-stat-n">${st.pctAcerto}%</div><div class="dash-stat-sub">Média geral</div></div></div>
    <div class="dash-stat"><span class="dash-stat-ic" style="background:#E3C48122; color:#E3C481;">⏱️</span><div><div class="dash-stat-label">Tempo médio</div><div class="dash-stat-n">${fmtSeg(st.tempoMedio)}</div><div class="dash-stat-sub">Por questão</div></div></div>
    <div class="dash-stat"><span class="dash-stat-ic" style="background:#C24B4B22; color:#C24B4B;">📈</span><div><div class="dash-stat-label">Simulados realizados</div><div class="dash-stat-n">${dashAtividade.filter(a => a.tipo === 'simulado').length}</div><div class="dash-stat-sub">Últimos 90 dias</div></div></div>
  `;

  const erradasCount = Object.entries(simuladosProgresso.respondidas).filter(([, r]) => !r.correta).length;
  const modos = [
    { id: 'provaCompleta', icone: '📄', titulo: 'Prova Completa', desc: 'Resolva exatamente como foi aplicada no CACD.', badge: simuladosProvasIndex.length + ' provas' },
    { id: 'disciplina', icone: '📚', titulo: 'Por Disciplina', desc: 'Selecione uma disciplina e resolva questões de todos os anos.', badge: null },
    { id: 'ano', icone: '📅', titulo: 'Por Ano', desc: 'Escolha um ano e resolva questões de todas as disciplinas.', badge: null },
    { id: 'personalizado', icone: '🎯', titulo: 'Simulado Personalizado', desc: 'Monte seu simulado escolhendo disciplinas, anos, temas e dificuldade.', badge: null },
    { id: 'favoritas', icone: '⭐', titulo: 'Questões Favoritas', desc: 'Revise suas questões marcadas como favoritas.', badge: simuladosProgresso.favoritas.length + ' questões' },
    { id: 'erradas', icone: '❌', titulo: 'Questões Erradas', desc: 'Reveja questões que você respondeu incorretamente.', badge: erradasCount + ' questões' },
    { id: 'revisao', icone: '🔄', titulo: 'Revisão', desc: 'Questões que você marcou para revisar depois.', badge: simuladosProgresso.revisao.length + ' questões' },
    { id: 'novas', icone: '🆕', titulo: 'Não Respondidas', desc: 'Questões que você ainda não respondeu.', badge: (st.total - st.respondidas) + ' questões' }
  ];
  const modosEl = document.getElementById('simuladosModos');
  if (modosEl) modosEl.innerHTML = modos.map(m => `
    <div class="card sim-modo-card" onclick="iniciarFluxoModo('${m.id}')">
      <div class="sim-modo-icone">${m.icone}</div>
      <div class="sim-modo-titulo">${m.titulo}</div>
      <div class="sim-modo-desc">${m.desc}</div>
      ${m.badge ? `<div class="sim-modo-badge mono">${m.badge}</div>` : ''}
    </div>
  `).join('');

  /* Provas disponíveis com barra de progresso real */
  const provasEl = document.getElementById('simuladosProvasDisponiveis');
  if (provasEl) provasEl.innerHTML = simuladosProvasIndex.map(p => {
    const idsDaProva = simuladosQuestoesIndex.filter(q => q.provaId === p.id).map(q => q.id);
    const respondidasDaProva = idsDaProva.filter(id => simuladosProgresso.respondidas[id]).length;
    const pct = idsDaProva.length ? Math.round((respondidasDaProva / idsDaProva.length) * 100) : 0;
    return `
      <div class="card dash-prova-card" onclick="iniciarSessaoComIds(${JSON.stringify(idsDaProva)}, 'estudo', true, '${p.titulo}')">
        <div class="dash-prova-ano">${p.ano}</div>
        <div class="dash-prova-meta">${p.totalQuestoes} questões</div>
        <div class="bar"><span style="width:${pct}%;"></span></div>
        <div class="dash-prova-pct mono">${pct}% resolvida</div>
      </div>`;
  }).join('');

  /* Desempenho por disciplina (coluna direita) */
  const porDisc = {};
  simuladosQuestoesIndex.forEach(q => { if (!porDisc[q.disciplina]) porDisc[q.disciplina] = { total: 0, corretas: 0, respondidas: 0 }; porDisc[q.disciplina].total++;
    const r = simuladosProgresso.respondidas[q.id]; if (r) { porDisc[q.disciplina].respondidas++; if (r.correta) porDisc[q.disciplina].corretas++; } });
  const discEl = document.getElementById('simuladosDesempenhoDisciplina');
  if (discEl) discEl.innerHTML = Object.entries(porDisc).map(([d, v]) => {
    const pct = v.respondidas ? Math.round((v.corretas / v.respondidas) * 100) : 0;
    return `<div class="dash-disc-row"><span>${d}</span><div class="bar" style="flex:1; margin:0 8px;"><span style="width:${pct}%;"></span></div><span class="mono" style="width:64px; text-align:right;">${pct}% · ${v.total}q</span></div>`;
  }).join('') || '<div class="biblio-empty">Nenhuma questão cadastrada ainda.</div>';

  /* Atividade recente */
  const atEl = document.getElementById('simuladosAtividadeRecente');
  if (atEl) atEl.innerHTML = dashAtividade.slice(0, 6).map(a => `
    <div class="dash-activity-row">
      <span class="dash-activity-ic ${a.tipo}">${a.tipo === 'acerto' ? '✓' : a.tipo === 'erro' ? '✕' : '🔁'}</span>
      <div><div class="dash-activity-txt">${a.texto}</div><div class="dash-activity-time">${tempoRelativo(a.data)}</div></div>
    </div>`).join('') || '<div class="biblio-empty">Nenhuma atividade ainda — comece a resolver questões.</div>';

  /* Temas mais cobrados */
  const temasCount = {};
  simuladosQuestoesIndex.forEach(q => { temasCount[q.tema] = (temasCount[q.tema] || 0) + 1; });
  const temasEl = document.getElementById('simuladosTemasCobrados');
  if (temasEl) temasEl.innerHTML = Object.entries(temasCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([t, n], i) => `<div class="dash-tema-row"><span>${i + 1}</span><span style="flex:1;">${t}</span><span class="mono">${n} questões</span></div>`).join('') || '<div class="biblio-empty">Sem dados ainda.</div>';

  /* Gráfico de evolução (acerto acumulado por dia) */
  const porDia = {};
  Object.values(simuladosProgresso.respondidas).forEach(r => {
    const dia = r.data.slice(0, 10);
    if (!porDia[dia]) porDia[dia] = { total: 0, corretas: 0 };
    porDia[dia].total++; if (r.correta) porDia[dia].corretas++;
  });
  const pontosGrafico = Object.keys(porDia).sort().map(dia => ({ label: dia, valor: Math.round((porDia[dia].corretas / porDia[dia].total) * 100) }));
  if (typeof renderLineChart === 'function') renderLineChart('simuladosGraficoEvolucao', pontosGrafico);

  /* Sequência de estudos */
  const streakEl = document.getElementById('simuladosStreakInfo');
  if (streakEl) streakEl.innerHTML = `<div class="dash-streak-n">🔥 ${streak} dias</div><div class="dash-streak-sub">Melhor sequência: ${melhorStreak} dias</div>`;
  const streakDaysEl = document.getElementById('simuladosStreakDias');
  if (streakDaysEl && typeof ultimosSeteDias === 'function') streakDaysEl.innerHTML = ultimosSeteDias().map(d =>
    `<div class="dash-streak-day"><span>${d.label}</span><span class="dash-streak-dot ${dashStreakDias.includes(d.iso) ? 'active' : ''}">${dashStreakDias.includes(d.iso) ? '✓' : ''}</span></div>`).join('');

  /* Meta mensal */
  const mesAtual = todayISO().slice(0, 7);
  const respondidasMes = Object.values(simuladosProgresso.respondidas).filter(r => r.data.slice(0, 7) === mesAtual).length;
  const pctMeta = Math.min(100, Math.round((respondidasMes / dashMetas.mensal) * 100));
  const metaEl = document.getElementById('simuladosMetaMensal');
  if (metaEl) metaEl.innerHTML = `
    <div class="ring" style="--pct:${pctMeta}; margin:0 auto;"><div class="hole">${pctMeta}%</div></div>
    <div style="text-align:center; margin-top:10px;"><div style="font-family:'Fraunces',serif; font-size:15px;">${dashMetas.mensal} questões</div><div class="mono" style="font-size:11px; color:var(--text-muted);">${respondidasMes} / ${dashMetas.mensal} · continue assim!</div></div>
  `;
}

/* ---- Roteamento dos modos ---- */
function iniciarFluxoModo(modo) {
  if (modo === 'favoritas') return iniciarSessaoComIds(simuladosProgresso.favoritas, 'estudo', false, 'Favoritas');
  if (modo === 'revisao') return iniciarSessaoComIds(simuladosProgresso.revisao, 'estudo', false, 'Revisão');
  if (modo === 'erradas') {
    const ids = Object.entries(simuladosProgresso.respondidas).filter(([, r]) => !r.correta).map(([id]) => id);
    return iniciarSessaoComIds(ids, 'estudo', false, 'Questões Erradas');
  }
  if (modo === 'novas') {
    const ids = simuladosQuestoesIndex.map(q => q.id).filter(id => !simuladosProgresso.respondidas[id]);
    return iniciarSessaoComIds(ids.slice(0, 20), 'estudo', false, 'Novas Questões');
  }
  simuladoConfigModoAtual = modo;
  renderSimuladosConfig();
  showSimuladosPanel('config');
}

async function iniciarSessaoComIds(ids, modo, cronometro, titulo) {
  if (!ids.length) { alert('Não há questões nessa categoria ainda.'); return; }
  const questoes = await carregarQuestoesPorIds(ids);
  iniciarSessao(questoes, modo, cronometro, titulo);
}

/* ---- Tela de configuração ---- */
function renderSimuladosConfig() {
  const modo = simuladoConfigModoAtual;
  const wrap = document.getElementById('simuladosConfigWrap'); if (!wrap) return;

  const disciplinas = [...new Set(simuladosQuestoesIndex.map(q => q.disciplina))].sort();
  const anos = [...new Set(simuladosQuestoesIndex.map(q => q.ano))].sort((a, b) => b - a);

  let camposHtml = '';
  if (modo === 'provaCompleta') {
    camposHtml = `
      <label class="field-label">Escolha a prova</label>
      <select id="cfgProva">${simuladosProvasIndex.map(p => `<option value="${p.id}">${p.titulo}</option>`).join('')}</select>
    `;
  } else {
    if (modo === 'disciplina' || modo === 'personalizado') {
      camposHtml += `<label class="field-label">Disciplinas</label><div class="filters" id="cfgDisciplinas">${disciplinas.map(d => `<button type="button" class="chip" data-val="${d}" onclick="this.classList.toggle('active')">${d}</button>`).join('')}</div>`;
    }
    if (modo === 'ano' || modo === 'personalizado') {
      camposHtml += `<label class="field-label" style="margin-top:14px;">Anos</label><div class="filters" id="cfgAnos">${anos.map(a => `<button type="button" class="chip" data-val="${a}" onclick="this.classList.toggle('active')">${a}</button>`).join('')}</div>`;
    }
    camposHtml += `
      <div class="row2" style="margin-top:14px;">
        <div><label class="field-label">Quantidade</label><input type="number" id="cfgQuantidade" value="10" min="1"></div>
        <div><label class="field-label">Dificuldade</label>
          <select id="cfgDificuldade"><option value="todas">Todas</option><option value="facil">Fácil</option><option value="media">Média</option><option value="dificil">Difícil</option></select>
        </div>
      </div>`;
  }

  wrap.innerHTML = `
    <button class="btn ghost small" onclick="showSimuladosPanel('home')" style="margin-bottom:14px;">← Voltar</button>
    <div class="card">
      ${camposHtml}
      <label class="field-label" style="margin-top:14px;">Modo</label>
      <div class="filters">
        <button type="button" class="chip active" id="cfgModoEstudo" onclick="setCfgModo('estudo')">Estudo (feedback na hora)</button>
        <button type="button" class="chip" id="cfgModoSimulado" onclick="setCfgModo('simulado')">Simulado (só no final)</button>
      </div>
      <label class="field-label" style="margin-top:14px; display:flex; align-items:center; gap:8px; cursor:pointer;">
        <input type="checkbox" id="cfgCronometro" checked style="width:16px; height:16px; accent-color:var(--ub-azul);"> <span style="text-transform:none; letter-spacing:0;">⏱️ Cronômetro ligado</span>
      </label>
      <label class="field-label" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <input type="checkbox" id="cfgEmbaralharQ" ${modo !== 'provaCompleta' ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--ub-azul);"> <span style="text-transform:none; letter-spacing:0;">🔀 Embaralhar questões</span>
      </label>
      <label class="field-label" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <input type="checkbox" id="cfgEmbaralharAlt" style="width:16px; height:16px; accent-color:var(--ub-azul);"> <span style="text-transform:none; letter-spacing:0;">🔀 Embaralhar alternativas</span>
      </label>
      <button class="btn secondary" style="margin-top:18px;" onclick="confirmarConfigECome车()">Começar</button>
    </div>
  `;
}
let cfgModoSelecionado = 'estudo';
function setCfgModo(m) {
  cfgModoSelecionado = m;
  document.getElementById('cfgModoEstudo').classList.toggle('active', m === 'estudo');
  document.getElementById('cfgModoSimulado').classList.toggle('active', m === 'simulado');
}

async function confirmarConfigECome车() {
  const modo = simuladoConfigModoAtual;
  const cronometro = document.getElementById('cfgCronometro').checked;
  let questoes = [];

  if (modo === 'provaCompleta') {
    const provaId = document.getElementById('cfgProva').value;
    questoes = await carregarProva(provaId);
  } else {
    const disciplinasSel = modo === 'ano' ? [] : [...document.querySelectorAll('#cfgDisciplinas .chip.active')].map(b => b.dataset.val);
    const anosSel = modo === 'disciplina' ? [] : [...document.querySelectorAll('#cfgAnos .chip.active')].map(b => Number(b.dataset.val));
    const dificuldade = document.getElementById('cfgDificuldade').value;
    const quantidade = parseInt(document.getElementById('cfgQuantidade').value) || 10;

    let pool = simuladosQuestoesIndex.filter(q => {
      if (disciplinasSel.length && !disciplinasSel.includes(q.disciplina)) return false;
      if (anosSel.length && !anosSel.includes(q.ano)) return false;
      if (dificuldade !== 'todas' && q.dificuldade !== dificuldade) return false;
      return true;
    });
    if (document.getElementById('cfgEmbaralharQ').checked) pool = embaralhar(pool);
    pool = pool.slice(0, quantidade);
    questoes = await carregarQuestoesPorIds(pool.map(q => q.id));
  }

  if (!questoes.length) { alert('Nenhuma questão encontrada com esses filtros.'); return; }
  if (document.getElementById('cfgEmbaralharAlt') && document.getElementById('cfgEmbaralharAlt').checked) {
    questoes = questoes.map(embaralharAlternativas);
  }
  iniciarSessao(questoes, cfgModoSelecionado, cronometro, null);
}

function embaralhar(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function embaralharAlternativas(q) {
  if (q.tipo !== 'multipla') return q;
  const corretaOriginal = q.alternativas.find(a => a.letra === q.respostaCorreta);
  const embaralhadas = embaralhar(q.alternativas);
  const letras = ['A', 'B', 'C', 'D', 'E'];
  const novas = embaralhadas.map((alt, i) => ({ letra: letras[i], texto: alt.texto }));
  const novaCorreta = novas.find(a => a.texto === corretaOriginal.texto).letra;
  return { ...q, alternativas: novas, respostaCorreta: novaCorreta };
}

/* ---- Sessão de prova ---- */
function iniciarSessao(questoes, modo, cronometro, titulo) {
  simuladoSessao = { questoes, modo, cronometro, indiceAtual: 0, inicioMs: Date.now(), tempos: {}, titulo: titulo || 'Simulado', questaoInicioMs: Date.now() };
  showSimuladosPanel('prova');
  renderSimuladoProva();
  if (cronometro) {
    clearInterval(simuladoTimerInterval);
    simuladoTimerInterval = setInterval(atualizarTimerSimulado, 1000);
  }
}
function atualizarTimerSimulado() {
  const el = document.getElementById('simTimer'); if (!el || !simuladoSessao) return;
  const seg = Math.floor((Date.now() - simuladoSessao.inicioMs) / 1000);
  el.textContent = fmtTempo(seg);
}

function questaoAtual() { return simuladoSessao.questoes[simuladoSessao.indiceAtual]; }

function renderSimuladoProva() {
  const s = simuladoSessao; const q = questaoAtual();
  const wrap = document.getElementById('simuladosProvaWrap'); if (!wrap || !q) return;
  const resposta = simuladosProgresso.respondidas[q.id];
  const fav = simuladosProgresso.favoritas.includes(q.id);
  const marcada = simuladosProgresso.revisao.includes(q.id);
  const mostrarFeedback = s.modo === 'estudo' && resposta;

  const navGrid = s.questoes.map((qq, i) => {
    const r = simuladosProgresso.respondidas[qq.id];
    let cls = 'sim-nav-item';
    if (i === s.indiceAtual) cls += ' atual';
    else if (r) cls += ' respondida';
    else if (simuladosProgresso.revisao.includes(qq.id)) cls += ' marcada';
    return `<button type="button" class="${cls}" onclick="irParaQuestao(${i})">${i + 1}</button>`;
  }).join('');

  const altsHtml = q.tipo === 'multipla' ? q.alternativas.map(a => {
    let cls = 'sim-alt';
    if (resposta && resposta.escolha === a.letra) cls += ' selecionada';
    if (mostrarFeedback) {
      if (a.letra === q.respostaCorreta) cls += ' correta';
      else if (resposta.escolha === a.letra) cls += ' incorreta';
    }
    return `<button type="button" class="${cls}" onclick="responderQuestao('${a.letra}')"><b>${a.letra})</b> ${a.texto}</button>`;
  }).join('') : '';

  wrap.innerHTML = `
    <div class="sim-topbar">
      <div>${s.titulo} · Questão ${s.indiceAtual + 1} de ${s.questoes.length}</div>
      ${s.cronometro ? `<div class="mono" id="simTimer">00:00</div>` : ''}
      <button class="btn ghost small" onclick="finalizarSimulado()">Finalizar</button>
    </div>
    <div class="sim-nav-grid">${navGrid}</div>
    <div class="card">
      <div class="sim-q-header">
        <span class="mono" style="font-size:11px; color:var(--text-muted);">${q.disciplina} · ${q.tema}</span>
        <div style="display:flex; gap:6px;">
          <button class="sim-icon-btn ${fav ? 'active' : ''}" onclick="toggleFavoritaQuestao('${q.id}')" title="Favoritar">★</button>
          <button class="sim-icon-btn ${marcada ? 'active' : ''}" onclick="toggleRevisaoQuestao('${q.id}')" title="Marcar para revisar">🔁</button>
        </div>
      </div>
      <p class="sim-enunciado">${q.enunciado}</p>
      <div class="sim-alternativas">${altsHtml}</div>
      ${mostrarFeedback ? `<div class="sim-explicacao"><strong>${resposta.correta ? '✅ Correto!' : '❌ Incorreto.'}</strong> ${q.explicacao}</div>` : ''}
      <label class="field-label" style="margin-top:14px;">Sua anotação</label>
      <textarea onchange="salvarAnotacaoQuestao('${q.id}', this.value)" placeholder="Anote algo sobre esta questão...">${simuladosProgresso.anotacoes[q.id] || ''}</textarea>
      ${(q.paisesRelacionados || []).length ? `<div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">${q.paisesRelacionados.map(pid => `
        <button class="btn ghost small" onclick="abrirPaisDaQuestao('${pid}')">🌍 Abrir ficha: ${pid}</button>
        <button class="btn ghost small" onclick="abrirFlashcardsDoPais('${pid}')">🔁 Flashcards: ${pid}</button>
      `).join('')}</div>` : ''}
    </div>
    <div style="display:flex; justify-content:space-between; margin-top:14px;">
      <button class="btn ghost" onclick="navegarQuestao(-1)" ${s.indiceAtual === 0 ? 'disabled' : ''}>← Anterior</button>
      <button class="btn secondary" onclick="navegarQuestao(1)" ${s.indiceAtual === s.questoes.length - 1 ? 'disabled' : ''}>Próxima →</button>
    </div>
  `;
}

function responderQuestao(letra) {
  const q = questaoAtual(); const s = simuladoSessao;
  const correta = q.tipo === 'multipla' ? letra === q.respostaCorreta : null;
  const tempoSeg = Math.round((Date.now() - s.questaoInicioMs) / 1000);
  simuladosProgresso.respondidas[q.id] = { escolha: letra, correta, tempoSeg, data: new Date().toISOString() };
  salvarProgresso();
  if (typeof trackStudyDay === 'function') trackStudyDay();
  if (typeof trackActivity === 'function') trackActivity(correta ? 'acerto' : 'erro', `Questão de ${q.disciplina} · ${q.tema}`);
  renderSimuladoProva();
}
function navegarQuestao(delta) {
  simuladoSessao.indiceAtual = Math.max(0, Math.min(simuladoSessao.questoes.length - 1, simuladoSessao.indiceAtual + delta));
  simuladoSessao.questaoInicioMs = Date.now();
  renderSimuladoProva();
}
function irParaQuestao(i) { simuladoSessao.indiceAtual = i; simuladoSessao.questaoInicioMs = Date.now(); renderSimuladoProva(); }
function toggleFavoritaQuestao(id) {
  simuladosProgresso.favoritas = simuladosProgresso.favoritas.includes(id) ? simuladosProgresso.favoritas.filter(x => x !== id) : [...simuladosProgresso.favoritas, id];
  salvarProgresso(); renderSimuladoProva();
}
function toggleRevisaoQuestao(id) {
  simuladosProgresso.revisao = simuladosProgresso.revisao.includes(id) ? simuladosProgresso.revisao.filter(x => x !== id) : [...simuladosProgresso.revisao, id];
  salvarProgresso(); renderSimuladoProva();
}
function salvarAnotacaoQuestao(id, texto) { simuladosProgresso.anotacoes[id] = texto; salvarProgresso(); }

function abrirPaisDaQuestao(paisId) { goTab('paises'); goSub('paisesLista'); setTimeout(() => abrirPaisDetalhe(paisId), 50); }
function abrirFlashcardsDoPais(paisId) {
  goTab('paises'); goSub('paisesLista');
  setTimeout(async () => { await abrirPaisDetalhe(paisId); paisDetalheAbaAtual = 'flashcards'; renderPaisDetalhe(); setTimeout(() => gerarFlashcardsPais(paisId), 50); }, 50);
}

/* ---- Finalização e resultado ---- */
function finalizarSimulado() {
  clearInterval(simuladoTimerInterval);
  const s = simuladoSessao;
  if (typeof trackActivity === 'function') trackActivity('simulado', `Simulado "${s.titulo}" concluído · ${s.questoes.length} questões`);
  const tempoTotalSeg = Math.round((Date.now() - s.inicioMs) / 1000);
  const respostas = s.questoes.map(q => simuladosProgresso.respondidas[q.id]).filter(Boolean);
  const corretas = respostas.filter(r => r.correta).length;
  const incorretas = respostas.filter(r => r.correta === false).length;
  const brancas = s.questoes.length - respostas.length;
  const nota = s.questoes.length ? Math.round((corretas / s.questoes.length) * 1000) / 100 : 0;

  const porDisciplina = {};
  s.questoes.forEach(q => {
    const r = simuladosProgresso.respondidas[q.id];
    if (!porDisciplina[q.disciplina]) porDisciplina[q.disciplina] = { total: 0, corretas: 0 };
    porDisciplina[q.disciplina].total++;
    if (r && r.correta) porDisciplina[q.disciplina].corretas++;
  });

  showSimuladosPanel('resultado');
  const wrap = document.getElementById('simuladosResultadoWrap');
  wrap.innerHTML = `
    <div class="card" style="text-align:center;">
      <div class="ring" style="--pct:${Math.round((corretas / s.questoes.length) * 100) || 0}; margin:0 auto;"><div class="hole">${nota}</div></div>
      <h2 style="margin-top:14px;">${s.titulo} — Resultado</h2>
      <div class="stats-row" style="justify-content:center;">
        <div class="card stat-card"><div class="n">${corretas}</div><div class="l">acertos</div></div>
        <div class="card stat-card"><div class="n">${incorretas}</div><div class="l">erros</div></div>
        <div class="card stat-card"><div class="n">${brancas}</div><div class="l">em branco</div></div>
        <div class="card stat-card"><div class="n">${fmtTempo(tempoTotalSeg)}</div><div class="l">tempo total</div></div>
      </div>
    </div>
    <div class="card">
      <h3 class="section-title">Desempenho por disciplina</h3>
      ${Object.entries(porDisciplina).map(([d, v]) => `
        <div style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;"><span>${d}</span><span class="mono">${v.corretas}/${v.total}</span></div>
          <div class="bar"><span style="width:${Math.round((v.corretas / v.total) * 100)}%;"></span></div>
        </div>
      `).join('')}
    </div>
    <button class="btn secondary" onclick="showSimuladosPanel('home'); renderSimuladosHome();">Voltar ao início de Simulados</button>
  `;
}
