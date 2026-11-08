/* ==========================================================================
   backup.js — cópias de segurança dos dados do usuário.
   - exportarBackup(): baixa um .json com TODAS as chaves de dados.
   - importarBackup(file): restaura (mesclando) após confirmação, criando
     antes um snapshot automático do estado atual.
   - criarSnapshot(motivo): guarda uma cópia no IndexedDB (últimos 5), usada
     automaticamente antes de migrações de dados e de atualizações.
   Nada aqui apaga dados: restaurar sempre cria um snapshot antes.
   ========================================================================== */
const BACKUP_DB = 'chancelaria_backups', BACKUP_STORE = 'snapshots', BACKUP_MAX = 5;

function coletarDadosUsuario() {
  const dados = {};
  CLOUD_KEYS.forEach(k => { const raw = localStorage.getItem(k); if (raw != null) { try { dados[k] = JSON.parse(raw); } catch (e) { dados[k] = raw; } } });
  return dados;
}
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
    const db = await _idb();
    const snap = { id: Date.now(), motivo: motivo || 'manual', versao: (typeof APP_INFO !== 'undefined' && APP_INFO.version) || '?', dados: coletarDadosUsuario() };
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
async function restaurarSnapshot(id) {
  const snap = (await listarSnapshots()).find(s => s.id === id); if (!snap) return;
  if (!await confirmar('Restaurar este ponto de restauração? O estado atual será guardado antes em um novo snapshot.', { titulo: 'Restaurar snapshot', ok: 'Restaurar', perigo: false })) return;
  await criarSnapshot('antes-de-restaurar');
  aplicarDadosBackup(snap.dados); toast('Snapshot restaurado. Recarregando…'); setTimeout(() => location.reload(), 900);
}
function aplicarDadosBackup(dados) { Object.keys(dados || {}).forEach(k => { if (CLOUD_KEYS.includes(k)) save(k, dados[k]); }); }

function exportarBackup() {
  const payload = { app: 'chancelaria', formato: 1, versao: (typeof APP_INFO !== 'undefined' && APP_INFO.version) || null, exportadoEm: new Date().toISOString(), dados: coletarDadosUsuario() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `chancelaria-backup-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Backup exportado.');
}
async function importarBackup(input) {
  const f = input.files && input.files[0]; input.value = ''; if (!f) return;
  try {
    const p = JSON.parse(await f.text());
    if (p.app !== 'chancelaria' || !p.dados) throw new Error('Arquivo não é um backup da Chancelaria.');
    const n = Object.keys(p.dados).filter(k => CLOUD_KEYS.includes(k)).length;
    if (!await confirmar(`Restaurar ${n} grupos de dados do backup de ${p.exportadoEm ? p.exportadoEm.slice(0, 10) : 'data desconhecida'}? Eles substituem os grupos de mesmo nome neste aparelho (um snapshot do estado atual é criado antes).`, { titulo: 'Importar backup', ok: 'Importar', perigo: false })) return;
    await criarSnapshot('antes-de-importar'); aplicarDadosBackup(p.dados);
    toast('Backup importado. Recarregando…'); setTimeout(() => location.reload(), 900);
  } catch (e) { toast('Backup inválido: ' + e.message, 'erro'); }
}
