/* ==========================================================================
   backup.js — cópias de segurança e recuperação dos dados do usuário.

   Formato do arquivo (v2): { app:'chancelaria', formato:2, versao, build, schema, exportadoEm,
     motivo, dispositivo, dados:{chave:valor}, local:{rascunhos/estado local recuperável},
     integridade:{algoritmo, hash, chaves, registros} }.
   Restaurar NUNCA é automático. Fluxo (restaurarBackup):
     1 validar estrutura · 2 identificar versão de origem · 3 apontar dados
     incompatíveis · 4 criar backup de segurança do estado atual (aborta se
     falhar) · 5 pedir confirmação · 6 aplicar com ROLLBACK em caso de erro ·
     7 verificar chave por chave; se divergir, desfaz tudo automaticamente.
   Snapshots automáticos (IndexedDB, últimos 10) antes de migrações,
   atualizações, restaurações e exclusões em massa.
   ========================================================================== */
const BACKUP_DB = 'chancelaria_backups', BACKUP_STORE = 'snapshots', BACKUP_MAX = 10, BACKUP_FORMATO = 2;
/* Estado local que também precisa ser recuperável (não vai para a nuvem). */
const LOCAL_RECUPERAVEIS = ['biblio_rascunho', 'chancelaria_timer'];
const TIPO_CHAVE = (() => { const t = {}; ['diplo_materias', 'diplo_cronograma', 'diplo_revisao', 'diplo_questoes', 'diplo_discursivas', 'diplo_atualidades', 'diplo_notas', 'biblio_docs', 'biblio_pastas', 'biblio_expanded_folders', 'diplo_paises', 'paises_favoritos', 'dashboard_atividade', 'dashboard_streak', 'nav_order', 'flash_cards', 'flash_streak_dias', 'flash_tempos', 'diplo_questoes_hist', 'diplo_kb', 'diplo_estudo_log', 'srs_log'].forEach(k => { t[k] = 'array'; }); ['simulados_progresso', 'dashboard_metas', 'chancelaria_prefs'].forEach(k => { t[k] = 'object'; }); t.chancelaria_theme = 'string'; return t; })();

/* ---- coleta ---- */
function coletarDadosUsuario() {
  const dados = {};
  CLOUD_KEYS.forEach(k => { const raw = localStorage.getItem(k); if (raw != null) { try { dados[k] = JSON.parse(raw); } catch (e) { dados[k] = raw; } } });
  return dados;
}
function coletarLocal() { const l = {}; LOCAL_RECUPERAVEIS.forEach(k => { const raw = localStorage.getItem(k); if (raw != null) { try { l[k] = JSON.parse(raw); } catch (e) { l[k] = raw; } } }); return l; }
function stableStringify(v) { if (v === null || typeof v !== 'object') return JSON.stringify(v); if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'; return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'; }
async function hashTexto(txt) {
  try { if (crypto && crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return 'sha256:' + [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); } } catch (e) {}
  let h = 0x811c9dc5; for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return 'fnv1a:' + h.toString(16);
}
function contarRegistros(dados) { let n = 0; Object.values(dados).forEach(v => { n += Array.isArray(v) ? v.length : 1; }); return n; }
async function montarBackup(motivo) {
  const dados = coletarDadosUsuario(), local = coletarLocal();
  return { app: 'chancelaria', formato: BACKUP_FORMATO, versao: (typeof APP_INFO !== 'undefined' && APP_INFO.version) || null, build: (typeof APP_INFO !== 'undefined' && APP_INFO.build) || null, schema: +localStorage.getItem('chancelaria_schema') || 0,
    exportadoEm: new Date().toISOString(), motivo: motivo || 'manual', dispositivo: typeof deviceId === 'function' ? deviceId() : null, dados, local,
    integridade: { algoritmo: 'sha256 do JSON canônico de {dados, local}', hash: await hashTexto(stableStringify({ dados, local })), chaves: Object.keys(dados).length, registros: contarRegistros(dados) } };
}

/* ---- validação ---- */
async function validarBackup(b) {
  const erros = [], avisos = [], r = { formato: b && b.formato, versao: b && b.versao, exportadoEm: b && b.exportadoEm, chaves: 0, registros: 0, desconhecidas: [], incompativeis: [], integridade: 'ausente' };
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, erros: ['O arquivo não contém um objeto JSON de backup.'], avisos, resumo: r };
  if (b.app !== 'chancelaria') erros.push('O arquivo não é um backup da Chancelaria (campo "app" ausente ou diferente).');
  if (!b.dados || typeof b.dados !== 'object' || Array.isArray(b.dados)) erros.push('O arquivo não tem a seção "dados".');
  if (b.formato !== 1 && b.formato !== 2) erros.push('Formato de backup desconhecido: ' + b.formato + '.');
  if (b.formato > BACKUP_FORMATO) erros.push('Este backup é de uma versão mais nova do aplicativo.');
  if (erros.length) return { ok: false, erros, avisos, resumo: r };
  Object.keys(b.dados).forEach(k => {
    if (!CLOUD_KEYS.includes(k)) { r.desconhecidas.push(k); return; }
    const v = b.dados[k], esperado = TIPO_CHAVE[k], real = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
    if (esperado && real !== esperado) r.incompativeis.push(`${k}: esperado ${esperado}, veio ${real}`);
  });
  r.chaves = Object.keys(b.dados).filter(k => CLOUD_KEYS.includes(k)).length; r.registros = contarRegistros(b.dados);
  if (b.local && typeof b.local !== 'object') erros.push('A seção "local" é inválida.');
  if (r.incompativeis.length) erros.push('Dados incompatíveis (tipo diferente do esperado): ' + r.incompativeis.join('; '));
  if (r.desconhecidas.length) avisos.push('Grupos desconhecidos serão ignorados: ' + r.desconhecidas.join(', '));
  if (!r.chaves) erros.push('O backup não contém nenhum grupo de dados reconhecido.');
  if (b.formato === 2 && b.integridade && b.integridade.hash) {
    const h = await hashTexto(stableStringify({ dados: b.dados, local: b.local || {} }));
    if (h.split(':')[0] !== b.integridade.hash.split(':')[0]) { r.integridade = 'indeterminada'; avisos.push('Não foi possível conferir a integridade neste navegador (algoritmo diferente).'); }
    else if (h === b.integridade.hash) r.integridade = 'ok'; else { r.integridade = 'falhou'; erros.push('Falha de integridade: o conteúdo do arquivo foi alterado ou está corrompido (hash não confere).'); }
  } else avisos.push(b.formato === 1 ? 'Backup no formato antigo (v1): sem verificação de integridade.' : 'Backup sem hash de integridade.');
  if (b.build && typeof APP_INFO !== 'undefined' && b.build > APP_INFO.build) avisos.push(`Backup gerado por uma versão mais nova (v${b.versao}) que a instalada (v${APP_INFO.version}).`);
  return { ok: erros.length === 0, erros, avisos, resumo: r };
}

/* ---- snapshots (IndexedDB) ---- */
function _idb() {
  return new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('IndexedDB indisponível'));
    const r = indexedDB.open(BACKUP_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(BACKUP_STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function criarSnapshot(motivo) {
  try {
    const db = await _idb(), b = await montarBackup(motivo), snap = Object.assign({ id: Date.now(), bytes: stableStringify(b).length }, b);
    await new Promise((res, rej) => { const tx = db.transaction(BACKUP_STORE, 'readwrite'); tx.objectStore(BACKUP_STORE).put(snap); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    const todos = await listarSnapshots();
    for (const s of todos.slice(BACKUP_MAX)) await new Promise(res => { const tx = db.transaction(BACKUP_STORE, 'readwrite'); tx.objectStore(BACKUP_STORE).delete(s.id); tx.oncomplete = res; });
    return snap.id;
  } catch (e) { console.warn('Snapshot não criado:', e); return null; }
}
async function listarSnapshots() {
  try {
    const db = await _idb();
    const all = await new Promise((res, rej) => { const r = db.transaction(BACKUP_STORE).objectStore(BACKUP_STORE).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return all.sort((a, b) => b.id - a.id);
  } catch (e) { return []; }
}
function _arquivo(nome, obj) { const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
async function exportarBackup() { const b = await montarBackup('exportacao-manual'); _arquivo(`chancelaria-backup-${todayISO()}-v${b.versao}.json`, b); toast('Backup completo exportado.'); renderSeguranca(); }
async function baixarSnapshot(id) { const s = (await listarSnapshots()).find(x => x.id === id); if (!s) return; const { bytes, id: _i, ...b } = s; _arquivo(`chancelaria-ponto-${new Date(id).toISOString().slice(0, 10)}.json`, b); }
async function criarPontoManual() { const id = await criarSnapshot('ponto-manual'); toast(id ? 'Ponto de restauração criado.' : 'Não foi possível criar o ponto de restauração.', id ? 'ok' : 'erro'); renderSeguranca(); }

/* ---- restauração segura ---- */
function _resumoDiff(b) {
  const atual = coletarDadosUsuario(); let novos = 0, mudam = 0, iguais = 0;
  Object.keys(b.dados).filter(k => CLOUD_KEYS.includes(k)).forEach(k => { if (!(k in atual)) novos++; else if (deepEqual(atual[k], b.dados[k])) iguais++; else mudam++; });
  return { novos, mudam, iguais };
}
function _modalRestauracao(v, d, origem) {
  const r = v.resumo;
  return new Promise(resolve => {
    const ov = document.createElement('div'); ov.className = 'modal-overlay show confirm-overlay';
    ov.innerHTML = `<div class="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="rbT"><h3 id="rbT">Restaurar backup?</h3>
      <div class="cr-form-info" style="margin:0 0 10px;">Origem: <b>${escHtml(origem)}</b><br>Gerado em: <b>${r.exportadoEm ? escHtml(new Date(r.exportadoEm).toLocaleString('pt-BR')) : 'data desconhecida'}</b> · versão <b>${escHtml(r.versao || '?')}</b> · formato ${escHtml(String(r.formato))}<br>Integridade: <b>${r.integridade === 'ok' ? 'conferida' : escHtml(r.integridade)}</b> · ${r.chaves} grupos, ${r.registros} registros</div>
      <p class="confirm-msg">Vão <b>substituir</b> ${d.mudam} grupo(s) deste aparelho e criar ${d.novos}; ${d.iguais} já são idênticos. Os demais grupos não mudam. Um ponto de restauração do estado atual <b>já foi criado</b> e você poderá voltar a ele.</p>
      ${v.avisos.length ? `<ul class="muted" style="font-size:13px;padding-left:18px;">${v.avisos.map(a => `<li>${escHtml(a)}</li>`).join('')}</ul>` : ''}
      <div class="modal-actions"><button class="btn ghost small" data-r="0">Cancelar</button><button class="btn small" data-r="1">Restaurar agora</button></div></div>`;
    ov.addEventListener('click', e => { if (e.target === ov) { ov.remove(); resolve(false); } const x = e.target.closest && e.target.closest('[data-r]'); if (x) { ov.remove(); resolve(x.dataset.r === '1'); } });
    document.body.appendChild(ov); ov.querySelector('[data-r="0"]').focus();
  });
}
/* Aplica com rollback. Retorna { ok, erro?, aplicadas }. */
function _aplicarBackup(b) {
  const chaves = Object.keys(b.dados).filter(k => CLOUD_KEYS.includes(k)), locais = Object.keys(b.local || {}).filter(k => LOCAL_RECUPERAVEIS.includes(k)), anterior = {};
  [...chaves, ...locais].forEach(k => { anterior[k] = localStorage.getItem(k); });
  const desfazer = () => Object.keys(anterior).forEach(k => { try { if (anterior[k] == null) localStorage.removeItem(k); else localStorage.setItem(k, anterior[k]); } catch (e) {} });
  try {
    chaves.forEach(k => localStorage.setItem(k, JSON.stringify(b.dados[k])));
    locais.forEach(k => localStorage.setItem(k, JSON.stringify(b.local[k])));
    for (const k of chaves) { const lido = JSON.parse(localStorage.getItem(k)); if (!deepEqual(lido, b.dados[k])) throw new Error('verificação falhou em ' + k); }
    for (const k of locais) { const lido = JSON.parse(localStorage.getItem(k)); if (!deepEqual(lido, b.local[k])) throw new Error('verificação falhou em ' + k); }
  } catch (e) {
    desfazer();
    const falhaRollback = Object.keys(anterior).filter(k => localStorage.getItem(k) !== anterior[k]);   // o rollback também é verificado
    return { ok: false, erro: String(e && e.message || e), rollbackIncompleto: falhaRollback };
  }
  return { ok: true, aplicadas: chaves, locais };
}
async function restaurarBackup(b, origem, opts) {
  opts = opts || {};
  const v = await validarBackup(b);                                                   // 1–3
  if (!v.ok) { toast('Backup recusado: ' + v.erros[0], 'erro'); return { ok: false, etapa: 'validacao', erros: v.erros }; }
  const seg = await criarSnapshot('antes-de-restaurar');                              // 4
  if (!seg) { toast('Não foi possível criar o backup de segurança do estado atual. Restauração cancelada.', 'erro'); return { ok: false, etapa: 'seguranca' }; }
  if (!opts.semConfirmar && !await _modalRestauracao(v, _resumoDiff(b), origem || 'arquivo')) return { ok: false, etapa: 'cancelado' };   // 5
  const r = _aplicarBackup(b);                                                        // 6–7
  if (!r.ok) { if (r.rollbackIncompleto && r.rollbackIncompleto.length) toast('A restauração falhou e NÃO foi possível desfazer por completo (' + r.rollbackIncompleto.join(', ') + '). Restaure o ponto "antes-de-restaurar" em Backup e segurança.', 'erro'); else toast('A restauração falhou e foi desfeita automaticamente (' + r.erro + '). Seus dados atuais foram mantidos.', 'erro'); return { ok: false, etapa: 'aplicacao', erro: r.erro, rollbackIncompleto: r.rollbackIncompleto || [] }; }
  r.aplicadas.forEach(k => syncKeyToCloud(k, b.dados[k]));                            // vira edição mais recente: sobe para a nuvem
  toast('Backup restaurado e verificado (' + r.aplicadas.length + ' grupos). Recarregando…'); if (!opts.semRecarregar) setTimeout(() => location.reload(), 1200);
  return { ok: true, aplicadas: r.aplicadas, segurancaId: seg };
}
async function importarBackup(input) {
  const f = input.files && input.files[0]; input.value = ''; if (!f) return;
  let b; try { b = JSON.parse(await f.text()); } catch (e) { toast('Arquivo inválido: não é um JSON legível.', 'erro'); return; }
  return restaurarBackup(b, 'arquivo ' + f.name);
}
async function restaurarSnapshot(id) {
  const s = (await listarSnapshots()).find(x => x.id === id); if (!s) return;
  const { bytes, id: _i, ...b } = s; return restaurarBackup(b, 'ponto de restauração de ' + new Date(id).toLocaleString('pt-BR'));
}
/* ---- integridade do que está salvo agora ---- */
function verificarIntegridadeLocal() {
  const problemas = [];
  CLOUD_KEYS.forEach(k => { const raw = localStorage.getItem(k); if (raw == null) return; let v; try { v = JSON.parse(raw); } catch (e) { problemas.push(`${k}: JSON inválido`); return; } const esp = TIPO_CHAVE[k], real = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v; if (esp && real !== esp) problemas.push(`${k}: esperado ${esp}, veio ${real}`); });
  return { ok: problemas.length === 0, problemas, chaves: CLOUD_KEYS.filter(k => localStorage.getItem(k) != null).length };
}
