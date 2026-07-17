/* ==========================================================================
   revisao.js — módulo "Diplomacia → Cronograma → Revisão espaçada"
   (lista manual de revisão em D+1/D+7/D+30, distinta do SRS da Biblioteca).
   ========================================================================== */

const REVISAO_KEY = 'diplo_revisao';
let revisao = load(REVISAO_KEY, []);

function ensureRevisaoForTopico(m, t) {
  if (revisao.find(r => r.topicoId === t.id)) return;
  revisao.unshift({ id: uid(), tema: t.nome, materia: m.nome, topicoId: t.id, dataEstudo: t.dataEstudo || todayISO(), r1: false, r2: false, r3: false });
  save(REVISAO_KEY, revisao);
}
function addRevisao() {
  const tema = document.getElementById('rTema').value.trim();
  const materia = document.getElementById('rMateria').value;
  const dataRaw = document.getElementById('rData').value;
  if (!tema) { alert('Dê um nome ao tema.'); return; }
  revisao.push({ id: uid(), tema, materia, topicoId: null, dataEstudo: dataRaw || null, r1: false, r2: false, r3: false });
  save(REVISAO_KEY, revisao);
  document.getElementById('rTema').value = ''; document.getElementById('rData').value = '';
  renderRevisao();
}
function toggleRevisaoCheck(id, campo) { const r = revisao.find(x => x.id === id); r[campo] = !r[campo]; save(REVISAO_KEY, revisao); renderRevisao(); }
function delRevisao(id) { if (!confirm('Remover revisão?')) return; revisao = revisao.filter(x => x.id !== id); save(REVISAO_KEY, revisao); renderRevisao(); }
function renderRevisao() {
  const el = document.getElementById('revisaoList'); if (!el) return;
  el.innerHTML = revisao.length ? revisao.map(r => {
    const d1 = r.dataEstudo ? isoToBR(addDaysISO(r.dataEstudo, 1)) : '—';
    const d2 = r.dataEstudo ? isoToBR(addDaysISO(r.dataEstudo, 7)) : '—';
    const d3 = r.dataEstudo ? isoToBR(addDaysISO(r.dataEstudo, 30)) : '—';
    return `<div class="card revisao"><div><div class="rname">${r.tema}</div><div class="rmeta">${r.materia}</div></div><div class="rchecks"><div><input type="checkbox" ${r.r1 ? 'checked' : ''} onchange="toggleRevisaoCheck('${r.id}','r1')">${d1}</div><div><input type="checkbox" ${r.r2 ? 'checked' : ''} onchange="toggleRevisaoCheck('${r.id}','r2')">${d2}</div><div><input type="checkbox" ${r.r3 ? 'checked' : ''} onchange="toggleRevisaoCheck('${r.id}','r3')">${d3}</div></div><button class="rdel" onclick="delRevisao('${r.id}')">Remover</button></div>`;
  }).join('') : '<div class="empty">Nenhuma revisão espaçada ativa.</div>';
}
