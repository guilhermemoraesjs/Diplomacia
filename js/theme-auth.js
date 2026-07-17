/* ==========================================================================
   theme-auth.js — alternância de tema claro/escuro e autenticação Firebase
   ========================================================================== */

function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme');
  const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', nextTheme);
  localStorage.setItem('chancelaria_theme', nextTheme);
}

function gateGoogleLogin() {
  firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => console.error(e));
}

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    const box = document.getElementById('authBox');
    if (box) box.innerHTML = `<div class="avatar">${user.displayName ? user.displayName.charAt(0) : 'U'}</div>`;
    reloadStateFromLocalStorage();
  }
});
