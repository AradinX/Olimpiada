// scripts.js

// === 1) Linki do arkuszy (wklej swoje!) ===
const SHEET_URL_WYNIKI = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=0&single=true&output=csv';
const SHEET_URL_ZESPOLY = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=1165307336&single=true&output=csv';
const SHEET_URL_FLANKI        = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=80270090&single=true&output=csv';       
const SHEET_URL_FLANKI_FINAL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=144304670&single=true&output=csv';  
const SHEET_URL_MISTRZ_FLANKI = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=1822343054&single=true&output=csv';
const SHEET_URL_BEERPONG        = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=1458846082&single=true&output=csv';        
const SHEET_URL_BEERPONG_FINAL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=1218477508&single=true&output=csv';  
const SHEET_URL_MISTRZ_BEERPONG = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=2068520393&single=true&output=csv';
const SHEET_URL_REKORDY = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=1413679066&single=true&output=csv';
// === 2) Pobieranie CSV i podbijanie cache'u ===
async function fetchCSV(url) {
  const sep = url.includes('?') ? '&' : '?';
  const fullUrl = url + sep + 't=' + Date.now();
  const res = await fetch(fullUrl);
  const text = await res.text();
  return text
    .trim()
    .split('\n')
    .map(parseCSVLine);
}

function parseCSVLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell.trim());
  return cells;
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// === 3) Render dużej tabeli Wyniki ===
function renderTable(rows, tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  if (tableId === 'rekordy') {
    renderRekordySprint(rows);
    return;
  }

  const [header, ...rawDataRows] = rows;
  const dataRows = tableId === 'wyniki'
    ? sortRowsByMedals(header, rawDataRows.filter(row => row.some(Boolean)))
    : rawDataRows;

  table.querySelector('thead').innerHTML =
    '<tr>' + header.map(h => `<th>${escapeHTML(h)}</th>`).join('') + '</tr>';

  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  dataRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = row.map(cell => `<td>${escapeHTML(cell)}</td>`).join('');
    tbody.appendChild(tr);
  });
}

// === 4) Render kolumn jako 6 małych tabelek ===
function renderColumnTables(rows, containerId) {
  const header   = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1);
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  header.forEach((groupName, colIdx) => {
    if (!groupName) return;               // pomiń puste nagłówki
    const table = document.createElement('table');
    table.classList.add('group-table');

    // nagłówek z nazwą grupy
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th>${escapeHTML(groupName)}</th></tr>`;
    table.appendChild(thead);

    // body: do 5 wierszy z tej kolumny
    const tbody = document.createElement('tbody');
    dataRows.slice(0, 5).forEach(row => {
      const cell = row[colIdx] || '';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHTML(cell)}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.appendChild(table);
  });
}

// === 5) Ładowanie i odświeżanie Wyniki ===
// UWAGA: od 2026-06-06 wyniki kalkuluje wyniki.js z Supabase results.
async function loadWyniki() {
  try {
    const rows = await fetchCSV(SHEET_URL_WYNIKI);
    renderTable(rows, 'wyniki');
  } catch (e) {
    console.error('Błąd pobierania Wyniki:', e);
  }
}
// Wylaczone — wyniki.js teraz kalkuluje z Supabase results.
// if (document.getElementById('wyniki')) {
//   loadWyniki();
//   setInterval(loadWyniki, 60000);
// }

// === 6) Ładowanie i odświeżanie Zespoły (kolumny → tabele) ===
// UWAGA: od 2026-06-06 zespoły są renderowane przez zespoly.js z TEAMS (data.js).
// Stary fetch z Google Sheets zostawiony pod stopką dla legacy/diagnostyki.
async function loadZespoly() {
  try {
    const rows = await fetchCSV(SHEET_URL_ZESPOLY);
    console.log('Zespoly CSV:', rows);
    renderColumnTables(rows, 'zespoly-groups');
  } catch (e) {
    console.error('Błąd pobierania Zespoły:', e);
  }
}
// Wylaczone — zespoly.js teraz renderuje z TEAMS w data.js.
// if (document.getElementById('zespoly-groups')) {
//   loadZespoly();
//   setInterval(loadZespoly, 60000);
// }
// === renderSplitTables – dzieli pierwszy arkusz na dwie tabele 2×4 i oznacza top2 jako advanced
function renderSplitTables(rows, containerId) {
  const header   = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1, 5); // weź cztery wiersze pod nagłówkiem
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (containerId === 'flanki-group-container') {
    renderFlankiHierarchy(header, rows.slice(1, 4), container);
    return;
  }

  for (let i = 0; i < header.length; i += 2) {
    const table = document.createElement('table');
    table.classList.add('flanki-group-table');

    // nagłówek dwóch kolumn
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th>${escapeHTML(header[i])}</th>
      <th>${escapeHTML(header[i+1] || '')}</th>
    </tr>`;
    if (containerId === 'flanki-group-container') {
      thead.innerHTML = `<tr>
        <th>Pozycja</th>
        <th>${escapeHTML(header[i])}</th>
        <th>${escapeHTML(header[i+1] || '')}</th>
      </tr>`;
    }
    table.appendChild(thead);

    // body: cztery wiersze, top2 oznaczone class="advanced"
    const tbody = document.createElement('tbody');
    dataRows.forEach((row, idx) => {
      const tr = document.createElement('tr');
      if (containerId !== 'flanki-group-container' && idx < 2) tr.classList.add('advanced');
      const c1 = row[i]   || '';
      const c2 = row[i+1] || '';
      tr.innerHTML = containerId === 'flanki-group-container'
        ? `<td>${idx + 1}</td><td>${escapeHTML(c1)}</td><td>${escapeHTML(c2)}</td>`
        : `<td>${escapeHTML(c1)}</td><td>${escapeHTML(c2)}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.appendChild(table);
  }
}

// === loadFlankiGroup – faza grupowa ===
function renderFlankiHierarchy(header, dataRows, container) {
  for (let i = 0; i < header.length; i += 2) {
    if (!header[i] && !header[i + 1]) continue;

    const card = document.createElement('article');
    card.className = 'flanki-ladder-card';
    const rowsMarkup = dataRows.map((row, index) => {
      const left = row[i] || '';
      const right = row[i + 1] || '';
      return `
        <div class="flanki-rank-step rank-${index + 1}">
          <span>Nr ${index + 1}</span>
          <strong>${escapeHTML(left)}</strong>
          ${right ? `<em>${escapeHTML(right)}</em>` : ''}
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="flanki-ladder-head">
        <span>Grupa</span>
        <strong>${escapeHTML(header[i])}${header[i + 1] ? ` / ${escapeHTML(header[i + 1])}` : ''}</strong>
      </div>
      <div class="flanki-ladder">${rowsMarkup}</div>
    `;
    container.appendChild(card);
  }
}

async function loadFlankiGroup() {
  try {
    const rows = await fetchCSV(SHEET_URL_FLANKI);
    renderSplitTables(rows, 'flanki-group-container');
  } catch (e) {
    console.error('Błąd pobierania Flanki (grupy):', e);
  }
}
if (document.getElementById('flanki-group-container')) {
  loadFlankiGroup();
  setInterval(loadFlankiGroup, 60000);
}

// === loadFlankiFinal – tabela finałowa ===
async function loadFlankiFinal() {
  try {
    const rows = await fetchCSV(SHEET_URL_FLANKI_FINAL);
    renderTable(rows, 'flanki-final');
  } catch (e) {
    console.error('Błąd pobierania Flanki Finał:', e);
  }
}
if (document.getElementById('flanki-final')) {
  loadFlankiFinal();
  setInterval(loadFlankiFinal, 60000);
}

// === loadMistrzFlanki – mistrzowie flanek ===
async function loadMistrzFlanki() {
  try {
    const rows = await fetchCSV(SHEET_URL_MISTRZ_FLANKI);
    renderTable(rows, 'flanki-champ');
  } catch (e) {
    console.error('Błąd pobierania Mistrz Flanki:', e);
  }
}
if (document.getElementById('flanki-champ')) {
  loadMistrzFlanki();
  setInterval(loadMistrzFlanki, 60000);
}
// === renderSplitTables dla Spaceru na ścieżkę (faza grupowa) ===
async function loadBeerPongGroup() {
  try {
    const rows = await fetchCSV(SHEET_URL_BEERPONG);
    renderSplitTables(rows, 'beerpong-group-container');
  } catch (e) {
    console.error('Błąd pobierania Spaceru na ścieżkę (grupy):', e);
  }
}
if (document.getElementById('beerpong-group-container')) {
  loadBeerPongGroup();
  setInterval(loadBeerPongGroup, 60000);
}

// === load Spacer na ścieżkę Finał ===
async function loadBeerPongFinal() {
  try {
    const rows = await fetchCSV(SHEET_URL_BEERPONG_FINAL);
    renderTable(rows, 'beerpong-final');
  } catch (e) {
    console.error('Błąd pobierania Spaceru na ścieżkę Finał:', e);
  }
}
if (document.getElementById('beerpong-final')) {
  loadBeerPongFinal();
  setInterval(loadBeerPongFinal, 60000);
}

// === load Mistrz Spaceru na ścieżkę ===
async function loadMistrzBeerPong() {
  try {
    const rows = await fetchCSV(SHEET_URL_MISTRZ_BEERPONG);
    renderTable(rows, 'beerpong-champ');
  } catch (e) {
    console.error('Błąd pobierania Mistrz Spaceru na ścieżkę:', e);
  }
}
if (document.getElementById('beerpong-champ')) {
  loadMistrzBeerPong();
  setInterval(loadMistrzBeerPong, 60000);
}
// === load Rekord ===
// UWAGA: od 2026-06-06 rekordy renderuje rekordy.js z Supabase records.
async function loadRekordy() {
  try {
    const rows = await fetchCSV(SHEET_URL_REKORDY);
    renderTable(rows, 'rekordy');
  } catch (e) {
    console.error('Błąd pobierania Rekordy:', e);
  }
}
// Wylaczone — rekordy.js teraz czyta z Supabase records.
// if (document.getElementById('rekordy')) {
//   loadRekordy();
//   setInterval(loadRekordy, 60000);
// }
// Home podium
function findColumnIndex(header, candidates, fallback) {
  const normalized = header.map(normalizeText);
  const found = candidates
    .map(candidate => normalized.findIndex(cell => cell.includes(normalizeText(candidate))))
    .find(index => index >= 0);

  return found ?? fallback;
}

async function loadHomePodium() {
  try {
    const rows = await fetchCSV(SHEET_URL_WYNIKI);
    renderHomePodium(rows);
    renderCompetitionTimeline(rows);
  } catch (e) {
    const podium = document.getElementById('home-podium');
    const timeline = document.getElementById('competition-timeline');
    if (podium) {
      podium.innerHTML = '<p class="status-copy">Nie udało się pobrać podium. Spróbuj odświeżyć stronę.</p>';
    }
    if (timeline) {
      timeline.innerHTML = '<p class="status-copy">Nie udało się pobrać konkurencji. Spróbuj odświeżyć stronę.</p>';
    }
    console.error('Błąd pobierania podium:', e);
  }
}

async function loadHomeRecords() {
  try {
    const rows = await fetchCSV(SHEET_URL_REKORDY);
    renderHomeRecords(rows);
  } catch (e) {
    const records = document.getElementById('home-records');
    if (records) {
      records.innerHTML = '<p class="status-copy">Nie udało się pobrać rekordów. Spróbuj odświeżyć stronę.</p>';
    }
    console.error('Błąd pobierania rekordów na stronę główną:', e);
  }
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseNumber(value) {
  const match = String(value ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function medalFromCell(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (String(value).includes('🥇') || normalized.includes('zloto') || normalized === '1') return 'gold';
  if (String(value).includes('🥈') || normalized.includes('srebro') || normalized === '2') return 'silver';
  if (String(value).includes('🥉') || normalized.includes('braz') || normalized === '3') return 'bronze';
  return null;
}

function getMedalSummaryIndexes(header) {
  return {
    gold: findColumnIndex(header, ['zloto', 'złoto', 'gold'], -1),
    silver: findColumnIndex(header, ['srebro', 'silver'], -1),
    bronze: findColumnIndex(header, ['braz', 'brąz', 'bronze'], -1)
  };
}

const OFFICIAL_COMPETITIONS = [
  { name: 'Flanki',           aliases: ['flanki'] },
  { name: 'Sprint na 500 ml', aliases: ['sprint na 500', 'sprint na 500 ml'] },
  { name: 'Na pół',           aliases: ['na pol', 'na pół'] },
  { name: 'Smakosz',          aliases: ['smakosz', 'beer hunt'] },
  { name: 'Spacer na ścieżkę', aliases: ['spacer na sciezke', 'spacer na ścieżkę', 'beer pong'] },
  { name: 'Inwestor',         aliases: ['inwestor', 'lucky shot'] }
];

function findCompetitionColumn(header, competition) {
  const normalized = header.map(normalizeText);
  return competition.aliases
    .map(alias => normalized.findIndex(cell => cell.includes(normalizeText(alias))))
    .find(index => index >= 0) ?? -1;
}

function getCompetitionIndexes(header) {
  const officialIndexes = OFFICIAL_COMPETITIONS
    .map(competition => findCompetitionColumn(header, competition))
    .filter(index => index >= 0);

  if (officialIndexes.length) {
    return [...new Set(officialIndexes)];
  }

  const normalized = header.map(normalizeText);
  const start = normalized.findIndex(cell => cell.includes('beer hunt'));
  const end = normalized.findIndex(cell => cell.includes('najebany na autobus'));
  const summary = getMedalSummaryIndexes(header);
  const summaryIndexes = Object.values(summary).filter(index => index >= 0);
  const firstSummary = summaryIndexes.length ? Math.min(...summaryIndexes) : header.length;

  if (start >= 0 && end >= start) {
    return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
  }

  return header
    .map((_, index) => index)
    .filter(index => index > 0 && index < firstSummary);
}

function getRowMedals(row, header, competitionIndexes) {
  const summary = getMedalSummaryIndexes(header);
  const counts = {
    gold: summary.gold >= 0 ? parseNumber(row[summary.gold]) : 0,
    silver: summary.silver >= 0 ? parseNumber(row[summary.silver]) : 0,
    bronze: summary.bronze >= 0 ? parseNumber(row[summary.bronze]) : 0
  };

  if (counts.gold || counts.silver || counts.bronze) {
    return counts;
  }

  competitionIndexes.forEach(index => {
    const medal = medalFromCell(row[index]);
    if (medal) counts[medal] += 1;
  });

  return counts;
}

function sortRowsByMedals(header, rows) {
  const competitionIndexes = getCompetitionIndexes(header);
  return [...rows].sort((a, b) => {
    const medalsA = getRowMedals(a, header, competitionIndexes);
    const medalsB = getRowMedals(b, header, competitionIndexes);
    return medalsB.gold - medalsA.gold ||
      medalsB.silver - medalsA.silver ||
      medalsB.bronze - medalsA.bronze ||
      a.join('').localeCompare(b.join(''), 'pl');
  });
}

const renderHomePodium = function renderHomeMedalists(rows) {
  const podium = document.getElementById('home-podium');
  if (!podium || rows.length < 2) return;

  const header = rows[0] || [];
  const dataRows = rows.slice(1).filter(row => row.some(Boolean));
  const nameIndex = findColumnIndex(header, ['uczestnik', 'osoba', 'zawodnik', 'imie', 'imi', 'zesp', 'team', 'dru'], 0);
  const competitionIndexes = getCompetitionIndexes(header);
  const rankedRows = dataRows
    .map((row, index) => {
      const medals = getRowMedals(row, header, competitionIndexes);
      const total = medals.gold + medals.silver + medals.bronze;
      return { row, index, medals, total };
    })
    .filter(entry => entry.total > 0)
    .sort((a, b) =>
      b.medals.gold - a.medals.gold ||
      b.medals.silver - a.medals.silver ||
      b.medals.bronze - a.medals.bronze ||
      a.index - b.index
    )
    .slice(0, 5);

  podium.innerHTML = '';

  if (!rankedRows.length) {
    podium.innerHTML = '<p class="status-copy">Medale jeszcze czekają na wpisanie do tabeli wyników.</p>';
    return;
  }

  rankedRows.forEach(({ row, medals }, index) => {
    const name = row[nameIndex] || 'Zawodnik';
    const item = document.createElement('div');
    item.className = 'podium-row medalist-row';
    item.innerHTML = `
      <div class="podium-rank">${index + 1}</div>
      <div class="podium-name">${escapeHTML(name)}</div>
      <div class="podium-score medal-stack">
        <span><b>Z</b>${medals.gold}</span>
        <span><b>S</b>${medals.silver}</span>
        <span><b>B</b>${medals.bronze}</span>
      </div>
    `;
    podium.appendChild(item);
  });
};

function renderCompetitionTimeline(rows) {
  const timeline = document.getElementById('competition-timeline');
  if (!timeline || rows.length < 2) return;

  const header = rows[0] || [];
  const dataRows = rows.slice(1).filter(row => row.some(Boolean));
  const nameIndex = findColumnIndex(header, ['uczestnik', 'osoba', 'zawodnik', 'imie', 'imi'], 0);

  timeline.innerHTML = '';

  OFFICIAL_COMPETITIONS.forEach((competition, index) => {
    const columnIndex = findCompetitionColumn(header, competition);
    const medalists = { gold: [], silver: [], bronze: [] };

    if (columnIndex >= 0) {
      dataRows.forEach(row => {
        const medal = medalFromCell(row[columnIndex]);
        if (!medal) return;
        medalists[medal].push(row[nameIndex] || 'Zawodnik');
      });
    }

    const total = medalists.gold.length + medalists.silver.length + medalists.bronze.length;
    const item = document.createElement('article');
    item.className = `timeline-event ${total ? 'is-complete' : 'is-pending'}`;
    item.innerHTML = `
      <div class="timeline-index">${String(index + 1).padStart(2, '0')}</div>
      <div class="timeline-card">
        <span class="timeline-status">${total ? 'complete' : 'oczekuje'}</span>
        <h4>${escapeHTML(competition.name)}</h4>
        <div class="timeline-medals" aria-label="Medaliści konkurencji">
          ${renderTimelineMedal('gold', 'Złoto', medalists.gold)}
          ${renderTimelineMedal('silver', 'Srebro', medalists.silver)}
          ${renderTimelineMedal('bronze', 'Brąz', medalists.bronze)}
        </div>
      </div>
    `;
    timeline.appendChild(item);
  });
}

function renderTimelineMedal(type, label, names) {
  const text = names.length ? names.join(', ') : 'czeka';
  return `
    <span class="timeline-medal-line ${type}">
      <i aria-hidden="true"></i>
      <b>${escapeHTML(label)}</b>
      <em>${escapeHTML(text)}</em>
    </span>
  `;
}

function getSprintRecordColumns(eventHeader) {
  return eventHeader
    .map((eventName, index) => ({ eventName, index }))
    .filter(item => normalizeText(item.eventName).includes('sprint na 500'));
}

function renderRekordySprint(rows) {
  const table = document.getElementById('rekordy');
  if (!table || rows.length < 3) return;

  const eventHeader = rows[0] || [];
  const yearHeader = rows[1] || [];
  const dataRows = rows.slice(2).filter(row => row.some(Boolean));
  const nameIndex = findColumnIndex(yearHeader, ['zawodnik', 'uczestnik', 'osoba', 'imie', 'imi'], 0);
  const sprintColumns = getSprintRecordColumns(eventHeader)
    .filter(column => column.index !== nameIndex)
    .sort((a, b) => parseNumber(yearHeader[b.index]) - parseNumber(yearHeader[a.index]));
  const newestSprintColumn = sprintColumns
    .map(column => ({ ...column, year: parseInt(String(yearHeader[column.index]).trim(), 10) }))
    .filter(column => Number.isFinite(column.year))
    .sort((a, b) => b.year - a.year)[0];

  const sortedRows = [...dataRows].sort((a, b) => {
    const valueA = newestSprintColumn ? parseNumber(a[newestSprintColumn.index]) : Number.POSITIVE_INFINITY;
    const valueB = newestSprintColumn ? parseNumber(b[newestSprintColumn.index]) : Number.POSITIVE_INFINITY;
    const safeA = valueA > 0 ? valueA : Number.POSITIVE_INFINITY;
    const safeB = valueB > 0 ? valueB : Number.POSITIVE_INFINITY;
    return safeA - safeB || String(a[nameIndex] || '').localeCompare(String(b[nameIndex] || ''), 'pl');
  });

  table.querySelector('thead').innerHTML = `
    <tr>
      <th>Zawodnik</th>
      ${sprintColumns.map(column => `<th>${escapeHTML(yearHeader[column.index] || eventHeader[column.index])}</th>`).join('')}
    </tr>
  `;

  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  sortedRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(row[nameIndex] || '')}</td>
      ${sprintColumns.map(column => `<td>${escapeHTML(row[column.index] || '')}</td>`).join('')}
    `;
    tbody.appendChild(tr);
  });

  renderRekordyTop3(rows, sprintColumns, nameIndex);
}

function renderRekordyTop3(rows, sprintColumns, nameIndex) {
  const container = document.getElementById('rekordy-top3');
  if (!container) return;

  const yearHeader = rows[1] || [];
  const dataRows = rows.slice(2).filter(row => row.some(Boolean));
  const entries = [];

  sprintColumns.forEach(column => {
    dataRows.forEach(row => {
      const result = parseNumber(row[column.index]);
      if (!Number.isFinite(result) || result <= 0) return;
      entries.push({
        name: row[nameIndex] || 'Zawodnik',
        year: yearHeader[column.index] || '',
        result
      });
    });
  });

  const topEntries = entries.sort((a, b) => a.result - b.result).slice(0, 3);
  container.innerHTML = topEntries.map((entry, index) => `
    <article class="record-top-card">
      <span>${index + 1}</span>
      <strong>${escapeHTML(entry.name)}</strong>
      <small>${escapeHTML(entry.year)}</small>
      <b>${escapeHTML(formatRecordTime(entry.result))}</b>
    </article>
  `).join('');
}

function renderHomeRecords(rows) {
  const records = document.getElementById('home-records');
  if (!records || rows.length < 3) return;

  const eventHeader = rows[0] || [];
  const yearHeader = rows[1] || [];
  const dataRows = rows.slice(2).filter(row => row.some(Boolean));
  const nameIndex = findColumnIndex(yearHeader, ['zawodnik', 'uczestnik', 'osoba', 'imie', 'imi'], 0);
  const currentYear = new Date().getFullYear();
  const allowedYears = [currentYear, currentYear - 1];
  const groups = [];

  yearHeader.forEach((year, columnIndex) => {
    const parsedYear = parseInt(String(year).trim(), 10);
    const eventName = eventHeader[columnIndex] || '';
    if (!allowedYears.includes(parsedYear) || columnIndex === nameIndex || !normalizeText(eventName).includes('sprint na 500')) return;
    const entries = [];

    dataRows.forEach(row => {
      const result = parseNumber(row[columnIndex]);
      if (!Number.isFinite(result) || result <= 0) return;

      entries.push({
        name: row[nameIndex] || 'Zawodnik',
        event: eventHeader[columnIndex] || 'Rekord',
        result
      });
    });

    if (entries.length) {
      groups.push({
        event: eventHeader[columnIndex] || 'Rekord',
        year: parsedYear,
        entries: entries.sort((a, b) => a.result - b.result).slice(0, 5)
      });
    }
  });

  records.innerHTML = '';
  const newestGroup = groups.sort((a, b) => b.year - a.year)[0];

  if (newestGroup) {
    const groupEl = document.createElement('article');
    groupEl.className = 'record-group';
    groupEl.innerHTML = `
      <div class="record-group-title">
        <strong>${escapeHTML(newestGroup.event)}</strong>
        <small>TOP ${newestGroup.entries.length} / ${newestGroup.year}</small>
      </div>
      <div class="record-group-list">
        ${newestGroup.entries.map((entry, index) => `
          <div class="record-row">
            <div class="record-rank">${index + 1}</div>
            <div class="record-copy">
              <strong>${escapeHTML(entry.name)}</strong>
            </div>
            <div class="record-time">${escapeHTML(formatRecordTime(entry.result))}</div>
          </div>
        `).join('')}
      </div>
    `;
    records.appendChild(groupEl);
  }

  if (!records.children.length) {
    records.innerHTML = '<p class="status-copy">Rekordy Sprintu na 500 dla obecnego lub poprzedniego roku czekają na uzupełnienie.</p>';
  }
}

function formatRecordTime(value) {
  return `${Number(value).toLocaleString('pl-PL', {
    minimumFractionDigits: value % 1 ? 1 : 0,
    maximumFractionDigits: 2
  })} s`;
}

if (document.getElementById('home-podium')) {
  loadHomePodium();
  setInterval(loadHomePodium, 60000);
}

if (document.getElementById('home-records')) {
  loadHomeRecords();
  setInterval(loadHomeRecords, 60000);
}

const COMPLAINTS_STORAGE_KEY = 'alkoolimpiada-complaints';
// Wklej tutaj URL wdrożonego Google Apps Script Web App (/exec) podpiętego do arkusza wyników.
const COMPLAINTS_API_URL = 'https://script.google.com/macros/s/AKfycbzzaDahZh62-mtOclvaJ0gI07wt92LYSdJavU1DTizyP6WDGU1WNiW7qiiax8B1NggUHA/exec';
const COMPLAINTS_TIMEOUT_MS = 7000;

function fetchWithTimeout(url, options = {}, timeout = COMPLAINTS_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => window.clearTimeout(timer));
}

function getStoredComplaints() {
  try {
    return JSON.parse(localStorage.getItem(COMPLAINTS_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStoredComplaints(complaints) {
  try {
    localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(complaints));
    return true;
  } catch {
    return false;
  }
}

function formatComplaintDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function renderComplaintsTable(complaints) {
  const tbody = document.getElementById('complaints-table-body');
  if (!tbody) return;

  const rows = (complaints || [])
    .slice()
    .reverse()
    .slice(0, 8);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="3">Brak zgłoszeń. Cisza na forum.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(item => `
    <tr>
      <td class="complaint-date">${escapeHTML(formatComplaintDate(item.createdAt))}</td>
      <td class="complaint-author">${escapeHTML(item.name || 'Anonim')}</td>
      <td>${escapeHTML(item.text || '')}</td>
    </tr>
  `).join('');
}

async function initComplaintsTable() {
  const tbody = document.getElementById('complaints-table-body');
  if (!tbody) return;

  const localComplaints = getStoredComplaints();
  renderComplaintsTable(localComplaints);

  const globalComplaints = await fetchGlobalComplaints().catch(() => null);
  if (Array.isArray(globalComplaints)) {
    renderComplaintsTable(globalComplaints);
  }
}

async function fetchGlobalComplaints() {
  if (!COMPLAINTS_API_URL) return null;

  const response = await fetchWithTimeout(`${COMPLAINTS_API_URL}?action=list&t=${Date.now()}`);
  if (!response.ok) throw new Error('Nie udało się pobrać globalnych zażaleń.');
  const data = await response.json();
  return Array.isArray(data) ? data : data.complaints;
}

async function saveGlobalComplaint(complaint) {
  if (!COMPLAINTS_API_URL) return false;

  const response = await fetchWithTimeout(COMPLAINTS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(complaint)
  });
  if (!response.ok) throw new Error('Nie udało się zapisać globalnego zażalenia.');
  return true;
}

function initComplaintForm() {
  const form = document.getElementById('zazalenie-form');
  if (!form) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (form.dataset.submitting === 'true') return;

    const name = form.querySelector('#imie')?.value.trim() || 'Anonim';
    const text = form.querySelector('#tekst')?.value.trim();
    if (!text) return;

    const submitButton = form.querySelector('button[type="submit"]');
    const message = document.getElementById('msg');
    form.dataset.submitting = 'true';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Wysyłanie...';
    }
    if (message) {
      message.textContent = 'Zażalenie trafia do kroniki. Chwila cierpliwości...';
      message.style.display = 'block';
    }

    const complaint = {
      name,
      text,
      createdAt: new Date().toISOString()
    };
    const complaints = getStoredComplaints();
    complaints.push(complaint);
    const saved = saveStoredComplaints(complaints);
    const globallySaved = await saveGlobalComplaint(complaint).catch(() => false);

    form.reset();
    if (message) {
      message.textContent = globallySaved
        ? 'Zażalenie zapisane globalnie. Zaraz wracasz na stronę główną, żeby zobaczyć pasek wiadomości.'
        : saved
        ? 'Zażalenie zapisane lokalnie. Globalna kronika chwilowo nie odpowiedziała, spróbuj jeszcze raz później.'
        : 'Nie udało się zapisać zażalenia w tej przeglądarce. Sprawdź uprawnienia localStorage.';
      message.style.display = 'block';
    }

    if (saved || globallySaved) {
      window.setTimeout(() => {
        window.location.href = 'index.html#complaint-ticker';
      }, 900);
    } else {
      form.dataset.submitting = 'false';
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Wyślij zażalenie';
      }
    }
  });
}

function renderComplaintTicker(track, complaints) {
  const items = complaints.length
    ? complaints.slice().reverse()
    : [{ name: 'Zarząd', text: 'Brak świeżych zażaleń. To podejrzane.' }];
  const totalChars = items.reduce((sum, item) => sum + String(item.name || '').length + String(item.text || '').length, 0);
  const tickerItems = items
    .map(item => `
      <span class="ticker-item">
        <b>${escapeHTML(item.name || 'Anonim')}</b>
        <em>${escapeHTML(item.text || '')}</em>
      </span>
    `)
    .join('');

  track.style.setProperty('--ticker-duration', `${Math.max(52, Math.ceil(totalChars * 0.28))}s`);
  track.innerHTML = `
    <div class="ticker-content">${tickerItems}</div>
    <div class="ticker-content" aria-hidden="true">${tickerItems}</div>
  `;
}

async function initComplaintTicker() {
  const track = document.getElementById('complaint-ticker-track');
  if (!track) return;

  const localComplaints = getStoredComplaints();
  const globalComplaints = await fetchGlobalComplaints().catch(() => null);

  if (Array.isArray(globalComplaints)) {
    renderComplaintTicker(track, globalComplaints);
    return;
  }

  renderComplaintTicker(track, localComplaints);
}

initComplaintForm();
initComplaintsTable();
initComplaintTicker();
window.addEventListener('storage', event => {
  if (event.key === COMPLAINTS_STORAGE_KEY) {
    initComplaintsTable();
    initComplaintTicker();
  }
});

// Status wydarzenia do 25.07.2026 16:00
(function(){
  const timerEl = document.getElementById('timer');
  if (!timerEl) return;

  const targetDate = new Date('2026-07-25T16:00:00');
  const eventEndDate = new Date('2026-07-26T04:00:00');
  const daysEl    = document.getElementById('days');
  const hoursEl   = document.getElementById('hours');
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');
  const labelEl = document.getElementById('event-status-label');
  const copyEl = document.getElementById('event-status-copy');
  let interval;

  function updateCountdown(){
    const now  = new Date();
    const diff = targetDate - now;
    if (diff <= 0) {
      timerEl.classList.add('is-finished');
      if (now <= eventEndDate) {
        timerEl.innerHTML = '<strong class="timer-finished">START!</strong>';
        if (labelEl) labelEl.textContent = 'Wydarzenie trwa';
        if (copyEl) copyEl.textContent = 'Ogień jest odpalony. Najważniejsze są teraz wyniki i konkurencje.';
      } else {
        timerEl.innerHTML = '<strong class="timer-finished">META</strong>';
        if (labelEl) labelEl.textContent = 'Edycja 2026 zakończona';
        if (copyEl) copyEl.textContent = 'Event z 25 lipca 2026 jest już historią. Na stronie zostają wyniki, rekordy i chwała.';
      }
      if (interval) clearInterval(interval);
      return;
    }
    const d = Math.floor(diff / (1000*60*60*24));
    const h = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
    const m = Math.floor((diff % (1000*60*60)) / (1000*60));
    const s = Math.floor((diff % (1000*60)) / 1000);

    daysEl.textContent    = String(d).padStart(2,'0');
    hoursEl.textContent   = String(h).padStart(2,'0');
    minutesEl.textContent = String(m).padStart(2,'0');
    secondsEl.textContent = String(s).padStart(2,'0');
    if (labelEl) labelEl.textContent = 'Odliczanie do startu';
    if (copyEl) copyEl.textContent = 'Start: 25 lipca 2026, godz. 16:00.';
  }

  updateCountdown();
  interval = setInterval(updateCountdown, 1000);
})();
// === Hamburger menu toggle ===
(function(){
  const navbar    = document.querySelector('.navbar');
  const burgerBtn = document.querySelector('.hamburger');

  if (!navbar || !burgerBtn) return;

  burgerBtn.setAttribute('aria-expanded', 'false');

  burgerBtn.addEventListener('click', () => {
    const isOpen = navbar.classList.toggle('open');
    burgerBtn.setAttribute('aria-expanded', String(isOpen));
  });

  // Opcjonalnie – zamknij menu po kliknięciu w link
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      if (navbar.classList.contains('open')) {
        navbar.classList.remove('open');
        burgerBtn.setAttribute('aria-expanded', 'false');
      }
    });
  });
})();
// === Auto-highlight current nav link ===
(function(){
  const links = document.querySelectorAll('.nav-links a');
  // pobieramy tylko nazwę pliku, np. "flanki.html"
  let path = window.location.pathname.split('/').pop();
  if (!path) path = 'index.html'; // jeśli jest pusty (root), traktujemy jako homepage

  links.forEach(link => {
    if (link.getAttribute('href') === path) {
      link.classList.add('active');
    }
  });
})();

// === Motion-like polish: appear effects, spotlight, magnetic controls ===
(function(){
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loader = document.getElementById('temple-loader');
  const animatedItems = document.querySelectorAll('[data-animate]');

  if (loader) {
    const hideLoader = () => {
      window.setTimeout(() => loader.classList.add('is-hidden'), reduceMotion ? 80 : 1500);
    };

    if (document.readyState === 'complete') {
      hideLoader();
    } else {
      window.addEventListener('load', hideLoader, { once: true });
      window.setTimeout(hideLoader, 3400);
    }
  }

  if (animatedItems.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      animatedItems.forEach(item => item.classList.add('is-visible'));
    } else {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });

      animatedItems.forEach((item, index) => {
        item.style.transitionDelay = `${Math.min(index * 90, 260)}ms`;
        revealObserver.observe(item);
      });
    }
  }

  if (!reduceMotion) {
    document.querySelectorAll('[data-spotlight]').forEach(section => {
      section.addEventListener('pointermove', event => {
        const rect = section.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        section.style.setProperty('--mouse-x', `${x}%`);
        section.style.setProperty('--mouse-y', `${y}%`);

        section.querySelectorAll('.parallax').forEach(layer => {
          const depth = Number(layer.dataset.depth || 0.04);
          const moveX = (x - 50) * depth;
          const moveY = (y - 50) * depth;
          layer.style.setProperty('--parallax-x', `${moveX}px`);
          layer.style.setProperty('--parallax-y', `${moveY}px`);
        });
      });

      section.addEventListener('pointerleave', () => {
        section.querySelectorAll('.parallax').forEach(layer => {
          layer.style.setProperty('--parallax-x', '0px');
          layer.style.setProperty('--parallax-y', '0px');
        });
      });
    });

    document.querySelectorAll('.magnetic').forEach(item => {
      item.addEventListener('pointermove', event => {
        const rect = item.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        item.style.transform = `translate(${x * 0.05}px, ${y * 0.08}px)`;
      });

      item.addEventListener('pointerleave', () => {
        item.style.transform = '';
      });
    });
  }
})();
