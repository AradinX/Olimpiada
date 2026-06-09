// === Strona Zespoły ===
// Renderuje 6 kart druzyn z TEAMS (data.js). Zero Google Sheets.

(function () {
  const container = document.getElementById('zespoly-groups');
  if (!container || typeof TEAMS === 'undefined') return;

  container.innerHTML = TEAMS.map((team, index) => `
    <article class="group-table team-card" aria-label="${escapeHTML(team.name)}">
      <header class="team-card-header">
        <span class="team-number" aria-hidden="true">${index + 1}</span>
        <div class="team-card-title">
          <p>Drużyna</p>
          <h2>${escapeHTML(team.name)}</h2>
        </div>
      </header>
      <ul class="team-members">
        ${team.members.map((member, memberIndex) => `
          <li>
            <span class="member-index" aria-hidden="true">${memberIndex + 1}</span>
            <span>${escapeHTML(member)}</span>
          </li>
        `).join('')}
      </ul>
    </article>
  `).join('');
})();
