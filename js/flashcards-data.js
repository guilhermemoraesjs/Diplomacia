/* ==========================================================================
   flashcards-data.js — módulo "Flashcards → Dados": modelo do cartão,
   armazenamento local (localStorage, sem IA e sem backend), CRUD e
   utilidades de parsing (cloze). Nenhuma função aqui desenha interface —
   mantém-se neutro de propósito, como os demais módulos de dados do app.
   ========================================================================== */

const FLASH_KEY = 'flash_cards';
const FLASH_STREAK_KEY = 'flash_streak_dias';
const FLASH_TEMPOS_KEY = 'flash_tempos';

let flashCards = load(FLASH_KEY, []);
let flashStreakDias = load(FLASH_STREAK_KEY, []);
let flashTempos = load(FLASH_TEMPOS_KEY, []); // [{data:iso, cardId, segundos}]

/* índice em Map para lookup O(1) por id — evita .find() em listas de milhares
   de cartões a cada clique (ver requisito de performance com 10.000+ cards) */
let _flashIndex = null;
function flashRebuildIndex() {
  _flashIndex = new Map();
  flashCards.forEach(c => _flashIndex.set(c.id, c));
}
function flashGetById(id) {
  if (!_flashIndex) flashRebuildIndex();
  return _flashIndex.get(id);
}
function flashSaveAll() { save(FLASH_KEY, flashCards); }

const FLASH_TIPOS = [
  { id: 'basico', label: 'Básico', icone: '📇', desc: 'Pergunta e resposta.' },
  { id: 'cloze', label: 'Cloze', icone: '🕳️', desc: 'Oculta trechos do texto ({{c1::assim}}).' },
  { id: 'comparacao', label: 'Comparação', icone: '⚖️', desc: 'Dois conceitos lado a lado.' },
  { id: 'discursivo', label: 'Discursivo', icone: '✍️', desc: 'Resposta curta (3–5 linhas), estilo CACD.' },
  { id: 'imagem', label: 'Mapa/Imagem', icone: '🖼️', desc: 'Imagem na frente e/ou no verso.' }
];
function flashTipoInfo(tipo) { return FLASH_TIPOS.find(t => t.id === tipo) || FLASH_TIPOS[0]; }

function flashCardDefaults() {
  return {
    id: uid(),
    tipo: 'basico',
    frente: '',
    verso: '',
    comparacaoA: { titulo: '', conteudo: '' },
    comparacaoB: { titulo: '', conteudo: '' },
    imagemFrenteUrl: '',
    imagemVersoUrl: '',
    clozeTexto: '',
    clozeIndex: null,
    clozeGrupoId: null,
    disciplina: '',
    tema: '',
    subtema: '',
    tags: [],
    dificuldade: 'media',
    fonte: '',
    origemTipo: 'manual',     // 'manual' | 'biblioteca' | 'simulado'
    origemRefId: null,
    criadoEm: Date.now(),
    editadoEm: Date.now(),
    srs: {
      estado: 'novo',          // 'novo' | 'aprendizado' | 'maduro'
      intervalo: 0,            // dias
      fatorFacilidade: 2.5,
      repeticoes: 0,
      acertos: 0,
      erros: 0,
      ultimaRevisao: null,     // ISO
      proximaRevisao: todayISO()
    }
  };
}

/* Cria um cartão comum (básico, comparação, discursivo, imagem) a partir de
   um objeto parcial de campos + metadados. Cloze tem função própria abaixo,
   pois um único "note" gera N cartões independentes. */
function flashCriarCard(campos) {
  const c = Object.assign(flashCardDefaults(), campos);
  flashCards.unshift(c);
  flashRebuildIndex();
  flashSaveAll();
  return c;
}

function flashAtualizarCard(id, campos) {
  const c = flashGetById(id); if (!c) return null;
  Object.assign(c, campos, { editadoEm: Date.now() });
  flashSaveAll();
  return c;
}

function flashExcluirCard(id) {
  flashCards = flashCards.filter(c => c.id !== id);
  flashRebuildIndex();
  flashSaveAll();
}

/* Exclui todos os cartões-irmãos de um mesmo grupo cloze (usado ao editar/
   excluir uma nota cloze inteira, não só uma lacuna). */
function flashExcluirGrupoCloze(grupoId) {
  flashCards = flashCards.filter(c => c.clozeGrupoId !== grupoId);
  flashRebuildIndex();
  flashSaveAll();
}

/* ---- Cloze: parsing de {{c1::texto}} {{c2::texto}} ... ---- */
function flashParseClozeNumeros(texto) {
  const nums = new Set();
  const re = /\{\{c(\d+)::/g;
  let m;
  while ((m = re.exec(texto || ''))) nums.add(parseInt(m[1], 10));
  return [...nums].sort((a, b) => a - b);
}

/* Cria (ou atualiza, se grupoIdExistente for passado) um grupo de cartões
   cloze — um cartão independente por número de lacuna encontrado no texto,
   cada um com seu próprio estado de revisão espaçada. */
function flashSalvarNotaCloze(texto, metaComum, grupoIdExistente) {
  const numeros = flashParseClozeNumeros(texto);
  if (!numeros.length) return [];
  if (grupoIdExistente) flashExcluirGrupoCloze(grupoIdExistente);
  const grupoId = grupoIdExistente || uid();
  const criados = numeros.map(n => flashCriarCard(Object.assign({}, metaComum, {
    tipo: 'cloze',
    clozeTexto: texto,
    clozeIndex: n,
    clozeGrupoId: grupoId
  })));
  return criados;
}

/* Escapa texto plano para uso seguro em innerHTML (mesma técnica de
   stripHtml, mas invertida — usa o DOM para gerar entidades). */
function flashEsc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}
function flashNl2Br(str) { return flashEsc(str).replace(/\n/g, '<br>'); }

/* Renderiza o texto cloze substituindo {{cN::conteudo}}: a lacuna ativa some
   (ou aparece destacada, se `revelar`) e as demais lacunas do MESMO texto
   aparecem sempre reveladas (comportamento Anki-like: cada número é um
   cartão independente, mas o contexto ao redor ajuda a resposta). */
function flashRenderClozeTexto(texto, ativoIndex, revelar) {
  const escapado = flashEsc(texto || '');
  return escapado.replace(/\{\{c(\d+)::(.*?)\}\}/gs, (full, n, conteudo) => {
    n = parseInt(n, 10);
    if (n === ativoIndex) {
      return revelar ? `<span class="cloze-ativo">${conteudo}</span>` : `<span class="cloze-blank">[...]</span>`;
    }
    return conteudo;
  }).replace(/\n/g, '<br>');
}

/* ---- Helpers de disciplina/tema, reaproveitando o edital de Matérias já
   existente no app (materias.js) como fonte única de verdade. ---- */
function flashListaDisciplinas() {
  const doMateria = (typeof materias !== 'undefined' ? materias.map(m => m.nome) : []);
  const dosCards = flashCards.map(c => c.disciplina).filter(Boolean);
  return [...new Set([...doMateria, ...dosCards])].sort();
}
function flashListaTemas(disciplina) {
  const temas = flashCards.filter(c => !disciplina || c.disciplina === disciplina).map(c => c.tema).filter(Boolean);
  return [...new Set(temas)].sort();
}
function flashListaTags() {
  const tags = flashCards.flatMap(c => c.tags || []);
  return [...new Set(tags)].sort();
}
