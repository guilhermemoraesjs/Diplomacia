/* ==========================================================================
   atualidades.js — módulo "Diplomacia → Atualidades" (recortes de temas
   correntes relevantes para a prova).
   ========================================================================== */

let atualidades = load('diplo_atualidades', []);

function addAtualidade() {
  const tit = document.getElementById('aTitulo').value; if (!tit) return;
  atualidades.unshift({ id: uid(), titulo: tit, resumo: document.getElementById('aResumo').value, criadoEm: Date.now() });
  save('diplo_atualidades', atualidades);
  renderAtualidades();
}
function renderAtualidades() {
  const el = document.getElementById('atualidadesList');
  if (el) el.innerHTML = atualidades.map(a => `<div class="card"><h4>${a.titulo}</h4><p>${a.resumo}</p></div>`).join('');
}
