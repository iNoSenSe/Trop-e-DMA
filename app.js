const $ = (s)=>document.querySelector(s);

let DATA = { entries: [] };
let STATE = { view: 'home', year: null, place: null }; // place = ville OU "Finales Nationales"



// === Libellés complets des niveaux ===
const LEVEL_NAMES = {
  3: "Niveau 3 - Initiation 1",
  4: "Niveau 4 - Initiation 2",
  5: "Niveau 5 - Préparatoire 1",
  6: "Niveau 6 - Préparatoire 2",
  7: "Niveau 7 - Fin de premier cycle",
  8: "Niveau 8 - Élémentaire 1",
  9: "Niveau 9 - Élémentaire 2",
  10: "Niveau 10 - Moyen",
  11: "Niveau 11 - Supérieur",
  12: "Niveau 12 - Excellence",
};

function levelLabel(n) {
  const k = typeof n === "number" ? n : parseInt(String(n), 10);
  return LEVEL_NAMES[k] || `Niveau ${k}`;
}




// ==== Helpers pour tri des résultats ====

// extrait un nombre d'un champ (ex. "Niveau 11 - Supérieur" -> 11)
function num(x, fallback = 9999) {
  if (x === null || x === undefined) return fallback;
  const n = typeof x === 'number' ? x : parseInt(String(x).match(/\d+/)?.[0] ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}
function levelNum(niveau) { return num(niveau, 999); }
const isFinaliste = s => /finaliste/i.test(String(s || ''));




// score de la distinction (plus grand = mieux)

function distScore(s) {
  if (!s) return 0;
  const t = String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, ''); // retire les accents

  // --- Trophée DMA ---
  if (/trophee/.test(t)) return 100;

  // --- Prix plaquette d'or ---
  if (/\b1(er)?\s*prix.*plaquette/.test(t)) return 90;
  if (/\b2(e|eme)?\s*prix.*plaquette/.test(t)) return 80;
  if (/\b3(e|eme)?\s*prix.*plaquette/.test(t)) return 70;
  if (/\b4(e|eme)?\s*prix.*plaquette/.test(t)) return 60;

  // --- 1er prix médaille d'or (unique) ---
  if (/\b1(er)?\s*prix.*medaille.*or/.test(t)) return 50;

  // --- Médailles d’argent / de bronze ---
  if (/medaille.*argent/.test(t)) return 30;
  if (/medaille.*bronze/.test(t)) return 20;

  // --- Finalistes ---
  if (/finaliste/.test(t)) return 10;

  // --- Par défaut ---
  return 5;
}




const FINALE_LABEL = 'Finales Nationales';
const FINALE_TOKENS = new Set([
  'finale','finales','finale nationale','finales nationales', FINALE_LABEL.toLowerCase()
]);
const isFinaleVille = (v)=> typeof v === 'string' && FINALE_TOKENS.has(v.trim().toLowerCase());

// Helpers sur DATA.entries
function yearsFromData() {
  const years = new Set((DATA.entries || []).map(r => r.annee));
  return [...years].filter(Boolean).sort((a, b) => b - a);
}

function villesForYear(year) {
  const entries = (DATA.entries || []).filter(r => r.annee === year);

  // On récupère tous les noms de villes exactement comme dans le fichier
  const set = new Set(
    entries
      .map(r => r.ville)        // prend le texte brut du JSON/Excel
      .filter(Boolean)          // retire les vides
  );

  return [...set].sort((a, b) => String(a).localeCompare(String(b)));
}



function setView(view, params = {}) {
  STATE = { ...STATE, ...params, view };
  render();
}

// --------- Vues ---------
function renderHome() {
  return `
    <h2 class="section-title">Bienvenue</h2>
    <p class="lead">Consultez les résultats du Trophée DMA.</p>
  `;
}

function renderYears() {
  const years = yearsFromData();
  const empty = years.length === 0 ? '<p class="lead">Aucune année disponible.</p>' : '';
  return `
    <h2 class="section-title">Palmarès</h2>
    ${empty}
    <div class="btns">
      ${years.map(y => `<button class="btn" data-year="${y}">${y}</button>`).join('')}
    </div>
  `;
}

function renderPlaces() {
  const villes = villesForYear(STATE.year);

  const boutonsVilles = villes
    .map(v => `<button class="btn" data-place="${v}">${v}</button>`)
    .join('');

  return `
    <div class="breadcrumb">Palmarès › ${STATE.year}</div>
    <div class="btns">
      ${boutonsVilles}
    </div>
    <div class="btns">
      <button class="btn" data-go="years">← Retour</button>
    </div>
  `;
}


function renderResults() {
const isFinale = (STATE.place === FINALE_LABEL);

const rows = (DATA.entries || []).filter(x =>
  x.annee === STATE.year &&
  (
    isFinale
      ? (x.finale || isFinaleVille(x.ville))                // finale = sa "ville"
      : (!x.finale && !isFinaleVille(x.ville) && x.ville === STATE.place)
  )
);

  // En-tête sans colonne "Niveau"
  const head = `<tr><th>Candidat</th><th>Professeur</th><th>Distinction</th></tr>`;

  // --- Construction du tbody avec sous-titres de niveaux ---
  let lastLevel = null;
  let body = '';

  rows
  .sort((a, b) =>
    (levelNum(a.niveau) - levelNum(b.niveau)) ||                 // niveau croissant
    (distScore(b.distinction) - distScore(a.distinction)) ||      // distinction décroissant
    (
      // si deux "médaille de finaliste", garder l'ordre Excel (ordre du JSON)
      isFinaliste(a.distinction) && isFinaliste(b.distinction)
        ? (a.__idx - b.__idx)
        : String(a.candidat || '').localeCompare(String(b.candidat || ''))
    )
  )
  .forEach(r => {

      // si le niveau change, on ajoute une ligne de titre
      if (r.niveau !== lastLevel) {
        body += `
  <tr class="level-row">
    <td colspan="4" class="level-title">${levelLabel(r.niveau)}</td>
  </tr>`;
        lastLevel = r.niveau;
      }

      // ligne du candidat
      body += `
  <tr>
    <td>${r.candidat || ''}</td>
    <td>${r.professeur || ''}</td>
    <td>${r.distinction || ''}</td>
  </tr>`;
    });

  return `
  <div class="breadcrumb">Palmarès › ${STATE.year} › ${isFinale ? FINALE_LABEL : STATE.place}</div>
  <div class="table-wrap">
    <table class="table">
      <thead>${head}</thead>
      <tbody>${body}</tbody>
    </table>
  </div>
  <div class="btns">
    <button class="btn" data-go="places">← Retour</button>
  </div>
`;
}


// --------- Render + Bind ---------
function render() {
  const container = $('#view');
  if (!container) return;

  if (STATE.view === 'home') container.innerHTML = renderHome();
  if (STATE.view === 'years') container.innerHTML = renderYears();
  if (STATE.view === 'places') container.innerHTML = renderPlaces();
  if (STATE.view === 'results') container.innerHTML = renderResults();

  bindInView();
}

function bindTopNav() {
  document.querySelectorAll('.nav .link').forEach(b => {
    b.onclick = () => setView(b.dataset.go, { year: null, place: null });
  });
}

function bindInView() {
  document.querySelectorAll('[data-go="years"]').forEach(b => b.onclick = () => setView('years', { year: null, place: null }));
  document.querySelectorAll('[data-go="home"]').forEach(b => b.onclick = () => setView('home', { year: null, place: null }));
  document.querySelectorAll('[data-go="places"]').forEach(b => b.onclick = () => setView('places', { place: null }));
  document.querySelectorAll('[data-year]').forEach(b => b.onclick = () => setView('places', { year: Number(b.dataset.year), place: null }));
  document.querySelectorAll('[data-place]').forEach(b => b.onclick = () => setView('results', { place: b.dataset.place }));
}


// --------- Boot ---------
document.addEventListener('DOMContentLoaded', () => {
  bindTopNav();
  setView('home');
  fetch('data.json?ts=' + Date.now(), { cache: 'no-store' })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(j => {
  DATA = j;
  DATA.entries = (j.entries || []).map((r, i) => ({ ...r, __idx: i })); // index d’origine
  console.log('DATA chargée', DATA);
})
    .catch(e => console.error('Erreur data.json', e));
});
