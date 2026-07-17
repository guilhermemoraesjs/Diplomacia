/* ==========================================================================
   biblioteca-busca.js — módulo "Biblioteca → Busca": pesquisa por título,
   autor, tag ou conteúdo entre os documentos arquivados.
   ========================================================================== */

function renderBiblioSearch() {
  const qEl = document.getElementById('biblioSearch'); if (!qEl) return;
  const q = qEl.value.trim().toLowerCase();
  const el = document.getElementById('biblioSearchResults');
  const layout = document.getElementById('biblioMainLayout');
  if (!q) { el.innerHTML = ''; layout.style.display = 'grid'; return; }
  layout.style.display = 'none';
  const results = biblioDocs.filter(d => {
    return (d.titulo || '').toLowerCase().includes(q) ||
      (d.autor || '').toLowerCase().includes(q) ||
      (d.tags || []).some(t => t.toLowerCase().includes(q)) ||
      stripHtml(d.conteudo).toLowerCase().includes(q) ||
      (d.observacoes || '').toLowerCase().includes(q);
  });
  el.innerHTML = `<h3 class="section-title" style="margin-top:6px;">${results.length} resultado(s) para "${qEl.value.trim()}"</h3>` +
    (results.length ? `<div class="biblio-doc-list">${results.map(d => `
      <div class="card biblio-doc-card" onclick="document.getElementById('biblioSearch').value=''; renderBiblioSearch(); abrirDocumento('${d.id}');">
        <div class="bd-icon">${d.tipo || '📄'}</div>
        <div class="bd-body"><div class="bd-title">${d.titulo}</div><div class="bd-meta">${pastaNome(d.pastaId)}</div></div>
      </div>`).join('')}</div>` : '<div class="biblio-empty">Nada encontrado.</div>');
}
