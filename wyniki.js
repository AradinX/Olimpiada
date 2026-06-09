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

    // Ikonki konkurencji (klucze pasujace do plikow w assets/icons/)
    const COMPETITION_ICONS = {
      sprint500: 'competition-sprint-na-500',
      flanki:    'competition-flanki',
      napol:     'competition-na-pol',
      smakosz:   'competition-smakosz',
      beerpong:  'competition-spacer',
      inwestor:  'competition-inwestor'
    };

    function medalCell(m) {
      if (!m) return '<td class="wyniki-medal-cell"></td>';
      const file = m === 'gold' ? 'medal-gold' : m === 'silver' ? 'medal-silver' : 'medal-bronze';
      return `<td class="wyniki-medal-cell"><img src="assets/icons/${file}.png" alt="${m}" class="wyniki-medal-img"></td>`;
    }

    function initialFor(person) {
      const trimmed = String(person || '').trim();
      const first = trimmed.charAt(0).toUpperCase() || '?';
      return first;
    }

    const thead = table.querySelector('thead');
    thead.innerHTML = `
      <tr>
        <th>Miejsce</th>
        <th>Uczestnik</th>
        <th>Drużyna</th>
        ${COMPETITIONS.map(c => `
          <th class="wyniki-comp-th">
            ${COMPETITION_ICONS[c.id] ? `<img src="assets/icons/${COMPETITION_ICONS[c.id]}.png" alt="" class="wyniki-comp-icon">` : ''}
            <span>${escapeHTML(c.name)}</span>
          </th>
        `).join('')}
        <th class="wyniki-medal-th"><img src="assets/icons/medal-gold.png" alt="Złoto"></th>
        <th class="wyniki-medal-th"><img src="assets/icons/medal-silver.png" alt="Srebro"></th>
        <th class="wyniki-medal-th"><img src="assets/icons/medal-bronze.png" alt="Brąz"></th>
        <th>Suma</th>
      </tr>
    `;

    const tbody = table.querySelector('tbody');
    tbody.innerHTML = stats.map((s, idx) => {
      const place = idx + 1;
      const placeClass = place === 1 ? 'wyniki-place-1' : place === 2 ? 'wyniki-place-2' : place === 3 ? 'wyniki-place-3' : '';
      return `
      <tr class="${placeClass}">
        <td class="wyniki-place-cell"><strong>${place}</strong></td>
        <td class="wyniki-name-cell">
          <span class="wyniki-avatar" aria-hidden="true">${escapeHTML(initialFor(s.person))}</span>
          <strong>${escapeHTML(s.person)}</strong>
        </td>
        <td class="wyniki-team-cell">${escapeHTML(s.team || '—')}</td>
        ${COMPETITIONS.map(c => medalCell(s.perComp[c.id])).join('')}
        <td class="wyniki-count">${s.gold}</td>
        <td class="wyniki-count">${s.silver}</td>
        <td class="wyniki-count">${s.bronze}</td>
        <td class="wyniki-sum"><strong>${s.total}</strong></td>
      </tr>
    `;
    }).join('');
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
