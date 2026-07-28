/* ==========================================================================
   flashcards-integracao.js — módulo "Flashcards → Integração": pontes com
   a Biblioteca (botão "Criar flashcard" em cada anotação) e com os
   Simulados (botão "Criar flashcard do erro" em questões respondidas
   incorretamente). Não redesenha os flashcards em si — só monta os campos
   a partir de dados de outro módulo e entrega para flashcards-data.js.
   ========================================================================== */

/* ---- Biblioteca → Flashcards ---- */
function flashAbrirCriarDeDocumento(tipo) {
  const d = biblioDocs.find(x => x.id === biblioCurrentDocId);
  if (!d) { alert('Abra ou salve o documento antes de criar um flashcard a partir dele.'); return; }
  goTab('flashcards');
  flashLimparFormCriar();
  flashSetCriarTipo(tipo);
  document.getElementById('flashCDisciplina').value = d.materia || '';
  document.getElementById('flashCTema').value = d.titulo || '';
  document.getElementById('flashCFonte').value = `Biblioteca — ${d.titulo || '(sem título)'}`;
  flashTagsAtual = [...(d.tags || [])];
  flashRenderTagsInput();
  const trecho = stripHtml(d.conteudo || '').trim().slice(0, 280);
  if (tipo === 'basico') {
    document.getElementById('flashFrenteBasico').value = d.titulo || '';
    document.getElementById('flashVersoBasico').value = trecho;
  } else if (tipo === 'cloze') {
    document.getElementById('flashClozeTexto').value = trecho;
    flashAtualizarClozePreview();
  } else if (tipo === 'discursivo') {
    document.getElementById('flashDiscFrente').value = d.titulo || '';
    document.getElementById('flashDiscVerso').value = trecho;
  }
  flashShowPanel('criar');
  flashToast('Complete os campos e salve para criar o flashcard.');
}

/* Conta quantos flashcards já nasceram a partir desta anotação específica —
   usado no painel lateral da Biblioteca, no lugar do antigo "em breve". */
function flashcardsDaAnotacao(docId) {
  return (typeof flashCards !== 'undefined' ? flashCards : []).filter(c => c.origemTipo === 'biblioteca' && c.origemRefId === docId);
}
function flashAbrirFlashcardsDaAnotacao(docId) {
  goTab('flashcards');
  flashShowPanel('lista');
  const d = biblioDocs.find(x => x.id === docId);
  const busca = document.getElementById('flashListaBusca');
  if (busca && d) { busca.value = d.titulo || ''; flashAplicarFiltrosLista(); }
}

/* ---- Simulados → Flashcards ---- */
function flashCriarDeErro(questaoId) {
  const q = (typeof simuladosQuestoesIndex !== 'undefined' ? simuladosQuestoesIndex : []).find(x => x.id === questaoId);
  if (!q) return;
  const jaExiste = flashCards.some(c => c.origemTipo === 'simulado' && c.origemRefId === questaoId);
  if (jaExiste) { flashToast('Você já tem um flashcard desta questão.'); return; }

  const respostaCorretaTexto = q.tipo === 'multipla'
    ? (q.alternativas.find(a => a.letra === q.respostaCorreta)?.texto || '')
    : (q.respostaCorreta === 'C' ? 'Certo' : 'Errado');
  const explicacaoCurta = (q.explicacao || '').trim().slice(0, 280);

  flashCriarCard({
    tipo: 'basico',
    frente: (q.enunciado || '').trim().slice(0, 260),
    verso: `Resposta correta: ${q.respostaCorreta}) ${respostaCorretaTexto}${explicacaoCurta ? `\n\n${explicacaoCurta}` : ''}`,
    disciplina: q.disciplina || '',
    tema: q.tema || '',
    subtema: q.subtema || '',
    tags: ['CACD', String(q.ano || '')].filter(Boolean),
    dificuldade: q.dificuldade === 'dificil' ? 'dificil' : (q.dificuldade === 'facil' ? 'facil' : 'media'),
    fonte: `CACD ${q.ano || ''}`.trim(),
    origemTipo: 'simulado',
    origemRefId: questaoId
  });
  flashToast('Flashcard criado a partir do erro!');
}
