/* ==========================================================================
   biblioteca-pastas.js — módulo "Biblioteca → Estantes": árvore de pastas,
   geração automática de estantes a partir de Diplomacia → Matérias, e
   reordenação por arrastar-e-soltar.
   ========================================================================== */

function biblioPastasDefault() {
  // As estantes agora vêm automaticamente de Diplomacia → Matérias (ver autoPastasFromMaterias).
  // Este array guarda apenas estantes/subpastas extras criadas manualmente pelo usuário.
  return [];
}
let biblioPastas = load('biblio_pastas', null) || biblioPastasDefault();

/* Gera a árvore de pastas em tempo real a partir de Diplomacia → Matérias
   (matéria = estante, tópico/subtópico/subsubtópico = subpastas aninhadas). */
function autoPastasFromMaterias() {
  const list = [];
  materias.forEach(m => {
    const mId = 'auto_m_' + m.id;
    list.push({ id: mId, nome: m.nome, parentId: null, auto: true });
    (m.topicos || []).forEach(t => {
      const tId = 'auto_t_' + t.id;
      list.push({ id: tId, nome: t.nome, parentId: mId, auto: true });
      (t.subtopicos || []).forEach(s => {
        const sId = 'auto_s_' + s.id;
        list.push({ id: sId, nome: s.nome, parentId: tId, auto: true });
        (s.subsubtopicos || []).forEach(ss => {
          list.push({ id: 'auto_ss_' + ss.id, nome: ss.nome, parentId: sId, auto: true });
        });
      });
    });
  });
  return list;
}
function getAllPastas() { return [...autoPastasFromMaterias(), ...biblioPastas]; }

function pastaNome(id) {
  const p = getAllPastas().find(x => x.id === id);
  if (!p) return '— sem pasta —';
  return /^\p{Extended_Pictographic}/u.test(p.nome) ? p.nome.replace(/^\S+\s/, '') : p.nome;
}

let biblioExpandedFolders = new Set(load('biblio_expanded_folders', []));
function toggleFolderExpand(id) {
  if (biblioExpandedFolders.has(id)) biblioExpandedFolders.delete(id); else biblioExpandedFolders.add(id);
  save('biblio_expanded_folders', [...biblioExpandedFolders]);
  renderBiblioTree();
}

function renderBiblioTree() {
  const el = document.getElementById('biblioTree'); if (!el) return;
  const all = getAllPastas();
  const roots = all.filter(p => !p.parentId);
  function nodeHtml(p) {
    const children = all.filter(c => c.parentId === p.id);
    const hasChildren = children.length > 0;
    const expanded = biblioExpandedFolders.has(p.id);
    const count = biblioDocs.filter(d => d.pastaId === p.id).length;
    const delBtn = p.auto
      ? `<button class="bn-del" title="Vem de Diplomacia → Matérias" onclick="event.stopPropagation(); alert('Esta estante vem da aba Diplomacia → Matérias. Para renomear ou remover, edite por lá.');">🔒</button>`
      : `<button class="bn-del" onclick="event.stopPropagation(); delPastaBiblio('${p.id}')">✕</button>`;
    const toggleBtn = hasChildren
      ? `<button type="button" class="bn-toggle ${expanded ? 'open' : ''}" onclick="event.stopPropagation(); toggleFolderExpand('${p.id}')">▶</button>`
      : `<span class="bn-toggle-spacer"></span>`;
    return `<li>
      <div class="biblio-node ${biblioCurrentPasta === p.id ? 'active' : ''}" draggable="true"
           ondragstart="folderDragStart(event,'${p.id}')" ondragover="folderDragOver(event,'${p.id}')"
           ondragleave="folderDragLeave(event)" ondrop="folderDrop(event,'${p.id}')" ondragend="folderDragEnd(event)"
           onclick="selecionarPasta('${p.id}')">
        ${toggleBtn}
        <span class="bn-name">${p.nome}</span>
        <span class="bn-count">${count}</span>
        ${delBtn}
      </div>
      ${hasChildren && expanded ? `<ul>${children.map(nodeHtml).join('')}</ul>` : ''}
    </li>`;
  }
  el.innerHTML = `<li><div class="biblio-node ${biblioCurrentPasta === null ? 'active' : ''}" onclick="selecionarPasta(null)"><span class="bn-toggle-spacer"></span><span class="bn-name">📚 Todas as estantes</span><span class="bn-count">${biblioDocs.length}</span></div></li>` + roots.map(nodeHtml).join('');
}

/* ---- Arrastar para reordenar estantes/subpastas ---- */
let dragFolderId = null;
function folderDragStart(ev, id) {
  dragFolderId = id;
  ev.dataTransfer.effectAllowed = 'move';
  try { ev.dataTransfer.setData('text/plain', id); } catch (e) {}
  ev.currentTarget.classList.add('dragging');
}
function folderDragOver(ev, id) {
  if (!dragFolderId || dragFolderId === id) return;
  ev.preventDefault();
  const rect = ev.currentTarget.getBoundingClientRect();
  const before = (ev.clientY - rect.top) < rect.height / 2;
  ev.currentTarget.classList.toggle('drag-over-before', before);
  ev.currentTarget.classList.toggle('drag-over-after', !before);
}
function folderDragLeave(ev) {
  ev.currentTarget.classList.remove('drag-over-before', 'drag-over-after');
}
function folderDrop(ev, targetId) {
  ev.preventDefault();
  ev.currentTarget.classList.remove('drag-over-before', 'drag-over-after');
  if (!dragFolderId || dragFolderId === targetId) return;
  const rect = ev.currentTarget.getBoundingClientRect();
  const position = (ev.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
  handleFolderDrop(dragFolderId, targetId, position);
  dragFolderId = null;
}
function folderDragEnd(ev) {
  ev.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drag-over-before,.drag-over-after').forEach(el => el.classList.remove('drag-over-before', 'drag-over-after'));
  dragFolderId = null;
}
function moveItemBeforeAfter(arr, dragId, targetId, position) {
  const idx = arr.findIndex(x => x.id === dragId); if (idx === -1) return false;
  const [item] = arr.splice(idx, 1);
  let targetIdx = arr.findIndex(x => x.id === targetId);
  if (targetIdx === -1) { arr.push(item); return true; }
  if (position === 'after') targetIdx++;
  arr.splice(targetIdx, 0, item);
  return true;
}
function getAutoArrayFor(autoId) {
  if (autoId.startsWith('auto_m_')) return materias;
  if (autoId.startsWith('auto_t_')) {
    const topicoId = autoId.replace('auto_t_', '');
    for (const m of materias) { if (m.topicos.some(t => t.id === topicoId)) return m.topicos; }
  }
  if (autoId.startsWith('auto_s_')) {
    const subId = autoId.replace('auto_s_', '');
    for (const m of materias) for (const t of m.topicos) { if ((t.subtopicos || []).some(s => s.id === subId)) return t.subtopicos; }
  }
  if (autoId.startsWith('auto_ss_')) {
    const ssId = autoId.replace('auto_ss_', '');
    for (const m of materias) for (const t of m.topicos) for (const s of (t.subtopicos || [])) { if ((s.subsubtopicos || []).some(ss => ss.id === ssId)) return s.subsubtopicos; }
  }
  return null;
}
function handleFolderDrop(dragId, targetId, position) {
  const dragIsAuto = dragId.startsWith('auto_');
  const targetIsAuto = targetId.startsWith('auto_');
  if (dragIsAuto !== targetIsAuto) { return; } // não mistura pastas de Matérias com pastas manuais
  const all = getAllPastas();
  const dragObj = all.find(x => x.id === dragId), targetObj = all.find(x => x.id === targetId);
  if (!dragObj || !targetObj || dragObj.parentId !== targetObj.parentId) return; // só reordena entre irmãs do mesmo nível

  if (dragIsAuto) {
    const arr = getAutoArrayFor(dragId);
    if (!arr) return;
    const realDragId = dragId.replace(/^auto_(m|t|s|ss)_/, '');
    const realTargetId = targetId.replace(/^auto_(m|t|s|ss)_/, '');
    moveItemBeforeAfter(arr, realDragId, realTargetId, position);
    save(MATERIAS_KEY, materias);
    renderMaterias();
  } else {
    moveItemBeforeAfter(biblioPastas, dragId, targetId, position);
    save('biblio_pastas', biblioPastas);
    renderBiblioTree();
  }
}

function selecionarPasta(id) {
  biblioCurrentPasta = id;
  const btn = document.getElementById('biblioAddSubpastaBtn'); if (btn) btn.style.display = id ? 'inline-block' : 'none';
  const p = getAllPastas().find(x => x.id === id);
  const label = document.getElementById('biblioCurrentPastaLabel'); if (label) label.textContent = p ? p.nome : 'Todas as estantes';
  renderBiblioTree(); renderBiblioDocList();
}

function addPastaBiblio(parentId) {
  const input = document.getElementById('novaAreaInput');
  const nome = input.value.trim(); if (!nome) return;
  biblioPastas.push({ id: uid(), nome: (parentId ? '📁 ' : '📂 ') + nome, parentId: parentId || null });
  input.value = ''; save('biblio_pastas', biblioPastas); renderBiblioTree();
}
function promptSubpasta() {
  if (!biblioCurrentPasta) return;
  const nome = prompt('Nome da subpasta:'); if (!nome || !nome.trim()) return;
  biblioPastas.push({ id: uid(), nome: '📁 ' + nome.trim(), parentId: biblioCurrentPasta });
  save('biblio_pastas', biblioPastas); renderBiblioTree();
}
function delPastaBiblio(id) {
  if (!biblioPastas.some(p => p.id === id)) {
    alert('Esta estante vem da aba Diplomacia → Matérias. Para renomear ou remover, edite por lá.');
    return;
  }
  const temFilhos = biblioPastas.some(p => p.parentId === id);
  const temDocs = biblioDocs.some(d => d.pastaId === id);
  if (temFilhos || temDocs) { if (!confirm('Esta pasta tem subpastas ou documentos dentro. Excluir mesmo assim? Os documentos ficarão sem pasta.')) return; }
  biblioPastas = biblioPastas.filter(p => p.id !== id);
  biblioDocs.forEach(d => { if (d.pastaId === id) d.pastaId = null; });
  save('biblio_pastas', biblioPastas); save('biblio_docs', biblioDocs);
  if (biblioCurrentPasta === id) selecionarPasta(null); else renderBiblioTree();
}

function renderDocPastaOptions() {
  const sel = document.getElementById('docPasta'); if (!sel) return;
  const all = getAllPastas();
  let html = '<option value="">— sem pasta —</option>';
  function walk(parentId, depth) {
    all.filter(p => p.parentId === parentId).forEach(p => {
      const prefix = depth > 0 ? '&nbsp;&nbsp;'.repeat(depth) + '↳ ' : '';
      html += `<option value="${p.id}">${prefix}${p.nome}</option>`;
      walk(p.id, depth + 1);
    });
  }
  walk(null, 0);
  sel.innerHTML = html;
}
function renderDocMateriaOptions() {
  const sel = document.getElementById('docMateria'); if (!sel) return;
  sel.innerHTML = '<option value="">— nenhuma —</option>' + materias.map(m => `<option value="${m.nome}">${m.nome}</option>`).join('');
}
