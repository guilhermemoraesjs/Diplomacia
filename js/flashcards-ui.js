/* ==========================================================================
   flashcards-ui.js — módulo "Flashcards → Interface": alterna os painéis
   (Painel/Revisar/Meus Cards/Criar/Estatísticas), desenha o dashboard, a
   listagem filtrada e paginada (suporta milhares de cartões sem travar) e
   o formulário de criação/edição para os 5 tipos de cartão. Também expõe
   renderFlashReviewCard(), chamada pelo flashcards-review.js para pintar
   a frente/verso durante a sessão.
   ========================================================================== */

const FLASH_PAGE_SIZE = 40;
let flashListaFiltrada = [];
let flashListaPagina = 1;
let flashListaFiltroEstados = [];
let flashCriarTipoAtual = 'basico';
let flashCriarEditandoId = null;
let flashCriarEditandoGrupoCloze = null;
let flashTagsAtual = [];
let flashRevisarFiltroEstados = [];

function initFlashcardsTab() {
  flashRebuildIndex();
  flashPopularDatalists();
  flashRenderDashboard();
  if (!flashReviewAtiva) flashRenderRevisarFiltros();
}

function flashShowPanel(panel) {
  ['dashboard', 'revisar', 'calendario', 'lista', 'criar', 'estatisticas'].forEach(p => {
    const el = document.getElementById('flashPanel' + p.charAt(0).toUpperCase() + p.slice(1));
    if (el) el.style.display = p === panel ? 'block' : 'none';
  });
  document.querySelectorAll('#flashSubtabs .subtab-btn').forEach(b => b.classList.toggle('active', b.dataset.fsub === panel));
  if (panel === 'dashboard') flashRenderDashboard();
  if (panel === 'lista') flashRenderListaFiltros();
  if (panel === 'estatisticas') flashRenderEstatisticas();
  if (panel === 'revisar' && !flashReviewAtiva) flashRenderRevisarFiltros();
  if (panel === 'calendario') flashRenderCalendario();
}

function flashPopularDatalists() {
  const discList = document.getElementById('flashDisciplinaDatalist');
  if (discList) discList.innerHTML = flashListaDisciplinas().map(d => `<option value="${flashEsc(d)}">`).join('');
  const temaList = document.getElementById('flashTemaDatalist');
  if (temaList) temaList.innerHTML = flashListaTemas().map(t => `<option value="${flashEsc(t)}">`).join('');
}

/* ==========================================================================
   DASHBOARD
   ========================================================================== */
function flashRenderDashboard() {
  const st = flashCalcularStats();
  const grid = document.getElementById('flashDashStats');
  if (grid) grid.innerHTML = `
    <div class="dash-stat"><span class="dash-stat-ic" style="background:#2E5BFF22; color:#6C8DFF;">📅</span><div><div class="dash-stat-label">Para hoje</div><div class="dash-stat-n">${st.paraHoje}</div><div class="dash-stat-sub">cartões prontos</div></div></div>
    <div class="dash-stat"><span class="dash-stat-ic" style="background:#C24B4B22; color:#E37B7B;">⏰</span><div><div class="dash-stat-label">Vencidos</div><div class="dash-stat-n">${st.vencidos}</div><div class="dash-stat-sub">atrasados</div></div></div>
    <div class="dash-stat"><span class="dash-stat-ic" style="background:#5C7A4F22; color:#7FA36A;">🎯</span><div><div class="dash-stat-label">Taxa de acerto</div><div class="dash-stat-n">${st.pctAcerto}%</div><div class="dash-stat-sub">${st.totalAcertos + st.totalErros} revisões</div></div></div>
    <div class="dash-stat"><span class="dash-stat-ic" style="background:#E3C48122; color:#E3C481;">🔥</span><div><div class="dash-stat-label">Sequência</div><div class="dash-stat-n">${st.streak}</div><div class="dash-stat-sub">dia(s) seguidos</div></div></div>
    <div class="dash-stat"><span class="dash-stat-ic" style="background:#B490FF22; color:#B490FF;">⏱️</span><div><div class="dash-stat-label">Tempo médio</div><div class="dash-stat-n">${flashFmtSeg(st.tempoMedioSeg)}</div><div class="dash-stat-sub">por cartão</div></div></div>
    <div class="dash-stat"><span class="dash-stat-ic" style="background:#2EC4B622; color:#2EC4B6;">🗂️</span><div><div class="dash-stat-label">Total de cartões</div><div class="dash-stat-n">${st.total}</div><div class="dash-stat-sub">no acervo</div></div></div>
  `;
  const sec = document.getElementById('flashDashGridSecondary');
  if (sec) sec.innerHTML = `
    <div class="card">
      <div class="panel-section-title">Disciplina mais revisada</div>
      <div class="flash-dash-line">${st.disciplinaMaisRevisada ? `📚 ${flashEsc(st.disciplinaMaisRevisada)}` : '<span style="color:var(--text-muted);">Ainda sem revisões suficientes.</span>'}</div>
      <div class="panel-section-title" style="margin-top:16px;">Disciplina com mais erros</div>
      <div class="flash-dash-line">${st.disciplinaComMaisErros ? `⚠️ ${flashEsc(st.disciplinaComMaisErros)}` : '<span style="color:var(--text-muted);">Nenhum erro registrado ainda.</span>'}</div>
    </div>
  `;
  const titulo = document.getElementById('flashHojeTitulo');
  const sub = document.getElementById('flashHojeSub');
  const btn = document.getElementById('flashIniciarBtn');
  if (titulo && btn) {
    if (st.paraHoje === 0) {
      titulo.textContent = st.total === 0 ? 'Nenhum flashcard cadastrado ainda' : 'Tudo em dia por aqui 🎉';
      sub.textContent = st.total === 0 ? 'Crie seu primeiro cartão na aba "Criar".' : 'Nenhum cartão pendente de revisão agora.';
      btn.disabled = true; btn.textContent = 'Nada pendente';
    } else {
      titulo.textContent = `${st.paraHoje} cartão${st.paraHoje === 1 ? '' : 's'} pronto${st.paraHoje === 1 ? '' : 's'} para revisar`;
      sub.textContent = st.vencidos ? `${st.vencidos} deles estão vencidos.` : 'Nenhum atraso — bom trabalho.';
      btn.disabled = false; btn.textContent = 'Iniciar Revisão';
    }
  }
}

function flashIniciarRevisaoDashboard() {
  const fila = flashConstruirFila({});
  if (!fila.length) return;
  flashIniciarSessao(fila);
}

/* ==========================================================================
   ABA REVISAR — filtros avançados + sessão (a sessão em si mora no
   flashcards-review.js; aqui só cuidamos do formulário de filtros).
   ========================================================================== */
function flashRenderRevisarFiltros() {
  const selDisc = document.getElementById('flashRevFiltroDisciplina');
  if (selDisc) selDisc.innerHTML = '<option value="">Todas as disciplinas</option>' + flashListaDisciplinas().map(d => `<option value="${flashEsc(d)}">${flashEsc(d)}</option>`).join('');
  flashAtualizarTemasRevisar();
  const cont = document.getElementById('flashRevFiltroEstados');
  if (cont) cont.innerHTML = ['vencido', 'novo', 'aprendizado', 'maduro'].map(e => `
    <button type="button" class="chip ${flashRevisarFiltroEstados.includes(e) ? 'active' : ''}" onclick="flashToggleRevisarEstado('${e}')">${flashLabelEstado(e)}</button>
  `).join('');
  flashAtualizarContagemRevisar();
}
function flashAtualizarTemasRevisar() {
  const disc = document.getElementById('flashRevFiltroDisciplina')?.value || '';
  const selTema = document.getElementById('flashRevFiltroTema');
  if (selTema) selTema.innerHTML = '<option value="">Todos os temas</option>' + flashListaTemas(disc).map(t => `<option value="${flashEsc(t)}">${flashEsc(t)}</option>`).join('');
  flashAtualizarContagemRevisar();
}
function flashToggleRevisarEstado(e) {
  const i = flashRevisarFiltroEstados.indexOf(e);
  if (i >= 0) flashRevisarFiltroEstados.splice(i, 1); else flashRevisarFiltroEstados.push(e);
  flashRenderRevisarFiltros();
}
function flashLerFiltrosRevisar() {
  return {
    disciplina: document.getElementById('flashRevFiltroDisciplina')?.value || '',
    tema: document.getElementById('flashRevFiltroTema')?.value || '',
    dificuldade: document.getElementById('flashRevFiltroDificuldade')?.value || '',
    estados: flashRevisarFiltroEstados
  };
}
function flashAtualizarContagemRevisar() {
  const n = flashConstruirFila(flashLerFiltrosRevisar()).length;
  const el = document.getElementById('flashRevFiltroContagem'); if (el) el.textContent = `${n} cartão${n === 1 ? '' : 's'} nessa seleção`;
  const btn = document.getElementById('flashRevIniciarFiltradoBtn'); if (btn) btn.disabled = n === 0;
}
function flashIniciarRevisaoFiltrada() {
  const fila = flashConstruirFila(flashLerFiltrosRevisar());
  if (!fila.length) return;
  flashIniciarSessao(fila);
}
function flashLabelEstado(e) {
  return { vencido: '⏰ Vencidos', novo: '🆕 Novos', aprendizado: '🌱 Em aprendizado', maduro: '🌳 Maduros' }[e] || e;
}

/* ==========================================================================
   RENDER DA SESSÃO DE REVISÃO (chamado por flashcards-review.js)
   ========================================================================== */
function renderFlashReviewCard(card, revelado) {
  const info = flashTipoInfo(card.tipo);
  document.getElementById('flashReviewProgress').textContent = `${flashReviewIdx + 1} / ${flashReviewQueue.length}`;
  document.getElementById('flashReviewTipoBadge').innerHTML = `<span class="flash-tipo-badge">${info.icone} ${info.label}</span>`;
  document.getElementById('flashReviewMeta').textContent = [card.disciplina, card.tema, card.subtema].filter(Boolean).join(' · ') || 'Sem classificação';
  document.getElementById('flashReviewFrente').innerHTML = flashRenderFrenteHTML(card);

  const versoWrap = document.getElementById('flashReviewVersoWrap');
  const mostrarBtn = document.getElementById('flashMostrarBtn');
  const rateRow = document.getElementById('flashRateRow');
  if (revelado) {
    document.getElementById('flashReviewVerso').innerHTML = flashRenderVersoHTML(card);
    versoWrap.style.display = 'block';
    versoWrap.classList.remove('flash-fade-in'); void versoWrap.offsetWidth; versoWrap.classList.add('flash-fade-in');
    mostrarBtn.style.display = 'none';
    rateRow.style.display = 'flex';
    ['again', 'hard', 'good', 'easy'].forEach(q => {
      const dias = flashPreviewIntervalo(card, q);
      const hint = document.getElementById('flashHint_' + q);
      if (hint) hint.textContent = flashFormatDias(dias);
    });
  } else {
    versoWrap.style.display = 'none';
    mostrarBtn.style.display = 'inline-flex';
    rateRow.style.display = 'none';
  }
}

function flashRenderFrenteHTML(card) {
  switch (card.tipo) {
    case 'cloze':
      return `<div class="flash-cloze-text">${flashRenderClozeTexto(card.clozeTexto, card.clozeIndex, false)}</div>`;
    case 'comparacao':
      return `<div class="flash-front-text">${flashNl2Br(card.frente || `${card.comparacaoA.titulo} × ${card.comparacaoB.titulo}`)}</div>`;
    case 'imagem':
      return `${card.imagemFrenteUrl ? `<img class="flash-card-img" src="${card.imagemFrenteUrl}" alt="">` : ''}${card.frente ? `<div class="flash-front-text">${flashNl2Br(card.frente)}</div>` : ''}`;
    default:
      return `<div class="flash-front-text">${flashNl2Br(card.frente)}</div>`;
  }
}
function flashRenderVersoHTML(card) {
  switch (card.tipo) {
    case 'cloze':
      return `<div class="flash-cloze-text">${flashRenderClozeTexto(card.clozeTexto, card.clozeIndex, true)}</div>`;
    case 'comparacao':
      return `<div class="flash-compare-grid">
        <div class="flash-compare-col"><h4>${flashEsc(card.comparacaoA.titulo)}</h4><div>${flashNl2Br(card.comparacaoA.conteudo)}</div></div>
        <div class="flash-compare-col"><h4>${flashEsc(card.comparacaoB.titulo)}</h4><div>${flashNl2Br(card.comparacaoB.conteudo)}</div></div>
      </div>`;
    case 'imagem':
      return `${card.imagemVersoUrl ? `<img class="flash-card-img" src="${card.imagemVersoUrl}" alt="">` : ''}${card.verso ? `<div class="flash-front-text">${flashNl2Br(card.verso)}</div>` : ''}`;
    default:
      return `<div class="flash-front-text">${flashNl2Br(card.verso)}</div>`;
  }
}

/* ==========================================================================
   ABA "MEUS FLASHCARDS" — lista com filtros avançados + paginação simples
   (renderiza só a página visível; "Carregar mais" só ANEXA ao DOM, sem
   redesenhar tudo de novo — importante para não travar com milhares de
   cartões).
   ========================================================================== */
function flashRenderListaFiltros() {
  const selDisc = document.getElementById('flashListaFiltroDisciplina');
  if (selDisc && !selDisc.dataset.built) {
    selDisc.dataset.built = '1';
    selDisc.innerHTML = '<option value="">Todas as disciplinas</option>' + flashListaDisciplinas().map(d => `<option value="${flashEsc(d)}">${flashEsc(d)}</option>`).join('');
  }
  const cont = document.getElementById('flashListaFiltroEstados');
  if (cont && !cont.dataset.built) {
    cont.dataset.built = '1';
    cont.innerHTML = ['vencido', 'novo', 'aprendizado', 'maduro'].map(e => `<button type="button" class="chip" onclick="flashToggleListaEstado('${e}')">${flashLabelEstado(e)}</button>`).join('');
  }
  flashAplicarFiltrosLista();
}
function flashToggleListaEstado(e) {
  const i = flashListaFiltroEstados.indexOf(e);
  if (i >= 0) flashListaFiltroEstados.splice(i, 1); else flashListaFiltroEstados.push(e);
  const estados = ['vencido', 'novo', 'aprendizado', 'maduro'];
  document.querySelectorAll('#flashListaFiltroEstados .chip').forEach((b, idx) => {
    b.classList.toggle('active', flashListaFiltroEstados.includes(estados[idx]));
  });
  flashAplicarFiltrosLista();
}

let flashListaBuscaTimeout = null;
function flashOnBuscaLista() {
  clearTimeout(flashListaBuscaTimeout);
  flashListaBuscaTimeout = setTimeout(flashAplicarFiltrosLista, 180);
}

function flashAplicarFiltrosLista() {
  const busca = (document.getElementById('flashListaBusca')?.value || '').trim().toLowerCase();
  const disciplina = document.getElementById('flashListaFiltroDisciplina')?.value || '';
  const dificuldade = document.getElementById('flashListaFiltroDificuldade')?.value || '';

  flashListaFiltrada = flashCards.filter(c => {
    if (disciplina && c.disciplina !== disciplina) return false;
    if (dificuldade && c.dificuldade !== dificuldade) return false;
    if (flashListaFiltroEstados.length) {
      const bate = flashListaFiltroEstados.some(e => e === 'vencido' ? flashIsVencido(c) : flashState(c) === e);
      if (!bate) return false;
    }
    if (busca) {
      const alvo = [c.frente, c.verso, c.clozeTexto, c.tema, c.subtema, c.comparacaoA?.titulo, c.comparacaoB?.titulo, ...(c.tags || [])].filter(Boolean).join(' ').toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
  flashListaPagina = 1;
  const grid = document.getElementById('flashListaGrid');
  if (grid) grid.innerHTML = '';
  flashRenderPaginaLista(true);
  const contEl = document.getElementById('flashListaContagem');
  if (contEl) contEl.textContent = `${flashListaFiltrada.length} cartão${flashListaFiltrada.length === 1 ? '' : 's'} encontrado${flashListaFiltrada.length === 1 ? '' : 's'}`;
}

function flashRenderPaginaLista(reset) {
  const grid = document.getElementById('flashListaGrid'); if (!grid) return;
  if (!flashListaFiltrada.length) {
    grid.innerHTML = '<div class="biblio-empty">Nenhum flashcard encontrado com esses filtros.</div>';
    document.getElementById('flashCarregarMaisBtn').style.display = 'none';
    return;
  }
  const inicio = (flashListaPagina - 1) * FLASH_PAGE_SIZE;
  const pagina = flashListaFiltrada.slice(inicio, inicio + FLASH_PAGE_SIZE);
  const html = pagina.map(flashCardItemHTML).join('');
  if (reset) grid.innerHTML = html; else grid.insertAdjacentHTML('beforeend', html);
  const btnMais = document.getElementById('flashCarregarMaisBtn');
  btnMais.style.display = inicio + FLASH_PAGE_SIZE < flashListaFiltrada.length ? 'block' : 'none';
}
function flashCarregarMais() { flashListaPagina++; flashRenderPaginaLista(false); }

function flashCardItemHTML(c) {
  const info = flashTipoInfo(c.tipo);
  const estado = flashIsVencido(c) ? 'vencido' : flashState(c);
  const preview = c.tipo === 'cloze' ? flashEsc(stripHtml(c.clozeTexto).replace(/\{\{c\d+::(.*?)\}\}/g, '$1')).slice(0, 140)
    : c.tipo === 'comparacao' ? flashEsc(`${c.comparacaoA.titulo} × ${c.comparacaoB.titulo}`)
    : flashEsc(stripHtml(c.frente)).slice(0, 140);
  return `
    <div class="card flash-card-item">
      <div class="flash-card-item-head">
        <span class="flash-tipo-badge">${info.icone} ${info.label}</span>
        <span class="flash-estado-badge estado-${estado}">${flashLabelEstado(estado)}</span>
      </div>
      <div class="flash-card-item-frente">${preview || '<span style="color:var(--text-muted);">(sem conteúdo)</span>'}</div>
      <div class="flash-card-item-meta mono">${[c.disciplina, c.tema].filter(Boolean).join(' · ') || 'Sem classificação'} ${c.srs.proximaRevisao ? '· próxima: ' + isoToBR(c.srs.proximaRevisao) : ''}</div>
      <div class="flash-card-item-actions">
        <button class="btn ghost small" onclick="flashAbrirEdicaoCard('${c.id}')">✏️ Editar</button>
        <button class="btn ghost small" onclick="flashConfirmarExclusao('${c.id}')">🗑️ Excluir</button>
      </div>
    </div>`;
}

/* ==========================================================================
   CALENDÁRIO DE REVISÃO — mostra em quais dias do mês há cartões agendados
   (card.srs.proximaRevisao) e, ao clicar num dia, lista exatamente quais.
   ========================================================================== */
let flashCalMes = new Date().getMonth();
let flashCalAno = new Date().getFullYear();
let flashCalDiaSelecionado = null; // ISO 'YYYY-MM-DD' ou null

function flashCalMudarMes(delta) {
  flashCalMes += delta;
  if (flashCalMes < 0) { flashCalMes = 11; flashCalAno--; }
  else if (flashCalMes > 11) { flashCalMes = 0; flashCalAno++; }
  flashRenderCalendario();
}

function flashCalIsoDoDia(dia) {
  return `${flashCalAno}-${String(flashCalMes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function flashRenderCalendario() {
  const grid = document.getElementById('flashCalGrid'); if (!grid) return;
  const label = document.getElementById('flashCalMesLabel');
  const mesesNomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  if (label) label.textContent = `${mesesNomes[flashCalMes]} de ${flashCalAno}`;

  const primeiroDiaSemana = new Date(flashCalAno, flashCalMes, 1).getDay();
  const totalDiasMes = new Date(flashCalAno, flashCalMes + 1, 0).getDate();
  const hojeIso = todayISO();

  // Conta quantos cartões vencem em cada dia do mês exibido
  const porDia = {};
  flashCards.forEach(c => {
    const prox = c.srs && c.srs.proximaRevisao; if (!prox) return;
    if (prox.slice(0, 7) === `${flashCalAno}-${String(flashCalMes + 1).padStart(2, '0')}`) {
      porDia[prox] = (porDia[prox] || 0) + 1;
    }
  });

  let html = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => `<div class="cal-weekday">${d}</div>`).join('');
  for (let i = 0; i < primeiroDiaSemana; i++) html += `<div class="cal-day empty-cell"></div>`;

  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const iso = flashCalIsoDoDia(dia);
    const n = porDia[iso] || 0;
    const classes = [
      iso === hojeIso ? 'today' : '',
      iso === flashCalDiaSelecionado ? 'active-filter' : ''
    ].join(' ');
    const dot = n ? `<div class="cal-day-dot" title="${n} cartão(ões)" style="${iso < hojeIso ? 'background:var(--bad);' : ''}"></div>` : '';
    html += `<div class="cal-day ${classes}" onclick="flashCalSelecionarDia('${iso}')"><span class="cal-day-num">${dia}</span>${dot}</div>`;
  }
  grid.innerHTML = html;

  if (flashCalDiaSelecionado && flashCalDiaSelecionado.slice(0, 7) === `${flashCalAno}-${String(flashCalMes + 1).padStart(2, '0')}`) {
    flashCalRenderListaDia();
  } else {
    document.getElementById('flashCalDiaTitulo').textContent = 'Selecione um dia no calendário';
    document.getElementById('flashCalDiaLista').innerHTML = '';
  }
}

function flashCalSelecionarDia(iso) {
  flashCalDiaSelecionado = (flashCalDiaSelecionado === iso) ? null : iso;
  flashRenderCalendario();
}

function flashCalRenderListaDia() {
  const titulo = document.getElementById('flashCalDiaTitulo');
  const lista = document.getElementById('flashCalDiaLista');
  if (!flashCalDiaSelecionado) { titulo.textContent = 'Selecione um dia no calendário'; lista.innerHTML = ''; return; }
  const cards = flashCards.filter(c => c.srs && c.srs.proximaRevisao === flashCalDiaSelecionado);
  titulo.textContent = `${isoToBR(flashCalDiaSelecionado)} — ${cards.length} cartão(ões) para revisar`;
  lista.innerHTML = cards.length
    ? `<div class="flash-cards-grid">${cards.map(flashCardItemHTML).join('')}</div>`
    : `<div class="empty" style="padding:12px 0; color:var(--text-muted);">Nenhum cartão agendado para este dia.</div>`;
}

function flashConfirmarExclusao(id) {
  const c = flashGetById(id); if (!c) return;
  if (!confirm('Excluir este flashcard definitivamente?')) return;
  if (c.tipo === 'cloze' && c.clozeGrupoId) flashExcluirGrupoCloze(c.clozeGrupoId); else flashExcluirCard(id);
  flashAplicarFiltrosLista();
  flashRenderDashboard();
  flashToast('Flashcard excluído.');
}

/* ==========================================================================
   ABA CRIAR — seletor de tipo + formulário dinâmico + campos comuns
   ========================================================================== */
function flashSetCriarTipo(tipo) {
  flashCriarTipoAtual = tipo;
  document.querySelectorAll('.flash-tipo-chip').forEach(b => b.classList.toggle('active', b.dataset.tipo === tipo));
  ['basico', 'cloze', 'comparacao', 'discursivo', 'imagem'].forEach(t => {
    const el = document.getElementById('flashCampo' + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.style.display = t === tipo ? 'block' : 'none';
  });
}

function flashAtualizarClozePreview() {
  const texto = document.getElementById('flashClozeTexto').value;
  const numeros = flashParseClozeNumeros(texto);
  const info = document.getElementById('flashClozeInfo');
  if (!numeros.length) { info.textContent = 'Nenhuma lacuna encontrada ainda — use {{c1::palavra}} para marcar o que deve ficar oculto.'; return; }
  info.textContent = `${numeros.length} cartão(ões) será(ão) criado(s), um para cada lacuna: ${numeros.map(n => 'c' + n).join(', ')}.`;
  document.getElementById('flashClozePreview').innerHTML = flashRenderClozeTexto(texto, numeros[0], false);
}

function flashLimparFormCriar() {
  flashCriarEditandoId = null;
  flashCriarEditandoGrupoCloze = null;
  flashTagsAtual = [];
  document.getElementById('flashCriarTituloPanel').textContent = 'Criar novo flashcard';
  document.getElementById('flashFrenteBasico').value = '';
  document.getElementById('flashVersoBasico').value = '';
  document.getElementById('flashClozeTexto').value = '';
  flashAtualizarClozePreview();
  document.getElementById('flashCompPrompt').value = '';
  document.getElementById('flashCompTituloA').value = '';
  document.getElementById('flashCompConteudoA').value = '';
  document.getElementById('flashCompTituloB').value = '';
  document.getElementById('flashCompConteudoB').value = '';
  document.getElementById('flashDiscFrente').value = '';
  document.getElementById('flashDiscVerso').value = '';
  document.getElementById('flashImgFrenteTexto').value = '';
  document.getElementById('flashImgVersoTexto').value = '';
  document.getElementById('flashImgFrentePreview').innerHTML = '';
  document.getElementById('flashImgVersoPreview').innerHTML = '';
  document.getElementById('flashImgFrentePreview').dataset.url = '';
  document.getElementById('flashImgVersoPreview').dataset.url = '';
  document.getElementById('flashCDisciplina').value = '';
  document.getElementById('flashCTema').value = '';
  document.getElementById('flashCSubtema').value = '';
  document.getElementById('flashCDificuldade').value = 'media';
  document.getElementById('flashCFonte').value = '';
  document.getElementById('flashCProximaRevisao').value = '';
  flashRenderTagsInput();
  flashSetCriarTipo('basico');
}

function flashRenderTagsInput() {
  const wrap = document.getElementById('flashTagsInput'); if (!wrap) return;
  const input = document.getElementById('flashTagNovo');
  wrap.querySelectorAll('.tag-chip').forEach(c => c.remove());
  flashTagsAtual.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${flashEsc(tag)}<button type="button" onclick="flashRemoverTag('${tag.replace(/'/g, "\\'")}')">✕</button>`;
    wrap.insertBefore(chip, input);
  });
}
function flashAdicionarTag() {
  const input = document.getElementById('flashTagNovo');
  const val = input.value.trim().replace(/^#/, '');
  if (!val) return;
  if (!flashTagsAtual.includes(val)) flashTagsAtual.push(val);
  input.value = ''; flashRenderTagsInput();
}
function flashRemoverTag(tag) { flashTagsAtual = flashTagsAtual.filter(t => t !== tag); flashRenderTagsInput(); }

/* Comprime e converte upload de imagem para dataURL local (sem backend) —
   redimensiona para no máx. 640px de largura para não pesar o localStorage. */
function flashUploadImagem(inputEl, previewId) {
  const file = inputEl.files && inputEl.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, 640 / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      const preview = document.getElementById(previewId);
      preview.innerHTML = `<img src="${dataUrl}" class="flash-image-preview">`;
      preview.dataset.url = dataUrl;
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function flashCamposComuns() {
  return {
    disciplina: document.getElementById('flashCDisciplina').value.trim(),
    tema: document.getElementById('flashCTema').value.trim(),
    subtema: document.getElementById('flashCSubtema').value.trim(),
    tags: [...flashTagsAtual],
    dificuldade: document.getElementById('flashCDificuldade').value,
    fonte: document.getElementById('flashCFonte').value.trim()
  };
}

/* Se o usuário escolheu uma data em "Data da 1ª revisão", ela sobrescreve
   card.srs.proximaRevisao (sem mexer no resto do histórico de SRS). Deixando
   em branco, o cartão segue com a data padrão (hoje, para um cartão novo). */
function flashAplicarDataRevisaoEscolhida(idsCards) {
  const data = document.getElementById('flashCProximaRevisao').value;
  if (!data) return;
  idsCards.forEach(id => {
    const c = flashGetById(id);
    if (c) c.srs.proximaRevisao = data;
  });
  flashSaveAll();
}

function flashSalvarCriar() {
  const comuns = flashCamposComuns();
  const tipo = flashCriarTipoAtual;

  if (tipo === 'cloze') {
    const texto = document.getElementById('flashClozeTexto').value.trim();
    if (!flashParseClozeNumeros(texto).length) { alert('Marque ao menos uma lacuna, no formato {{c1::palavra}}.'); return; }
    const criados = flashSalvarNotaCloze(texto, comuns, flashCriarEditandoGrupoCloze);
    flashAplicarDataRevisaoEscolhida(criados.map(c => c.id));
    flashToast(flashCriarEditandoGrupoCloze ? 'Cartões cloze atualizados.' : 'Cartões cloze criados.');
  } else {
    let campos = Object.assign({ tipo }, comuns);
    if (tipo === 'basico') {
      campos.frente = document.getElementById('flashFrenteBasico').value.trim();
      campos.verso = document.getElementById('flashVersoBasico').value.trim();
      if (!campos.frente || !campos.verso) { alert('Preencha a frente e o verso do cartão.'); return; }
    } else if (tipo === 'comparacao') {
      campos.frente = document.getElementById('flashCompPrompt').value.trim();
      campos.comparacaoA = { titulo: document.getElementById('flashCompTituloA').value.trim(), conteudo: document.getElementById('flashCompConteudoA').value.trim() };
      campos.comparacaoB = { titulo: document.getElementById('flashCompTituloB').value.trim(), conteudo: document.getElementById('flashCompConteudoB').value.trim() };
      if (!campos.comparacaoA.titulo || !campos.comparacaoB.titulo) { alert('Dê um título para os dois conceitos comparados.'); return; }
    } else if (tipo === 'discursivo') {
      campos.frente = document.getElementById('flashDiscFrente').value.trim();
      campos.verso = document.getElementById('flashDiscVerso').value.trim();
      if (!campos.frente || !campos.verso) { alert('Preencha a pergunta e a resposta-modelo.'); return; }
    } else if (tipo === 'imagem') {
      campos.frente = document.getElementById('flashImgFrenteTexto').value.trim();
      campos.verso = document.getElementById('flashImgVersoTexto').value.trim();
      campos.imagemFrenteUrl = document.getElementById('flashImgFrentePreview').dataset.url || (flashCriarEditandoId ? flashGetById(flashCriarEditandoId)?.imagemFrenteUrl || '' : '');
      campos.imagemVersoUrl = document.getElementById('flashImgVersoPreview').dataset.url || (flashCriarEditandoId ? flashGetById(flashCriarEditandoId)?.imagemVersoUrl || '' : '');
      if (!campos.imagemFrenteUrl && !campos.frente) { alert('Adicione ao menos uma imagem ou texto na frente.'); return; }
    }
    let cardsAlvo;
    if (flashCriarEditandoId) { flashAtualizarCard(flashCriarEditandoId, campos); cardsAlvo = [flashCriarEditandoId]; }
    else { const novo = flashCriarCard(campos); cardsAlvo = [novo.id]; }
    flashAplicarDataRevisaoEscolhida(cardsAlvo);
    flashToast(flashCriarEditandoId ? 'Flashcard atualizado.' : 'Flashcard criado.');
  }

  flashPopularDatalists();
  flashRenderDashboard();
  flashLimparFormCriar();
  flashShowPanel('lista');
  flashAplicarFiltrosLista();
}

function flashAbrirEdicaoCard(id) {
  const c = flashGetById(id); if (!c) return;
  flashLimparFormCriar();
  flashCriarEditandoId = id;
  flashCriarEditandoGrupoCloze = c.clozeGrupoId || null;
  document.getElementById('flashCriarTituloPanel').textContent = 'Editar flashcard';
  flashTagsAtual = [...(c.tags || [])];
  document.getElementById('flashCDisciplina').value = c.disciplina || '';
  document.getElementById('flashCTema').value = c.tema || '';
  document.getElementById('flashCSubtema').value = c.subtema || '';
  document.getElementById('flashCDificuldade').value = c.dificuldade || 'media';
  document.getElementById('flashCFonte').value = c.fonte || '';
  document.getElementById('flashCProximaRevisao').value = c.srs?.proximaRevisao || '';
  flashRenderTagsInput();
  flashSetCriarTipo(c.tipo);
  if (c.tipo === 'basico') {
    document.getElementById('flashFrenteBasico').value = c.frente || '';
    document.getElementById('flashVersoBasico').value = c.verso || '';
  } else if (c.tipo === 'cloze') {
    document.getElementById('flashClozeTexto').value = c.clozeTexto || '';
    flashAtualizarClozePreview();
  } else if (c.tipo === 'comparacao') {
    document.getElementById('flashCompPrompt').value = c.frente || '';
    document.getElementById('flashCompTituloA').value = c.comparacaoA?.titulo || '';
    document.getElementById('flashCompConteudoA').value = c.comparacaoA?.conteudo || '';
    document.getElementById('flashCompTituloB').value = c.comparacaoB?.titulo || '';
    document.getElementById('flashCompConteudoB').value = c.comparacaoB?.conteudo || '';
  } else if (c.tipo === 'discursivo') {
    document.getElementById('flashDiscFrente').value = c.frente || '';
    document.getElementById('flashDiscVerso').value = c.verso || '';
  } else if (c.tipo === 'imagem') {
    document.getElementById('flashImgFrenteTexto').value = c.frente || '';
    document.getElementById('flashImgVersoTexto').value = c.verso || '';
    if (c.imagemFrenteUrl) { document.getElementById('flashImgFrentePreview').innerHTML = `<img src="${c.imagemFrenteUrl}" class="flash-image-preview">`; document.getElementById('flashImgFrentePreview').dataset.url = c.imagemFrenteUrl; }
    if (c.imagemVersoUrl) { document.getElementById('flashImgVersoPreview').innerHTML = `<img src="${c.imagemVersoUrl}" class="flash-image-preview">`; document.getElementById('flashImgVersoPreview').dataset.url = c.imagemVersoUrl; }
  }
  flashShowPanel('criar');
}

/* ==========================================================================
   ESTATÍSTICAS
   ========================================================================== */
function flashRenderEstatisticas() {
  const st = flashCalcularStats();
  const grid = document.getElementById('flashStatsGrid');
  if (grid) grid.innerHTML = `
    <div class="card stat-card"><div class="n">${st.porEstado.novo}</div><div class="l">novos</div></div>
    <div class="card stat-card"><div class="n">${st.porEstado.aprendizado}</div><div class="l">em aprendizado</div></div>
    <div class="card stat-card"><div class="n">${st.porEstado.maduro}</div><div class="l">maduros</div></div>
    <div class="card stat-card"><div class="n">${st.totalAcertos}</div><div class="l">acertos</div></div>
    <div class="card stat-card"><div class="n">${st.totalErros}</div><div class="l">erros</div></div>
  `;
  const porTipoEl = document.getElementById('flashStatsPorTipo');
  if (porTipoEl) porTipoEl.innerHTML = FLASH_TIPOS.map(t => {
    const n = st.porTipo[t.id] || 0;
    const pct = st.total ? Math.round((n / st.total) * 100) : 0;
    return `<div style="margin-bottom:10px;"><div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;"><span>${t.icone} ${t.label}</span><span class="mono">${n}</span></div><div class="bar"><span style="width:${pct}%;"></span></div></div>`;
  }).join('');
  const porDiscEl = document.getElementById('flashStatsPorDisciplina');
  if (porDiscEl) {
    const entradas = Object.entries(st.porDisciplina).sort((a, b) => b[1].total - a[1].total);
    porDiscEl.innerHTML = entradas.length ? entradas.map(([nome, v]) => {
      const pct = (v.acertos + v.erros) ? Math.round((v.acertos / (v.acertos + v.erros)) * 100) : 0;
      return `<div style="margin-bottom:10px;"><div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;"><span>${flashEsc(nome)}</span><span class="mono">${v.total} cartão(ões) · ${pct}% acerto</span></div><div class="bar"><span style="width:${pct}%;"></span></div></div>`;
    }).join('') : '<div class="biblio-empty">Ainda sem dados por disciplina.</div>';
  }
  if (typeof renderLineChart === 'function') renderLineChart('flashStatsGrafico', flashRevoesUltimosDiasLabel());
}
function flashRevoesUltimosDiasLabel() {
  const dados = flashRevisoesUltimosDias(7);
  const max = Math.max(1, ...dados.map(d => d.valor));
  return dados.map(p => ({ label: p.label, valor: Math.round((p.valor / max) * 100) }));
}

/* ==========================================================================
   TOAST — pequena confirmação flutuante, sem depender de alert().
   ========================================================================== */
let flashToastTimeout = null;
function flashToast(msg) {
  let el = document.getElementById('flashToastEl');
  if (!el) {
    el = document.createElement('div');
    el.id = 'flashToastEl';
    el.className = 'flash-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flashToastTimeout);
  flashToastTimeout = setTimeout(() => el.classList.remove('show'), 2600);
}
