// === Strona Wyniki ===
// Kalkuluje klasyfikacje INDYWIDUALNA (uczestnicy) z tabeli results w Supabase.
// Dla konkurencji druzynowych medal ide do wszystkich czlonkow zwycieskiej druzyny.

(function () {
  const table = document.getElementById('wyniki');
  if (!table) return;

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

  // Buduje liste wszystkich unikalnych uczestnikow (PARTICIPANTS + czlonkowie TEAMS).
  function allPeople() {
    const seen = new Map(); // normalized -> original
    PARTICIPANTS.forEach(p => {
      const key = normalizePersonName(p);
      if (key && !seen.has(key)) seen.set(key, p);
    });
    TEAMS.forEach(t => t.members.forEach(m => {
      const key = normalizePersonName(m);
      if (key && !seen.has(key)) seen.set(key, m);
    }));
    return Array.from(seen.values());
  }

  // Znajduje druzyne danej osoby (lub null)
  function teamOf(person) {
    const n = normalizePersonName(person);
    for (const t of TEAMS) {
      if (t.members.some(m => normalizePersonName(m) === n)) return t.name;
    }
    return null;
  }

  function sameName(a, b) {
    return normalizePersonName(a) === normalizePersonName(b);
  }

  function renderStandings(resultsByComp) {
    const people = allPeople();
    const stats = people.map(person => {
      const myTeam = teamOf(person);
      const perComp = {};
      let gold = 0, silver = 0, bronze = 0;
      COMPETITIONS.forEach(comp => {
        const r = resultsByComp[comp.id];
        if (!r) { perComp[comp.id] = null; return; }
        let medal = null;
        if (comp.type === 'team') {
          if (myTeam && r.actual_1st === myTeam) medal = 'gold';
          else if (myTeam && r.actual_2nd === myTeam) medal = 'silver';
          else if (myTeam && r.actual_3rd === myTeam) medal = 'bronze';
        } else {
          if (sameName(r.actual_1st, person)) medal = 'gold';
          else if (sameName(r.actual_2nd, person)) medal = 'silver';
          else if (sameName(r.actual_3rd, person)) medal = 'bronze';
        }
        perComp[comp.id] = medal;
        if (medal === 'gold') gold++;
        else if (medal === 'silver') silver++;
        else if (medal === 'bronze') bronze++;
      });
      return { person, team: myTeam, perComp, gold, silver, bronze, total: gold + silver + bronze };
    });

    stats.sort((a, b) =>
      b.gold - a.gold ||
      b.silver - a.silver ||
      b.bronze - a.bronze ||
      a.person.localeCompare(b.person, 'pl')
    );

    const thead = table.querySelector('thead');
    thead.innerHTML = `
      <tr>
        <th>Miejsce</th>
        <th>Uczestnik</th>
        <th>Drużyna</th>
        ${COMPETITIONS.map(c => `<th>${escapeHTML(c.name)}</th>`).join('')}
        <th>🥇</th><th>🥈</th><th>🥉</th><th>Suma</th>
      </tr>
    `;

    const tbody = table.querySelector('tbody');
    tbody.innerHTML = stats.map((s, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHTML(s.person)}</strong></td>
        <td>${escapeHTML(s.team || '—')}</td>
        ${COMPETITIONS.map(c => {
          const m = s.perComp[c.id];
          const cell = m === 'gold' ? '🥇' : m === 'silver' ? '🥈' : m === 'bronze' ? '🥉' : '';
          return `<td>${cell}</td>`;
        }).join('')}
        <td>${s.gold}</td>
        <td>${s.silver}</td>
        <td>${s.bronze}</td>
        <td><strong>${s.total}</strong></td>
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
  setInterval(() => {
    if (window.alkoAuth.getUser()) load();
  }, 60000);
})();
