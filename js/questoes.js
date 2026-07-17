/* ==========================================================================
   questoes.js — módulo "Diplomacia → Questões" (banco de questões
   Certo/Errado e Discursivas, com filtro por matéria/tópico).
   ========================================================================== */

let questoes = load('diplo_questoes', []);
let draftItens = [];

function renderQTopicoOptions() {
  const m = materias.find(x => x.nome === document.getElementById('qMateria').value);
  const sel = document.getElementById('qTopico');
  if (sel) sel.innerHTML = '<option value="">— nenhum —</option>' + (m ? m.topicos.map(t => `<option value="${t.id}">${t.nome}</option>`).join('') : '');
}
function setFiltroMateria(n) { renderQuestoes(); }
function addItemField() {
  draftItens.push({ id: uid(), texto: '', gabarito: '' });
  const w = document.getElementById('qItensWrap');
  if (w) w.innerHTML = draftItens.map((i, idx) => `<div style="margin-top:6px;"><label class="field-label">Item ${idx + 1}</label><textarea oninput="draftItens[${idx}].texto=this.value"></textarea></div>`).join('');
}
function addQuestao() {}
function onQTipoChange() {}
function toggleRevisada(id) { const q = questoes.find(x => x.id === id); q.revisada = !q.revisada; save('diplo_questoes', questoes); renderQuestoes(); }
function delQuestao(id) { questoes = questoes.filter(x => x.id !== id); save('diplo_questoes', questoes); renderQuestoes(); }
function renderQuestoes() { const el = document.getElementById('questoesList'); if (el) el.innerHTML = '<div class="empty">Nenhuma questão filtrada.</div>'; }
