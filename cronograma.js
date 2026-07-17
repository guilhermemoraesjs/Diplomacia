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
let calendarFilterDate = null;

function isAtrasado(c) { const d = parseBR(c.data); return d && d < new Date().setHours(0, 0, 0, 0) && !c.feito; }
function fmtTempo(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

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

  // Filtro por dia selecionado no calendário
  if (cronoViewMode === 'calendario' && calendarFilterDate) {
    list = list.filter(c => { const d = parseBR(c.data); return d && isMesmoDia(d, calendarFilterDate); });
  }

  const el = document.getElementById('cronogramaList'); if (!el) return;

  if (!list.length) {
    el.innerHTML = '<div class="empty" style="padding:12px 0; color:var(--text-muted);">Nenhum item encontrado para este filtro.</div>';
    return;
  }

  el.innerHTML = list.map(c => `
    <div class="card crono ${c.feito ? 'feito' : ''} ${isAtrasado(c) ? 'atrasado' : ''}" onclick="openCronoEditModal('${c.id}')">
      <input type="checkbox" ${c.feito ? 'checked' : ''} onchange="event.stopPropagation(); toggleCronoFeito('${c.id}')">
      <div class="cbody">
        <div class="ch"><span>${c.materia} · ${c.semana}</span><span>${c.data}</span></div>
        <div class="ct">${c.tema}</div>
        ${c.estudar ? `<div class="ce">${c.estudar}</div>` : ''}
      </div>
    </div>
  `).join('');
}
function toggleCronoFeito(id) { const c = cronograma.find(x => x.id === id); c.feito = !c.feito; save('diplo_cronograma', cronograma); renderCronograma(); refreshStats(); }

function renderCalendarStructure() {
  const calView = document.getElementById('calendarView'); if (!calView) return;
  const agora = new Date(); const ano = agora.getFullYear(); const mes = agora.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
  const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  let html = `<div style="grid-column: 1/-1; text-align: center; font-weight:600; margin-bottom:10px; color:var(--brass-light);">${mesesNomes[mes]} de ${ano}</div>`;
  ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].forEach(da => { html += `<div class="cal-weekday">${da}</div>`; });
  for (let i = 0; i < primeiroDiaSemana; i++) html += `<div class="cal-day empty-cell"></div>`;

  const eventosPorDia = {};
  cronograma.forEach(c => {
    const d = parseBR(c.data); if (d && d.getFullYear() === ano && d.getMonth() === mes) {
      const diaNum = d.getDate(); eventosPorDia[diaNum] = (eventosPorDia[diaNum] || 0) + 1;
    }
  });

  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const classeHoje = (agora.getDate() === dia) ? 'today' : '';
    const temEvento = eventosPorDia[dia] ? `<div class="cal-day-dot"></div>` : '';
    let classeFiltroAtivo = (calendarFilterDate && calendarFilterDate.getMonth() === mes && calendarFilterDate.getFullYear() === ano && calendarFilterDate.getDate() === dia) ? 'active-filter' : '';
    html += `<div class="cal-day ${classeHoje} ${classeFiltroAtivo}" onclick="selectCalendarDate(${dia})"><span class="cal-day-num">${dia}</span>${temEvento}</div>`;
  }
  calView.innerHTML = html;
}
function selectCalendarDate(dia) {
  const agora = new Date(); const selecionada = new Date(agora.getFullYear(), agora.getMonth(), dia);
  calendarFilterDate = (calendarFilterDate && isMesmoDia(calendarFilterDate, selecionada)) ? null : selecionada;
  renderCalendarStructure(); renderCronograma();
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
