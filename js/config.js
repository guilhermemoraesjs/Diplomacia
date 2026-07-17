/* ==========================================================================
   config.js — configurações globais do projeto Chancelaria
   Ponto único para chaves/URLs externas. Ao expandir o projeto (novo
   backend, novo domínio do Hub Linguístico, etc.) altere apenas aqui.
   ========================================================================== */

const fbCfg = {
  apiKey: "AIzaSyA-LdSk34sspNiABm7wUn0_Jry-Qe2dqok",
  authDomain: "estudamais-e8a60.firebaseapp.com",
  projectId: "estudamais-e8a60",
  storageBucket: "estudamais-e8a60.firebasestorage.app",
  messagingSenderId: "1030390489355",
  appId: "1:1030390489355:web:4f09a3c04b6cd61ebe020e"
};

const HUB_ORIGIN = 'https://estuda-mais-theta.vercel.app';

try { firebase.initializeApp(fbCfg); } catch (e) {}
