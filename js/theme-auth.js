/* ==========================================================================
   theme-auth.js — alternância de tema claro/escuro, autenticação Firebase
   e sincronização dos dados do usuário com o Firestore (nuvem).

   Login passou a ser obrigatório: o "loginGate" bloqueia o uso do app até
   o usuário entrar com o Google. Uma vez logado, os dados salvos por
   save() (em utils.js) passam a viajar entre dispositivos através do
   documento "chancelaria_users/{uid}" no Firestore.
   ========================================================================== */
/* ---- Sincronização com a nuvem (Firestore: chancelaria_users/{uid}) ----
   Cada save() grava a chave localmente e a envia ao Firestore. Para NUNCA
   perder edição feita offline (ou antes do login), cada chave enviada fica
   marcada como "pendente" em localStorage['chancelaria_dirty'] até o
   Firestore confirmar a gravação. No login, chaves pendentes têm
   prioridade sobre o que está na nuvem (são reenviadas em vez de
   sobrescritas). */
const DIRTY_KEY = 'chancelaria_dirty';
const _pendingWrites = new Set();
let _syncStatus = { estado: 'ocioso', ultimoOk: null, ultimoErro: null };
function getDirty() { try { return JSON.parse(localStorage.getItem(DIRTY_KEY)) || {}; } catch (e) { return {}; } }
function setDirty(d) { try { localStorage.setItem(DIRTY_KEY, JSON.stringify(d)); } catch (e) {} }
function markDirty(key) { const d = getDirty(); d[key] = Date.now(); setDirty(d); return d[key]; }
function clearDirty(key, stamp) { const d = getDirty(); if (d[key] === stamp) { delete d[key]; setDirty(d); } }
function pendingSyncCount() { return Object.keys(getDirty()).length; }

function syncKeyToCloud(key, value) {
  if (!CLOUD_KEYS.includes(key)) return Promise.resolve();
  const stamp = markDirty(key);
  if (!currentUid || typeof firebase === 'undefined') return Promise.resolve();
  _syncStatus.estado = 'enviando';
  const p = firebase.firestore().collection('chancelaria_users').doc(currentUid)
    .set({ [key]: value }, { merge: true })
    .then(() => { clearDirty(key, stamp); _syncStatus.estado = 'ok'; _syncStatus.ultimoOk = Date.now(); })
    .catch(e => { _syncStatus.estado = 'erro'; _syncStatus.ultimoErro = String(e && e.message || e); console.error('Falha ao sincronizar', key, 'para a nuvem:', e); });
  _pendingWrites.add(p); p.finally(() => _pendingWrites.delete(p));
  return p;
}

/* Reenvia todas as chaves pendentes (lendo o valor ATUAL do localStorage). */
function pushDirtyKeys() {
  const ps = [];
  Object.keys(getDirty()).forEach(k => { if (CLOUD_KEYS.includes(k)) { const raw = localStorage.getItem(k); if (raw != null) { try { ps.push(syncKeyToCloud(k, JSON.parse(raw))); } catch (e) {} } } });
  return Promise.all(ps);
}

/* Usado pelo atualizador antes de recarregar a página: garante que tudo o
   que o usuário digitou já foi gravado localmente e tenta confirmar o envio
   à nuvem (com limite de tempo — offline, as chaves ficam pendentes e
   seguem seguras no localStorage). Resolve { confirmado, pendentes }. */
async function flushPendingSync(timeoutMs) {
  try { if (typeof flushAllEditors === 'function') flushAllEditors(); } catch (e) {}
  if (currentUid && navigator.onLine !== false) {
    try { await Promise.race([pushDirtyKeys().then(() => Promise.all([..._pendingWrites])), new Promise(r => setTimeout(r, timeoutMs || 8000))]); } catch (e) {}
  }
  const pendentes = pendingSyncCount();
  return { confirmado: pendentes === 0, pendentes };
}

function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme');
  const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', nextTheme);
  save('chancelaria_theme', nextTheme);
  if (typeof aplicarIconeTema === 'function') aplicarIconeTema();
}

function gateGoogleLogin() {
  if (typeof firebase === 'undefined' || !firebase.auth) { const e0 = document.getElementById('gateError'); if (e0) e0.textContent = 'Sem conexão: não foi possível carregar o login.'; return; }
  const errEl = document.getElementById('gateError'); if (errEl) errEl.textContent = '';
  firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .catch(e => { if (errEl) errEl.textContent = 'Não foi possível entrar: ' + e.message; console.error(e); });
}

async function logoutChancelaria() {
  const r = await flushPendingSync(5000);
  if (!r.confirmado && !(await confirmar(`Há ${r.pendentes} grupo(s) de dados ainda não enviados à nuvem. Eles continuam salvos neste aparelho, mas só serão enviados na próxima vez que você entrar aqui. Sair mesmo assim?`, { titulo: 'Dados pendentes', ok: 'Sair mesmo assim' }))) return;
  firebase.auth().signOut();
}

function showLoginGate() {
  const gate = document.getElementById('loginGate'); if (gate) gate.classList.remove('hidden');
}
function hideLoginGate() {
  const gate = document.getElementById('loginGate'); if (gate) gate.classList.add('hidden');
}

/* Baixa o documento do usuário no Firestore para o localStorage deste
   dispositivo, SEM sobrescrever chaves com alteração local pendente
   (essas são reenviadas). Chaves que existem só localmente também são
   enviadas à nuvem. Só recarrega a página se algo realmente mudou. */
async function syncFromCloud(uid) {
  const db = firebase.firestore();
  const ref = db.collection('chancelaria_users').doc(uid);
  let mudou = false, falhou = false;
  try {
    const snap = await ref.get();
    const dirty = getDirty();
    if (snap.exists) {
      const data = snap.data() || {};
      CLOUD_KEYS.forEach(k => {
        if (dirty[k]) return;                                   // alteração local pendente: não sobrescrever
        if (data[k] !== undefined) {
          const novo = JSON.stringify(data[k]);
          if (localStorage.getItem(k) !== novo) { localStorage.setItem(k, novo); mudou = true; }
        } else {
          const v = load(k, null); if (v !== null) markDirty(k);   // só existe localmente: enviar
        }
      });
    } else {
      CLOUD_KEYS.forEach(k => { const v = load(k, null); if (v !== null) markDirty(k); });
    }
    await pushDirtyKeys();
  } catch (e) {
    falhou = true;
    console.error('Falha ao sincronizar com a nuvem:', e);
    if (typeof toast === 'function') toast('Sem conexão com a nuvem: seus dados continuam salvos neste aparelho e serão enviados depois.', 'aviso');
  }
  /* o auth pode responder antes de todos os scripts terem carregado */
  if (document.readyState !== 'complete') await new Promise(r => window.addEventListener('load', r, { once: true }));
  const alreadySynced = sessionStorage.getItem('chancelaria_cloud_synced');
  if (mudou && alreadySynced !== uid) {
    sessionStorage.setItem('chancelaria_cloud_synced', uid);
    location.reload();
  } else {
    sessionStorage.setItem('chancelaria_cloud_synced', uid);
    if (!falhou || !mudou) reloadStateFromLocalStorage();
  }
}

window.addEventListener('online', () => { if (currentUid) pushDirtyKeys(); });

/* Sem o SDK do Firebase (ex.: primeira abertura offline) o app continua
   funcionando 100% com os dados locais; o login é retomado quando houver rede. */
if (typeof firebase === 'undefined' || !firebase.auth) {
  hideLoginGate(); currentUid = null;
  window.addEventListener('load', () => { if (typeof toast === 'function') toast('Sem conexão com o serviço de login. Usando os dados salvos neste aparelho.', 'aviso'); });
} else firebase.auth().onAuthStateChanged(user => {
  if (user) {
    currentUid = user.uid;
    hideLoginGate();
    const box = document.getElementById('authBox');
    if (box) {
      box.innerHTML = `
        <div class="avatar" title="${escHtml(user.displayName || user.email || 'Usuário')}">${escHtml(user.displayName ? user.displayName.charAt(0) : 'U')}</div>
        <button onclick="logoutChancelaria()">Sair</button>`;
      window.chancelariaUser = { nome: user.displayName || '', email: user.email || '' };
    }
    syncFromCloud(user.uid);
  } else {
    currentUid = null;
    sessionStorage.removeItem('chancelaria_cloud_synced');
    const box = document.getElementById('authBox');
    if (box) box.innerHTML = '';
    showLoginGate();
  }
});
