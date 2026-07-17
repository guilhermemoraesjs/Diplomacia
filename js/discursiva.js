/* ==========================================================================
   discursiva.js — módulo "Diplomacia → Discursiva": exercícios de redação,
   versão, tradução e resumo, com cronômetro de prática.
   ========================================================================== */

let discursivas = load('diplo_discursivas', []);

let cronoInterval = null;
let cronoState = { running: false, elapsedMs: 0 };
function cronoStart() {
  if (cronoState.running) return;
  cronoState.running = true;
  const start = Date.now() - cronoState.elapsedMs;
  cronoInterval = setInterval(() => {
    const ms = Date.now() - start;
    cronoState.elapsedMs = ms;
    document.getElementById('cronoDisplay').textContent = fmtTempo(Math.floor(ms / 1000));
  }, 500);
}
function cronoPause() { cronoState.running = false; clearInterval(cronoInterval); }
function cronoReset() { cronoState.running = false; cronoState.elapsedMs = 0; clearInterval(cronoInterval); document.getElementById('cronoDisplay').textContent = "00:00"; }

function addDiscursiva() {
  const m = document.getElementById('dMateria').value;
  const t = document.getElementById('dTema').value;
  if (!t) return;
  discursivas.unshift({ id: uid(), materia: m, tema: t, linhas: document.getElementById('dLinhas').value, tempoSeg: 0, historyTempos: [] });
  save('diplo_discursivas', discursivas);
  renderDiscursivas();
}
function renderDiscursivas() {
  const el = document.getElementById('discursivasList');
  if (el) el.innerHTML = discursivas.map(d => `<div class="card"><h4>${d.materia}</h4><p>${d.tema}</p></div>`).join('');
}
