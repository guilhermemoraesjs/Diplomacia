/* ==========================================================================
   materias.js — módulo "Diplomacia → Matérias": edital em árvore
   (matéria → tópico → subtópico → subsubtópico) com progresso.
   ========================================================================== */

const MATERIAS_KEY = 'diplo_materias';

function materiasDefault() {
  const t = (nome) => ({ id: uid(), nome, feito: false, subtopicos: [] });
  return [
    { id: uid(), nome: '📜 História do Brasil', topicos: [{ id: uid(), nome: 'Período Colonial (1500-1822)', feito: false, subtopicos: [] }, { id: uid(), nome: 'Império', feito: false, subtopicos: [] }, { id: uid(), nome: 'República', feito: false, subtopicos: [] }] },
    { id: uid(), nome: '🌐 História Mundial', topicos: [t('Iluminismo e Revoluções'), t('Século XIX'), t('Século XX')] },
    { id: uid(), nome: '🏳️ Política Internacional', topicos: [t('Relações Internacionais'), t('Diretrizes da PEB')] },
    { id: uid(), nome: '🇧🇷 Português', topicos: [t('Sintaxe e Morfologia'), t('Compreensão Textual')] },
    { id: uid(), nome: '🇺🇸 Inglês', topicos: [t('Advanced Reading'), t('Translation Techniques')] },
    { id: uid(), nome: '🗺️ Geografia', topicos: [t('Geopolítica Espacial'), t('Demografia')] },
    { id: uid(), nome: '⚖️ Direito Interno', topicos: [t('Constitucional'), t('Administrativo')] },
    { id: uid(), nome: '💼 Direito Internacional', topicos: [t('Tratados Públicos'), t('Organizações')] },
    { id: uid(), nome: '📈 Economia', topicos: [t('Microeconomia'), t('Macroeconomia')] }
  ];
}
let materias = load(MATERIAS_KEY, null) || materiasDefault();

function renderMaterias() {
  const el = document.getElementById('materiasList'); if (!el) return;
  el.innerHTML = materias.map(m => `
    <details class="card materia-card" ${m.open ? 'open' : ''}>
      <summary onclick="toggleOpen('${m.id}')"><span class="m-title">${m.nome}</span><span class="m-pct mono">${pctMateria(m)}%</span></summary>
      <div class="bar"><span style="width:${pctMateria(m)}%; background:var(--ub-verde);"></span></div>
      <div style="margin-top:12px;">
        ${m.topicos.map(t => { const subs = t.subtopicos || []; return `
          <div class="topic-row">
            <button type="button" class="topic-toggle ${t.subOpen ? 'open' : ''}" onclick="event.stopPropagation(); toggleSubOpen('${m.id}','${t.id}')">▶</button>
            <input type="checkbox" ${t.feito ? 'checked' : ''} onchange="toggleTopico('${m.id}','${t.id}')" id="t_${t.id}">
            <label for="t_${t.id}">${t.nome}</label>
            <button class="del-t" onclick="delTopico('${m.id}','${t.id}')">✕</button>
          </div>
          <div class="subtopics-wrap ${t.subOpen ? 'open' : ''}">
            ${subs.map(s => { const ssubs = s.subsubtopicos || []; return `
              <div class="subtopic-row">
                <button type="button" class="topic-toggle ${s.subOpen ? 'open' : ''}" onclick="toggleSubSubOpen('${m.id}','${t.id}','${s.id}')">▶</button>
                <input type="checkbox" ${s.feito ? 'checked' : ''} onchange="toggleSubtopico('${m.id}','${t.id}','${s.id}')" id="s_${s.id}">
                <label for="s_${s.id}">${s.nome}</label>
                <button class="del-t" onclick="delSubtopico('${m.id}','${t.id}','${s.id}')">✕</button>
              </div>
              <div class="subsubtopics-wrap ${s.subOpen ? 'open' : ''}">
                ${ssubs.map(ss => `
                  <div class="subsubtopic-row">
                    <input type="checkbox" ${ss.feito ? 'checked' : ''} onchange="toggleSubsubtopico('${m.id}','${t.id}','${s.id}','${ss.id}')" id="ss_${ss.id}">
                    <label for="ss_${ss.id}">${ss.nome}</label>
                    <button class="del-t" onclick="delSubsubtopico('${m.id}','${t.id}','${s.id}','${ss.id}')">✕</button>
                  </div>
                `).join('')}
                <div class="add-subsubtopic-row"><input type="text" placeholder="Novo subtópico..." id="news_${s.id}" onkeydown="if(event.key==='Enter')addSubsubtopico('${m.id}','${t.id}','${s.id}')"></div>
              </div>
            `; }).join('')}
            <div class="add-subtopic-row"><input type="text" placeholder="Novo tópico..." id="newt_${t.id}" onkeydown="if(event.key==='Enter')addSubtopico('${m.id}','${t.id}')"></div>
          </div>
        `; }).join('')}
        <div class="add-topic-row"><input type="text" placeholder="Novo tema..." id="newm_${m.id}" onkeydown="if(event.key==='Enter')addTopico('${m.id}')"></div>
      </div>
    </details>
  `).join('');
  renderBiblioTree();
}

function pctMateria(m) { if (!m.topicos.length) return 0; return Math.round(100 * m.topicos.filter(t => t.feito).length / m.topicos.length); }
function toggleOpen(id) { const m = materias.find(x => x.id === id); m.open = !m.open; save(MATERIAS_KEY, materias); }
function toggleSubOpen(mid, tid) { const m = materias.find(x => x.id === mid); const t = m.topicos.find(x => x.id === tid); t.subOpen = !t.subOpen; save(MATERIAS_KEY, materias); renderMaterias(); }
function toggleSubSubOpen(mid, tid, sid) { const m = materias.find(x => x.id === mid); const t = m.topicos.find(x => x.id === tid); const s = t.subtopicos.find(x => x.id === sid); s.subOpen = !s.subOpen; save(MATERIAS_KEY, materias); renderMaterias(); }
function addTopico(mid) { const input = document.getElementById('newm_' + mid); if (!input.value.trim()) return; const m = materias.find(x => x.id === mid); m.topicos.push({ id: uid(), nome: input.value.trim(), feito: false, subtopicos: [] }); save(MATERIAS_KEY, materias); renderMaterias(); }
function addSubtopico(mid, tid) { const input = document.getElementById('newt_' + tid); if (!input.value.trim()) return; const m = materias.find(x => x.id === mid); const t = m.topicos.find(x => x.id === tid); t.subtopicos.push({ id: uid(), nome: input.value.trim(), feito: false, subsubtopicos: [] }); save(MATERIAS_KEY, materias); renderMaterias(); }
function addSubsubtopico(mid, tid, sid) { const input = document.getElementById('news_' + sid); if (!input.value.trim()) return; const m = materias.find(x => x.id === mid); const t = m.topicos.find(x => x.id === tid); const s = t.subtopicos.find(x => x.id === sid); s.subsubtopicos.push({ id: uid(), nome: input.value.trim(), feito: false }); save(MATERIAS_KEY, materias); renderMaterias(); }
function toggleTopico(mid, tid) { const m = materias.find(x => x.id === mid); const t = m.topicos.find(x => x.id === tid); t.feito = !t.feito; save(MATERIAS_KEY, materias); refreshStats(); renderMaterias(); }
function toggleSubtopico(mid, tid, sid) { const m = materias.find(x => x.id === mid); const t = m.topicos.find(x => x.id === tid); const s = t.subtopicos.find(x => x.id === sid); s.feito = !s.feito; save(MATERIAS_KEY, materias); renderMaterias(); }
function toggleSubsubtopico(mid, tid, sid, ssid) { const m = materias.find(x => x.id === mid); const t = m.topicos.find(x => x.id === tid); const s = t.subtopicos.find(x => x.id === sid); const ss = s.subsubtopicos.find(x => x.id === ssid); ss.feito = !ss.feito; save(MATERIAS_KEY, materias); renderMaterias(); }
function delTopico(mid, tid) { if (!confirm('Excluir este tema e tudo dentro dele? Essa ação não pode ser desfeita.')) return; const m = materias.find(x => x.id === mid); m.topicos = m.topicos.filter(x => x.id !== tid); save(MATERIAS_KEY, materias); renderMaterias(); }
function delSubtopico(mid, tid, sid) { if (!confirm('Excluir este tópico e tudo dentro dele? Essa ação não pode ser desfeita.')) return; const m = materias.find(x => x.id === mid); const t = m.topicos.find(x => x.id === tid); t.subtopicos = t.subtopicos.filter(x => x.id !== sid); save(MATERIAS_KEY, materias); renderMaterias(); }
function delSubsubtopico(mid, tid, sid, ssid) { if (!confirm('Excluir este subtópico? Essa ação não pode ser desfeita.')) return; const m = materias.find(x => x.id === mid); const t = m.topicos.find(x => x.id === tid); const s = t.subtopicos.find(x => x.id === sid); s.subsubtopicos = s.subsubtopicos.filter(x => x.id !== ssid); save(MATERIAS_KEY, materias); renderMaterias(); }

/* Popula todos os <select> de matéria da aplicação (cronograma, revisão,
   discursiva, questões e filtros) a partir de uma única fonte de verdade,
   evitando repetir o mesmo loop em cada módulo. */
function populateMateriaSelect(id) {
  const sel = document.getElementById(id);
  if (sel) sel.innerHTML = materias.map(m => `<option value="${m.nome}">${m.nome}</option>`).join('');
}
function renderCMateriaSelect() {
  ['cMateria', 'rMateria', 'dMateria'].forEach(populateMateriaSelect);
}
function renderMateriaOptions() {
  populateMateriaSelect('qMateria');
  const filt = document.getElementById('qFiltroMateria'); if (filt) filt.innerHTML = ['todas', ...materias.map(m => m.nome)].map(n => `<button class="chip" onclick="setFiltroMateria('${n}')">${n}</button>`).join('');
  const filtC = document.getElementById('cronoFiltroMateria'); if (filtC) filtC.innerHTML = ['todas', ...materias.map(m => m.nome)].map(n => `<button class="chip" onclick="setCronoFiltroMateria('${n}')">${n}</button>`).join('');
  renderCMateriaSelect();
  renderDocMateriaOptions();
}

function addMateria() { const input = document.getElementById('novaMateriaInput'); const nome = input.value.trim(); if (!nome) return; materias.push({ id: uid(), nome, topicos: [], open: true }); input.value = ''; save(MATERIAS_KEY, materias); renderMaterias(); renderMateriaOptions(); }

function pctGeral() { const total = materias.reduce((a, m) => a + m.topicos.length, 0); const feitos = materias.reduce((a, m) => a + m.topicos.filter(t => t.feito).length, 0); return total ? Math.round(100 * feitos / total) : 0; }
