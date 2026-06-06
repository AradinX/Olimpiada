// === Admin: wpisywanie wynikow Flankow ===
// Dla kazdego z 8 meczow karta z dropdownami wyniku 0-3.
// Mecze grupowe maja sztywne druzyny. Mecze pucharowe: admin wybiera druzyny (z sugestia).

(function () {
  const gateLogin = document.getElementById('flanki-gate-login');
  const gateForbidden = document.getElementById('flanki-gate-forbidden');
  const wrap = document.getElementById('flanki-admin');
  const listEl = document.getElementById('flanki-admin-list');
  if (!wrap || !listEl) return;

  if (!window.alkoAuth || !window.alkoAuth.configured) {
    gateForbidden.hidden = false;
    gateForbidden.querySelector('p').textContent = 'Backend Supabase nie jest skonfigurowany.';
    return;
  }

  let matchesById = {};

  function showToast(message, kind) {
    let toast = document.getElementById('flanki-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'flanki-toast';
      toast.className = 'typuj-toast';
      document.body.appendChild(toast);
    }
    toast.className = 'typuj-toast ' + (kind || 'info');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, kind === 'error' ? 8000 : 3500);
  }

  async function loadMatches() {
    const { data, error } = await pgGet('flanki_matches?select=match_id,team_a,team_b,score_a,score_b');
    if (error) {
      console.error('[wpisz-flanki] load:', error.message);
      showToast('Błąd ładowania: ' + error.message, 'error');
      return;
    }
    matchesById = {};
    (data || []).forEach(m => { matchesById[m.match_id] = m; });
  }

  function scoreOpts(selected) {
    return [0, 1, 2, 3].map(n =>
      `<option value="${n}"${selected === n ? ' selected' : ''}>${n}</option>`
    ).join('');
  }

  function teamOpts(selected) {
    const all = Object.values(FLANKI_GROUPS).flat();
    return '<option value="" disabled' + (selected ? '' : ' selected') + '>— wybierz —</option>' +
      all.map(t => `<option value="${escapeHTML(t)}"${t === selected ? ' selected' : ''}>${escapeHTML(t)}</option>`).join('');
  }

  function renderCard(m) {
    const r = matchesById[m.id] || {};
    const isGroup = m.phase === 'group';
    const teamA = isGroup ? m.team_a : (r.team_a || '');
    const teamB = isGroup ? m.team_b : (r.team_b || '');
    const filled = r.score_a != null && r.score_b != null;

    // Sugestie dla pucharowych
    let suggestion = '';
    if (!isGroup) {
      const standA = computeFlankiStandings('A', matchesById);
      const standB = computeFlankiStandings('B', matchesById);
      const aDone = FLANKI_SCHEDULE.filter(x => x.phase === 'group' && x.group === 'A')
        .every(x => { const rr = matchesById[x.id]; return rr && rr.score_a === 3 || rr && rr.score_b === 3; });
      const bDone = FLANKI_SCHEDULE.filter(x => x.phase === 'group' && x.group === 'B')
        .every(x => { const rr = matchesById[x.id]; return rr && rr.score_a === 3 || rr && rr.score_b === 3; });
      if (m.id === 'small_final' && aDone && bDone) {
        suggestion = `<p class="flanki-suggestion">Sugerowane: <strong>${escapeHTML(standA[1]?.team || '?')}</strong> vs <strong>${escapeHTML(standB[1]?.team || '?')}</strong></p>`;
      } else if (m.id === 'final' && aDone && bDone) {
        suggestion = `<p class="flanki-suggestion">Sugerowane: <strong>${escapeHTML(standA[0]?.team || '?')}</strong> vs <strong>${escapeHTML(standB[0]?.team || '?')}</strong></p>`;
      } else {
        suggestion = `<p class="flanki-suggestion">${escapeHTML(m.placeholder)} — najpierw zakończ grupy</p>`;
      }
    }

    const teamInputs = isGroup ? `
      <div class="flanki-teams-static">
        <strong>${escapeHTML(teamA)}</strong> vs <strong>${escapeHTML(teamB)}</strong>
      </div>
    ` : `
      <div class="flanki-teams-pick">
        <label class="wynik-slot">
          <span class="wynik-slot-label">Drużyna A</span>
          <select name="team_a" required>${teamOpts(teamA)}</select>
        </label>
        <label class="wynik-slot">
          <span class="wynik-slot-label">Drużyna B</span>
          <select name="team_b" required>${teamOpts(teamB)}</select>
        </label>
      </div>
    `;

    return `
      <article class="wynik-card ${filled ? 'is-filled' : ''}" data-match="${escapeHTML(m.id)}">
        <div class="wynik-card-head">
          <h3>${escapeHTML(m.label)}</h3>
          <span class="wynik-card-tag">${m.phase === 'group' ? 'grupa ' + m.group : 'puchar'}${filled ? ' • zapisany' : ''}</span>
        </div>
        ${suggestion}
        <form data-flanki-form="${escapeHTML(m.id)}" data-phase="${escapeHTML(m.phase)}" class="wynik-form">
          ${teamInputs}
          <div class="flanki-score-row">
            <label class="wynik-slot">
              <span class="wynik-slot-label">Punkty A</span>
              <select name="score_a" required>${scoreOpts(r.score_a)}</select>
            </label>
            <div class="flanki-score-sep">:</div>
            <label class="wynik-slot">
              <span class="wynik-slot-label">Punkty B</span>
              <select name="score_b" required>${scoreOpts(r.score_b)}</select>
            </label>
          </div>
          <div class="wynik-actions">
            <button type="submit">${filled ? 'Zaktualizuj' : 'Zapisz wynik'}</button>
            ${filled ? `<button type="button" data-reset="${escapeHTML(m.id)}" style="background:#b32f2f;">Reset</button>` : ''}
          </div>
          <p class="wynik-feedback" data-feedback></p>
        </form>
      </article>
    `;
  }

  function render() {
    listEl.innerHTML = FLANKI_SCHEDULE.map(renderCard).join('');
    listEl.querySelectorAll('[data-flanki-form]').forEach(f => f.addEventListener('submit', handleSave));
    listEl.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', handleReset));
  }

  async function handleSave(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const matchId = form.dataset.flankiForm;
    const phase = form.dataset.phase;
    const feedback = form.querySelector('[data-feedback]');
    const submit = form.querySelector('button[type="submit"]');

    const scheduleMatch = FLANKI_SCHEDULE.find(m => m.id === matchId);
    const teamA = phase === 'group' ? scheduleMatch.team_a : form.querySelector('[name="team_a"]').value;
    const teamB = phase === 'group' ? scheduleMatch.team_b : form.querySelector('[name="team_b"]').value;
    const scoreA = parseInt(form.querySelector('[name="score_a"]').value, 10);
    const scoreB = parseInt(form.querySelector('[name="score_b"]').value, 10);

    if (!teamA || !teamB || teamA === teamB) {
      feedback.textContent = 'Wybierz dwie różne drużyny.';
      feedback.classList.add('error');
      return;
    }
    if (isNaN(scoreA) || isNaN(scoreB)) {
      feedback.textContent = 'Wybierz wynik dla obu drużyn.';
      feedback.classList.add('error');
      return;
    }
    if (scoreA !== 3 && scoreB !== 3) {
      feedback.textContent = 'Mecz nie może się skończyć bez wyniku 3 (brak remisów).';
      feedback.classList.add('error');
      return;
    }
    if (scoreA === 3 && scoreB === 3) {
      feedback.textContent = 'Nie może być 3:3 (brak remisów).';
      feedback.classList.add('error');
      return;
    }

    submit.disabled = true;
    feedback.textContent = 'Zapisuje...';
    feedback.classList.remove('error');

    const payload = {
      match_id: matchId,
      team_a: teamA, team_b: teamB,
      score_a: scoreA, score_b: scoreB,
      updated_at: new Date().toISOString()
    };
    console.log('[wpisz-flanki] upsert payload:', payload);

    try {
      const token = window.alkoAuth.getAccessToken();
      const url = window.SUPABASE_CONFIG.url + '/rest/v1/flanki_matches?on_conflict=match_id';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(payload)
      });
      submit.disabled = false;
      if (!res.ok) {
        const txt = await res.text();
        feedback.textContent = `Błąd: HTTP ${res.status} ${txt}`;
        feedback.classList.add('error');
        showToast(`Błąd zapisu (${res.status}).`, 'error');
        console.error('[wpisz-flanki] upsert error:', res.status, txt);
        return;
      }
      feedback.textContent = '✓ Zapisane.';
      showToast(`✓ ${scheduleMatch.label}: ${teamA} ${scoreA}:${scoreB} ${teamB}`, 'success');
      await loadMatches();
      render();
    } catch (err) {
      submit.disabled = false;
      console.error('[wpisz-flanki] fetch threw:', err);
      feedback.textContent = 'Wyjątek: ' + (err.message || err);
      feedback.classList.add('error');
    }
  }

  async function handleReset(e) {
    const matchId = e.currentTarget.dataset.reset;
    if (!confirm(`Skasować wynik meczu ${matchId}?`)) return;
    const token = window.alkoAuth.getAccessToken();
    const url = window.SUPABASE_CONFIG.url + '/rest/v1/flanki_matches?match_id=eq.' + encodeURIComponent(matchId);
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'apikey': window.SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        showToast(`Błąd: HTTP ${res.status}`, 'error');
        return;
      }
      showToast('✓ Wynik skasowany.', 'success');
      await loadMatches();
      render();
    } catch (err) {
      showToast('Wyjątek: ' + err.message, 'error');
    }
  }

  async function refreshFor(user) {
    if (!user) {
      gateLogin.hidden = false;
      gateForbidden.hidden = true;
      wrap.hidden = true;
      return;
    }
    if (user.email !== ADMIN_EMAIL) {
      gateLogin.hidden = true;
      gateForbidden.hidden = false;
      wrap.hidden = true;
      return;
    }
    gateLogin.hidden = true;
    gateForbidden.hidden = true;
    wrap.hidden = false;
    await loadMatches();
    render();
  }

  window.alkoAuth.onAuthChange(refreshFor);
})();
