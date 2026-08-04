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
/* Preenche as 3 datas de revisão sugeridas (D+1/D+7/D+30) a partir da data
   de estudo, mas o usuário pode sobrescrever cada uma antes de adicionar. */
function sugerirDatasRevisao() {
  const dataRaw = document.getElementById('rData').value; if (!dataRaw) return;
  document.getElementById('r1Data').value = addDaysISO(dataRaw, 1);
  document.getElementById('r2Data').value = addDaysISO(dataRaw, 7);
  document.getElementById('r3Data').value = addDaysISO(dataRaw, 30);
}

function addRevisao() {
  const tema = document.getElementById('rTema').value.trim();
  const materia = document.getElementById('rMateria').value;
  const dataRaw = document.getElementById('rData').value;
  const r1Data = document.getElementById('r1Data').value || null;
  const r2Data = document.getElementById('r2Data').value || null;
  const r3Data = document.getElementById('r3Data').value || null;
  if (!tema) { alert('Dê um nome ao tema.'); return; }
  revisao.push({
    id: uid(), tema, materia, topicoId: null, dataEstudo: dataRaw || null,
    r1: false, r2: false, r3: false,
    r1Data, r2Data, r3Data
  });
  save(REVISAO_KEY, revisao);
  ['rTema', 'rData', 'r1Data', 'r2Data', 'r3Data'].forEach(id => document.getElementById(id).value = '');
  renderRevisao();
}
function toggleRevisaoCheck(id, campo) { const r = revisao.find(x => x.id === id); r[campo] = !r[campo]; save(REVISAO_KEY, revisao); renderRevisao(); }
function delRevisao(id) { if (!confirm('Remover revisão?')) return; revisao = revisao.filter(x => x.id !== id); save(REVISAO_KEY, revisao); renderRevisao(); }
function limparRevisaoTudo() {
  if (!revisao.length) { alert('A revisão espaçada já está vazia.'); return; }
  if (!confirm(`Isso vai excluir permanentemente todos os ${revisao.length} itens de revisão espaçada. Essa ação não pode ser desfeita. Confirma?`)) return;
  revisao = [];
  save(REVISAO_KEY, revisao);
  renderRevisao();
}
function renderRevisao() {
  const el = document.getElementById('revisaoList'); if (!el) return;
  el.innerHTML = revisao.length ? revisao.map(r => {
    const iso1 = r.r1Data || (r.dataEstudo ? addDaysISO(r.dataEstudo, 1) : null);
    const iso2 = r.r2Data || (r.dataEstudo ? addDaysISO(r.dataEstudo, 7) : null);
    const iso3 = r.r3Data || (r.dataEstudo ? addDaysISO(r.dataEstudo, 30) : null);
    const d1 = iso1 ? isoToBR(iso1) : '—';
    const d2 = iso2 ? isoToBR(iso2) : '—';
    const d3 = iso3 ? isoToBR(iso3) : '—';
    return `<div class="card revisao"><div><div class="rname">${r.tema}</div><div class="rmeta">${r.materia}</div></div><div class="rchecks"><div><input type="checkbox" ${r.r1 ? 'checked' : ''} onchange="toggleRevisaoCheck('${r.id}','r1')">${d1}</div><div><input type="checkbox" ${r.r2 ? 'checked' : ''} onchange="toggleRevisaoCheck('${r.id}','r2')">${d2}</div><div><input type="checkbox" ${r.r3 ? 'checked' : ''} onchange="toggleRevisaoCheck('${r.id}','r3')">${d3}</div></div><button class="rdel" onclick="delRevisao('${r.id}')">Remover</button></div>`;
  }).join('') : '<div class="empty">Nenhuma revisão espaçada ativa.</div>';
}
