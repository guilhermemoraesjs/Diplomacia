/* ==========================================================================
   updater.js — sistema automático de atualização da Chancelaria.

   FONTE ÚNICA: version.json (publicado junto do site). Instalada = APP_INFO
   (js/version.js, gerado de version.json por scripts/sync-version.js).
   Publicada  = version.json buscado com cache:'no-store' + parâmetro único.
   Comparação por APP_INFO.build (inteiro monotônico).

   Quando checa: ao abrir (3 s), a cada 10 min, ao voltar à aba/app (no
   máximo 1x/min), ao voltar a ficar online e ao abrir Configurações → Versão.

   Atualizar agora: 1) flush dos dados pendentes + snapshot, 2) pede ao
   Service Worker a nova versão, 3) espera ele assumir o controle,
   4) recarrega, 5) CONFIRMA (no boot seguinte) que o build novo carregou —
   só então mostra "atualizado". Nunca limpa localStorage/IndexedDB/Firebase.
   ========================================================================== */
const UPD_INTERVALO_MS = 10 * 60 * 1000;
const UPD_MIN_GAP_MS = 60 * 1000;
const UPD_DISPENSA_MS = 2 * 60 * 60 * 1000;
const UPD = { ultimaChecagem: 0, nova: null, ocupado: false, ultimoResultado: null };

function updLerJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function updGravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

/* Versão publicada, sempre da rede. Retorna { ok, info } ou { ok:false, motivo } */
async function updBuscarPublicada() {
  if (navigator.onLine === false) return { ok: false, motivo: 'offline' };
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch('version.json?ts=' + Date.now(), { cache: 'no-store', signal: ctl.signal, headers: { 'Cache-Control': 'no-cache' } });
    clearTimeout(t);
    if (!r.ok) return { ok: false, motivo: 'http-' + r.status };
    const info = await r.json();
    if (!info || !Number.isInteger(info.build) || !info.version) return { ok: false, motivo: 'invalido' };
    return { ok: true, info };
  } catch (e) { return { ok: false, motivo: navigator.onLine === false ? 'offline' : 'rede' }; }
}

/* status: 'atual' | 'nova' | 'offline' | 'erro' */
async function checkUpdate(opts) {
  opts = opts || {};
  const agora = Date.now();
  if (!opts.manual && agora - UPD.ultimaChecagem < UPD_MIN_GAP_MS) return UPD.ultimoResultado;
  UPD.ultimaChecagem = agora;
  try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch (e) {}
  const pub = await updBuscarPublicada();
  let res;
  if (!pub.ok) res = { status: pub.motivo === 'offline' ? 'offline' : 'erro', motivo: pub.motivo, checadoEm: agora };
  else if (pub.info.build > APP_INFO.build) { UPD.nova = pub.info; res = { status: 'nova', info: pub.info, checadoEm: agora }; }
  else { UPD.nova = null; res = { status: 'atual', info: pub.info, checadoEm: agora }; }
  UPD.ultimoResultado = res;
  const meta = updLerJSON('chancelaria_version_info') || {};
  meta.checadoEm = agora; if (pub.ok) meta.publicada = { version: pub.info.version, build: pub.info.build };
  updGravar('chancelaria_version_info', meta);
  updAtualizarUI(opts.manual);
  return res;
}

/* ---- Aviso visual ---- */
function updDispensado() { const d = updLerJSON('chancelaria_upd_dismissed'); return !!(d && UPD.nova && d.build === UPD.nova.build && Date.now() - d.em < UPD_DISPENSA_MS); }
function updMostrarBanner(msgOcupado) {
  let el = document.getElementById('updBanner');
  if (!UPD.nova && !msgOcupado) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'updBanner'; el.className = 'upd-banner'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
  if (msgOcupado) { el.innerHTML = `<div class="upd-ico">${typeof icon === 'function' ? icon('refresh') : ''}</div><div class="upd-body"><strong>${escHtml(msgOcupado)}</strong><span>Não feche nem recarregue esta página.</span></div>`; return; }
  el.innerHTML = `<div class="upd-ico">${typeof icon === 'function' ? icon('sparkle') : ''}</div>
    <div class="upd-body"><strong>Nova versão disponível</strong>
      <span>A Chancelaria possui uma atualização disponível.</span>
      <span class="upd-vers">Versão instalada: <b>v${escHtml(APP_INFO.version)}</b> · Nova versão: <b>v${escHtml(UPD.nova.version)}</b></span></div>
    <div class="upd-actions"><button class="btn secondary small" onclick="applyUpdate()">Atualizar agora</button><button class="btn ghost small" onclick="updDispensar()">Depois</button></div>`;
}
function updDispensar() { if (UPD.nova) updGravar('chancelaria_upd_dismissed', { build: UPD.nova.build, em: Date.now() }); const el = document.getElementById('updBanner'); if (el) el.remove(); updAtualizarUI(); }
function updAtualizarUI(manual) {
  document.body.classList.toggle('has-update', !!UPD.nova);
  if (UPD.nova && !updDispensado()) updMostrarBanner(); else if (!UPD.ocupado) { const el = document.getElementById('updBanner'); if (el && !UPD.nova) el.remove(); }
  renderVersionPanel();
  if (manual && UPD.ultimoResultado) {
    const r = UPD.ultimoResultado;
    if (r.status === 'atual') toast(`Você está na versão mais recente (v${APP_INFO.version}).`);
    else if (r.status === 'offline') toast(`Sem conexão: não foi possível verificar. Versão instalada: v${APP_INFO.version}.`, 'aviso');
    else if (r.status === 'erro') toast('Não foi possível verificar agora. Tente novamente em instantes.', 'aviso');
  }
}

/* ---- Aplicar atualização ---- */
function updAguardar(cond, ms) { return new Promise(res => { const ini = Date.now(); (function t() { if (cond() || Date.now() - ini > ms) return res(cond()); setTimeout(t, 150); })(); }); }

async function applyUpdate() {
  if (UPD.ocupado) return; UPD.ocupado = true;
  const alvo = UPD.nova || (UPD.ultimoResultado && UPD.ultimoResultado.info) || { version: '?', build: APP_INFO.build + 1 };
  try {
    updMostrarBanner('Salvando seus dados…');
    const f = await flushPendingSync(8000);
    await criarSnapshot('pre-atualizacao-v' + alvo.version);
    if (!f.confirmado) toast(`${f.pendentes} grupo(s) de dados seguem salvos neste aparelho e serão enviados à nuvem depois.`, 'aviso');

    updMostrarBanner('Baixando a nova versão…');
    let trocou = false;
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update().catch(() => {});
        await updAguardar(() => !reg.installing, 25000);                       // espera terminar de instalar
        if (reg.waiting) {
          updMostrarBanner('Ativando a nova versão…');
          const mudou = new Promise(res => navigator.serviceWorker.addEventListener('controllerchange', () => res(true), { once: true }));
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          trocou = await Promise.race([mudou, new Promise(r => setTimeout(() => r(false), 10000))]);
        }
      }
    }
    updGravar('chancelaria_upd_target', { build: alvo.build, version: alvo.version, em: Date.now(), tentativas: (updLerJSON('chancelaria_upd_target') || {}).tentativas || 0 });
    updMostrarBanner('Recarregando…');
    setTimeout(() => location.reload(), trocou ? 200 : 400);
  } catch (e) {
    console.error('Falha ao atualizar', e); UPD.ocupado = false;
    toast('Não foi possível concluir a atualização. Seus dados estão intactos. Tente novamente.', 'erro'); updAtualizarUI();
  }
}

/* Último recurso (iPhone preso em versão antiga): remove SÓ o Service Worker e os
   caches 'chancelaria-app-*'; dados do usuário não são tocados. */
async function forcarAtualizacao() {
  const alvo = updLerJSON('chancelaria_upd_target') || {};
  alvo.tentativas = (alvo.tentativas || 0) + 1; updGravar('chancelaria_upd_target', alvo);
  try { await flushPendingSync(5000); } catch (e) {}
  try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); } catch (e) {}
  try { const ns = await caches.keys(); await Promise.all(ns.filter(n => n.startsWith('chancelaria-app-')).map(n => caches.delete(n))); } catch (e) {}
  location.replace(location.pathname + '?atualizado=' + Date.now());
}

/* Boot: confirma que a versão pedida realmente carregou */
function updVerificarPosAtualizacao() {
  const visto = updLerJSON('chancelaria_version_seen');
  if (!visto || visto.build !== APP_INFO.build) {
    updGravar('chancelaria_version_seen', { build: APP_INFO.build, version: APP_INFO.version, em: Date.now() });
    if (visto && visto.build < APP_INFO.build) setTimeout(() => toast(`Chancelaria atualizada para a versão v${APP_INFO.version}.`), 1200);
  }
  const alvo = updLerJSON('chancelaria_upd_target'); if (!alvo) return;
  if (APP_INFO.build >= alvo.build) { localStorage.removeItem('chancelaria_upd_target'); localStorage.removeItem('chancelaria_upd_dismissed'); if (history.replaceState && /atualizado=/.test(location.search)) history.replaceState(null, '', location.pathname); return; }
  if ((alvo.tentativas || 0) >= 2) { localStorage.removeItem('chancelaria_upd_target'); setTimeout(() => toast(`Não foi possível carregar a v${alvo.version}. Continue usando a v${APP_INFO.version} e tente de novo mais tarde.`, 'erro'), 1500); return; }
  UPD.nova = { version: alvo.version, build: alvo.build };
  const el = document.createElement('div'); el.id = 'updBanner'; el.className = 'upd-banner erro'; el.setAttribute('role', 'alert');
  el.innerHTML = `<div class="upd-body"><strong>A atualização ainda não foi carregada</strong><span>O navegador manteve a v${escHtml(APP_INFO.version)}. Seus dados estão intactos.</span></div><div class="upd-actions"><button class="btn secondary small" onclick="forcarAtualizacao()">Forçar atualização</button></div>`;
  document.body.appendChild(el);
}

/* ---- Painel de informações da versão (Configurações) ---- */
function renderVersionPanel() {
  const el = document.getElementById('versionPanel'); if (!el) return;
  const visto = updLerJSON('chancelaria_version_seen') || {};
  const meta = updLerJSON('chancelaria_version_info') || {};
  const r = UPD.ultimoResultado;
  let msg = '<span class="vp-status neutro">Ainda não verificado nesta sessão.</span>';
  if (UPD.ocupado) msg = '<span class="vp-status neutro">Atualizando…</span>';
  else if (r && r.status === 'atual') msg = '<span class="vp-status ok">Sistema atualizado.</span>';
  else if (r && r.status === 'nova') msg = `<span class="vp-status aviso">Nova versão disponível: v${escHtml(r.info.version)}.</span>`;
  else if (r && r.status === 'offline') msg = '<span class="vp-status aviso">Sem conexão: não foi possível verificar.</span>';
  else if (r && r.status === 'erro') msg = '<span class="vp-status aviso">Não foi possível verificar agora.</span>';
  const fmt = ms => ms ? new Date(ms).toLocaleString('pt-BR') : '—';
  el.innerHTML = `
    <div class="vp-grid">
      <div><span class="vp-l">Versão instalada</span><b class="vp-v">v${escHtml(APP_INFO.version)}</b><small>build ${APP_INFO.build} · publicada em ${escHtml(isoToBR(APP_INFO.date))}</small></div>
      <div><span class="vp-l">Instalada neste aparelho em</span><b class="vp-v2">${fmt(visto.em)}</b></div>
      <div><span class="vp-l">Última verificação</span><b class="vp-v2">${fmt(meta.checadoEm)}</b></div>
    </div>
    <div class="vp-linha">${msg}</div>
    <div class="vp-botoes">
      <button class="btn secondary small" onclick="checkUpdate({manual:true})">${typeof icon === 'function' ? icon('refresh') : ''} Verificar atualizações</button>
      ${UPD.nova ? `<button class="btn small" onclick="applyUpdate()">Atualizar para v${escHtml(UPD.nova.version)}</button>` : ''}
    </div>
    <p class="vp-nota">Seus dados nunca são apagados na atualização. ${pendingSyncCount() ? `<b>${pendingSyncCount()}</b> grupo(s) aguardam envio à nuvem.` : 'Tudo sincronizado.'}</p>`;
}

/* ---- Boot ---- */
(function iniciarUpdater() {
  updVerificarPosAtualizacao();
  renderVersionPanel();
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(e => console.warn('Service Worker não registrado:', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!UPD.ocupado) checkUpdate({ manual: false }); });
  setTimeout(() => checkUpdate(), 3000);
  setInterval(() => checkUpdate(), UPD_INTERVALO_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
  window.addEventListener('online', () => checkUpdate());
})();
