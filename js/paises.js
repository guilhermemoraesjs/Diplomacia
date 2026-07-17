/* ==========================================================================
   paises.js — módulo "Países": fichas geopolíticas (capital, população,
   moeda, organizações internacionais) em grade de cards + mapa-múndi
   interativo por coordenadas. Dados estáticos, sem dependência de API.

   Atualização: bandeiras agora usam imagens reais (flagcdn.com) em vez de
   emoji de bandeira (que em muitos sistemas — sobretudo Windows — não
   renderiza e cai no fallback de duas letras, ex.: "DE", "AR"). O
   mapa-múndi agora desenha os continentes de verdade (via d3-geo +
   topojson, dados públicos do world-atlas), em vez de uma grade abstrata
   com pontos soltos. Nenhuma outra lógica, rota ou dado foi alterado.
   ========================================================================== */

/* Paleta por continente — usada na barra inferior do card e nos marcadores
   do mapa, para reforçar a hierarquia visual sem poluir a interface. */
const CONTINENTE_COR = {
  'Europa': 'var(--ub-azul)',
  'América do Sul': 'var(--ub-verde)',
  'América do Norte': 'var(--brass-light)',
  'Ásia': 'var(--seal-glow)',
  'Oceania': '#59D6C7',
  'África': 'var(--brass)',
  'Europa/Ásia': 'var(--azul-light)'
};
function continenteCor(c) { return CONTINENTE_COR[c] || 'var(--brass)'; }

/* Mantido por compatibilidade (não é mais usado nos cards/modal/mapa,
   que agora usam flagImgHtml), caso algo externo ainda dependa dele. */
function flagEmoji(code) {
  if (!code) return '🏳️';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/* Bandeira real via flagcdn.com (SVG/PNG por código ISO 3166-1 alpha-2).
   Muito mais confiável entre navegadores/SO do que emoji de bandeira. */
function flagImgHtml(code, cls) {
  if (!code) return '';
  const c = code.toLowerCase();
  return `<img class="flag-img ${cls || ''}" src="https://flagcdn.com/w80/${c}.png" srcset="https://flagcdn.com/w160/${c}.png 2x" alt="Bandeira: ${code}" loading="lazy">`;
}

function fmtPopulacao(n) {
  if (n >= 1000000000) return (n / 1000000000).toFixed(n % 1000000000 === 0 ? 0 : 1) + ' bi';
  if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + ' mi';
  return n.toLocaleString('pt-BR');
}

/* Fonte de verdade dos países. lat/lng ~ localização da capital, usada
   para posicionar o marcador no mapa-múndi (projeção equiretangular). */
function paisesDefault() {
  return [
    { id: 'de', code: 'DE', nome: 'Alemanha', continente: 'Europa', capital: 'Berlim', populacao: 84000000, moeda: 'Euro (EUR)', idioma: 'Alemão', governo: 'República Federal Parlamentarista', lat: 52.52, lng: 13.40, organizacoes: ['UE', 'OTAN', 'G7', 'ONU'] },
    { id: 'ar', code: 'AR', nome: 'Argentina', continente: 'América do Sul', capital: 'Buenos Aires', populacao: 46000000, moeda: 'Peso argentino (ARS)', idioma: 'Espanhol', governo: 'República Presidencialista', lat: -34.60, lng: -58.38, organizacoes: ['Mercosul', 'G20', 'ONU'] },
    { id: 'au', code: 'AU', nome: 'Austrália', continente: 'Oceania', capital: 'Camberra', populacao: 26000000, moeda: 'Dólar australiano (AUD)', idioma: 'Inglês', governo: 'Monarquia Parlamentarista', lat: -35.28, lng: 149.13, organizacoes: ['G20', 'APEC', 'ONU'] },
    { id: 'br', code: 'BR', nome: 'Brasil', continente: 'América do Sul', capital: 'Brasília', populacao: 213000000, moeda: 'Real (BRL)', idioma: 'Português', governo: 'República Federativa Presidencialista', lat: -15.79, lng: -47.88, organizacoes: ['Mercosul', 'BRICS', 'G20', 'ONU', 'OMC'] },
    { id: 'ca', code: 'CA', nome: 'Canadá', continente: 'América do Norte', capital: 'Ottawa', populacao: 39000000, moeda: 'Dólar canadense (CAD)', idioma: 'Inglês / Francês', governo: 'Monarquia Parlamentarista', lat: 45.42, lng: -75.70, organizacoes: ['G7', 'OTAN', 'ONU'] },
    { id: 'cn', code: 'CN', nome: 'China', continente: 'Ásia', capital: 'Pequim', populacao: 1412000000, moeda: 'Yuan (CNY)', idioma: 'Mandarim', governo: 'República Popular Socialista', lat: 39.90, lng: 116.41, organizacoes: ['BRICS', 'G20', 'ONU (P5)', 'OMC'] },
    { id: 'es', code: 'ES', nome: 'Espanha', continente: 'Europa', capital: 'Madri', populacao: 47000000, moeda: 'Euro (EUR)', idioma: 'Espanhol', governo: 'Monarquia Parlamentarista', lat: 40.42, lng: -3.70, organizacoes: ['UE', 'OTAN', 'ONU'] },
    { id: 'us', code: 'US', nome: 'Estados Unidos', continente: 'América do Norte', capital: 'Washington, D.C.', populacao: 335000000, moeda: 'Dólar americano (USD)', idioma: 'Inglês', governo: 'República Federativa Presidencialista', lat: 38.90, lng: -77.04, organizacoes: ['G7', 'G20', 'OTAN', 'ONU (P5)'] },
    { id: 'fr', code: 'FR', nome: 'França', continente: 'Europa', capital: 'Paris', populacao: 68400000, area: '643.801 km²', moeda: 'Euro (EUR)', idioma: 'Francês', fuso: 'UTC+1', governo: 'República semipresidencialista', nomeOficial: 'República Francesa', chefeEstado: 'Emmanuel Macron', chefeGoverno: 'Gabriel Attal', independencia: '4 de setembro de 1870', regiao: 'Europa Ocidental', subregiao: 'Europa Ocidental',
      sobre: 'A França é uma república soberana transcontinental, cujo território metropolitano está localizado na Europa Ocidental e cujos territórios ultramarinos se espalham por diferentes regiões do mundo.',
      curiosidade: 'A França é o país mais visitado do mundo, recebendo mais de 90 milhões de turistas por ano.',
      lat: 48.86, lng: 2.35, organizacoes: ['ONU (P5)', 'UE', 'OTAN', 'OCDE', 'G7', 'G20', 'UNESCO'] },
    { id: 'in', code: 'IN', nome: 'Índia', continente: 'Ásia', capital: 'Nova Délhi', populacao: 1428000000, moeda: 'Rupia indiana (INR)', idioma: 'Hindi / Inglês', governo: 'República Federativa Parlamentarista', lat: 28.61, lng: 77.21, organizacoes: ['BRICS', 'G20', 'ONU'] },
    { id: 'il', code: 'IL', nome: 'Israel', continente: 'Ásia', capital: 'Jerusalém', populacao: 9800000, moeda: 'Novo shekel (ILS)', idioma: 'Hebraico / Árabe', governo: 'República Parlamentarista', lat: 31.77, lng: 35.21, organizacoes: ['ONU', 'OCDE'] },
    { id: 'it', code: 'IT', nome: 'Itália', continente: 'Europa', capital: 'Roma', populacao: 59000000, moeda: 'Euro (EUR)', idioma: 'Italiano', governo: 'República Parlamentarista', lat: 41.90, lng: 12.50, organizacoes: ['UE', 'OTAN', 'G7', 'ONU'] },
    { id: 'jp', code: 'JP', nome: 'Japão', continente: 'Ásia', capital: 'Tóquio', populacao: 124000000, moeda: 'Iene (JPY)', idioma: 'Japonês', governo: 'Monarquia Parlamentarista', lat: 35.68, lng: 139.65, organizacoes: ['G7', 'G20', 'ONU', 'OCDE'] },
    { id: 'mx', code: 'MX', nome: 'México', continente: 'América do Norte', capital: 'Cidade do México', populacao: 128000000, moeda: 'Peso mexicano (MXN)', idioma: 'Espanhol', governo: 'República Federativa Presidencialista', lat: 19.43, lng: -99.13, organizacoes: ['G20', 'OCDE', 'ONU'] },
    { id: 'pt', code: 'PT', nome: 'Portugal', continente: 'Europa', capital: 'Lisboa', populacao: 10300000, moeda: 'Euro (EUR)', idioma: 'Português', governo: 'República Semipresidencialista', lat: 38.72, lng: -9.14, organizacoes: ['UE', 'OTAN', 'ONU'] },
    { id: 'gb', code: 'GB', nome: 'Reino Unido', continente: 'Europa', capital: 'Londres', populacao: 67700000, moeda: 'Libra esterlina (GBP)', idioma: 'Inglês', governo: 'Monarquia Parlamentarista', lat: 51.51, lng: -0.13, organizacoes: ['ONU (P5)', 'OTAN', 'G7', 'G20'] },
    { id: 'ru', code: 'RU', nome: 'Rússia', continente: 'Europa/Ásia', capital: 'Moscou', populacao: 144000000, moeda: 'Rublo (RUB)', idioma: 'Russo', governo: 'República Federativa Semipresidencialista', lat: 55.75, lng: 37.62, organizacoes: ['BRICS', 'ONU (P5)', 'G20'] },
    { id: 'tr', code: 'TR', nome: 'Turquia', continente: 'Europa/Ásia', capital: 'Ancara', populacao: 85300000, moeda: 'Lira turca (TRY)', idioma: 'Turco', governo: 'República Presidencialista', lat: 39.93, lng: 32.86, organizacoes: ['OTAN', 'G20', 'ONU'] },
    { id: 'za', code: 'ZA', nome: 'África do Sul', continente: 'África', capital: 'Pretória', populacao: 60600000, moeda: 'Rand (ZAR)', idioma: 'Zulu / Inglês (+9)', governo: 'República Parlamentarista', lat: -25.75, lng: 28.19, organizacoes: ['BRICS', 'G20', 'ONU'] },
    { id: 'kr', code: 'KR', nome: 'Coreia do Sul', continente: 'Ásia', capital: 'Seul', populacao: 51700000, moeda: 'Won (KRW)', idioma: 'Coreano', governo: 'República Presidencialista', lat: 37.57, lng: 126.98, organizacoes: ['G20', 'OCDE', 'ONU'] }
  ];
}
let paises = load('diplo_paises', null) || paisesDefault();
let paisesFiltroContinente = 'todos';
let paisesOrdem = 'az';

function listaContinentes() { return [...new Set(paises.map(p => p.continente))].sort(); }

function renderPaisesFiltros() {
  const el = document.getElementById('paisesFiltroContinente'); if (!el) return;
  const conts = ['todos', ...listaContinentes()];
  el.innerHTML = conts.map(c => `<button class="chip ${paisesFiltroContinente === c ? 'active' : ''}" onclick="setPaisesFiltroContinente('${c}')">${c === 'todos' ? 'Todos' : c}</button>`).join('');
}
function setPaisesFiltroContinente(c) { paisesFiltroContinente = c; renderPaisesFiltros(); renderPaises(); }
function togglePaisesOrdem() {
  paisesOrdem = paisesOrdem === 'az' ? 'za' : 'az';
  document.getElementById('paisesOrdemBtn').textContent = paisesOrdem === 'az' ? 'A → Z' : 'Z → A';
  renderPaises();
}

function paisCardHtml(p) {
  const orgs = p.organizacoes || [];
  return `
    <div class="card pais-card" style="--accent:${continenteCor(p.continente)}" onclick="abrirPaisModal('${p.id}')">
      <div class="pc-top">
        <span class="pc-flag">${flagImgHtml(p.code)}</span>
        <div class="pc-name-wrap">
          <div class="pc-name">${p.nome}</div>
          <div class="pc-continent">${p.continente}</div>
        </div>
      </div>
      <div class="pc-stats">
        <div class="pc-stat"><span class="pc-stat-ic">🏛️</span><div><span class="pc-stat-label">Capital</span><span class="pc-stat-val">${p.capital}</span></div></div>
        <div class="pc-stat"><span class="pc-stat-ic">👥</span><div><span class="pc-stat-label">População</span><span class="pc-stat-val">${fmtPopulacao(p.populacao)}</span></div></div>
        <div class="pc-stat"><span class="pc-stat-ic">💰</span><div><span class="pc-stat-label">Moeda</span><span class="pc-stat-val">${p.moeda}</span></div></div>
      </div>
      ${orgs.length ? `<div class="pc-orgs">${orgs.slice(0, 3).map(o => `<span class="org-badge">${o}</span>`).join('')}${orgs.length > 3 ? `<span class="org-badge more">+${orgs.length - 3}</span>` : ''}</div>` : ''}
      <div class="pc-bar"></div>
    </div>`;
}

function renderPaises() {
  const el = document.getElementById('paisesGrid'); if (!el) return;
  const q = (document.getElementById('paisesSearch')?.value || '').trim().toLowerCase();
  let list = paises.filter(p => {
    const matchQ = !q || p.nome.toLowerCase().includes(q) || p.capital.toLowerCase().includes(q);
    const matchC = paisesFiltroContinente === 'todos' || p.continente === paisesFiltroContinente;
    return matchQ && matchC;
  });
  list.sort((a, b) => paisesOrdem === 'az' ? a.nome.localeCompare(b.nome, 'pt-BR') : b.nome.localeCompare(a.nome, 'pt-BR'));

  el.innerHTML = list.length ? list.map(paisCardHtml).join('') : '<div class="empty" style="padding:20px 0; color:var(--text-muted);">Nenhum país encontrado para esse filtro.</div>';

  // reinicia a animação de entrada a cada filtragem/busca
  el.classList.remove('filtering');
  void el.offsetWidth;
  el.classList.add('filtering');

  const lbl = document.getElementById('paisesCountLabel');
  if (lbl) lbl.textContent = paises.length + ' país' + (paises.length === 1 ? '' : 'es') + ' catalogado' + (paises.length === 1 ? '' : 's');
}

/* ---- Modal — ficha detalhada do país ---- */
function abrirPaisModal(id) {
  const p = paises.find(x => x.id === id); if (!p) return;
  const orgs = p.organizacoes || [];
  document.getElementById('paisModalBody').innerHTML = `
    <div class="pm-hero" style="--accent:${continenteCor(p.continente)}">
      <span class="pm-flag">${flagImgHtml(p.code)}</span>
      <div>
        <h3 style="margin-bottom:2px;">${p.nome}</h3>
        <div class="pm-sub mono">${p.nomeOficial || p.nome} · ${p.continente}</div>
      </div>
    </div>
    ${p.sobre ? `<p class="pm-sobre">${p.sobre}</p>` : ''}
    <div class="pm-grid">
      <div class="pm-item"><span class="field-label">Capital</span>${p.capital}</div>
      <div class="pm-item"><span class="field-label">População</span>${fmtPopulacao(p.populacao)}</div>
      <div class="pm-item"><span class="field-label">Moeda</span>${p.moeda}</div>
      <div class="pm-item"><span class="field-label">Idioma</span>${p.idioma || '—'}</div>
      <div class="pm-item"><span class="field-label">Governo</span>${p.governo || '—'}</div>
      ${p.area ? `<div class="pm-item"><span class="field-label">Área</span>${p.area}</div>` : ''}
      ${p.chefeEstado ? `<div class="pm-item"><span class="field-label">Chefe de Estado</span>${p.chefeEstado}</div>` : ''}
      ${p.chefeGoverno ? `<div class="pm-item"><span class="field-label">Chefe de Governo</span>${p.chefeGoverno}</div>` : ''}
    </div>
    ${orgs.length ? `<div style="margin-top:14px;"><span class="field-label">Organizações internacionais</span><div class="pc-orgs" style="margin-top:6px;">${orgs.map(o => `<span class="org-badge">${o}</span>`).join('')}</div></div>` : ''}
    ${p.curiosidade ? `<div class="pm-curiosidade"><span class="field-label">Curiosidade</span>${p.curiosidade}</div>` : ''}
  `;
  document.getElementById('paisModal').classList.add('show');
}
function closePaisModal(e) { if (e.target.classList.contains('modal-overlay')) closePaisModalDirect(); }
function closePaisModalDirect() { document.getElementById('paisModal').classList.remove('show'); }

/* ==========================================================================
   Mapa-múndi — agora com continentes reais (d3-geo + topojson, dados
   públicos do world-atlas em resolução 110m) por baixo dos marcadores.
   A matemática dos marcadores (lat/lng → % da tela) continua a mesma de
   antes: é uma projeção equiretangular, exatamente igual à usada para
   desenhar os continentes — por isso os pinos continuam batendo
   certinho em cima do mapa.
   ========================================================================== */
function latLngToPct(lat, lng) {
  return { x: ((lng + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 };
}

const MAPA_MUNDI_W = 1000;
const MAPA_MUNDI_H = 500;
let mapaMundiSvgCache = null;      // guarda o SVG dos continentes já pronto (evita recalcular a cada busca)
let mapaMundiFeaturesPromise = null; // guarda a promise dos dados geográficos (evita baixar de novo)

function getMapaMundiFeatures() {
  if (!mapaMundiFeaturesPromise) {
    mapaMundiFeaturesPromise = fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(topo => topojson.feature(topo, topo.objects.countries).features)
      .catch(e => { console.error('Falha ao carregar dados do mapa-múndi:', e); return []; });
  }
  return mapaMundiFeaturesPromise;
}

async function construirMapaMundiSvg() {
  if (mapaMundiSvgCache) return mapaMundiSvgCache;
  if (typeof d3 === 'undefined' || typeof topojson === 'undefined') return null; // libs indisponíveis (offline) — mantém a grade
  const features = await getMapaMundiFeatures();
  if (!features.length) return null;
  const projection = d3.geoEquirectangular().fitSize([MAPA_MUNDI_W, MAPA_MUNDI_H], { type: 'Sphere' });
  const pathGen = d3.geoPath(projection);
  const paths = features.map(f => `<path d="${pathGen(f)}" class="mapa-country"></path>`).join('');
  mapaMundiSvgCache = `<svg class="mapa-mundi-svg" viewBox="0 0 ${MAPA_MUNDI_W} ${MAPA_MUNDI_H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
  return mapaMundiSvgCache;
}

function mapaMundiPinsHtml(q) {
  return paises.map(p => {
    const pos = latLngToPct(p.lat, p.lng);
    const match = q && (p.nome.toLowerCase().includes(q) || p.capital.toLowerCase().includes(q));
    return `<button type="button" class="map-pin ${match ? 'match' : ''}" style="left:${pos.x}%; top:${pos.y}%; --accent:${continenteCor(p.continente)}" onclick="abrirPaisModal('${p.id}')" title="${p.nome}">
        <span class="map-pin-dot"></span>
        <span class="map-pin-label">${flagImgHtml(p.code, 'map-pin-flag')}${p.nome}</span>
      </button>`;
  }).join('');
}

async function renderPaisesMapa() {
  const wrap = document.getElementById('paisesMapaSvgWrap'); if (!wrap) return;
  const q = (document.getElementById('paisesMapaSearch')?.value || '').trim().toLowerCase();
  const pins = mapaMundiPinsHtml(q);

  // Mostra na hora o que já tivermos (mapa em cache, ou a grade como placeholder)
  wrap.innerHTML = `
    ${mapaMundiSvgCache || '<div class="map-grid-lines"></div>'}
    <div class="map-vignette"></div>
    ${pins}
  `;

  if (!mapaMundiSvgCache) {
    const svg = await construirMapaMundiSvg();
    if (!svg) return; // sem internet/lib: fica na grade mesmo
    // Evita sobrescrever se o usuário já saiu da aba/mudou a busca nesse meio-tempo
    const wrapAinda = document.getElementById('paisesMapaSvgWrap');
    if (!wrapAinda) return;
    const qAgora = (document.getElementById('paisesMapaSearch')?.value || '').trim().toLowerCase();
    wrapAinda.innerHTML = `
      ${svg}
      <div class="map-vignette"></div>
      ${mapaMundiPinsHtml(qAgora)}
    `;
  }
}

function renderPaisesModule() {
  renderPaisesFiltros();
  renderPaises();
  renderPaisesMapa();
}
