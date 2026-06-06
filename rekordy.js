// === Strona Rekordy ===
// Czyta z Supabase tabela records.
// Top 3 Sprint na 500 = najnizszy czas (value asc) filtrowane po competition='sprint500'.

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

  function compName(id) {
    const c = COMPETITIONS.find(x => x.id === id);
    return c ? c.name : id;
  }

  function fmtValue(value, unit) {
    if (value == null) return '—';
    const v = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(v)) return escapeHTML(value);
    const display = v % 1 === 0 ? v.toString() : v.toFixed(2);
    return display + (unit ? ` ${escapeHTML(unit)}` : '');
  }

  function fmtDate(d) {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return escapeHTML(d);
      return String(dt.getFullYear());
    } catch { return escapeHTML(d); }
  }

  function renderTop3(records) {
    if (!top3El) return;
    const sprint = records
      .filter(r => r.competition === 'sprint500')
      .map(r => ({ ...r, num: parseFloat(r.value) }))
      .filter(r => !isNaN(r.num))
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
        <div class="record-value">${fmtValue(r.value, r.unit || 'sek')}</div>
      </div>
    `).join('');
  }

  function renderTable(records) {
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    thead.innerHTML = `
      <tr>
        <th>Konkurencja</th>
        <th>Rekordzista</th>
        <th>Wynik</th>
        <th>Rok</th>
        <th>Notatki</th>
      </tr>
    `;
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="5">Brak rekordów — admin jeszcze nic nie wpisał.</td></tr>';
      return;
    }
    // Sortuj po konkurencji + value asc
    const sorted = records.slice().sort((a, b) => {
      const cn = (compName(a.competition) || '').localeCompare(compName(b.competition) || '', 'pl');
      if (cn !== 0) return cn;
      return (parseFloat(a.value) || 0) - (parseFloat(b.value) || 0);
    });
    tbody.innerHTML = sorted.map(r => `
      <tr>
        <td>${escapeHTML(compName(r.competition))}</td>
        <td>${escapeHTML(r.holder)}</td>
        <td>${fmtValue(r.value, r.unit)}</td>
        <td>${fmtDate(r.set_at)}</td>
        <td>${escapeHTML(r.notes || '')}</td>
      </tr>
    `).join('');
  }

  async function load() {
    const { data, error } = await pgGet('records?select=id,competition,holder,value,unit,set_at,notes');
    if (error) {
      console.error('[rekordy] load:', error.message);
      renderError('Nie udało się pobrać rekordów. Zaloguj się.');
      return;
    }
    const records = data || [];
    renderTop3(records);
    renderTable(records);
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
