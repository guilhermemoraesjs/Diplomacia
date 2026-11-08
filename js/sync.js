/* ==========================================================================
   sync.js — motor de sincronização local ↔ Firestore (documento
   chancelaria_users/{uid}, um campo por chave de dados).

   Garantias:
   • FILA ÚNICA SERIALIZADA: nunca há duas gravações em voo; várias edições
     rápidas da mesma chave são COALESCIDAS (envia-se sempre o valor mais
     recente lido do localStorage no momento do envio).
   • CARIMBO por edição (monotônico): cada save() marca a chave como
     pendente com um carimbo; o envio só limpa a pendência se nenhuma edição
     mais nova ocorreu durante o voo.
   • TRANSAÇÃO com metadados (__meta[chave] = {t, d}): uma gravação antiga
     nunca sobrescreve uma mais recente (do mesmo ou de outro aparelho).
   • CONFLITO entre aparelhos (a nuvem mudou desde a última sincronização E
     você também editou): listas de registros com `id` são MESCLADAS por id
     (vence o registro mais recente); os demais valores vencem pelo carimbo.
     A cópia perdedora é guardada em chancelaria_conflicts.
   • RETENTATIVAS com recuo exponencial; idempotentes (sem duplicação).
   Estados mostrados ao usuário: somente local · pendente · enviando ·
   sincronizado · offline · falha.
   Limitações conhecidas (ver docs/SINCRONIZACAO.md): relógios muito
   diferentes entre aparelhos podem inverter o "mais recente"; exclusões em
   listas mescladas podem reaparecer após um conflito.
   ========================================================================== */
const DIRTY_KEY = 'chancelaria_dirty', SYNCMETA_KEY = 'chancelaria_syncmeta', CONFLICTS_KEY = 'chancelaria_conflicts', DEVICE_KEY = 'chancelaria_device';
const SYNC_TIMEOUT_MS = 15000;
const _sync = { draining: false, inflight: null, retryMs: 0, retryTimer: null, ultimoOk: null, ultimoErro: null, ultimoPull: 0, ultimoStamp: 0, listeners: [] };

function _lsJSON(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } }
function _lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error('localStorage cheio?', k, e); } }
function deviceId() { let d = localStorage.getItem(DEVICE_KEY); if (!d) { d = 'dev-' + Math.random().toString(36).slice(2, 10); try { localStorage.setItem(DEVICE_KEY, d); } catch (e) {} } return d; }
function getDirty() { return _lsJSON(DIRTY_KEY, {}); }
function setDirty(d) { _lsSet(DIRTY_KEY, d); }
function getSyncBase() { return _lsJSON(SYNCMETA_KEY, {}); }
function setSyncBase(m) { _lsSet(SYNCMETA_KEY, m); }
function _setBase(k, t) { const b = getSyncBase(); b[k] = t; setSyncBase(b); }
function nextStamp() { _sync.ultimoStamp = Math.max(Date.now(), _sync.ultimoStamp + 1); return _sync.ultimoStamp; }
function markDirty(key) { const d = getDirty(), s = nextStamp(); d[key] = s; setDirty(d); return s; }
function clearDirty(key, stamp) { const d = getDirty(); if (d[key] === stamp) { delete d[key]; setDirty(d); return true; } return false; }
function pendingSyncCount() { return Object.keys(getDirty()).length; }
function getConflicts() { return _lsJSON(CONFLICTS_KEY, []); }

/* ---- estado para a interface ---- */
function getSyncStatus() {
  const pend = pendingSyncCount();
  let estado;
  if (!currentUid) estado = 'local';
  else if (_sync.inflight) estado = 'enviando';
  else if (navigator.onLine === false && pend) estado = 'offline';
  else if (pend && _sync.ultimoErro) estado = 'falha';
  else if (pend) estado = 'pendente';
  else estado = 'sincronizado';
  return { estado, pendentes: pend, chaves: Object.keys(getDirty()), ultimoOk: _sync.ultimoOk, ultimoErro: _sync.ultimoErro, conflitos: getConflicts().length };
}
function _syncNotify() { try { renderSyncChip(); } catch (e) {} try { if (typeof renderVersionPanel === 'function') renderVersionPanel(); } catch (e) {} try { if (typeof renderSegurancaStatus === 'function') renderSegurancaStatus(); } catch (e) {} }
function renderSyncChip() {
  const el = document.getElementById('syncChip'); if (!el) return; const s = getSyncStatus();
  const M = { local: ['Somente local', 'local', 'Entre com Google para sincronizar entre aparelhos'], enviando: ['Enviando…', 'pend', 'Enviando alterações à nuvem'], offline: [`Offline · ${s.pendentes} pendente(s)`, 'pend', 'Sem conexão: as alterações estão salvas neste aparelho'], falha: [`Falha · ${s.pendentes} pendente(s)`, 'err', s.ultimoErro || 'Falha ao enviar; nova tentativa automática'], pendente: [`Pendente (${s.pendentes})`, 'pend', 'Salvo neste aparelho, aguardando envio'], sincronizado: ['Sincronizado', 'ok', s.ultimoOk ? 'Última sincronização: ' + new Date(s.ultimoOk).toLocaleTimeString('pt-BR') : 'Sincronizado'] }[s.estado];
  el.className = 'sync-chip ' + M[1]; el.textContent = M[0]; el.title = M[2]; el.setAttribute('aria-label', 'Sincronização: ' + M[0]);
}

/* ---- utilitários de comparação/mesclagem ---- */
function deepEqual(a, b) {
  if (a === b) return true; if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
  return ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]));
}
function _itemStamp(it) { let s = Math.max(+it.editadoEm || 0, +it.atualizadoEm || 0, +it.criadoEm || 0); if (it.srs && +it.srs.em) s = Math.max(s, +it.srs.em); return s; }
function mesclarListas(local, remoto) {
  const ids = a => a.every(x => x && typeof x === 'object' && !Array.isArray(x) && typeof x.id === 'string');
  if (local.length && remoto.length && ids(local) && ids(remoto)) {
    const rm = new Map(remoto.map(x => [x.id, x])), usados = new Set(), out = [];
    local.forEach(l => { const r = rm.get(l.id); usados.add(l.id); out.push(r && _itemStamp(r) > _itemStamp(l) ? r : l); });
    remoto.forEach(r => { if (!usados.has(r.id)) out.push(r); });
    return out;
  }
  if (local.every(x => typeof x !== 'object') && remoto.every(x => typeof x !== 'object')) return [...new Set([...local, ...remoto])].sort();
  return null;
}
function resolverValor(local, remoto, tLocal, tRemoto) {
  if (Array.isArray(local) && Array.isArray(remoto)) { const m = mesclarListas(local, remoto); if (m) return { valor: m, como: 'mesclado' }; }
  return tLocal >= tRemoto ? { valor: local, como: 'local' } : { valor: remoto, como: 'remoto' };
}
function guardarConflito(key, local, remoto, como) {
  const l = getConflicts(); l.unshift({ key, em: Date.now(), como, local: JSON.stringify(local).slice(0, 200000), remoto: JSON.stringify(remoto).slice(0, 200000) });
  while (l.length > 10 || JSON.stringify(l).length > 1500000) l.pop(); _lsSet(CONFLICTS_KEY, l);
}
function _aplicarConflito(key, local, remoto, tLocal, tRemoto, tRemotoMeta) {
  const r = resolverValor(local, remoto, tLocal, tRemoto);
  guardarConflito(key, local, remoto, r.como);
  localStorage.setItem(key, JSON.stringify(r.valor));
  const base = getSyncBase(); base[key] = tRemotoMeta; setSyncBase(base);   // a partir daqui partimos do estado remoto visto
  if (!deepEqual(r.valor, remoto)) markDirty(key); else clearDirty(key, getDirty()[key]);
  _sync.conflitoNovo = true;
  return r;
}

/* ---- acesso ao Firestore ---- */
function _ref() { return firebase.firestore().collection('chancelaria_users').doc(currentUid); }
const _comTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado ao falar com a nuvem')), ms))]);

/* Envia UMA chave (transação). Retorna 'ok' | 'conflito' | 'superado' | 'nada'. */
async function _enviarChave(key) {
  const stamp = getDirty()[key]; if (!stamp) return 'nada';
  const raw = localStorage.getItem(key); if (raw == null) { clearDirty(key, stamp); return 'nada'; }
  const value = JSON.parse(raw), ref = _ref(), dev = deviceId(); let res = 'ok', remotoVal, remotoT = 0;
  await _comTimeout(firebase.firestore().runTransaction(async tx => {
    const snap = await tx.get(ref), data = snap.exists ? snap.data() : {}, rm = (data.__meta || {})[key];
    remotoT = rm ? rm.t : 0; remotoVal = data[key];
    if (rm && rm.d === dev && rm.t > stamp) { res = 'superado'; return; }                 // gravação antiga: já existe uma mais nova deste aparelho
    const base = getSyncBase()[key] || 0;
    if (remotoT > base && remotoVal !== undefined && !deepEqual(remotoVal, value)) { res = 'conflito'; return; }   // outro aparelho mudou desde a última sincronização
    if (remotoVal !== undefined && deepEqual(remotoVal, value)) { res = 'igual'; return; }
    tx.set(ref, { [key]: value, __meta: { [key]: { t: stamp, d: dev } } }, { merge: true });
  }), SYNC_TIMEOUT_MS);
  if (res === 'conflito') { _aplicarConflito(key, value, remotoVal, stamp, remotoT, remotoT); return 'conflito'; }
  const base = getSyncBase(); base[key] = res === 'ok' ? stamp : Math.max(remotoT, base[key] || 0); setSyncBase(base);
  clearDirty(key, stamp);               // só limpa se não houve edição mais nova durante o voo
  return res === 'superado' ? 'superado' : 'ok';
}

async function _drenar() {
  if (_sync.draining || !currentUid || typeof firebase === 'undefined') return;
  _sync.draining = true; let falhou = false;
  try {
    for (let guard = 0; guard < 200; guard++) {
      const keys = Object.keys(getDirty()).filter(k => CLOUD_KEYS.includes(k)); if (!keys.length) break;
      let avancou = false;
      for (const k of keys) {
        if (navigator.onLine === false) { falhou = true; break; }
        _sync.inflight = k; _syncNotify();
        try { const r = await _enviarChave(k); avancou = true; _sync.ultimoOk = Date.now(); _sync.ultimoErro = null; if (r === 'conflito') _syncNotificarConflito(k); }
        catch (e) { falhou = true; _sync.ultimoErro = String(e && e.message || e); console.error('Falha ao sincronizar', k, e); break; }
        finally { _sync.inflight = null; }
      }
      if (falhou || !avancou) break;
    }
  } finally { _sync.draining = false; _sync.inflight = null; }
  if (falhou || pendingSyncCount()) _agendarRetentativa(); else { _sync.retryMs = 0; clearTimeout(_sync.retryTimer); }
  _syncNotify();
}
function _agendarRetentativa() { clearTimeout(_sync.retryTimer); _sync.retryMs = Math.min(60000, (_sync.retryMs || 1000) * 2); _sync.retryTimer = setTimeout(() => _drenar(), _sync.retryMs); }
function _syncNotificarConflito(k) { if (typeof toast === 'function') toast('Duas versões de "' + k + '" foram combinadas (edição em outro aparelho). Uma cópia da versão descartada foi guardada em Configurações → Backup e segurança.', 'aviso'); if (typeof reloadStateFromLocalStorage === 'function') reloadStateFromLocalStorage(); }

/* Chamado por save(): marca pendente (com carimbo) e agenda o envio. */
function syncKeyToCloud(key, value) {
  if (!CLOUD_KEYS.includes(key)) return Promise.resolve();
  markDirty(key); _syncNotify();
  if (!currentUid || typeof firebase === 'undefined') return Promise.resolve();
  return Promise.resolve().then(() => _drenar());      // microtask: várias save() seguidas viram um único envio do valor mais novo
}
function pushDirtyKeys() { return _drenar(); }

/* Usado pelo atualizador/logout: grava edições abertas, tenta enviar e espera (com limite). */
async function flushPendingSync(timeoutMs) {
  try { if (typeof flushAllEditors === 'function') flushAllEditors(); } catch (e) {}
  if (currentUid && navigator.onLine !== false) {
    const fim = Date.now() + (timeoutMs || 8000);
    while (pendingSyncCount() && Date.now() < fim) { await Promise.race([_drenar(), new Promise(r => setTimeout(r, Math.max(100, fim - Date.now())))]); if (!pendingSyncCount()) break; if (_sync.ultimoErro && !_sync.draining) break; await new Promise(r => setTimeout(r, 150)); }
  }
  const pendentes = pendingSyncCount(); return { confirmado: pendentes === 0, pendentes };
}

/* ---- download da nuvem (login, volta à aba, volta da conexão) ---- */
async function pullFromCloud() {
  const snap = await _comTimeout(_ref().get(), SYNC_TIMEOUT_MS), data = snap.exists ? snap.data() : {}, meta = data.__meta || {}, mudou = [], conflitos = [];
  const dirty = getDirty(), base = getSyncBase();
  CLOUD_KEYS.forEach(k => {
    const rv = data[k], rt = (meta[k] && meta[k].t) || 0, raw = localStorage.getItem(k); let lv; try { lv = raw == null ? undefined : JSON.parse(raw); } catch (e) { lv = undefined; }
    if (rv === undefined) { if (raw != null && !dirty[k]) markDirty(k); return; }     // só existe aqui: enviar
    if (!dirty[k]) { if (!deepEqual(rv, lv)) { localStorage.setItem(k, JSON.stringify(rv)); mudou.push(k); } _setBase(k, rt); return; }
    if (rt > (base[k] || 0) && !deepEqual(rv, lv)) { _aplicarConflito(k, lv, rv, dirty[k], rt, rt); conflitos.push(k); mudou.push(k); }   // ambos mudaram
  });
  _sync.ultimoPull = Date.now();
  return { mudou, conflitos };
}
async function syncFromCloud(uid) {
  let resultado = { mudou: [], conflitos: [] }, falhou = false;
  try { resultado = await pullFromCloud(); await _drenar(); }
  catch (e) { falhou = true; _sync.ultimoErro = String(e && e.message || e); console.error('Falha ao sincronizar com a nuvem:', e); if (typeof toast === 'function') toast('Sem conexão com a nuvem: seus dados continuam salvos neste aparelho e serão enviados depois.', 'aviso'); _agendarRetentativa(); }
  if (document.readyState !== 'complete') await new Promise(r => window.addEventListener('load', r, { once: true }));
  const ja = sessionStorage.getItem('chancelaria_cloud_synced');
  sessionStorage.setItem('chancelaria_cloud_synced', uid);
  if (resultado.mudou.length && ja !== uid) location.reload(); else reloadStateFromLocalStorage();
  _syncNotify();
}
/* Voltou à aba/conexão: busca mudanças feitas em outro aparelho e atualiza a tela (sem interromper edição em andamento). */
async function sincronizarAgora(motivo) {
  if (!currentUid || typeof firebase === 'undefined' || navigator.onLine === false) return;
  try { if (typeof flushAllEditors === 'function') flushAllEditors(); } catch (e) {}
  try {
    const r = await pullFromCloud(); await _drenar();
    if (r.mudou.length) { const a = document.activeElement; if (!(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable))) { reloadStateFromLocalStorage(); if (typeof toast === 'function') toast('Dados atualizados a partir de outro aparelho.'); } else if (typeof toast === 'function') toast('Há dados novos de outro aparelho; eles serão aplicados quando você sair do campo de edição.', 'aviso'); }
  } catch (e) { _sync.ultimoErro = String(e && e.message || e); _agendarRetentativa(); }
  _syncNotify();
}
window.addEventListener('online', () => { _sync.retryMs = 0; sincronizarAgora('online'); });
window.addEventListener('offline', _syncNotify);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - _sync.ultimoPull > 60000) sincronizarAgora('visivel'); });
setInterval(() => { if (currentUid && pendingSyncCount() && !_sync.draining) _drenar(); }, 30000);
