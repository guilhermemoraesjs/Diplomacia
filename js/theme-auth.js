/* ==========================================================================
   theme-auth.js — alternância de tema claro/escuro, autenticação Firebase
   e sincronização dos dados do usuário com o Firestore (nuvem).

   Login passou a ser obrigatório: o "loginGate" bloqueia o uso do app até
   o usuário entrar com o Google. Uma vez logado, os dados salvos por
   save() (em utils.js) passam a viajar entre dispositivos através do
   documento "chancelaria_users/{uid}" no Firestore.
   ========================================================================== */
/* A sincronização com o Firestore vive em sync.js (carregado antes deste arquivo). */

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

/* Sem o SDK do Firebase (ex.: primeira abertura offline) o app continua
   funcionando 100% com os dados locais; o login é retomado quando houver rede. */
if (typeof firebase === 'undefined' || !firebase.auth) {
  hideLoginGate(); currentUid = null;
  window.addEventListener('load', () => { if (typeof toast === 'function') toast('Sem conexão com o serviço de login. Usando os dados salvos neste aparelho.', 'aviso'); });
} else firebase.auth().onAuthStateChanged(user => {
  if (user) {
    currentUid = user.uid; _syncNotify();
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
    currentUid = null; _syncNotify();
    sessionStorage.removeItem('chancelaria_cloud_synced');
    const box = document.getElementById('authBox');
    if (box) box.innerHTML = '';
    showLoginGate();
  }
});
