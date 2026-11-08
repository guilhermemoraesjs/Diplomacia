/* ==========================================================================
   utils.js — helpers genéricos compartilhados por todos os módulos
   (persistência local, datas, ids, escape de HTML, toasts e confirmação).
   Nenhuma função aqui conhece regras de negócio de uma aba específica.

   DATAS: todas as datas "de calendário" (YYYY-MM-DD) são calculadas no
   FUSO LOCAL do usuário. Nunca use toISOString().slice(0,10) para isso —
   toISOString converte para UTC e, após ~21h no Brasil, devolveria o dia
   seguinte. Use ymdLocal()/todayISO().
   ========================================================================== */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/* ---- Persistência local + marcação de "pendente de sincronização" ---- */
const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } };
const save = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); }
  catch (e) { console.error('Falha ao gravar', k, e); if (typeof toast === 'function') toast('Não foi possível salvar neste dispositivo (armazenamento cheio?). Exporte um backup em Configurações.', 'erro'); return; }
  if (typeof syncKeyToCloud === 'function') syncKeyToCloud(k, v);
};

/* ---- Datas (sempre no fuso local) ---- */
function ymdLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseISOLocal(iso) { // 'YYYY-MM-DD' -> Date à meia-noite LOCAL (new Date(iso) seria UTC)
  const p = String(iso || '').slice(0, 10).split('-').map(Number);
  return p.length === 3 && p[0] ? new Date(p[0], p[1] - 1, p[2]) : null;
}
function todayISO() { return ymdLocal(new Date()); }
function isoToBR(iso) { if (!iso) return ''; const p = iso.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso; }
function addDaysISO(iso, days) { const d = parseISOLocal(iso) || new Date(); d.setDate(d.getDate() + Math.round(days)); return ymdLocal(d); }
function diffDaysISO(a, b) { // b - a em dias de calendário (imune a horário de verão)
  const da = parseISOLocal(a), db = parseISOLocal(b);
  return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86400000);
}
function isoDateTimeToLocalYMD(isoDateTime) { return ymdLocal(new Date(isoDateTime)); }

function parseBR(d) {
  if (!d || d === '—') return null;
  const parts = d.split('/').map(Number);
  if (parts.length !== 3) return null;
  let ano = parts[2];
  if (ano < 1000) ano = new Date().getFullYear();
  return new Date(ano, parts[1] - 1, parts[0]);
}
function brToISO(br) { const d = parseBR(br); return d ? ymdLocal(d) : null; }
function isMesmoDia(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

/* ---- Texto / HTML seguro ---- */
function stripHtml(html) { try { return new DOMParser().parseFromString(String(html || ''), 'text/html').body.textContent || ''; } catch (e) { return ''; } }   // DOMParser não executa onerror/scripts
function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function escAttr(s) { return escHtml(s); }
function jsArg(s) { return escHtml(JSON.stringify(String(s == null ? '' : s))); } // string segura dentro de onclick="f(...)"
function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function fmtTempo(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function fmtMin(min) { // 135 -> "2h15"
  min = Math.round(min || 0); if (min < 60) return min + ' min';
  const h = Math.floor(min / 60), m = min % 60; return h + 'h' + (m ? String(m).padStart(2, '0') : '');
}
function parseTempoMin(txt) { // "2h30", "1h", "45min", "90" -> minutos (ou null)
  if (txt == null) return null; const s = String(txt).trim().toLowerCase(); if (!s || s === '—') return null;
  let m = s.match(/^(\d+)\s*h\s*(\d+)?\s*(?:min|m)?$/); if (m) return (+m[1]) * 60 + (+(m[2] || 0));
  m = s.match(/^(\d+)\s*(?:min|m)?$/); if (m) return +m[1];
  m = s.match(/^(\d+)[.,](\d+)\s*h$/); if (m) return Math.round(parseFloat(m[1] + '.' + m[2]) * 60);
  return null;
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }

/* ---- Feedback visual: toast e confirmação (substitui alert/confirm) ---- */
function toast(msg, tipo) {
  let host = document.getElementById('toastHost');
  if (!host) { host = document.createElement('div'); host.id = 'toastHost'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
  const t = document.createElement('div'); t.className = 'toast ' + (tipo || 'ok'); t.textContent = msg; host.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, tipo === 'erro' ? 6000 : 3200);
}
/* confirmar(msg, {titulo, ok, perigo}) -> Promise<boolean>. Diálogo próprio, acessível, sem bloquear a thread. */
function confirmar(msg, opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const ov = document.createElement('div'); ov.className = 'modal-overlay show confirm-overlay';
    ov.innerHTML = `<div class="modal-card confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="cfT"><h3 id="cfT">${escHtml(opts.titulo || 'Confirmar')}</h3><p class="confirm-msg">${escHtml(msg)}</p>
      <div class="modal-actions"><button class="btn ghost small" data-r="0">Cancelar</button><button class="btn ${opts.perigo === false ? 'secondary' : 'danger'} small" data-r="1">${escHtml(opts.ok || 'Confirmar')}</button></div></div>`;
    const prev = document.activeElement;
    const fim = v => { ov.remove(); document.removeEventListener('keydown', onKey, true); if (prev && prev.focus) try { prev.focus(); } catch (e) {} resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); fim(false); } };
    ov.addEventListener('click', e => { if (e.target === ov) fim(false); const r = e.target.closest && e.target.closest('[data-r]'); if (r) fim(r.dataset.r === '1'); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(ov); ov.querySelector('[data-r="0"]').focus();
  });
}

/* ---- Sanitização de HTML rico (documentos da Biblioteca) ----
   Lista de permissões: mantém a formatação do editor (títulos, listas,
   tabelas, imagens, cores) e remove scripts, iframes, atributos on*,
   javascript: e estilos perigosos. Usada ao EXIBIR/CARREGAR conteúdo salvo. */
const _HTML_OK = new Set('A,B,BLOCKQUOTE,BR,CODE,DETAILS,DIV,EM,FONT,H1,H2,H3,H4,H5,H6,HR,I,IMG,INPUT,LABEL,LI,MARK,OL,P,PRE,S,SPAN,STRIKE,STRONG,SUB,SUP,SUMMARY,TABLE,TBODY,TD,TH,THEAD,TR,U,UL'.split(','));
function sanitizarHTML(html) {
  const t = document.createElement('template'); t.innerHTML = String(html == null ? '' : html);
  (function limpar(no) {
    [...no.children].forEach(el => {
      if (!_HTML_OK.has(el.tagName)) { el.remove(); return; }
      [...el.attributes].forEach(a => {
        const n = a.name.toLowerCase(), v = a.value;
        if (n.startsWith('on') || n === 'srcdoc' || n === 'formaction') el.removeAttribute(a.name);
        else if ((n === 'href' || n === 'src') && !/^(https?:|mailto:|#|data:image\/(png|jpe?g|gif|webp);base64,|\/|\.)/i.test(v.trim())) el.removeAttribute(a.name);
        else if (n === 'style' && /expression|url\s*\(|javascript:|@import/i.test(v)) el.removeAttribute(a.name);
      });
      if (el.tagName === 'A') { el.setAttribute('rel', 'noopener noreferrer'); if (el.getAttribute('target')) el.setAttribute('target', '_blank'); }
      if (el.tagName === 'INPUT' && el.type !== 'checkbox') { el.remove(); return; }
      limpar(el);
    });
  })(t.content);
  return t.innerHTML;
}
