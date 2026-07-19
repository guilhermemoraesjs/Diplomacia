/* ==========================================================================
   dashboard.js — infraestrutura compartilhada do novo layout: sequência de
   estudos (streak), metas diária/mensal, atividade recente e busca global.
   Dados do usuário (localStorage + Firestore, como todo o resto do app).
   Começa zerado e cresce com o uso real — nada é inventado.
   ========================================================================== */

let dashAtividade = load('dashboard_atividade', []);
let dashStreakDias = load('dashboard_streak', []); // array de datas ISO (YYYY-MM-DD)
let dashMetas = load('dashboard_metas', { diaria: 15, mensal: 600 });

function trackActivity(tipo, texto) {
  dashAtividade.unshift({ tipo, texto, data: new Date().toISOString() });
  dashAtividade = dashAtividade.slice(0, 30);
  save('dashboard_atividade', dashAtividade);
}
function trackStudyDay() {
  const hoje = todayISO();
  if (!dashStreakDias.includes(hoje)) {
    dashStreakDias.push(hoje);
    dashStreakDias = dashStreakDias.slice(-90);
    save('dashboard_streak', dashStreakDias);
  }
}
function calcularStreakAtual() {
  let streak = 0; let d = new Date();
  while (dashStreakDias.includes(d.toISOString().slice(0, 10))) {
    streak++; d.setDate(d.getDate() - 1);
  }
  return streak;
}
function calcularMelhorStreak() {
  if (!dashStreakDias.length) return 0;
  const dias = [...dashStreakDias].sort();
  let melhor = 1, atual = 1;
  for (let i = 1; i < dias.length; i++) {
    const diff = (new Date(dias[i]) - new Date(dias[i - 1])) / 86400000;
    atual = diff === 1 ? atual + 1 : 1;
    melhor = Math.max(melhor, atual);
  }
  return melhor;
}
function ultimosSeteDias() {
  const arr = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    arr.push({ label: 'DSTQQSS'.charAt(d.getDay()) === '' ? '' : ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()], iso: d.toISOString().slice(0, 10) });
  }
  return arr;
}
function tempoRelativo(iso) {
  const diffMin = Math.round((Date.now() - new Date(iso)) / 60000);
  if (diffMin < 1) return 'agora há pouco';
  if (diffMin < 60) return diffMin + ' min atrás';
  const h = Math.round(diffMin / 60);
  if (h < 24) return h + (h === 1 ? ' hora atrás' : ' horas atrás');
  return Math.round(h / 24) + ' dia(s) atrás';
}

/* ---- Gráfico de evolução (SVG simples, sem lib externa) ---- */
function renderLineChart(containerId, pontos) {
  const el = document.getElementById(containerId); if (!el) return;
  if (!pontos.length) { el.innerHTML = '<div class="biblio-empty">Responda questões nos Simulados para ver sua evolução aqui.</div>'; return; }
  const w = 600, h = 160, pad = 10;
  const max = 100;
  const step = pontos.length > 1 ? (w - pad * 2) / (pontos.length - 1) : 0;
  const pts = pontos.map((p, i) => `${pad + i * step},${h - pad - (p.valor / max) * (h - pad * 2)}`).join(' ');
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%; height:150px;">
    <polyline points="${pts}" fill="none" stroke="var(--ok-glow)" stroke-width="2"/>
    ${pontos.map((p, i) => `<circle cx="${pad + i * step}" cy="${h - pad - (p.valor / max) * (h - pad * 2)}" r="2.5" fill="var(--ok-glow)"><title>${p.label}: ${p.valor}%</title></circle>`).join('')}
  </svg>`;
}

/* ---- Busca global (⌘K) ---- */
function buildSearchIndex() {
  const idx = [];
  (paises || []).forEach(p => idx.push({ tipo: 'País', label: p.nome, sub: p.capital, acao: () => { goTab('paises'); goSub('paisesLista'); setTimeout(() => abrirPaisDetalhe(p.id), 50); } }));
  (materias || []).forEach(m => { idx.push({ tipo: 'Matéria', label: m.nome, sub: 'Diplomacia', acao: () => { goTab('diplomacia'); goSub('materias'); } });
    (m.topicos || []).forEach(t => idx.push({ tipo: 'Tópico', label: t.nome, sub: m.nome, acao: () => { goTab('diplomacia'); goSub('materias'); } })); });
  (typeof simuladosQuestoesIndex !== 'undefined' ? simuladosQuestoesIndex : []).forEach(q => idx.push({ tipo: 'Questão', label: q.tema, sub: q.disciplina + ' · ' + q.ano, acao: () => { goTab('simulados'); } }));
  return idx;
}
async function abrirBuscaGlobal() {
  if (typeof simuladosIndexCarregado !== 'undefined' && !simuladosIndexCarregado && typeof carregarSimuladosIndex === 'function') await carregarSimuladosIndex();
  document.getElementById('globalSearchOverlay').classList.add('show');
  document.getElementById('globalSearchInput').value = '';
  document.getElementById('globalSearchResults').innerHTML = '';
  document.getElementById('globalSearchInput').focus();
}
function fecharBuscaGlobal() { document.getElementById('globalSearchOverlay').classList.remove('show'); }
function executarBuscaGlobal(q) {
  const el = document.getElementById('globalSearchResults');
  const query = q.trim().toLowerCase();
  if (!query) { el.innerHTML = ''; return; }
  const results = buildSearchIndex().filter(r => r.label.toLowerCase().includes(query) || (r.sub || '').toLowerCase().includes(query)).slice(0, 12);
  el.innerHTML = results.length ? results.map((r, i) => `
    <div class="gsearch-item" onclick="acionarResultadoBusca(${i})">
      <span class="gsearch-tipo">${r.tipo}</span>
      <div><div class="gsearch-label">${r.label}</div><div class="gsearch-sub">${r.sub || ''}</div></div>
    </div>`).join('') : '<div class="biblio-empty">Nenhum resultado encontrado.</div>';
  window._gsearchResults = results;
}
function acionarResultadoBusca(i) { window._gsearchResults[i].acao(); fecharBuscaGlobal(); }

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirBuscaGlobal(); }
  if (e.key === 'Escape') fecharBuscaGlobal();
});
