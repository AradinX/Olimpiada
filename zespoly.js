// === Strona Zespoły ===
// Renderuje 6 tabelek druzyn z TEAMS (data.js). Zero Google Sheets.

(function () {
  const container = document.getElementById('zespoly-groups');
  if (!container || typeof TEAMS === 'undefined') return;

  container.innerHTML = TEAMS.map(team => `
    <table class="group-table">
      <thead><tr><th>${escapeHTML(team.name)}</th></tr></thead>
      <tbody>
        ${team.members.map(m => `<tr><td>${escapeHTML(m)}</td></tr>`).join('')}
      </tbody>
    </table>
  `).join('');
})();
