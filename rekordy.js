// === Strona Rekordy ===
// Czyta z Supabase tabela records.
// Tabela glowna: pivot Sprint na 500 (uczestnik x rok x najlepszy czas).
// Top 3: najlepsze 3 czasy ze WSZYSTKICH lat.

(function () {
  const top3El = document.getElementById('rekordy-top3');
  const table = document.getElementById('rekordy');
  if (!table) return;

  if (!window.alkoAuth || !window.alkoAuth.configured) {
    renderError('Backend Supabase nie jest skonfigurowany.');
    return;
  }

  function renderError(msg) {
    if (top3El) top3El.innerHTML = `<p class="status-copy">${escapeHTML(msg)}</p>`;
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = `<tr><td>${escapeHTML(msg)}</td></tr>`;
  }

  function fmtTime(value) {
    if (value == null || value === '') return '—';
    const v = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(v)) return '—';
    return (v % 1 === 0 ? v.toString() : v.toFixed(2)) + ' s';
  }

  function getYear(d) {
    if (!d) return null;
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return null;
      return dt.getFullYear();
    } catch { return null; }
  }

  function renderTop3(records) {
    if (!top3El) return;
    const sprint = records
      .filter(r => r.competition === 'sprint500')
      .map(r => ({ ...r, num: parseFloat(r.value) }))
      .filter(r => !isNaN(r.num) && r.num > 0)
      .sort((a, b) => a.num - b.num)
      .slice(0, 3);

    if (!sprint.length) {
      top3El.innerHTML = '<p class="status-copy">Brak rekordów Sprint na 500.</p>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    top3El.innerHTML = sprint.map((r, i) => `
      <div class="record-card">
        <div class="record-medal">${medals[i]}</div>
        <div class="record-holder">${escapeHTML(r.holder)}</div>
        <div class="record-value">${fmtTime(r.value)}</div>
        ${getYear(r.set_at) ? `<div style="color:#3a4a60;font-size:0.85rem;">${getYear(r.set_at)}</div>` : ''}
      </div>
    `).join('');
  }

  function renderPivotTable(records) {
    const sprint = records.filter(r => r.competition === 'sprint500');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (!sprint.length) {
      thead.innerHTML = '<tr><th>Uczestnik</th></tr>';
      tbody.innerHTML = '<tr><td>Brak rekordów Sprint na 500. Admin może je dodać.</td></tr>';
      return;
    }

    // Zbierz unikalne lata (desc) i uczestnikow
    const yearsSet = new Set();
    const holdersSet = new Set();
    const byHolderYear = {}; // holder -> { year -> bestValue }

    sprint.forEach(r => {
      const y = getYear(r.set_at);
      const v = parseFloat(r.value);
      if (!r.holder || !y || isNaN(v) || v <= 0) return;
      yearsSet.add(y);
      holdersSet.add(r.holder);
      if (!byHolderYear[r.holder]) byHolderYear[r.holder] = {};
      const cur = byHolderYear[r.holder][y];
      if (cur == null || v < cur) byHolderYear[r.holder][y] = v;
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);
    const holders = Array.from(holdersSet);

    // Sortuj uczestnikow po najlepszym czasie z najnowszego roku (ASC),
    // a jesli nie maja w najnowszym to po najlepszym czasie kiedykolwiek (ASC)
    holders.sort((a, b) => {
      const ay = years.find(y => byHolderYear[a]?.[y] != null);
      const by = years.find(y => byHolderYear[b]?.[y] != null);
      const av = ay != null ? byHolderYear[a][ay] : Infinity;
      const bv = by != null ? byHolderYear[b][by] : Infinity;
      return av - bv || a.localeCompare(b, 'pl');
    });

    thead.innerHTML = `
      <tr>
        <th>Uczestnik</th>
        ${years.map(y => `<th>${y}</th>`).join('')}
      </tr>
    `;
    tbody.innerHTML = holders.map(h => `
      <tr>
        <td><strong>${escapeHTML(h)}</strong></td>
        ${years.map(y => {
          const v = byHolderYear[h]?.[y];
          return `<td>${v != null ? fmtTime(v) : '—'}</td>`;
        }).join('')}
      </tr>
    `).join('');
  }

  async function load() {
    const { data, error } = await pgGet('records?select=id,competition,holder,value,unit,set_at');
    if (error) {
      console.error('[rekordy] load:', error.message);
      renderError('Nie udało się pobrać rekordów. Zaloguj się.');
      return;
    }
    const records = data || [];
    renderTop3(records);
    renderPivotTable(records);
  }

  function refreshFor(user) {
    if (!user) {
      renderError('Zaloguj się, żeby zobaczyć rekordy.');
      return;
    }
    load();
  }

  window.alkoAuth.onAuthChange(refreshFor);
  setInterval(() => { if (window.alkoAuth.getUser()) load(); }, 60000);
})();
