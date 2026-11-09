/* ==========================================================================
   migracao.js — migração GRADUAL e REVERSÍVEL do Firestore:
   documento único  chancelaria_users/{uid}  →  um documento por chave
   chancelaria_users/{uid}/dados/{chave} = { valor, t, d, v:1 }.

   Só roda quando VOCÊ aciona (Configurações → Backup e segurança). Nunca apaga
   o documento legado. Passos de migrarEstrutura():
     1 sincroniza pendências · 2 snapshot local obrigatório · 3 TESTE DE PERMISSÃO
     (se as regras de produção ainda não permitem a subcoleção, para aqui sem
     alterar nada) · 4 cópia do legado em backup/legado-AAAAMMDD · 5 marca
     "copiando" em dados/__controle · 6 copia chave a chave (idempotente, retomável,
     sem duplicar: id do documento = chave) · 7 VALIDA numa transação (legado ==
     novo, chave a chave) e só então grava estrutura:2 · se algo divergir (edição
     concorrente), recopia e valida de novo (até 3 vezes).
   Depois da virada, as gravações vão para os documentos por chave e são
   espelhadas (melhor esforço) no legado, para versões 1.1.0 ainda abertas.
   reverterEstrutura() devolve tudo ao legado (após atualizá-lo e verificar).
   ========================================================================== */
const MIG = { ocupada: false, progresso: '', ultimoResultado: null };
const _migHook = n => (window.__MIG && window.__MIG[n]) || null;   // ganchos só para testes automatizados
function _controleRef() { return _dadosCol().doc('__controle'); }
function _migMsg(m) { MIG.progresso = m; try { renderMigracaoPainel(); } catch (e) {} }

async function _migTestarPermissao() {
  try { const r = _dadosCol().doc('__teste'); await r.set({ t: Date.now() }); await r.delete(); return { ok: true }; }
  catch (e) { return { ok: false, codigo: e && e.code, msg: e && e.message }; }
}
async function migracaoStatus() {
  const ls = await _ref().get(), leg = ls.exists ? ls.data() : {}, c = await _controleRef().get(), col = await _dadosCol().get().catch(() => null);
  let n = 0; if (col) col.forEach(d => { if (d.id !== '__controle') n++; });
  return { estrutura: c.exists && c.data().estrutura === 2 ? 2 : 1, controle: c.exists ? c.data() : null, docs: n, bytesLegado: new Blob([JSON.stringify(leg)]).size };
}

async function migrarEstrutura(opts) {
  opts = opts || {};
  const falha = (etapa, msg, extra) => { MIG.ultimoResultado = Object.assign({ ok: false, etapa, msg }, extra || {}); _migMsg(''); return MIG.ultimoResultado; };
  if (MIG.ocupada) return { ok: false, etapa: 'ocupada' };
  if (!currentUid) return falha('login', 'Entre com a sua conta para migrar.'); if (navigator.onLine === false) return falha('rede', 'Sem conexão.');
  MIG.ocupada = true;
  try {
    _migMsg('Enviando alterações pendentes…'); const f = await flushPendingSync(15000);
    if (!f.confirmado) toast(`${f.pendentes} grupo(s) ainda não confirmados na nuvem (por exemplo, por excederem o limite do documento único). Eles seguem salvos neste aparelho e serão enviados à nova estrutura depois da migração.`, 'aviso');
    _migMsg('Criando ponto de restauração local…'); if (!await criarSnapshot('pre-migracao-firestore')) return falha('snapshot', 'Não foi possível criar o ponto de restauração local. Nada foi alterado.');
    _migMsg('Verificando permissões das regras do Firestore…'); const perm = await _migTestarPermissao();
    if (!perm.ok) return falha('regras', 'As regras de segurança do seu projeto ainda não permitem a subcoleção "dados" (' + (perm.codigo || 'erro') + '). Publique as regras de infra/firestore.rules e tente de novo. NADA foi alterado.');
    const ref = _ref(), ctlRef = _controleRef(), ctl = await ctlRef.get();
    if (ctl.exists && ctl.data().estrutura === 2) { localStorage.setItem('chancelaria_estrutura', '2'); MIG.ultimoResultado = { ok: true, jaMigrada: true }; return MIG.ultimoResultado; }
    _migMsg('Guardando uma cópia do documento atual na nuvem…'); const ls0 = await ref.get(), leg0 = ls0.exists ? ls0.data() : {}, bref = ref.collection('backup').doc('legado-' + todayISO());
    if (!(await bref.get()).exists) { try { await bref.set(Object.assign({}, leg0, { __backup: { em: Date.now(), versao: APP_INFO.version } })); } catch (e) { return falha('backup', 'Não foi possível guardar a cópia de segurança na nuvem (' + (e && e.message) + '). Nada foi alterado.'); } }
    await ctlRef.set({ estrutura: 1, migracao: { estado: 'copiando', iniciadaEm: Date.now(), dispositivo: deviceId(), versao: APP_INFO.version } }, { merge: true });
    let divergentes = [];
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      const ls = await ref.get(), leg = ls.exists ? ls.data() : {}, lm = leg.__meta || {}, keys = CLOUD_KEYS.filter(k => leg[k] !== undefined); let i = 0;
      for (const k of keys) {
        _migMsg(`Copiando ${++i}/${keys.length}: ${k}…`);
        await firebase.firestore().runTransaction(async tx => {                                  // idempotente: só escreve se não existe ou se é cópia antiga de migração
          const nref = _dadosCol().doc(k), s = await tx.get(nref);
          if (!s.exists || (s.data().migrado && !deepEqual(s.data().valor, leg[k]))) tx.set(nref, { valor: leg[k], t: lm[k] ? lm[k].t : 0, d: (lm[k] && lm[k].d) || 'migracao', v: 1, migrado: true });
        });
        await ctlRef.set({ migracao: { feitas: firebase.firestore.FieldValue.arrayUnion(k) } }, { merge: true });
        const h = _migHook('aposChave'); if (h) await h(k, i);
      }
      const hv = _migHook('antesValidar'); if (hv) await hv(tentativa);
      _migMsg('Validando a cópia (legado × novo)…'); divergentes = [];
      await firebase.firestore().runTransaction(async tx => {
        divergentes = []; const ls2 = await tx.get(ref), l2 = ls2.exists ? ls2.data() : {}, ks = CLOUD_KEYS.filter(k => l2[k] !== undefined), docs = {};
        for (const k of ks) { const s = await tx.get(_dadosCol().doc(k)); docs[k] = s.exists ? s.data() : null; }
        ks.forEach(k => { if (!docs[k] || !deepEqual(docs[k].valor, l2[k])) divergentes.push(k); });
        if (!divergentes.length) tx.set(ctlRef, { estrutura: 2, migracao: { estado: 'concluida', validadaEm: Date.now(), chaves: ks.length, dispositivo: deviceId(), versao: APP_INFO.version } }, { merge: true });
      });
      if (!divergentes.length) break;
      _migMsg('Houve alteração durante a cópia (' + divergentes.join(', ') + '). Recopiando…');
    }
    if (divergentes.length) { await ctlRef.set({ estrutura: 1, migracao: { estado: 'interrompida', divergentes } }, { merge: true }); return falha('validacao', 'A validação encontrou divergências em: ' + divergentes.join(', ') + '. A estrutura NÃO foi alterada (nada se perdeu).', { divergentes }); }
    localStorage.setItem('chancelaria_estrutura', '2'); MIG.ultimoResultado = { ok: true }; _migMsg(''); toast('Migração concluída e validada. Seus dados agora ficam em um documento por grupo.'); return MIG.ultimoResultado;
  } catch (e) {
    console.error('Migração interrompida', e);
    try { await _controleRef().set({ migracao: { estado: 'interrompida', erro: String(e && e.message || e) } }, { merge: true }); } catch (e2) {}
    return falha('erro', 'A migração foi interrompida (' + (e && e.message || e) + '). Nada foi perdido: você pode retomar quando quiser.');
  } finally { MIG.ocupada = false; _migMsg(''); renderMigracaoPainel(); }
}

async function reverterEstrutura() {
  if (MIG.ocupada) return { ok: false, etapa: 'ocupada' }; MIG.ocupada = true;
  try {
    const ref = _ref(), ls = await ref.get(), leg = ls.exists ? ls.data() : {}, col = await _dadosCol().get(), docs = {}; col.forEach(d => { if (d.id !== '__controle') docs[d.id] = d.data(); });
    const { data, meta } = _compor(leg, docs); let atualizadas = 0;
    for (const k of Object.keys(data)) if (!deepEqual(leg[k], data[k])) {                                    // atualiza o legado com o que só existe/é mais novo nos documentos por chave
      try { await ref.set({ [k]: data[k], __meta: { [k]: meta[k] } }, { merge: true }); atualizadas++; } catch (e) { toast('Não foi possível atualizar "' + k + '" no documento legado (' + (e && e.message) + '). A estrutura NÃO foi revertida.', 'erro'); return { ok: false, etapa: 'legado', chave: k }; }
    }
    const v = (await ref.get()).data() || {}; const ruins = Object.keys(data).filter(k => !deepEqual(v[k], data[k]));
    if (ruins.length) { toast('Verificação falhou para: ' + ruins.join(', ') + '. Estrutura mantida.', 'erro'); return { ok: false, etapa: 'verificacao', ruins }; }
    await _controleRef().set({ estrutura: 1, migracao: { estado: 'revertida', revertidaEm: Date.now() } }, { merge: true }); localStorage.setItem('chancelaria_estrutura', '1');
    toast('Estrutura revertida para o documento único (' + atualizadas + ' grupo(s) atualizados). Os documentos por chave foram mantidos como cópia.'); return { ok: true, atualizadas };
  } catch (e) { toast('Falha ao reverter: ' + (e && e.message || e), 'erro'); return { ok: false, etapa: 'erro' }; }
  finally { MIG.ocupada = false; renderMigracaoPainel(); }
}

/* ---- painel (dentro de Backup e segurança) ---- */
async function renderMigracaoPainel() {
  const el = document.getElementById('segEstrutura'); if (!el) return;
  if (!currentUid) { el.innerHTML = '<div class="muted" style="font-size:13px;">Entre com a sua conta para ver a estrutura dos dados na nuvem.</div>'; return; }
  const est = _estrutura(), tam = typeof cfgTamanhoDados === 'function' ? cfgTamanhoDados() : 0;
  el.innerHTML = `<div class="panel-title" style="margin-top:18px;">Estrutura dos dados na nuvem</div>
    <p style="margin:0 0 8px;"><b>${est === 2 ? 'Um documento por grupo de dados (migrada)' : 'Documento único (estrutura original)'}</b>${est === 1 ? ` — ${tam} KB de ~1024 KB` : ''}</p>
    ${est === 2 && _sync.legadoFalhando ? '<div class="badge warn" style="margin-bottom:8px;">O espelho no documento antigo falhou (provavelmente por tamanho). Isso é esperado e não afeta o app novo; versões antigas abertas em outros aparelhos deixarão de ver novidades.</div>' : ''}
    ${MIG.progresso ? `<div class="loading" role="status">${escHtml(MIG.progresso)}</div>` : ''}
    <div class="row">${est === 1 ? `<button class="btn secondary small" id="migBtn" onclick="migracaoClicar()" ${MIG.ocupada ? 'disabled' : ''}>Migrar para um documento por grupo</button>` : `<button class="btn ghost small" onclick="migracaoReverterClicar()" ${MIG.ocupada ? 'disabled' : ''}>Reverter para o documento único</button>`}</div>
    <p class="muted" style="font-size:12.5px;margin:8px 0 0;">${est === 1 ? 'Remove o limite de ~1 MiB para o total dos dados (cada grupo passa a ter o seu). A migração é gradual, validada e reversível, nunca apaga o documento atual e começa criando um ponto de restauração e testando as permissões do Firestore. Atualize o app em todos os seus aparelhos antes (v1.2.0 ou mais nova).' : 'O documento antigo continua sendo mantido como cópia de segurança.'}</p>
    ${MIG.ultimoResultado && !MIG.ultimoResultado.ok ? `<div class="form-erro" role="alert">${escHtml(MIG.ultimoResultado.msg || '')}</div>` : ''}`;
}
async function migracaoClicar() {
  if (!await confirmar('A migração copia cada grupo de dados para um documento próprio na nuvem, valida a cópia e só então passa a usá-la. Nada é apagado e dá para reverter. Antes, será criado um ponto de restauração. Continuar?', { titulo: 'Migrar estrutura na nuvem', ok: 'Migrar', perigo: false })) return;
  const r = await migrarEstrutura(); if (!r.ok) toast(r.msg || 'Migração não concluída.', 'erro'); renderSeguranca();
}
async function migracaoReverterClicar() { if (!await confirmar('Voltar a usar o documento único? O documento antigo será atualizado com os dados atuais e verificado antes de a estrutura mudar.', { titulo: 'Reverter estrutura', ok: 'Reverter', perigo: false })) return; await reverterEstrutura(); renderSeguranca(); }
