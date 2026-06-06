// === Strona Wyniki ===
// Kalkuluje klasyfikacje druzyn z tabeli results w Supabase.
// Dla konkurencji indywidualnych mapuje osobe -> druzyna przez personToTeam.

(function () {
  const table = document.getElementById('wyniki');
  if (!table) return;

  // Czekamy az alkoAuth bedzie gotowy (anon key wystarczy do read jesli RLS na to pozwala,
  // ale my mamy polityke "to authenticated", wiec wymagane jest zalogowanie).
  if (!window.alkoAuth || !window.alkoAuth.configured) {
    renderError('Backend Supabase nie jest skonfigurowany.');
    return;
  }

  function renderError(msg) {
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = `<tr><td>${escapeHTML(msg)}</td></tr>`;
  }

  function renderLoading() {
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '<tr><td>Ładowanie...</td></tr>';
  }

  function renderStandings(resultsByComp) {
    // Dla kazdej druzyny zlicz medale we wszystkich konkurencjach.
    const teamStats = TEAMS.map(team => {
      const stats = { team, perComp: {}, gold: 0, silver: 0, bronze: 0 };
      const memberSet = new Set(team.members.map(m => m.toLowerCase()));
      COMPETITIONS.forEach(comp => {
        const r = resultsByComp[comp.id];
        if (!r) { stats.perComp[comp.id] = null; return; }
        let medal = null;
        if (comp.type === 'team') {
          if (r.actual_1st === team.name) medal = 'gold';
          else if (r.actual_2nd === team.name) medal = 'silver';
          else if (r.actual_3rd === team.name) medal = 'bronze';
        } else {
          // Indywidualna — mapuj osobe na druzyne
          const t1 = personToTeam(r.actual_1st);
          const t2 = personToTeam(r.actual_2nd);
          const t3 = personToTeam(r.actual_3rd);
          if (t1 === team.name) medal = 'gold';
          else if (t2 === team.name) medal = 'silver';
          else if (t3 === team.name) medal = 'bronze';
        }
        stats.perComp[comp.id] = medal;
        if (medal === 'gold') stats.gold++;
        else if (medal === 'silver') stats.silver++;
        else if (medal === 'bronze') stats.bronze++;
      });
      stats.total = stats.gold + stats.silver + stats.bronze;
      return stats;
    });

    teamStats.sort((a, b) =>
      b.gold - a.gold ||
      b.silver - a.silver ||
      b.bronze - a.bronze ||
      a.team.name.localeCompare(b.team.name, 'pl')
    );

    // Header
    const thead = table.querySelector('thead');
    thead.innerHTML = `
      <tr>
        <th>Miejsce</th>
        <th>Drużyna</th>
        ${COMPETITIONS.map(c => `<th>${escapeHTML(c.name)}</th>`).join('')}
        <th>🥇</th><th>🥈</th><th>🥉</th><th>Suma</th>
      </tr>
    `;

    const tbody = table.querySelector('tbody');
    tbody.innerHTML = teamStats.map((stats, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHTML(stats.team.name)}</strong></td>
        ${COMPETITIONS.map(c => {
          const m = stats.perComp[c.id];
          const cell = m === 'gold' ? '🥇' : m === 'silver' ? '🥈' : m === 'bronze' ? '🥉' : '';
          return `<td>${cell}</td>`;
        }).join('')}
        <td>${stats.gold}</td>
        <td>${stats.silver}</td>
        <td>${stats.bronze}</td>
        <td><strong>${stats.total}</strong></td>
      </tr>
    `).join('');
  }

  async function load() {
    renderLoading();
    const { data, error } = await pgGet('results?select=competition,actual_1st,actual_2nd,actual_3rd');
    if (error) {
      console.error('[wyniki] load:', error.message);
      renderError('Nie udało się pobrać wyników. Zaloguj się.');
      return;
    }
    const resultsByComp = {};
    (data || []).forEach(r => { resultsByComp[r.competition] = r; });
    renderStandings(resultsByComp);
  }

  function refreshFor(user) {
    if (!user) {
      renderError('Zaloguj się, żeby zobaczyć wyniki.');
      return;
    }
    load();
  }

  window.alkoAuth.onAuthChange(refreshFor);
  // Odswiezaj co minute
  setInterval(() => {
    if (window.alkoAuth.getUser()) load();
  }, 60000);
})();
