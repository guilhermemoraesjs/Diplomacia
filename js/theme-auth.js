/* ==========================================================================
   theme-auth.js — alternância de tema claro/escuro, autenticação Firebase
   e sincronização dos dados do usuário com o Firestore (nuvem).

   Login passou a ser obrigatório: o "loginGate" bloqueia o uso do app até
   o usuário entrar com o Google. Uma vez logado, os dados salvos por
   save() (em utils.js) passam a viajar entre dispositivos através do
   documento "chancelaria_users/{uid}" no Firestore.
   ========================================================================== */

function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme');
  const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', nextTheme);
  localStorage.setItem('chancelaria_theme', nextTheme);
  syncKeyToCloud('chancelaria_theme', nextTheme);
}

function gateGoogleLogin() {
  const errEl = document.getElementById('gateError'); if (errEl) errEl.textContent = '';
  firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .catch(e => { if (errEl) errEl.textContent = 'Não foi possível entrar: ' + e.message; console.error(e); });
}

function logoutChancelaria() {
  firebase.auth().signOut();
}

function showLoginGate() {
  const gate = document.getElementById('loginGate'); if (gate) gate.classList.remove('hidden');
}
function hideLoginGate() {
  const gate = document.getElementById('loginGate'); if (gate) gate.classList.add('hidden');
}

/* Baixa o documento do usuário no Firestore para o localStorage deste
   dispositivo. Se ainda não existir nenhum documento na nuvem (primeiro
   login do usuário em qualquer dispositivo), envia o que já estiver salvo
   localmente para a nuvem, para não perder anotações antigas. */
async function syncFromCloud(uid) {
  const db = firebase.firestore();
  const ref = db.collection('chancelaria_users').doc(uid);
  try {
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() || {};
      CLOUD_KEYS.forEach(k => {
        if (data[k] !== undefined) localStorage.setItem(k, JSON.stringify(data[k]));
      });
    } else {
      const initial = {};
      CLOUD_KEYS.forEach(k => { const v = load(k, null); if (v !== null) initial[k] = v; });
      await ref.set(initial, { merge: true });
    }
  } catch (e) {
    console.error('Falha ao sincronizar com a nuvem:', e);
  }

  // Evita recarregar em loop: só recarrega a página uma vez por sessão de
  // login, para que todos os módulos releiam o localStorage já atualizado.
  const alreadySynced = sessionStorage.getItem('chancelaria_cloud_synced');
  if (alreadySynced !== uid) {
    sessionStorage.setItem('chancelaria_cloud_synced', uid);
    location.reload();
  } else {
    reloadStateFromLocalStorage();
  }
}

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    currentUid = user.uid;
    hideLoginGate();
    const box = document.getElementById('authBox');
    if (box) {
      box.innerHTML = `
        <div class="avatar" title="${user.displayName || user.email || 'Usuário'}">${user.displayName ? user.displayName.charAt(0) : 'U'}</div>
        <button onclick="logoutChancelaria()">Sair</button>`;
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
