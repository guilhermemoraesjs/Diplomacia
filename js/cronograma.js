/* ==========================================================================
   cronograma.js — módulo "Diplomacia → Cronograma": itens de estudo com
   data, filtros (status/matéria), visões (dia/matéria/calendário) e o
   modal de edição rápida usado também pelo Despacho do Dia.
   ========================================================================== */

function cronogramaDefault() { return []; }

let cronograma = load('diplo_cronograma', []) || cronogramaDefault();

// Estado de filtros/visões da aba Cronograma
let cronoViewMode = 'dia';
let cronoStatusFiltro = 'todas';

// Estado do mês exibido no Calendário (independente do mês atual real)
let calState = { year: new Date().getFullYear(), month: new Date().getMonth() };
// Data selecionada no modal "conteúdo do dia" (objeto Date, ou null se modal fechado)
let cronoDayModalDate = null;

function isAtrasado(c) { const d = parseBR(c.data); return d && d < new Date().setHours(0, 0, 0, 0) && !c.feito; }
function fmtTempo(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function fmtDataBR(d) { return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }

function openCronoEditModal(id) {
  const c = cronograma.find(x => x.id === id); if (!c) return;
  document.getElementById('editCronoId').value = c.id;
  document.getElementById('editCronoTema').value = c.tema;
  document.getElementById('editCronoEstudar').value = c.estudar || '';
  document.getElementById('editCronoSemana').value = c.semana || '';
  document.getElementById('editCronoTempo').value = c.tempo || '';
  const sel = document.getElementById('editCronoMateria');
  sel.innerHTML = materias.map(m => `<option value="${m.nome}">${m.nome}</option>`).join('');
  sel.value = c.materia;

  let isoVal = ""; const parsed = parseBR(c.data);
  if (parsed) isoVal = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  document.getElementById('editCronoData').value = isoVal;
  document.getElementById('editCronoModal').classList.add('show');
}
function closeEditModal(e) { if (e.target.classList.contains('modal-overlay')) closeEditModalDirect(); }
function closeEditModalDirect() { document.getElementById('editCronoModal').classList.remove('show'); }
function saveCronoEdition() {
  const id = document.getElementById('editCronoId').value; const c = cronograma.find(x => x.id === id); if (!c) return;
  c.tema = document.getElementById('editCronoTema').value; c.estudar = document.getElementById('editCronoEstudar').value;
  c.materia = document.getElementById('editCronoMateria').value; c.semana = document.getElementById('editCronoSemana').value;
  c.tempo = document.getElementById('editCronoTempo').value;
  const rawD = document.getElementById('editCronoData').value; c.data = rawD ? isoToBR(rawD) : '—';
  save('diplo_cronograma', cronograma); closeEditModalDirect(); renderCronograma(); refreshStats();
}

function renderCronograma() {
  let list = cronograma;

  // Filtro por status
  if (cronoStatusFiltro === 'pendentes') list = list.filter(c => !c.feito && !isAtrasado(c));
  else if (cronoStatusFiltro === 'atrasados') list = list.filter(c => isAtrasado(c));
  else if (cronoStatusFiltro === 'concluidos') list = list.filter(c => c.feito);

  const el = document.getElementById('cronogramaList'); if (!el) return;

  if (!list.length) {
    el.innerHTML = '<div class="empty" style="padding:12px 0; color:var(--text-muted);">Nenhum item encontrado para este filtro.</div>';
    return;
  }

  el.innerHTML = list.map(c => `
    <div class="card crono ${c.feito ? 'feito' : ''} ${isAtrasado(c) ? 'atrasado' : ''}" style="border-left:4px solid ${getMateriaColor(c.materia)};" onclick="openCronoEditModal('${c.id}')">
      <input type="checkbox" ${c.feito ? 'checked' : ''} onchange="event.stopPropagation(); toggleCronoFeito('${c.id}')">
      <div class="cbody">
        <div class="ch"><span><span class="crono-materia-dot" style="background:${getMateriaColor(c.materia)}"></span>${escHtml(c.materia)} · ${escHtml(c.semana)}</span><span>${escHtml(c.data)}</span></div>
        <div class="ct">${escHtml(c.tema)}</div>
        ${c.estudar ? `<div class="ce">${escHtml(c.estudar)}</div>` : ''}
      </div>
    </div>
  `).join('');
}
function toggleCronoFeito(id) { const c = cronograma.find(x => x.id === id); c.feito = !c.feito; save('diplo_cronograma', cronograma); renderCronograma(); refreshStats(); }

const MESES_NOMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SEMANA_NOMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const CRONO_CAL_MAX_PILLS = 3;

function renderCalendarStructure() {
  const calView = document.getElementById('calendarView'); if (!calView) return;
  const agora = new Date(); const ano = calState.year; const mes = calState.month;
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); const totalDiasMes = new Date(ano, mes + 1, 0).getDate();

  let html = `<div class="crono-cal-header">
    <button type="button" class="cal-nav-btn" onclick="cronoCalPrev()" aria-label="Mês anterior">‹</button>
    <span class="cal-month-label">${MESES_NOMES[mes]} de ${ano}</span>
    <button type="button" class="cal-nav-btn" onclick="cronoCalNext()" aria-label="Próximo mês">›</button>
    <button type="button" class="cal-today-btn" onclick="cronoCalToday()">Hoje</button>
  </div>`;
  ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].forEach(da => { html += `<div class="cal-weekday">${da}</div>`; });
  for (let i = 0; i < primeiroDiaSemana; i++) html += `<div class="cal-day empty-cell"></div>`;

  const eventosPorDia = {};
  cronograma.forEach(c => {
    const d = parseBR(c.data); if (d && d.getFullYear() === ano && d.getMonth() === mes) {
      (eventosPorDia[d.getDate()] = eventosPorDia[d.getDate()] || []).push(c);
    }
  });

  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const classeHoje = (agora.getFullYear() === ano && agora.getMonth() === mes && agora.getDate() === dia) ? 'today' : '';
    const itens = eventosPorDia[dia] || [];
    const pillsHtml = itens.slice(0, CRONO_CAL_MAX_PILLS).map(c => `
      <div class="cal-event-pill ${c.feito ? 'feito' : ''}" style="background:${getMateriaColor(c.materia)}" title="${escHtml(c.materia)} — ${escHtml(c.tema)}" onclick="event.stopPropagation(); openCronoEditModal('${c.id}')">${escHtml(c.materia)}</div>
    `).join('');
    const moreHtml = itens.length > CRONO_CAL_MAX_PILLS ? `<div class="cal-event-more" onclick="event.stopPropagation(); openCronoDayModal(${ano},${mes},${dia})">+${itens.length - CRONO_CAL_MAX_PILLS} mais</div>` : '';
    html += `<div class="cal-day ${classeHoje}" onclick="openCronoDayModal(${ano},${mes},${dia})">
      <div class="cal-day-num">${dia}</div>
      <div class="cal-day-events">${pillsHtml}${moreHtml}</div>
    </div>`;
  }
  calView.innerHTML = html;
}
function cronoCalPrev() { calState.month--; if (calState.month < 0) { calState.month = 11; calState.year--; } renderCalendarStructure(); }
function cronoCalNext() { calState.month++; if (calState.month > 11) { calState.month = 0; calState.year++; } renderCalendarStructure(); }
function cronoCalToday() { const n = new Date(); calState.year = n.getFullYear(); calState.month = n.getMonth(); renderCalendarStructure(); }

/* Modal "conteúdo do dia": abre ao clicar em qualquer ponto vazio de um dia
   do calendário. Mostra os itens já agendados (coloridos por matéria, com
   clique abrindo o conteúdo completo) e um formulário rápido para escolher
   uma matéria e deixar um novo item marcado naquele dia. */
function openCronoDayModal(ano, mes, dia) {
  cronoDayModalDate = new Date(ano, mes, dia);
  renderCronoDayModal();
  document.getElementById('cronoDayModal').classList.add('show');
}
function closeCronoDayModal(e) { if (e && !e.target.classList.contains('modal-overlay')) return; closeCronoDayModalDirect(); }
function closeCronoDayModalDirect() { document.getElementById('cronoDayModal').classList.remove('show'); cronoDayModalDate = null; }

function renderCronoDayModal() {
  if (!cronoDayModalDate) return;
  document.getElementById('cronoDayModalTitle').textContent = `${DIAS_SEMANA_NOMES[cronoDayModalDate.getDay()]}, ${cronoDayModalDate.getDate()} de ${MESES_NOMES[cronoDayModalDate.getMonth()]}`;

  const itens = cronograma.filter(c => { const d = parseBR(c.data); return d && isMesmoDia(d, cronoDayModalDate); });
  const listEl = document.getElementById('cronoDayModalList');
  listEl.innerHTML = itens.length ? itens.map(c => `
    <div class="day-modal-item ${c.feito ? 'feito' : ''}" onclick="closeCronoDayModalDirect(); openCronoEditModal('${c.id}')">
      <span class="day-modal-dot" style="background:${getMateriaColor(c.materia)}"></span>
      <div class="day-modal-item-body">
        <div class="day-modal-item-materia">${escHtml(c.materia)}</div>
        <div class="day-modal-item-tema">${escHtml(c.tema)}</div>
      </div>
    </div>
  `).join('') : `<div class="empty" style="padding:6px 0 14px; color:var(--text-muted); font-size:13px;">Nenhum item ainda neste dia.</div>`;

  const sel = document.getElementById('cronoDayModalMateria');
  sel.innerHTML = materias.map(m => `<option value="${escHtml(m.nome)}">${escHtml(m.nome)}</option>`).join('');
  updateCronoDayModalSwatch();
  document.getElementById('cronoDayModalTema').value = '';
}
function updateCronoDayModalSwatch() {
  const sel = document.getElementById('cronoDayModalMateria'); const sw = document.getElementById('cronoDayModalMateriaSwatch');
  if (sel && sw) sw.style.background = getMateriaColor(sel.value);
}
function addCronoFromDayModal() {
  const temaInput = document.getElementById('cronoDayModalTema');
  const tema = temaInput.value.trim();
  if (!tema || !cronoDayModalDate) return;
  const materia = document.getElementById('cronoDayModalMateria').value;
  cronograma.push({ id: uid(), tema, estudar: '', semana: '—', tempo: '—', data: fmtDataBR(cronoDayModalDate), materia, feito: false });
  save('diplo_cronograma', cronograma);
  temaInput.value = '';
  renderCronoDayModal(); renderCalendarStructure(); renderCronograma(); refreshStats();
}
function setCronoView(mode) {
  cronoViewMode = mode;
  document.getElementById('calendarioWrap').style.display = (mode === 'calendario') ? 'block' : 'none';
  document.getElementById('cronoViewDiaBtn').classList.toggle('active', mode === 'dia');
  document.getElementById('cronoViewMateriaBtn').classList.toggle('active', mode === 'materia');
  document.getElementById('cronoViewCalBtn').classList.toggle('active', mode === 'calendario');
  if (mode === 'calendario') renderCalendarStructure();
  renderCronograma();
}
function setCronoStatusFiltro(status) {
  cronoStatusFiltro = status;
  document.getElementById('cronoStatusTodasBtn').classList.toggle('active', status === 'todas');
  document.getElementById('cronoStatusPendentesBtn').classList.toggle('active', status === 'pendentes');
  document.getElementById('cronoStatusAtrasadosBtn').classList.toggle('active', status === 'atrasados');
  document.getElementById('cronoStatusConcluidosBtn').classList.toggle('active', status === 'concluidos');
  renderCronograma();
}
function setCronoFiltroMateria(n) { renderCronograma(); }

function limparCronogramaTudo() {
  if (!cronograma.length) { alert('O cronograma já está vazio.'); return; }
  if (!confirm(`Isso vai excluir permanentemente todos os ${cronograma.length} itens do cronograma. Essa ação não pode ser desfeita. Confirma?`)) return;
  cronograma = [];
  save('diplo_cronograma', cronograma);
  calendarFilterDate = null;
  renderCronograma();
  if (cronoViewMode === 'calendario') renderCalendarStructure();
  refreshStats();
}

function addCronograma() {
  const tema = document.getElementById('cTema').value.trim();
  const estudar = document.getElementById('cEstudar').value.trim();
  const materia = document.getElementById('cMateria').value;
  const semana = document.getElementById('cSemana').value.trim() || '—';
  const dataRaw = document.getElementById('cData').value; const data = dataRaw ? isoToBR(dataRaw) : '—';
  const tempo = document.getElementById('cTempo').value.trim() || '—';
  if (!tema) return;
  cronograma.push({ id: uid(), tema, estudar, semana, tempo, data, materia, feito: false });
  save('diplo_cronograma', cronograma);
  ['cTema', 'cEstudar', 'cSemana', 'cData', 'cTempo'].forEach(id => document.getElementById(id).value = '');
  renderCronograma(); refreshStats();
}
