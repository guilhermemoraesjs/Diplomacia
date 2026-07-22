/* ==========================================================================
   biblioteca-editor.js — módulo "Biblioteca → Editor de texto rico":
   barra de ferramentas contenteditable (formatação, links, imagens,
   tabelas, checklist, blocos recolhíveis, caixas de destaque, tela
   cheia e contagem de palavras/caracteres/tempo de leitura).
   ========================================================================== */

function fmt(cmd, val) { document.getElementById('docConteudo').focus(); document.execCommand(cmd, false, val || null); updateWordCount(); }
function fmtLink() { const url = prompt('URL do link:'); if (!url) return; fmt('createLink', url); }
function highlightColor(val) {
  const el = document.getElementById('docConteudo'); el.focus();
  if (!document.execCommand('hiliteColor', false, val)) { document.execCommand('backColor', false, val); }
}
function clearFormatting() {
  const el = document.getElementById('docConteudo'); el.focus();
  document.execCommand('removeFormat');
  document.execCommand('formatBlock', false, 'P');
  updateWordCount();
}
function insertChecklist() {
  const el = document.getElementById('docConteudo'); el.focus();
  document.execCommand('insertHTML', false, '<ul class="tasklist"><li><input type="checkbox"> Novo item</li></ul><p><br></p>');
  updateWordCount();
}
function insertToggleBlock() {
  const el = document.getElementById('docConteudo'); el.focus();
  document.execCommand('insertHTML', false, '<details class="toggle-block" open><summary>Clique para expandir/recolher</summary><p>Conteúdo do bloco recolhível...</p></details><p><br></p>');
  updateWordCount();
}
function insertCallout(tipo) {
  const el = document.getElementById('docConteudo'); el.focus();
  const config = {
    info: { icone: 'ℹ️', texto: 'Escreva uma informação relevante aqui...' },
    atencao: { icone: '⚠️', texto: 'Escreva um ponto de atenção aqui...' },
    importante: { icone: '🔴', texto: 'Escreva algo importante aqui...' }
  }[tipo] || { icone: 'ℹ️', texto: '...' };
  document.execCommand('insertHTML', false, `<div class="callout callout-${tipo}"><span class="callout-icon">${config.icone}</span><span class="callout-text">${config.texto}</span></div><p><br></p>`);
  updateWordCount();
}
function insertTable() {
  const rows = Math.max(1, parseInt(prompt('Quantas linhas?', '3')) || 3);
  const cols = Math.max(1, parseInt(prompt('Quantas colunas?', '3')) || 3);
  let html = '<table class="doc-table"><tbody>';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      html += r === 0 ? '<th>Título</th>' : '<td> </td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table><p><br></p>';
  const el = document.getElementById('docConteudo'); el.focus();
  document.execCommand('insertHTML', false, html);
  updateWordCount();
}
function insertImagePrompt() {
  const usarArquivo = confirm('OK para enviar uma imagem do computador.\nCancelar para colar uma URL de imagem.');
  if (usarArquivo) { document.getElementById('docImgFileInput').click(); }
  else { const url = prompt('URL da imagem:'); if (url) insertImageHTML(url); }
}
function handleImageFile(ev) {
  const file = ev.target.files && ev.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { insertImageHTML(reader.result); ev.target.value = ''; };
  reader.readAsDataURL(file);
}
function insertImageHTML(src) {
  const el = document.getElementById('docConteudo'); el.focus();
  document.execCommand('insertHTML', false, `<img src="${src}" alt="">`);
  updateWordCount();
}
function toggleEditorFullscreen() {
  document.getElementById('docConteudoWrap').classList.toggle('fullscreen-mode');
  document.body.classList.toggle('editor-fullscreen-active');
}
function updateWordCount() {
  const el = document.getElementById('docConteudo'); if (!el) return;
  const text = el.innerText.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const chars = text.length;
  const minutos = Math.max(1, Math.round(words / 200));

  const wc = document.getElementById('docWordCount'); if (wc) wc.textContent = words + ' palavra' + (words === 1 ? '' : 's');
  const cc = document.getElementById('docCharCount'); if (cc) cc.textContent = chars + ' caractere' + (chars === 1 ? '' : 's');
  const rt = document.getElementById('docReadTime'); if (rt) rt.textContent = '~' + minutos + ' min de leitura';

  const sp = document.getElementById('statPalavras'); if (sp) sp.textContent = words;
  const sc = document.getElementById('statCaracteres'); if (sc) sc.textContent = chars;
  const st = document.getElementById('statTempoLeitura'); if (st) st.textContent = minutos + ' min';

  if (typeof renderPainelConexoes === 'function') renderPainelConexoes(biblioDocs.find(x => x.id === biblioCurrentDocId) || null);
}
(function initEditorEvents() {
  const el = document.getElementById('docConteudo'); if (!el) return;
  el.addEventListener('input', updateWordCount);
  el.addEventListener('change', e => {
    if (e.target.matches('.tasklist input[type=checkbox]')) {
      e.target.closest('li').classList.toggle('checked', e.target.checked);
    }
  });
  document.addEventListener('keydown', e => {
    const wrap = document.getElementById('docConteudoWrap');
    if (e.key === 'Escape' && wrap && wrap.classList.contains('fullscreen-mode')) {
      toggleEditorFullscreen();
    }
  });
})();
