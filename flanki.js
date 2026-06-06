// === Strona Flanki (publiczna) ===
// Pokazuje tabele grup, harmonogram, faze pucharowa na podstawie flanki_matches w Supabase.

(function () {
  const groupsEl   = document.getElementById('flanki-groups');
  const scheduleEl = document.getElementById('flanki-schedule');
  const playoffEl  = document.getElementById('flanki-playoff');
  if (!groupsEl || !scheduleEl || !playoffEl) return;

  if (!window.alkoAuth || !window.alkoAuth.configured) {
    groupsEl.innerHTML = '<p class="status-copy">Backend Supabase nie jest skonfigurowany.</p>';
    return;
  }

  let matchesById = {}; // match_id -> { team_a, team_b, score_a, score_b }

  function isPlayed(match) {
    return match && match.score_a != null && match.score_b != null
      && (match.score_a === 3 || match.score_b === 3);
  }

  function renderGroups() {
    groupsEl.innerHTML = ['A', 'B'].map(g => {
      const standings = computeFlankiStandings(g, matchesById);
      const rows = standings.map((s, idx) => {
        const place = idx + 1;
        const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
        return `
          <tr class="place-${place}">
            <td>${medal}</td>
            <td><strong>${escapeHTML(s.team)}</strong></td>
            <td>${s.played}</td>
            <td>${s.wins}</td>
            <td>${s.scored}</td>
            <td>${s.conceded}</td>
            <td><strong>${s.scored - s.conceded >= 0 ? '+' : ''}${s.scored - s.conceded}</strong></td>
          </tr>
        `;
      }).join('');
      return `
        <article class="flanki-group">
          <h2>Grupa ${g}</h2>
          <table class="flanki-group-table">
            <thead>
              <tr>
                <th>#</th><th>Drużyna</th><th>M</th><th>W</th><th>Za</th><th>Prz</th><th>Bilans</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </article>
      `;
    }).join('');
  }

  function renderSchedule() {
    const groupMatches = FLANKI_SCHEDULE.filter(m => m.phase === 'group');
    scheduleEl.innerHTML = groupMatches.map(m => {
      const r = matchesById[m.id] || {};
      const played = isPlayed(r);
      const scoreA = r.score_a != null ? r.score_a : '–';
      const scoreB = r.score_b != null ? r.score_b : '–';
      const winnerA = played && r.score_a > r.score_b;
      const winnerB = played && r.score_b > r.score_a;
      return `
        <article class="flanki-match ${played ? 'played' : 'pending'}">
          <div class="match-label">${escapeHTML(m.label)}</div>
          <div class="match-teams">
            <span class="team ${winnerA ? 'won' : ''}">${escapeHTML(m.team_a)}</span>
            <span class="match-score">${scoreA} : ${scoreB}</span>
            <span class="team ${winnerB ? 'won' : ''}">${escapeHTML(m.team_b)}</span>
          </div>
          ${!played ? '<div class="match-pending">oczekuje</div>' : ''}
        </article>
      `;
    }).join('');
  }

  function renderPlayoff() {
    // Odczytujemy zwyciezcow grup
    const standA = computeFlankiStandings('A', matchesById);
    const standB = computeFlankiStandings('B', matchesById);
    const groupsComplete = (g) =>
      FLANKI_SCHEDULE.filter(m => m.phase === 'group' && m.group === g)
        .every(m => isPlayed(matchesById[m.id]));

    const aDone = groupsComplete('A');
    const bDone = groupsComplete('B');

    const playoffMatches = FLANKI_SCHEDULE.filter(m => m.phase === 'playoff');
    playoffEl.innerHTML = playoffMatches.map(m => {
      const r = matchesById[m.id] || {};
      const played = isPlayed(r);
      const hasTeams = r.team_a && r.team_b;

      // Sugerujemy druzyny na podstawie standings
      let suggestedA = '', suggestedB = '';
      if (m.id === 'small_final') {
        suggestedA = aDone ? standA[1]?.team : '2 z grupy A';
        suggestedB = bDone ? standB[1]?.team : '2 z grupy B';
      } else if (m.id === 'final') {
        suggestedA = aDone ? standA[0]?.team : '1 z grupy A';
        suggestedB = bDone ? standB[0]?.team : '1 z grupy B';
      }

      const teamA = hasTeams ? r.team_a : suggestedA;
      const teamB = hasTeams ? r.team_b : suggestedB;
      const winnerA = played && r.score_a > r.score_b;
      const winnerB = played && r.score_b > r.score_a;
      const scoreA = r.score_a != null ? r.score_a : '–';
      const scoreB = r.score_b != null ? r.score_b : '–';

      return `
        <article class="flanki-match playoff ${played ? 'played' : 'pending'} ${m.id}">
          <div class="match-label">${escapeHTML(m.label)}</div>
          <div class="match-teams">
            <span class="team ${winnerA ? 'won' : ''}">${escapeHTML(teamA || '?')}</span>
            <span class="match-score">${scoreA} : ${scoreB}</span>
            <span class="team ${winnerB ? 'won' : ''}">${escapeHTML(teamB || '?')}</span>
          </div>
          ${!played ? `<div class="match-pending">${hasTeams ? 'oczekuje' : escapeHTML(m.placeholder)}</div>` : ''}
        </article>
      `;
    }).join('');
  }

  function renderAll() {
    renderGroups();
    renderSchedule();
    renderPlayoff();
  }

  async function load() {
    matchesById = {};
    const { data, error } = await pgGet('flanki_matches?select=match_id,team_a,team_b,score_a,score_b');
    if (error) {
      // Nie wisimy na bledzie — renderujemy grupy/harmonogram z pustymi wynikami
      // i pokazujemy delikatny banner.
      console.warn('[flanki] load:', error.message);
      renderAll();
      const banner = document.createElement('p');
      banner.className = 'status-copy';
      banner.style.cssText = 'margin-bottom:14px;color:#ffb4b4;';
      banner.textContent = `Brak meczów w bazie (${error.message}). Wpisz pierwszy w panelu admina.`;
      groupsEl.parentNode.insertBefore(banner, groupsEl);
      return;
    }
    (data || []).forEach(m => { matchesById[m.match_id] = m; });
    renderAll();
  }

  function refreshFor(user) {
    if (!user) {
      groupsEl.innerHTML = '<p class="status-copy">Zaloguj się, żeby zobaczyć tabele Flanków.</p>';
      scheduleEl.innerHTML = '';
      playoffEl.innerHTML = '';
      return;
    }
    // Render od razu (puste wyniki) zeby cos bylo widac zanim sieciowka odpowie
    matchesById = {};
    renderAll();
    load();
  }

  window.alkoAuth.onAuthChange(refreshFor);
  setInterval(() => { if (window.alkoAuth.getUser()) load(); }, 30000);
})();
