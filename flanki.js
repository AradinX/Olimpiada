// === Strona Flanki (publiczna) ===
// Pokazuje tabele grup, harmonogram (kolejki), faze pucharowa.

(function () {
  const groupsEl = document.getElementById('flanki-groups');
  const scheduleEl = document.getElementById('flanki-schedule');
  const playoffEl = document.getElementById('flanki-playoff');
  if (!groupsEl || !scheduleEl || !playoffEl) return;

  if (!window.alkoAuth || !window.alkoAuth.configured) {
    groupsEl.innerHTML = '<p class="status-copy">Backend Supabase nie jest skonfigurowany.</p>';
    return;
  }

  let matchesById = {};

  function isPlayed(match) {
    return match && match.score_a != null && match.score_b != null
      && (match.score_a === 3 || match.score_b === 3);
  }

  function membersOf(teamName) {
    const team = TEAMS.find(item => item.name === teamName);
    return team ? team.members.join(', ') : '';
  }

  function renderGroups() {
    groupsEl.innerHTML = ['A', 'B'].map(groupName => {
      const standings = computeFlankiStandings(groupName, matchesById);
      const rows = standings.map((standing, index) => {
        const place = index + 1;
        const losses = Math.max(0, standing.played - standing.wins);
        const diff = standing.scored - standing.conceded;

        return `
          <tr class="place-${place}">
            <td class="rank-cell"><span>${place}</span></td>
            <td class="team-cell">
              <strong>${escapeHTML(standing.team)}</strong>
              <small>${escapeHTML(membersOf(standing.team))}</small>
            </td>
            <td>${standing.played}</td>
            <td>${standing.wins}</td>
            <td>${losses}</td>
            <td><strong>${standing.scored}</strong></td>
            <td>${diff > 0 ? '+' : ''}${diff}</td>
          </tr>
        `;
      }).join('');

      return `
        <article class="flanki-group">
          <h2>Grupa ${groupName}</h2>
          <div class="flanki-table-scroll">
            <table class="flanki-group-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Drużyna</th>
                  <th>M</th>
                  <th>Z</th>
                  <th>P</th>
                  <th>Pkt</th>
                  <th>+/-</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderMatchCard(match) {
    const result = matchesById[match.id] || {};
    const played = isPlayed(result);
    const scoreA = result.score_a != null ? result.score_a : '-';
    const scoreB = result.score_b != null ? result.score_b : '-';
    const winnerA = played && result.score_a > result.score_b;
    const winnerB = played && result.score_b > result.score_a;
    const membersA = membersOf(match.team_a);
    const membersB = membersOf(match.team_b);

    return `
      <article class="match-card ${played ? 'played' : 'pending'}">
        <div class="match-card-meta">${escapeHTML(match.label)}</div>
        <div class="match-card-body">
          <div class="match-side ${winnerA ? 'winner' : ''}">
            <div class="match-side-name">${escapeHTML(match.team_a)}</div>
            <div class="match-side-members">${escapeHTML(membersA)}</div>
            ${winnerA ? '<div class="match-side-badge">Wygrana</div>' : ''}
          </div>
          <div class="match-score-block">
            <div class="match-score-num ${winnerA ? 'won' : ''}">${scoreA}</div>
            <div class="match-vs">VS</div>
            <div class="match-score-num ${winnerB ? 'won' : ''}">${scoreB}</div>
          </div>
          <div class="match-side ${winnerB ? 'winner' : ''}">
            <div class="match-side-name">${escapeHTML(match.team_b)}</div>
            <div class="match-side-members">${escapeHTML(membersB)}</div>
            ${winnerB ? '<div class="match-side-badge">Wygrana</div>' : ''}
          </div>
        </div>
        ${!played ? '<div class="match-card-status">Oczekuje na rozegranie</div>' : ''}
      </article>
    `;
  }

  function renderSchedule() {
    const rounds = [
      { label: 'Kolejka 1', matches: ['A1', 'B1'] },
      { label: 'Kolejka 2', matches: ['A2', 'B2'] },
      { label: 'Kolejka 3', matches: ['A3', 'B3'] }
    ];

    scheduleEl.innerHTML = rounds.map(round => {
      const matches = round.matches.map(id => FLANKI_SCHEDULE.find(match => match.id === id)).filter(Boolean);
      const cards = matches.map(renderMatchCard).join('');
      const anyPlayed = matches.some(match => isPlayed(matchesById[match.id]));
      const allPlayed = matches.every(match => isPlayed(matchesById[match.id]));
      const status = allPlayed ? 'Zakończona' : anyPlayed ? 'W trakcie' : 'Przed nami';

      return `
        <section class="round">
          <header class="round-header">
            <span class="round-label">${round.label}</span>
            <span class="round-status ${allPlayed ? 'done' : anyPlayed ? 'partial' : 'todo'}">${status}</span>
          </header>
          <div class="round-matches">${cards}</div>
        </section>
      `;
    }).join('');
  }

  function renderPlayoff() {
    const standingsA = computeFlankiStandings('A', matchesById);
    const standingsB = computeFlankiStandings('B', matchesById);
    const groupsDone = groupName =>
      FLANKI_SCHEDULE.filter(match => match.phase === 'group' && match.group === groupName)
        .every(match => isPlayed(matchesById[match.id]));

    const groupADone = groupsDone('A');
    const groupBDone = groupsDone('B');

    function bracketMatch(matchId, sideASource, sideBSource) {
      const match = FLANKI_SCHEDULE.find(item => item.id === matchId);
      const result = matchesById[matchId] || {};
      const played = isPlayed(result);
      const hasTeams = result.team_a && result.team_b;
      const teamA = hasTeams ? result.team_a : sideASource.team;
      const teamB = hasTeams ? result.team_b : sideBSource.team;
      const showA = teamA || sideASource.placeholder;
      const showB = teamB || sideBSource.placeholder;
      const winnerA = played && result.score_a > result.score_b;
      const winnerB = played && result.score_b > result.score_a;
      const scoreA = result.score_a != null ? result.score_a : '-';
      const scoreB = result.score_b != null ? result.score_b : '-';
      const membersA = teamA ? membersOf(teamA) : '';
      const membersB = teamB ? membersOf(teamB) : '';

      return `
        <article class="bracket-match ${matchId === 'final' ? 'final' : 'small-final'} ${played ? 'played' : 'pending'}">
          <div class="bracket-label">${escapeHTML(match.label)}</div>
          <div class="bracket-row ${winnerA ? 'winner-top' : ''}">
            <div class="bracket-team">
              <div class="bracket-team-name">${escapeHTML(showA)}</div>
              ${membersA ? `<div class="bracket-team-mem">${escapeHTML(membersA)}</div>` : ''}
            </div>
            <div class="bracket-score ${winnerA ? 'won' : ''}">${scoreA}</div>
          </div>
          <div class="bracket-divider"></div>
          <div class="bracket-row ${winnerB ? 'winner-top' : ''}">
            <div class="bracket-team">
              <div class="bracket-team-name">${escapeHTML(showB)}</div>
              ${membersB ? `<div class="bracket-team-mem">${escapeHTML(membersB)}</div>` : ''}
            </div>
            <div class="bracket-score ${winnerB ? 'won' : ''}">${scoreB}</div>
          </div>
          ${played
            ? `<div class="bracket-result">Zwycięzca: ${escapeHTML(winnerA ? showA : showB)}</div>`
            : `<div class="bracket-result pending">${!hasTeams && (!groupADone || !groupBDone) ? 'oczekuje na zakończenie grup' : 'oczekuje na rozegranie'}</div>`}
        </article>
      `;
    }

    const finalSourceA = { team: groupADone ? standingsA[0]?.team : null, placeholder: '1 z grupy A' };
    const finalSourceB = { team: groupBDone ? standingsB[0]?.team : null, placeholder: '1 z grupy B' };
    const smallSourceA = { team: groupADone ? standingsA[1]?.team : null, placeholder: '2 z grupy A' };
    const smallSourceB = { team: groupBDone ? standingsB[1]?.team : null, placeholder: '2 z grupy B' };

    const finalResult = matchesById.final || {};
    const finalPlayed = isPlayed(finalResult);
    const champion = finalPlayed
      ? (finalResult.score_a > finalResult.score_b ? finalResult.team_a : finalResult.team_b)
      : null;

    playoffEl.innerHTML = `
      <div class="bracket-container">
        <div class="bracket-col bracket-col-small">
          <div class="bracket-col-title">Mecz o 3. miejsce</div>
          ${bracketMatch('small_final', smallSourceA, smallSourceB)}
        </div>
        <div class="flanki-belt-wrap" aria-hidden="true">
          <img class="flanki-belt" src="assets/decorations/flanki-trophy.png" alt="">
        </div>
        <div class="bracket-col bracket-col-final">
          <div class="bracket-col-title">Finał</div>
          ${bracketMatch('final', finalSourceA, finalSourceB)}
        </div>
      </div>
      <p class="flanki-champion-note">
        ${champion
          ? `Zwycięzcą Turnieju Flanki zostaje ${escapeHTML(champion)}!`
          : 'Zwycięzca Turnieju Flanki zostanie ogłoszony po finale.'}
      </p>
    `;
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
      console.warn('[flanki] load:', error.message);
      renderAll();
      if (!document.querySelector('.flanki-error-banner')) {
        const banner = document.createElement('p');
        banner.className = 'status-copy flanki-error-banner';
        banner.style.cssText = 'margin-bottom:14px;color:#ffb4b4;';
        banner.textContent = `Brak meczów w bazie (${error.message}). Wpisz pierwszy w panelu admina.`;
        groupsEl.parentNode.insertBefore(banner, groupsEl);
      }
      return;
    }
    document.querySelectorAll('.flanki-error-banner').forEach(el => el.remove());
    (data || []).forEach(match => { matchesById[match.match_id] = match; });
    renderAll();
  }

  function refreshFor(user) {
    if (!user) {
      groupsEl.innerHTML = '<p class="status-copy">Zaloguj się, żeby zobaczyć tabele Flanków.</p>';
      scheduleEl.innerHTML = '';
      playoffEl.innerHTML = '';
      return;
    }
    matchesById = {};
    renderAll();
    load();
  }

  window.alkoAuth.onAuthChange(refreshFor);
  setInterval(() => { if (window.alkoAuth.getUser()) load(); }, 30000);
})();
