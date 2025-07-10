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
    .map(line => line.split(','));
}

// === 3) Render dużej tabeli Wyniki ===
function renderTable(rows, tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const [header, ...dataRows] = rows;
  table.querySelector('thead').innerHTML =
    '<tr>' + header.map(h => `<th>${h}</th>`).join('') + '</tr>';

  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  dataRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = row.map(cell => `<td>${cell}</td>`).join('');
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
    thead.innerHTML = `<tr><th>${groupName}</th></tr>`;
    table.appendChild(thead);

    // body: do 5 wierszy z tej kolumny
    const tbody = document.createElement('tbody');
    dataRows.slice(0, 5).forEach(row => {
      const cell = row[colIdx] || '';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${cell}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.appendChild(table);
  });
}

// === 5) Ładowanie i odświeżanie Wyniki ===
async function loadWyniki() {
  try {
    const rows = await fetchCSV(SHEET_URL_WYNIKI);
    renderTable(rows, 'wyniki');
  } catch (e) {
    console.error('Błąd pobierania Wyniki:', e);
  }
}
if (document.getElementById('wyniki')) {
  loadWyniki();
  setInterval(loadWyniki, 60000);
}

// === 6) Ładowanie i odświeżanie Zespoły (kolumny → tabele) ===
async function loadZespoly() {
  try {
    const rows = await fetchCSV(SHEET_URL_ZESPOLY);
    console.log('Zespoly CSV:', rows);
    renderColumnTables(rows, 'zespoly-groups');
  } catch (e) {
    console.error('Błąd pobierania Zespoły:', e);
  }
}
if (document.getElementById('zespoly-groups')) {
  loadZespoly();
  setInterval(loadZespoly, 60000);
}
// === renderSplitTables – dzieli pierwszy arkusz na dwie tabele 2×4 i oznacza top2 jako advanced
function renderSplitTables(rows, containerId) {
  const header   = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1, 5); // weź cztery wiersze pod nagłówkiem
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  for (let i = 0; i < header.length; i += 2) {
    const table = document.createElement('table');
    table.classList.add('flanki-group-table');

    // nagłówek dwóch kolumn
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th>${header[i]}</th>
      <th>${header[i+1] || ''}</th>
    </tr>`;
    table.appendChild(thead);

    // body: cztery wiersze, top2 oznaczone class="advanced"
    const tbody = document.createElement('tbody');
    dataRows.forEach((row, idx) => {
      const tr = document.createElement('tr');
      if (idx < 2) tr.classList.add('advanced');
      const c1 = row[i]   || '';
      const c2 = row[i+1] || '';
      tr.innerHTML = `<td>${c1}</td><td>${c2}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.appendChild(table);
  }
}

// === loadFlankiGroup – faza grupowa ===
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
// === renderSplitTables dla BeerPong (faza grupowa) ===
async function loadBeerPongGroup() {
  try {
    const rows = await fetchCSV(SHEET_URL_BEERPONG);
    renderSplitTables(rows, 'beerpong-group-container');
  } catch (e) {
    console.error('Błąd pobierania BeerPong (grupy):', e);
  }
}
if (document.getElementById('beerpong-group-container')) {
  loadBeerPongGroup();
  setInterval(loadBeerPongGroup, 60000);
}

// === load BeerPong Finał ===
async function loadBeerPongFinal() {
  try {
    const rows = await fetchCSV(SHEET_URL_BEERPONG_FINAL);
    renderTable(rows, 'beerpong-final');
  } catch (e) {
    console.error('Błąd pobierania BeerPong Finał:', e);
  }
}
if (document.getElementById('beerpong-final')) {
  loadBeerPongFinal();
  setInterval(loadBeerPongFinal, 60000);
}

// === load Mistrz BeerPong ===
async function loadMistrzBeerPong() {
  try {
    const rows = await fetchCSV(SHEET_URL_MISTRZ_BEERPONG);
    renderTable(rows, 'beerpong-champ');
  } catch (e) {
    console.error('Błąd pobierania Mistrz BeerPong:', e);
  }
}
if (document.getElementById('beerpong-champ')) {
  loadMistrzBeerPong();
  setInterval(loadMistrzBeerPong, 60000);
}
// === load Rekord ===
async function loadRekordy() {
  try {
    const rows = await fetchCSV(SHEET_URL_REKORDY);
    renderTable(rows, 'rekordy');
  } catch (e) {
    console.error('Błąd pobierania Rekordy:', e);
  }
}
if (document.getElementById('rekordy')) {
  loadRekordy();
  setInterval(loadRekordy, 60000);
}
// Countdown do 26.07.2025 16:00
(function(){
  const timerEl = document.getElementById('timer');
  if (!timerEl) return;

  const targetDate = new Date('2025-07-26T16:00:00');
  const daysEl    = document.getElementById('days');
  const hoursEl   = document.getElementById('hours');
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');

  function updateCountdown(){
    const now  = new Date();
    const diff = targetDate - now;
    if (diff <= 0) {
      timerEl.textContent = 'START!';
      clearInterval(interval);
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
  }

  updateCountdown();
  const interval = setInterval(updateCountdown, 1000);
})();
// === Hamburger menu toggle ===
(function(){
  const navbar    = document.querySelector('.navbar');
  const burgerBtn = document.querySelector('.hamburger');

  if (!navbar || !burgerBtn) return;

  burgerBtn.addEventListener('click', () => {
    navbar.classList.toggle('open');
  });

  // Opcjonalnie – zamknij menu po kliknięciu w link
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      if (navbar.classList.contains('open')) {
        navbar.classList.remove('open');
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