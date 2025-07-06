// assets/js/data.js

// 1. Wklej swoje opublikowane linki CSV (z Google Sheets → Publikuj → CSV)
const URL_MAP = {
  wyniki:           'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=0&single=true&output=csv',
  zespoly:          'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=1165307336&single=true&output=csv',
  flanki:           'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=80270090&single=true&output=csv',
  'flanki-final':   'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=144304670&single=true&output=csv',
  'mistrz-flanki':  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=1822343054&single=true&output=csv',
  beerpong:         'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=1458846082&single=true&output=csv',
  'beerpong-final': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=1218477508&single=true&output=csv',
  'mistrz-beerpong':'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=2068520393&single=true&output=csv',
  rekordy:          'https://docs.google.com/spreadsheets/d/e/2PACX-1vQlbFxgS96SNuBfHBZtpz7kjNemgxjfvGYetxN7xN9wJbVDRqsiI59WzPp1K6nrUhI_-roHiF-8U6fm/pub?gid=1413679066&single=true&output=csv'
};

// 2. fetchCSV: pobiera CSV i zwraca tablicę wierszy
async function fetchCSV(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    const text = await res.text();
    const rows = text.split(/
?
/).filter(line => line.trim());
    return rows.map(line => {
      const sep = line.includes(';') ? ';' : ',';
      return line.split(sep).map(cell => cell.trim());
    });
  } catch (err) {
    console.error('Fetch error for', url, err);
    return [];
  }
}

// 3. renderTable: rysuje <table> o danym ID
function renderTable(tableId, data) {
  const table = document.getElementById(tableId);
  if (!table) return;
  table.innerHTML = '';
  data.forEach((row, i) => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const el = document.createElement(i === 0 ? 'th' : 'td');
      el.textContent = cell;
      el.classList.add('border', 'px-2', 'py-1');
      tr.appendChild(el);
    });
    table.appendChild(tr);
  });
}

// 4. updateResults: dla każdej tabeli fetch & render
async function updateResults() {
  for (const key in URL_MAP) {
    const data = await fetchCSV(URL_MAP[key]);
    renderTable(`${key}-table`, data);
  }
}

// 5. startujemy po załadowaniu DOM
window.addEventListener('DOMContentLoaded', () => {
  updateResults();
  setInterval(updateResults, 60000);
});