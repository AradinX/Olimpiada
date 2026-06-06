// === Strona Flanki (publiczna) ===
// Pokazuje tabele grup, harmonogram (kolejki), faze pucharowa.

(function () {
  const groupsEl   = document.getElementById('flanki-groups');
  const scheduleEl = document.getElementById('flanki-schedule');
  const playoffEl  = document.getElementById('flanki-playoff');
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
    const t = TEAMS.find(x => x.name === teamName);
    return t ? t.members.join(', ') : '';
  }

  // ============================================================
  // GRUPY — uproszczona tabela: Druzyna | Mecze | Punkty
  // ============================================================
  function renderGroups() {
    groupsEl.innerHTML = ['A', 'B'].map(g => {
      const standings = computeFlankiStandings(g, matchesById);
      const rows = standings.map((s, idx) => {
        const place = idx + 1;
        const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
        return `
          <tr class="place-${place}">
            <td class="rank-cell">${medal}</td>
            <td class="team-cell">
              <strong>${escapeHTML(s.team)}</strong>
              <small>${escapeHTML(membersOf(s.team))}</small>
            </td>
            <td>${s.played}</td>
            <td><strong>${s.scored}</strong></td>
          </tr>
        `;
      }).join('');
      return `
        <article class="flanki-group">
          <h2>Grupa ${g}</h2>
          <table class="flanki-group-table">
            <thead>
              <tr>
                <th></th><th>Drużyna</th><th>M</th><th>Pkt</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </article>
      `;
    }).join('');
  }

  // ============================================================
  // HARMONOGRAM — widok kolejek z battle cards
  // Kolejka 1: A1 + B1, Kolejka 2: A2 + B2, Kolejka 3: A3 + B3
  // ============================================================
  function renderMatchCard(m) {
    const r = matchesById[m.id] || {};
    const played = isPlayed(r);
    const scoreA = r.score_a != null ? r.score_a : '–';
    const scoreB = r.score_b != null ? r.score_b : '–';
    const winnerA = played && r.score_a > r.score_b;
    const winnerB = played && r.score_b > r.score_a;
    const memA = membersOf(m.team_a);
    const memB = membersOf(m.team_b);

    return `
      <article class="match-card ${played ? 'played' : 'pending'}">
        <div class="match-card-meta">${escapeHTML(m.label)}</div>
        <div class="match-card-body">
          <div class="match-side ${winnerA ? 'winner' : ''}">
            <div class="match-side-name">${escapeHTML(m.team_a)}</div>
            <div class="match-side-members">${escapeHTML(memA)}</div>
            ${winnerA ? '<div class="match-side-badge">✓ Wygrana</div>' : ''}
          </div>
          <div class="match-score-block">
            <div class="match-score-num ${winnerA ? 'won' : ''}">${scoreA}</div>
            <div class="match-vs">VS</div>
            <div class="match-score-num ${winnerB ? 'won' : ''}">${scoreB}</div>
          </div>
          <div class="match-side ${winnerB ? 'winner' : ''}">
            <div class="match-side-name">${escapeHTML(m.team_b)}</div>
            <div class="match-side-members">${escapeHTML(memB)}</div>
            ${winnerB ? '<div class="match-side-badge">✓ Wygrana</div>' : ''}
          </div>
        </div>
        ${!played ? '<div class="match-card-status">⏳ oczekuje na rozegranie</div>' : ''}
      </article>
    `;
  }

  function renderSchedule() {
    // Grupuj mecze po kolejkach.
    // Kolejka 1: A1 + B1, Kolejka 2: A2 + B2, Kolejka 3: A3 + B3
    const rounds = [
      { label: 'Kolejka 1', matches: ['A1', 'B1'] },
      { label: 'Kolejka 2', matches: ['A2', 'B2'] },
      { label: 'Kolejka 3', matches: ['A3', 'B3'] }
    ];

    scheduleEl.innerHTML = rounds.map(round => {
      const matches = round.matches.map(id => FLANKI_SCHEDULE.find(m => m.id === id)).filter(Boolean);
      const cards = matches.map(renderMatchCard).join('');
      const anyPlayed = matches.some(m => isPlayed(matchesById[m.id]));
      const allPlayed = matches.every(m => isPlayed(matchesById[m.id]));
      const status = allPlayed ? '✓ zakończona' : anyPlayed ? '◐ w trakcie' : '◯ przed nami';
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

  // ============================================================
  // FAZA PUCHAROWA — drabinka
  // ============================================================
  function renderPlayoff() {
    const standA = computeFlankiStandings('A', matchesById);
    const standB = computeFlankiStandings('B', matchesById);
    const groupsDone = (g) =>
      FLANKI_SCHEDULE.filter(m => m.phase === 'group' && m.group === g)
        .every(m => isPlayed(matchesById[m.id]));
    const aDone = groupsDone('A');
    const bDone = groupsDone('B');

    function bracketMatch(matchId, sideASource, sideBSource) {
      const m = FLANKI_SCHEDULE.find(x => x.id === matchId);
      const r = matchesById[matchId] || {};
      const played = isPlayed(r);
      const hasTeams = r.team_a && r.team_b;
      const teamA = hasTeams ? r.team_a : sideASource.team;
      const teamB = hasTeams ? r.team_b : sideBSource.team;
      const placeholderA = sideASource.placeholder;
      const placeholderB = sideBSource.placeholder;
      const winnerA = played && r.score_a > r.score_b;
      const winnerB = played && r.score_b > r.score_a;
      const scoreA = r.score_a != null ? r.score_a : '–';
      const scoreB = r.score_b != null ? r.score_b : '–';

      const showA = teamA || placeholderA;
      const showB = teamB || placeholderB;
      const memA = teamA ? membersOf(teamA) : '';
      const memB = teamB ? membersOf(teamB) : '';

      return `
        <article class="bracket-match ${matchId === 'final' ? 'final' : 'small-final'} ${played ? 'played' : 'pending'}">
          <div class="bracket-label">${escapeHTML(m.label)}</div>
          <div class="bracket-row ${winnerA ? 'winner-top' : ''}">
            <div class="bracket-team">
              <div class="bracket-team-name">${escapeHTML(showA)}</div>
              ${memA ? `<div class="bracket-team-mem">${escapeHTML(memA)}</div>` : ''}
            </div>
            <div class="bracket-score ${winnerA ? 'won' : ''}">${scoreA}</div>
          </div>
          <div class="bracket-divider"></div>
          <div class="bracket-row ${winnerB ? 'winner-top' : ''}">
            <div class="bracket-team">
              <div class="bracket-team-name">${escapeHTML(showB)}</div>
              ${memB ? `<div class="bracket-team-mem">${escapeHTML(memB)}</div>` : ''}
            </div>
            <div class="bracket-score ${winnerB ? 'won' : ''}">${scoreB}</div>
          </div>
          ${played
            ? `<div class="bracket-result">🏆 ${escapeHTML(winnerA ? showA : showB)}</div>`
            : `<div class="bracket-result pending">${!hasTeams && (!aDone || !bDone) ? 'oczekuje na zakończenie grup' : 'oczekuje na rozegranie'}</div>`}
        </article>
      `;
    }

    const finalSrcA = { team: aDone ? standA[0]?.team : null, placeholder: '1 z grupy A' };
    const finalSrcB = { team: bDone ? standB[0]?.team : null, placeholder: '1 z grupy B' };
    const smallSrcA = { team: aDone ? standA[1]?.team : null, placeholder: '2 z grupy A' };
    const smallSrcB = { team: bDone ? standB[1]?.team : null, placeholder: '2 z grupy B' };

    playoffEl.innerHTML = `
      <div class="bracket-container">
        <div class="bracket-col bracket-col-small">
          <div class="bracket-col-title">🥉 Mecz o 3 miejsce</div>
          ${bracketMatch('small_final', smallSrcA, smallSrcB)}
        </div>
        <div class="bracket-col bracket-col-final">
          <div class="bracket-col-title">🏆 Finał</div>
          ${bracketMatch('final', finalSrcA, finalSrcB)}
        </div>
      </div>
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
      // Nie wstawiamy bannera multiple times — sprawdzamy czy juz jest
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
    matchesById = {};
    renderAll();
    load();
  }

  window.alkoAuth.onAuthChange(refreshFor);
  setInterval(() => { if (window.alkoAuth.getUser()) load(); }, 30000);
})();
