/* ==========================================================================
   notas.js — módulo "Diplomacia → Anotações" (notas livres de estudo).
   ========================================================================== */

let notas = load('diplo_notas', []);

function addNota() {
  const tit = document.getElementById('nTitulo').value; if (!tit) return;
  notas.unshift({ id: uid(), titulo: tit, texto: document.getElementById('nTexto').value, criadoEm: Date.now() });
  save('diplo_notas', notas);
  renderNotas();
}
function renderNotas() {
  const el = document.getElementById('notasList');
  if (el) el.innerHTML = notas.map(n => `<div class="card"><h4>${n.titulo}</h4><p>${n.texto}</p></div>`).join('');
}
