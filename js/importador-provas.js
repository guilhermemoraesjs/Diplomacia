/* ==========================================================================
   importador-provas.js — módulo interno/admin "Importador de Provas".

   Fluxo: PDF da prova + PDF do gabarito → extração automática de texto
   (pdf.js) → parser heurístico de questões/alternativas/gabarito → tela
   de revisão (100% editável) → geração dos 3 arquivos JSON no MESMO
   formato usado por data/simulados/*.

   LIMITAÇÃO HONESTA: a Chancelaria é um site estático, sem backend. Este
   módulo não escreve sozinho dentro do seu repositório — ele gera os
   JSONs prontos (formatados exatamente como data/simulados/provas/*.json
   espera) para download/copiar, e você solta no lugar certo. É o máximo
   que dá pra automatizar sem um servidor por trás.

   LIMITAÇÃO DO PARSER: extração de PDF é heurística (baseada em regex e
   posição das linhas). Provas com layout em colunas, imagens de texto
   (PDF escaneado sem OCR) ou numeração irregular podem sair incompletas
   — por isso a tela de revisão é OBRIGATÓRIA e cada campo é editável,
   inclusive dá pra adicionar questões manualmente se o parser perder
   alguma.
   ========================================================================== */

/* ⚠️ Troque esta senha antes de publicar. Isto NÃO é segurança de verdade
   (é só JS rodando no navegador de quem acessar) — serve apenas para o
   link não ficar exposto no caminho do usuário comum. Para proteção real,
   seria necessário autenticação server-side. */
const IMPORTADOR_SENHA = '12345';

let importadorDesbloqueado = false;
let impQuestoesExtraidas = [];   // questões durante a revisão (editável)
let impMetaAtual = { ano: null, fase: 1 };
let impGerado = { provaJson: '', indexJson: '', qindexJson: '' };

/* ---- Acesso / navegação da área admin ---- */
function abrirImportadorProvas() {
  document.body.setAttribute('data-active-tab', 'admin-importador');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-admin-importador');
  if (view) view.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (importadorDesbloqueado) mostrarImportadorApp();
}
function mostrarImportadorApp() {
  document.getElementById('importadorGate').style.display = 'none';
  document.getElementById('importadorApp').style.display = 'block';
}
function tentarDesbloquearImportador() {
  const val = document.getElementById('importadorSenhaInput').value;
  if (val === IMPORTADOR_SENHA) {
    importadorDesbloqueado = true;
    mostrarImportadorApp();
  } else {
    document.getElementById('importadorSenhaErro').textContent = 'Senha incorreta.';
  }
}

function renderImpSteps(passo) {
  const el = document.getElementById('impSteps'); if (!el) return;
  const passos = ['1. Upload dos PDFs', '2. Revisão', '3. Exportar JSON'];
  el.innerHTML = `<div class="filters">${passos.map((p, i) =>
    `<span class="chip ${i + 1 === passo ? 'active' : ''}" style="cursor:default;">${p}</span>`
  ).join('')}</div>`;
}
function mostrarPainelImportador(nome) {
  ['Upload', 'Revisao', 'Export'].forEach(p => {
    const el = document.getElementById('impPanel' + p);
    if (el) el.style.display = (p === nome) ? 'block' : 'none';
  });
  renderImpSteps(nome === 'Upload' ? 1 : nome === 'Revisao' ? 2 : 3);
}

/* ---- Extração de texto do PDF (pdf.js), preservando quebras de linha
   por agrupamento de itens que compartilham a mesma posição vertical. ---- */
async function extrairTextoPDF(file) {
  if (!window.pdfjsLib) throw new Error('pdf.js não carregou — verifique sua conexão e recarregue a página.');
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const paginasTexto = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let linhaY = null, linhaBuf = [], linhas = [];
    content.items.forEach(item => {
      const y = Math.round(item.transform[5]);
      if (linhaY === null || Math.abs(y - linhaY) > 2.5) {
        if (linhaBuf.length) linhas.push(linhaBuf.join(' ').replace(/\s+/g, ' ').trim());
        linhaBuf = [item.str]; linhaY = y;
      } else {
        linhaBuf.push(item.str);
      }
    });
    if (linhaBuf.length) linhas.push(linhaBuf.join(' ').replace(/\s+/g, ' ').trim());
    paginasTexto.push(linhas.filter(l => l.length));
  }
  return paginasTexto; // array de páginas, cada uma array de linhas
}

/* Remove ruído comum de cabeçalho/rodapé: linhas curtas que se repetem em
   várias páginas (ex.: "MINISTÉRIO DAS RELAÇÕES EXTERIORES", "Página 3"). */
function removerCabecalhosRodapes(paginas) {
  const contagem = {};
  paginas.forEach(linhas => linhas.forEach(l => {
    const chave = l.toLowerCase();
    if (chave.length < 60) contagem[chave] = (contagem[chave] || 0) + 1;
  }));
  const repetidas = new Set(Object.entries(contagem).filter(([, n]) => n >= Math.max(3, paginas.length * 0.5)).map(([k]) => k));
  return paginas.map(linhas => linhas.filter(l => !repetidas.has(l.toLowerCase()) && !/^p[aá]gina\s*\d+/i.test(l) && !/^\d{1,3}\s*\/\s*\d{1,3}$/.test(l)));
}

/* ---- Parser de questões + alternativas ---- */
const RE_QUESTAO = /^(?:quest(?:ã|a)o\s*)?0*(\d{1,3})[\.\)\-–]\s*(.*)$/i;
const RE_ALTERNATIVA = /^\(?([A-E])\)?[\.\)\-–]\s*(.*)$/;

function parsearQuestoesDoPDF(paginas) {
  const linhas = removerCabecalhosRodapes(paginas).flat();
  const questoes = [];
  let atual = null;
  let ultimoNumero = 0;

  linhas.forEach(linha => {
    const mQ = linha.match(RE_QUESTAO);
    const numeroCandidato = mQ ? parseInt(mQ[1], 10) : null;
    // só tratamos como início de questão nova se o número fizer sentido
    // numa sequência crescente (evita confundir com anos, artigos de lei etc.)
    const pareceNovaQuestao = mQ && numeroCandidato >= 1 && numeroCandidato <= 200 &&
      (numeroCandidato === ultimoNumero + 1 || (ultimoNumero === 0 && numeroCandidato === 1));

    if (pareceNovaQuestao) {
      if (atual) questoes.push(finalizarQuestao(atual));
      atual = { numero: numeroCandidato, linhasEnunciado: [mQ[2]], alternativasBrutas: [] };
      ultimoNumero = numeroCandidato;
      return;
    }
    if (!atual) return; // ainda não achamos a questão 1 — ignora ruído do início do PDF

    const mA = linha.match(RE_ALTERNATIVA);
    if (mA) {
      atual.alternativasBrutas.push({ letra: mA[1].toUpperCase(), texto: mA[2] });
    } else if (atual.alternativasBrutas.length) {
      // continuação de texto de uma alternativa (linha quebrada)
      atual.alternativasBrutas[atual.alternativasBrutas.length - 1].texto += ' ' + linha;
    } else {
      atual.linhasEnunciado.push(linha);
    }
  });
  if (atual) questoes.push(finalizarQuestao(atual));
  return questoes;
}
function finalizarQuestao(q) {
  const letras = ['A', 'B', 'C', 'D', 'E'];
  const alternativas = letras.map(letra => {
    const achada = q.alternativasBrutas.find(a => a.letra === letra);
    return { letra, texto: achada ? achada.texto.trim() : '' };
  });
  return {
    numero: q.numero,
    enunciado: q.linhasEnunciado.join(' ').replace(/\s+/g, ' ').trim(),
    disciplina: '', tema: '', dificuldade: 'media',
    tipo: 'multipla', alternativas, respostaCorreta: null
  };
}

/* ---- Parser do gabarito: procura pares "número ... letra A-E" ---- */
function parsearGabaritoDoPDF(paginas) {
  const linhas = removerCabecalhosRodapes(paginas).flat();
  const mapa = {};
  linhas.forEach(linha => {
    const regexPar = /(\d{1,3})\s*[-–\.\):]?\s*([A-E])\b/g;
    let m;
    while ((m = regexPar.exec(linha)) !== null) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 200 && !mapa[n]) mapa[n] = m[2].toUpperCase();
    }
  });
  return mapa;
}

/* ---- Passo 1 → 2: processa os dois PDFs e abre a revisão ---- */
async function processarImportacao() {
  const fProva = document.getElementById('impFileProva').files[0];
  const fGabarito = document.getElementById('impFileGabarito').files[0];
  const ano = parseInt(document.getElementById('impAno').value, 10);
  const fase = parseInt(document.getElementById('impFase').value, 10);
  const status = document.getElementById('impProcessandoStatus');

  if (!fProva || !fGabarito) { status.textContent = 'Selecione os dois PDFs (prova e gabarito) antes de continuar.'; return; }
  if (!ano) { status.textContent = 'Informe o ano da prova.'; return; }

  status.textContent = 'Lendo o PDF da prova...';
  try {
    const paginasProva = await extrairTextoPDF(fProva);
    status.textContent = 'Lendo o PDF do gabarito...';
    const paginasGabarito = await extrairTextoPDF(fGabarito);

    status.textContent = 'Identificando questões e alternativas...';
    const questoes = parsearQuestoesDoPDF(paginasProva);
    const gabarito = parsearGabaritoDoPDF(paginasGabarito);
    questoes.forEach(q => { q.respostaCorreta = gabarito[q.numero] || null; });

    if (!questoes.length) {
      status.textContent = 'Não consegui identificar questões nesse PDF automaticamente. Você pode adicionar as questões manualmente na tela de revisão a seguir.';
    } else {
      status.textContent = `${questoes.length} questões extraídas, ${questoes.filter(q => q.respostaCorreta).length} com gabarito identificado.`;
    }

    impMetaAtual = { ano, fase };
    impQuestoesExtraidas = questoes;
    renderImpQuestoesList();
    mostrarPainelImportador('Revisao');
  } catch (e) {
    console.error(e);
    status.textContent = 'Erro ao processar os PDFs: ' + e.message;
  }
}

function voltarParaUpload() { mostrarPainelImportador('Upload'); }
function voltarParaRevisao() { mostrarPainelImportador('Revisao'); }

/* ---- Passo 2: revisão — cada campo é editável ---- */
function renderImpQuestoesList() {
  const el = document.getElementById('impQuestoesList'); if (!el) return;
  const resumo = document.getElementById('impRevisaoResumo');
  if (resumo) resumo.textContent = `${impQuestoesExtraidas.length} questões · ${impQuestoesExtraidas.filter(q => q.respostaCorreta).length} com gabarito identificado automaticamente`;

  el.innerHTML = impQuestoesExtraidas.map((q, i) => `
    <div class="card imp-q-card ${!q.respostaCorreta ? 'imp-q-warn' : ''}">
      <div class="imp-q-head">
        <span class="mono">Questão ${q.numero}</span>
        ${!q.respostaCorreta ? '<span class="imp-q-badge">⚠ gabarito não identificado — selecione manualmente</span>' : ''}
        <button class="btn ghost small" onclick="removerQuestaoImportador(${i})">Remover</button>
      </div>
      <label class="field-label">Enunciado</label>
      <textarea oninput="atualizarCampoQuestao(${i},'enunciado',this.value)" style="min-height:70px;">${escapeHtml(q.enunciado)}</textarea>
      <div class="row2" style="margin-top:8px;">
        <div><label class="field-label">Disciplina</label><input type="text" value="${escapeHtml(q.disciplina)}" placeholder="Ex.: História" oninput="atualizarCampoQuestao(${i},'disciplina',this.value)"></div>
        <div><label class="field-label">Tema</label><input type="text" value="${escapeHtml(q.tema)}" placeholder="Ex.: Guerra Fria" oninput="atualizarCampoQuestao(${i},'tema',this.value)"></div>
      </div>
      <label class="field-label" style="margin-top:10px;">Alternativas e gabarito</label>
      ${q.alternativas.map(a => `
        <div class="imp-alt-row">
          <label class="imp-alt-radio"><input type="radio" name="impGab_${i}" ${q.respostaCorreta === a.letra ? 'checked' : ''} onchange="atualizarCampoQuestao(${i},'respostaCorreta','${a.letra}')"> ${a.letra}</label>
          <input type="text" value="${escapeHtml(a.texto)}" placeholder="Texto da alternativa ${a.letra}" oninput="atualizarAlternativa(${i},'${a.letra}',this.value)">
        </div>`).join('')}
    </div>
  `).join('') || '<div class="biblio-empty">Nenhuma questão ainda — use "Adicionar questão manualmente".</div>';
}
function atualizarCampoQuestao(i, campo, valor) { if (impQuestoesExtraidas[i]) { impQuestoesExtraidas[i][campo] = valor; if (campo === 'respostaCorreta') renderImpQuestoesList(); } }
function atualizarAlternativa(i, letra, valor) { const alt = impQuestoesExtraidas[i]?.alternativas.find(a => a.letra === letra); if (alt) alt.texto = valor; }
function removerQuestaoImportador(i) { impQuestoesExtraidas.splice(i, 1); renderImpQuestoesList(); }
function adicionarQuestaoManual() {
  const proximoNumero = (impQuestoesExtraidas[impQuestoesExtraidas.length - 1]?.numero || 0) + 1;
  impQuestoesExtraidas.push({
    numero: proximoNumero, enunciado: '', disciplina: '', tema: '', dificuldade: 'media',
    tipo: 'multipla', alternativas: ['A', 'B', 'C', 'D', 'E'].map(letra => ({ letra, texto: '' })), respostaCorreta: null
  });
  renderImpQuestoesList();
}

/* ---- Passo 2 → 3: gera os 3 JSONs no formato exato de data/simulados/* ---- */
function irParaExportacao() {
  const { ano, fase } = impMetaAtual;
  const provaId = String(ano);

  const provaJson = impQuestoesExtraidas.map((q, idx) => ({
    id: `${provaId}-q${idx + 1}`, ano, fase,
    disciplina: q.disciplina || 'A definir', tema: q.tema || 'A definir', subtema: '', dificuldade: q.dificuldade || 'media',
    enunciado: q.enunciado, tipo: 'multipla',
    alternativas: q.alternativas,
    respostaCorreta: q.respostaCorreta || '',
    explicacao: '',
    paisesRelacionados: [], organizacoesRelacionadas: [], tratadosRelacionados: [], palavrasChave: [],
    fonte: `Importado de PDF oficial — CACD ${ano}, ${fase}ª Fase. Revisar/confirmar fonte exata antes de publicar.`
  }));

  const disciplinasUnicas = [...new Set(provaJson.map(q => q.disciplina))];
  const indexJson = [{
    id: provaId, ano, fase,
    titulo: `CACD ${ano} — ${fase}ª Fase`,
    totalQuestoes: provaJson.length,
    disciplinas: disciplinasUnicas,
    arquivo: `${provaId}.json`
  }];

  const qindexJson = provaJson.map(q => ({ id: q.id, provaId, ano, disciplina: q.disciplina, tema: q.tema, dificuldade: q.dificuldade }));

  impGerado.provaJson = JSON.stringify(provaJson, null, 2);
  impGerado.indexJson = JSON.stringify(indexJson, null, 2);
  impGerado.qindexJson = JSON.stringify(qindexJson, null, 2);

  document.getElementById('impExportProva').value = impGerado.provaJson;
  document.getElementById('impExportIndex').value = impGerado.indexJson;
  document.getElementById('impExportQIndex').value = impGerado.qindexJson;
  const semGabarito = provaJson.filter(q => !q.respostaCorreta).length;
  document.getElementById('impExportResumo').innerHTML = `<div class="mono" style="font-size:12px; color:var(--text-muted);">
    ${provaJson.length} questões prontas para <code>data/simulados/provas/${provaId}.json</code>${semGabarito ? ` · <span style="color:var(--bad);">${semGabarito} sem gabarito preenchido</span>` : ' · todas com gabarito'}
  </div>`;

  mostrarPainelImportador('Export');
}

function baixarArquivoImportador(tipo) {
  const { ano } = impMetaAtual;
  const map = {
    provaJson: [impGerado.provaJson, `${ano}.json`],
    indexJson: [impGerado.indexJson, 'index-append.json'],
    qindexJson: [impGerado.qindexJson, 'questoes-index-append.json']
  };
  const [conteudo, nome] = map[tipo]; if (!conteudo) return;
  const blob = new Blob([conteudo], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
function copiarTextareaImportador(id) {
  const el = document.getElementById(id); if (!el) return;
  el.select();
  navigator.clipboard ? navigator.clipboard.writeText(el.value) : document.execCommand('copy');
}

/* ---- Feedback de arquivo selecionado (os inputs já existem no DOM,
   já que este script carrega no fim do body) ---- */
(function initImportadorFileInputs() {
  const fp = document.getElementById('impFileProva');
  const fg = document.getElementById('impFileGabarito');
  if (fp) fp.addEventListener('change', () => { document.getElementById('impFileProvaStatus').textContent = fp.files[0] ? `📄 ${fp.files[0].name}` : ''; });
  if (fg) fg.addEventListener('change', () => { document.getElementById('impFileGabaritoStatus').textContent = fg.files[0] ? `📄 ${fg.files[0].name}` : ''; });
})();

/* Permite abrir a área direto pela URL: recarregar a página com
   #/admin/importador na barra de endereço já leva pra cá. */
if (location.hash === '#/admin/importador') {
  window.addEventListener('DOMContentLoaded', abrirImportadorProvas);
}
