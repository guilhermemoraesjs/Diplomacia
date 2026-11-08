/* ==========================================================================
   sw.js — Service Worker da Chancelaria.
   • O bloco @generated é produzido por scripts/sync-version.js a partir de
     version.json (fonte única). NÃO edite a versão aqui à mão.
   • Cache VERSIONADO: 'chancelaria-app-<versão>'. Ao ativar, apaga SÓ caches
     'chancelaria-app-*' antigos. Caches 'chancelaria-data-*' (JSON de países,
     provas, bibliotecas externas) são preservados. Dados do usuário
     (localStorage / IndexedDB / Firebase) NUNCA são tocados por este arquivo.
   • Não chama skipWaiting sozinho: a nova versão espera o usuário clicar em
     "Atualizar agora" (mensagem SKIP_WAITING), para não interromper estudo.
   ========================================================================== */
/* @generated:start (scripts/sync-version.js) */
const APP_VERSION = "1.0.0";
const APP_BUILD = 1;
const CACHE_APP = 'chancelaria-app-' + APP_VERSION;
const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/modern.css",
  "css/modulos.css",
  "css/style.css",
  "js/app.js",
  "js/atualidades.js",
  "js/backup.js",
  "js/biblioteca-busca.js",
  "js/biblioteca-documentos.js",
  "js/biblioteca-editor.js",
  "js/biblioteca-extras.js",
  "js/biblioteca-pastas.js",
  "js/biblioteca-revisao.js",
  "js/central.js",
  "js/config.js",
  "js/configuracoes.js",
  "js/conhecimento.js",
  "js/cronograma.js",
  "js/dashboard.js",
  "js/discursiva.js",
  "js/estudo-log.js",
  "js/flashcards-data.js",
  "js/flashcards-integracao.js",
  "js/flashcards-review.js",
  "js/flashcards-srs.js",
  "js/flashcards-stats.js",
  "js/flashcards-ui.js",
  "js/icons.js",
  "js/materias.js",
  "js/migrations.js",
  "js/navigation.js",
  "js/notas.js",
  "js/paises.js",
  "js/questoes.js",
  "js/revisao-hub.js",
  "js/revisao.js",
  "js/simulados.js",
  "js/srs-core.js",
  "js/stats.js",
  "js/theme-auth.js",
  "js/updater.js",
  "js/utils.js",
  "js/version.js",
  "vendor/d3.min.js",
  "vendor/topojson-client.min.js",
  "assets/logo-32.png",
  "assets/logo-64.png",
  "assets/logo-96.png",
  "assets/logo-180.png",
  "assets/logo-192.png",
  "assets/logo-512.png"
];
/* @generated:end */
const CACHE_DATA = 'chancelaria-data-v1';   // JSON de dados + bibliotecas externas (preservado entre versões)

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE_APP);
    // cache:'reload' ignora o cache HTTP do navegador: garante arquivos NOVOS no pré-cache
    await Promise.all(PRECACHE.map(async url => {
      try { const r = await fetch(new Request(url, { cache: 'reload' })); if (r.ok) await c.put(url === './' ? 'index.html' : url, r); } catch (err) { /* offline na instalação: segue */ }
    }));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n.startsWith('chancelaria-app-') && n !== CACHE_APP).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d.type === 'GET_VERSION' && e.source) e.source.postMessage({ type: 'VERSION', version: APP_VERSION, build: APP_BUILD });
});

const isHTMLNav = req => req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;

  // Nunca interceptar: Firestore / Auth / APIs (tráfego dinâmico)
  if (/(firestore|identitytoolkit|securetoken|googleapis)\.com$/.test(url.hostname) && !/fonts\./.test(url.hostname)) return;

  // SDK do Firebase e fontes: cache-first (permite abrir offline)
  if (url.origin !== location.origin) {
    if (/gstatic\.com|fonts\.googleapis\.com/.test(url.hostname)) {
      e.respondWith(caches.open(CACHE_DATA).then(async c => {
        const hit = await c.match(req); if (hit) return hit;
        try { const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; } catch (err) { return hit || Response.error(); }
      }));
    }
    return;
  }

  const path = url.pathname;
  // Arquivos de controle de versão: SEMPRE da rede, nunca do cache
  if (path.endsWith('/version.json') || path.endsWith('/sw.js')) { e.respondWith(fetch(req, { cache: 'no-store' })); return; }

  // Dados estáticos (JSON): stale-while-revalidate em cache preservado
  if (/\/data\/.+\.json$/.test(path)) {
    e.respondWith(caches.open(CACHE_DATA).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  // HTML / JS / CSS: rede primeiro (revalidando), cache só como plano B offline.
  // Evita servir HTML/JS antigos indefinidamente (problema clássico do iPhone).
  if (isHTMLNav(req) || /\.(js|css|webmanifest)$/.test(path)) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req, { cache: 'no-cache' });
        if (r.ok) { const c = await caches.open(CACHE_APP); c.put(isHTMLNav(req) ? 'index.html' : req, r.clone()); }
        return r;
      } catch (err) {
        const c = await caches.open(CACHE_APP);
        return (await c.match(isHTMLNav(req) ? 'index.html' : req, { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }

  // Imagens e vendor: cache primeiro
  e.respondWith((async () => {
    const c = await caches.open(CACHE_APP);
    const hit = await c.match(req, { ignoreSearch: true }); if (hit) return hit;
    try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; } catch (err) { return Response.error(); }
  })());
});
