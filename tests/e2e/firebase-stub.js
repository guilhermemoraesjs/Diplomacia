/* Stub do Firebase para testes E2E offline (substitui os 3 scripts do gstatic).
   Firestore em memória; window.__FS guarda o documento; window.__FS_FAIL=true simula falha de rede. */
(function () {
  const store = window.__FS = window.__FS || { doc: null };
  const user = { uid: 'teste-uid', displayName: 'Estudante Teste', email: 'teste@example.com' };
  const fs = () => ({ collection: () => ({ doc: () => ({
    get: async () => { if (window.__FS_FAIL) throw new Error('offline'); return { exists: !!store.doc, data: () => store.doc }; },
    set: async (obj) => { if (window.__FS_FAIL) throw new Error('offline'); store.doc = Object.assign(store.doc || {}, JSON.parse(JSON.stringify(obj))); store.writes = (store.writes || 0) + 1; }
  }) }) });
  const auth = () => ({ onAuthStateChanged: cb => setTimeout(() => cb(window.__NO_USER ? null : user), 20), signInWithPopup: async () => {}, signOut: async () => {} });
  auth.GoogleAuthProvider = function () {};
  window.firebase = { initializeApp() {}, auth, firestore: fs };
})();
