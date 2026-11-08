/* ==========================================================================
   estudo-log.js — registro do TEMPO EFETIVAMENTE ESTUDADO e cronômetro de
   estudo global. Fonte única do "tempo real" usada pela Central de Estudos,
   Cronograma e relatórios.

   diplo_estudo_log: [{ id, data:'YYYY-MM-DD', materia, minutos, origem:
     'cronograma'|'cronometro'|'manual'|'discursiva', refId?, criadoEm }]
   O cronômetro (chancelaria_timer) fica só no aparelho e sobrevive a
   recarregamentos e atualizações do app.
   Também concentra as preferências do usuário (chancelaria_prefs).
   ========================================================================== */
const PREFS_PADRAO = { metaDiariaMin: 120, metaQuestoesDia: 15, srsModo: 'adaptativo', srsRetencao: 0.9, srsMaxIntervalo: 365, charsPorLinha: 75 };
function prefs() { return Object.assign({}, PREFS_PADRAO, load('chancelaria_prefs', {}) || {}); }
function setPref(chave, valor) { const p = load('chancelaria_prefs', {}) || {}; p[chave] = valor; save('chancelaria_prefs', p); }

let estudoLog = load('diplo_estudo_log', []);
function recarregarEstudoLog() { estudoLog = load('diplo_estudo_log', []); }

function registrarEstudo(o) {
  const min = Math.round(+o.minutos || 0); if (min < 1) return null;
  if (o.refId) estudoLog = estudoLog.filter(e => !(e.origem === o.origem && e.refId === o.refId));   // um registro por item (reedição substitui)
  const e = { id: uid(), data: o.data || todayISO(), materia: o.materia || '', minutos: min, origem: o.origem || 'manual', refId: o.refId || null, criadoEm: Date.now() };
  estudoLog.push(e); save('diplo_estudo_log', estudoLog);
  if (typeof trackStudyDay === 'function') trackStudyDay();
  return e;
}
function removerEstudoPorRef(origem, refId) { const n = estudoLog.length; estudoLog = estudoLog.filter(e => !(e.origem === origem && e.refId === refId)); if (estudoLog.length !== n) save('diplo_estudo_log', estudoLog); }
function minutosEntre(isoIni, isoFim, materia) { return estudoLog.filter(e => e.data >= isoIni && e.data <= isoFim && (!materia || e.materia === materia)).reduce((a, e) => a + e.minutos, 0); }
function minutosNoDia(iso) { return minutosEntre(iso, iso); }
function inicioDaSemana(iso) { const d = parseISOLocal(iso || todayISO()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymdLocal(d); }   // segunda-feira
function minutosPorMateria(isoIni, isoFim) { const m = {}; estudoLog.forEach(e => { if (e.data >= isoIni && e.data <= isoFim) m[e.materia || '—'] = (m[e.materia || '—'] || 0) + e.minutos; }); return m; }
function serieDiaria(dias) { const r = []; for (let i = dias - 1; i >= 0; i--) { const iso = addDaysISO(todayISO(), -i); r.push({ iso, min: minutosNoDia(iso) }); } return r; }

/* ---------- Cronômetro global ---------- */
function timerLer() { try { return JSON.parse(localStorage.getItem('chancelaria_timer')); } catch (e) { return null; } }
function timerGravar(t) { if (t) localStorage.setItem('chancelaria_timer', JSON.stringify(t)); else localStorage.removeItem('chancelaria_timer'); renderTimerPill(); }
function timerDecorridoMs(t) { return t ? (t.acumuladoMs || 0) + (t.rodando ? Date.now() - t.inicio : 0) : 0; }
function estudoTimerIniciar(o) {
  const atual = timerLer();
  if (atual) { toast('Já existe um cronômetro de estudo em andamento.', 'aviso'); abrirTimerModal(); return; }
  timerGravar({ rodando: true, inicio: Date.now(), acumuladoMs: 0, materia: (o && o.materia) || '', cronoId: (o && o.cronoId) || null, titulo: (o && o.titulo) || 'Sessão de estudo' });
  toast('Cronômetro iniciado. Ele continua mesmo se você recarregar ou atualizar o app.');
}
function timerPausarRetomar() { const t = timerLer(); if (!t) return; if (t.rodando) { t.acumuladoMs = timerDecorridoMs(t); t.rodando = false; } else { t.inicio = Date.now(); t.rodando = true; } timerGravar(t); abrirTimerModal(); }
async function timerDescartar() { if (!await confirmar('Descartar esta sessão sem registrar o tempo?', { titulo: 'Descartar cronômetro', ok: 'Descartar' })) return; timerGravar(null); fecharTimerModal(); }
function timerFinalizar() {
  const t = timerLer(); if (!t) return;
  const min = Math.round(timerDecorridoMs(t) / 60000);
  const materia = (document.getElementById('timerMateria') || {}).value || t.materia || '';
  timerGravar(null); fecharTimerModal();
  if (min < 1) { toast('Sessão muito curta (menos de 1 minuto): nada foi registrado.', 'aviso'); return; }
  if (t.cronoId && typeof cronoAddTempoReal === 'function') cronoAddTempoReal(t.cronoId, min);
  else registrarEstudo({ materia, minutos: min, origem: 'cronometro' });
  toast(`${fmtMin(min)} de estudo registrados${materia ? ' em ' + materia : ''}.`);
  if (typeof refreshStats === 'function') refreshStats();
}
function fmtHMS(ms) { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? String(h).padStart(2, '0') + ':' : '') + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function renderTimerPill() {
  let el = document.getElementById('timerPill'); const t = timerLer();
  if (!t) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('button'); el.id = 'timerPill'; el.className = 'timer-pill'; el.onclick = abrirTimerModal; const tb = document.querySelector('.topbar-spacer'); if (tb) tb.after(el); else document.body.appendChild(el); }
  el.innerHTML = `${icon(t.rodando ? 'clock' : 'pause', 16)}<span class="mono">${fmtHMS(timerDecorridoMs(t))}</span>`;
  el.classList.toggle('pausado', !t.rodando); el.setAttribute('aria-label', 'Cronômetro de estudo: ' + fmtHMS(timerDecorridoMs(t)));
}
function abrirTimerModal() {
  const t = timerLer(); if (!t) return; fecharTimerModal();
  const ov = document.createElement('div'); ov.className = 'modal-overlay show'; ov.id = 'timerModal';
  ov.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="Cronômetro de estudo"><h3>${escHtml(t.titulo)}</h3>
    <div class="timer-big mono" id="timerBig">${fmtHMS(timerDecorridoMs(t))}</div>
    <label class="field-label">Matéria</label><select id="timerMateria">${materias.map(m => `<option ${m.nome === t.materia ? 'selected' : ''}>${escHtml(m.nome)}</option>`).join('')}<option value="" ${!t.materia ? 'selected' : ''}>Sem matéria</option></select>
    <div class="modal-actions" style="flex-wrap:wrap;"><button class="btn danger small" onclick="timerDescartar()">Descartar</button><button class="btn secondary small" onclick="fecharTimerModal()">Minimizar</button><button class="btn ghost small" onclick="timerPausarRetomar()">${t.rodando ? 'Pausar' : 'Continuar'}</button><button class="btn small" onclick="timerFinalizar()">Finalizar e registrar</button></div></div>`;
  ov.addEventListener('click', e => { if (e.target === ov) fecharTimerModal(); });
  document.body.appendChild(ov);
}
function fecharTimerModal() { const m = document.getElementById('timerModal'); if (m) m.remove(); }
setInterval(() => { const t = timerLer(); if (!t) return; renderTimerPill(); const b = document.getElementById('timerBig'); if (b) b.textContent = fmtHMS(timerDecorridoMs(t)); }, 1000);
window.addEventListener('DOMContentLoaded', renderTimerPill);

function removerEstudoPorPrefixo(origem, prefixo) { const n = estudoLog.length; estudoLog = estudoLog.filter(e => !(e.origem === origem && e.refId && e.refId.startsWith(prefixo))); if (estudoLog.length !== n) save('diplo_estudo_log', estudoLog); }
