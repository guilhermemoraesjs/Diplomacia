/* ==========================================================================
   utils.js — helpers genéricos compartilhados por todos os módulos
   (persistência local, datas, ids). Nenhuma função aqui conhece regras
   de negócio específicas de uma aba — mantém-se neutro de propósito.
   ========================================================================== */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } };
const save = (k, v) => {
  localStorage.setItem(k, JSON.stringify(v));
  if (typeof syncKeyToCloud === 'function') syncKeyToCloud(k, v);
};

function todayISO() { return new Date().toISOString().slice(0, 10); }
function isoToBR(iso) { if (!iso) return ''; const p = iso.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso; }
function addDaysISO(iso, days) { const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

function parseBR(d) {
  if (!d || d === '—') return null;
  const parts = d.split('/').map(Number);
  if (parts.length !== 3) return null;
  let ano = parts[2];
  if (ano < 1000) ano = 2026;
  return new Date(ano, parts[1] - 1, parts[0]);
}
function isMesmoDia(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

function stripHtml(html) { const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent || ''; }
