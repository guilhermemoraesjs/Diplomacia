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

const CLOUD_KEYS = [
  'diplo_materias', 'diplo_cronograma', 'diplo_revisao', 'diplo_questoes',
  'diplo_discursivas', 'diplo_atualidades', 'diplo_notas',
  'biblio_docs', 'biblio_pastas', 'biblio_expanded_folders',
  'chancelaria_theme', 'diplo_paises', 'paises_favoritos', 'simulados_progresso',
  'dashboard_atividade', 'dashboard_streak', 'dashboard_metas', 'nav_order',
  'flash_cards', 'flash_streak_dias', 'flash_tempos',
  /* adicionadas na modernização v1.0.0 (todas novas — nenhuma substitui chave existente) */
  'chancelaria_prefs', 'diplo_questoes_hist', 'diplo_kb', 'diplo_estudo_log', 'srs_log'
];

/* Chaves locais que NÃO vão para a nuvem (estado do aparelho). Listadas aqui
   para o backup e a documentação saberem que existem. */
const LOCAL_ONLY_KEYS = ['chancelaria_dirty', 'chancelaria_schema', 'chancelaria_timer', 'chancelaria_version_seen', 'chancelaria_version_info', 'chancelaria_upd_dismissed', 'chancelaria_upd_target', 'biblio_rascunho', 'chancelaria_syncmeta', 'chancelaria_conflicts', 'chancelaria_device'];

let currentUid = null;

try { firebase.initializeApp(fbCfg); } catch (e) {}
/* Gancho SÓ para testes automatizados: se a página definir window.__FIREBASE_EMULATOR__ antes dos scripts
   ({firestore:'localhost:8080', auth:'http://localhost:9099'}), usa o Firebase Emulator Suite em vez da produção. */
try { if (window.__FIREBASE_EMULATOR__) { const [h, p] = window.__FIREBASE_EMULATOR__.firestore.split(':'); firebase.firestore().useEmulator(h, +p); firebase.auth().useEmulator(window.__FIREBASE_EMULATOR__.auth, { disableWarnings: true }); window.__EMU_ACTIVE = true; } } catch (e) { console.warn('emulador:', e); }
