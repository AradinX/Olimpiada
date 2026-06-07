// === Strona Typowania ===
// Renderuje liste konkurencji + formularze do obstawiania zwyciezcy.
// Zapisuje do tabeli public.bets w Supabase.
//
// TEAMS, PARTICIPANTS, COMPETITIONS, POINTS, EVENT_START
// + helpery (isBettingLocked, escapeHTML, pgGet) sa w data.js (musi byc dolaczony wczesniej).

(function () {
  const lockedEl = document.getElementById('typuj-locked');
  const listEl = document.getElementById('typuj-list');
  if (!lockedEl || !listEl) return;

  if (!window.alkoAuth || !window.alkoAuth.configured) {
    lockedEl.hidden = false;
    lockedEl.querySelector('span').textContent =
      'Backend Supabase nie jest skonfigurowany. Zobacz SUPABASE_SETUP.md';
    return;
  }

  const supabase = window.alkoAuth.client;
  let myBets = {};           // competition_id -> bet row
  let allBets = [];          // wszystkie cudze zaklady do pokazania
  let profilesById = {};     // user_id -> display_name
  let resultsByComp = {};    // competition_id -> { actual_1st, actual_2nd, actual_3rd }
  let dataLoaded = false;

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // Generyczny GET na PostgREST (bypass SDK, ktore wisi).
  async function pgGet(path) {
    const token = window.alkoAuth.getAccessToken();
    if (!token) return { data: null, error: { message: 'Brak tokena.' } };
    const url = window.SUPABASE_CONFIG.url + '/rest/v1/' + path;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'apikey': window.SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${token}`
        }
      });
      clearTimeout(tid);
      if (!res.ok) {
        const txt = await res.text();
        return { data: null, error: { message: `HTTP ${res.status}: ${txt}` } };
      }
      return { data: await res.json(), error: null };
    } catch (err) {
      clearTimeout(tid);
      return { data: null, error: { message: err.name === 'AbortError' ? 'TIMEOUT' : err.message } };
    }
  }

  async function loadProfiles() {
    const { data, error } = await pgGet('profiles?select=id,display_name');
    if (error) {
      console.warn('[typuj] profiles load:', error.message);
      return;
    }
    profilesById = {};
    (data || []).forEach(p => { profilesById[p.id] = p.display_name; });
    console.log('[typuj] profili:', (data || []).length);
  }

  async function loadBets() {
    const { data, error } = await pgGet('bets?select=id,user_id,competition,predicted_1st,predicted_2nd,predicted_3rd,updated_at&order=updated_at.desc');
    if (error) {
      console.error('[typuj] bets load:', error.message);
      return;
    }
    allBets = data || [];
  }

  async function loadResults() {
    const { data, error } = await pgGet('results?select=competition,actual_1st,actual_2nd,actual_3rd');
    if (error) {
      console.warn('[typuj] results load:', error.message);
      return;
    }
    resultsByComp = {};
    (data || []).forEach(r => { resultsByComp[r.competition] = r; });
    console.log('[typuj] wynikow:', (data || []).length);
  }

  // === Punktacja ===
  function scoreBet(bet, result) {
    if (!result) return { total: 0, hits: [] };
    let total = 0;
    const hits = [];
    if (bet.predicted_1st === result.actual_1st) { total += POINTS.first;  hits.push('1'); }
    if (bet.predicted_2nd === result.actual_2nd) { total += POINTS.second; hits.push('2'); }
    if (bet.predicted_3rd === result.actual_3rd) { total += POINTS.third;  hits.push('3'); }

    const exact = bet.predicted_1st === result.actual_1st
               && bet.predicted_2nd === result.actual_2nd
               && bet.predicted_3rd === result.actual_3rd;
    const predicted = new Set([bet.predicted_1st, bet.predicted_2nd, bet.predicted_3rd]);
    const actual    = [result.actual_1st, result.actual_2nd, result.actual_3rd];
    const samePeople = actual.every(a => predicted.has(a));

    if (exact)        { total += POINTS.podiumExact; hits.push('PODIUM'); }
    else if (samePeople) { total += POINTS.podiumAny;  hits.push('3OF3'); }

    return { total, hits };
  }

  function computeLeaderboard() {
    const byUser = {};
    allBets.forEach(bet => {
      const result = resultsByComp[bet.competition];
      if (!result) return; // bez wynikow nic nie liczymy
      const { total, hits } = scoreBet(bet, result);
      if (!byUser[bet.user_id]) {
        byUser[bet.user_id] = {
          user_id: bet.user_id,
          display_name: profilesById[bet.user_id] || 'anon',
          points: 0,
          breakdown: {}
        };
      }
      byUser[bet.user_id].points += total;
      byUser[bet.user_id].breakdown[bet.competition] = { points: total, hits };
    });
    return Object.values(byUser).sort((a, b) => b.points - a.points || a.display_name.localeCompare(b.display_name));
  }

  function rebuildMyBets(userId) {
    myBets = {};
    allBets.filter(b => b.user_id === userId).forEach(b => {
      myBets[b.competition] = b;
    });
  }

  function renderOthers(competitionId) {
    const rows = allBets
      .filter(b => b.competition === competitionId)
      .map(b => {
        const name = escapeHTML(profilesById[b.user_id] || 'anon');
        const podium = [b.predicted_1st, b.predicted_2nd, b.predicted_3rd]
          .map(p => escapeHTML(p || '—'))
          .join(' › ');
        return `<li><strong>${name}:</strong> ${podium}</li>`;
      })
      .join('');
    return rows
      ? `<details><summary>Aktualne typy (${allBets.filter(b => b.competition === competitionId).length})</summary><ul>${rows}</ul></details>`
      : 'Nikt jeszcze nie obstawial.';
  }

  function optionsHtml(values, selected) {
    const empty = '<option value="" disabled' + (selected ? '' : ' selected') + '>— wybierz —</option>';
    const opts = values.map(v => {
      const isSel = v === selected ? ' selected' : '';
      return `<option value="${escapeHTML(v)}"${isSel}>${escapeHTML(v)}</option>`;
    }).join('');
    return empty + opts;
  }

  function teamOptionsHtml(selected) {
    const empty = '<option value="" disabled' + (selected ? '' : ' selected') + '>— wybierz —</option>';
    const opts = TEAMS.map(t => {
      const label = `${t.name} — ${t.members.join(', ')}`;
      const isSel = t.name === selected ? ' selected' : '';
      return `<option value="${escapeHTML(t.name)}"${isSel}>${escapeHTML(label)}</option>`;
    }).join('');
    return empty + opts;
  }

  function podiumSelect(name, label, selected, comp, locked) {
    const opts = comp.type === 'team'
      ? teamOptionsHtml(selected)
      : optionsHtml(PARTICIPANTS, selected);
    const disabledAttr = locked ? ' disabled' : '';
    return `
      <label class="typuj-podium-slot">
        <span class="typuj-podium-label">${label}</span>
        <select name="${name}" required${disabledAttr}>${opts}</select>
      </label>
    `;
  }

  function renderLockBanner() {
    const wrap = document.getElementById('typuj-lock-banner');
    if (!wrap) return;
    if (isBettingLocked()) {
      wrap.hidden = false;
      wrap.className = 'typuj-lock-banner closed';
      wrap.innerHTML = `🔒 Typowanie zamknięte — impreza już ruszyła. Czekaj na wyniki!`;
    } else {
      const text = formatLockCountdown();
      if (!text) { wrap.hidden = true; return; }
      wrap.hidden = false;
      wrap.className = 'typuj-lock-banner open';
      wrap.innerHTML = `⏳ ${escapeHTML(text)}`;
    }
  }

  function renderLeaderboard() {
    const wrap = document.getElementById('typuj-leaderboard');
    if (!wrap) return;
    const ranking = computeLeaderboard();
    const resultsCount = Object.keys(resultsByComp).length;

    if (resultsCount === 0) {
      wrap.hidden = false;
      wrap.innerHTML = `
        <div class="typuj-leaderboard-header">
          <h2>🏆 Klasyfikacja typujących</h2>
          <span class="typuj-leaderboard-meta">Wyniki konkurencji jeszcze nie wprowadzone</span>
        </div>
        <p class="typuj-leaderboard-empty">
          Tabela pojawi się gdy organizator wprowadzi pierwsze wyniki.
        </p>
      `;
      return;
    }

    if (ranking.length === 0) {
      wrap.hidden = false;
      wrap.innerHTML = `
        <div class="typuj-leaderboard-header">
          <h2>🏆 Klasyfikacja typujących</h2>
          <span class="typuj-leaderboard-meta">Wyniki: ${resultsCount} / ${COMPETITIONS.length}</span>
        </div>
        <p class="typuj-leaderboard-empty">Nikt jeszcze nie zatypował.</p>
      `;
      return;
    }

    const currentUserId = window.alkoAuth.getUser()?.id;
    const compMap = Object.fromEntries(COMPETITIONS.map(c => [c.id, c.name]));

    const rows = ranking.map((entry, idx) => {
      const isMe = entry.user_id === currentUserId;
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
      const breakdownItems = Object.entries(entry.breakdown)
        .filter(([, v]) => v.points > 0)
        .map(([comp, v]) => `<li>${escapeHTML(compMap[comp] || comp)}: <strong>${v.points} pkt</strong></li>`)
        .join('');
      return `
        <li class="typuj-rank-row${isMe ? ' me' : ''}">
          <span class="typuj-rank-place">${medal || '#' + (idx + 1)}</span>
          <details class="typuj-rank-details">
            <summary>
              <span class="typuj-rank-name">${escapeHTML(entry.display_name)}${isMe ? ' <em>(Ty)</em>' : ''}</span>
              <span class="typuj-rank-points">${entry.points} pkt</span>
            </summary>
            ${breakdownItems ? `<ul class="typuj-rank-breakdown">${breakdownItems}</ul>` : '<p class="typuj-rank-breakdown-empty">Same pudła jak na razie.</p>'}
          </details>
        </li>
      `;
    }).join('');

    wrap.hidden = false;
    wrap.innerHTML = `
      <div class="typuj-leaderboard-header">
        <h2>🏆 Klasyfikacja typujących</h2>
        <span class="typuj-leaderboard-meta">Wyniki: ${resultsCount} / ${COMPETITIONS.length}</span>
      </div>
      <ol class="typuj-rank-list">${rows}</ol>
    `;
  }

  function renderList() {
    listEl.hidden = false;
    const locked = isBettingLocked();
    listEl.innerHTML = COMPETITIONS.map(comp => {
      const mine = myBets[comp.id] || {};
      const v1 = mine.predicted_1st || '';
      const v2 = mine.predicted_2nd || '';
      const v3 = mine.predicted_3rd || '';
      const submitted = v1 && v2 && v3;

      const buttonHtml = locked
        ? `<button type="submit" disabled title="Typowanie zamkniete">Zamkniete</button>`
        : `<button type="submit">${submitted ? 'Zaktualizuj typ' : 'Obstaw'}</button>`;

      // Aktualny wynik konkurencji (jesli admin juz wpisal)
      const result = resultsByComp[comp.id];
      const resultBlock = result ? `
        <div class="typuj-result-podium">
          <span class="typuj-result-label">✅ Wyniki konkurencji:</span>
          <div class="typuj-result-places">
            <span class="typuj-result-place">🥇 <strong>${escapeHTML(result.actual_1st || '—')}</strong></span>
            <span class="typuj-result-place">🥈 <strong>${escapeHTML(result.actual_2nd || '—')}</strong></span>
            <span class="typuj-result-place">🥉 <strong>${escapeHTML(result.actual_3rd || '—')}</strong></span>
          </div>
        </div>
      ` : '';

      return `
        <article class="typuj-card${locked ? ' locked' : ''}${result ? ' has-result' : ''}" data-comp="${escapeHTML(comp.id)}">
          <div class="typuj-card-head">
            <h3>${escapeHTML(comp.name)}</h3>
            <span class="typuj-card-tag">${comp.type === 'team' ? 'druzyna' : 'uczestnik'}</span>
          </div>
          ${comp.description ? `<p class="typuj-card-desc">${escapeHTML(comp.description)}</p>` : ''}
          ${resultBlock}
          <form data-comp-form="${escapeHTML(comp.id)}" class="typuj-podium-form">
            ${podiumSelect('first',  '🥇 1. miejsce', v1, comp, locked)}
            ${podiumSelect('second', '🥈 2. miejsce', v2, comp, locked)}
            ${podiumSelect('third',  '🥉 3. miejsce', v3, comp, locked)}
            <div class="typuj-podium-actions">
              ${buttonHtml}
            </div>
          </form>
          <div class="typuj-current">${renderOthers(comp.id)}</div>
          <p class="typuj-feedback" data-feedback></p>
        </article>
      `;
    }).join('');

    listEl.querySelectorAll('[data-comp-form]').forEach(form => {
      form.addEventListener('submit', handleBet);
    });
  }

  function showToast(message, kind) {
    let toast = document.getElementById('typuj-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'typuj-toast';
      toast.className = 'typuj-toast';
      document.body.appendChild(toast);
    }
    toast.className = 'typuj-toast ' + (kind || 'info');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, kind === 'error' ? 8000 : 3500);
  }

  async function handleBet(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const compId = form.dataset.compForm;
    const first  = (form.querySelector('[name="first"]')?.value  || '').trim();
    const second = (form.querySelector('[name="second"]')?.value || '').trim();
    const third  = (form.querySelector('[name="third"]')?.value  || '').trim();
    const card = form.closest('.typuj-card');
    const feedback = card.querySelector('[data-feedback]');
    const submit = form.querySelector('button');

    if (isBettingLocked()) {
      feedback.textContent = 'Typowanie zamkniete — impreza juz ruszyla.';
      feedback.classList.add('error');
      renderList();
      renderLockBanner();
      return;
    }

    if (!first || !second || !third) {
      feedback.textContent = 'Wybierz wszystkie 3 miejsca.';
      feedback.classList.add('error');
      return;
    }
    const set = new Set([first, second, third]);
    if (set.size < 3) {
      feedback.textContent = 'Kazde miejsce musi byc inne.';
      feedback.classList.add('error');
      return;
    }

    const user = window.alkoAuth.getUser();
    if (!user) {
      feedback.textContent = 'Zaloguj sie, zeby obstawiac.';
      feedback.classList.add('error');
      return;
    }

    submit.disabled = true;
    feedback.textContent = 'Zapisuje...';
    feedback.classList.remove('error');

    const payload = {
      user_id: user.id,
      competition: compId,
      predicted_1st: first,
      predicted_2nd: second,
      predicted_3rd: third,
      updated_at: new Date().toISOString()
    };
    console.log('[typuj] upsert payload:', payload);

    // BYPASS supabase-js — direct REST. SDK wisi przy auth.getSession(),
    // wiec token czytamy z cache/localStorage i strzelamy wprost na PostgREST.
    let response;
    try {
      const token = window.alkoAuth.getAccessToken();
      console.log('[typuj] token present:', !!token);
      if (!token) throw new Error('Brak tokena sesji. Wyloguj sie i zaloguj ponownie.');
      const url = window.SUPABASE_CONFIG.url + '/rest/v1/bets?on_conflict=user_id%2Ccompetition';
      console.log('[typuj] fetch URL:', url);
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(payload)
      });
      clearTimeout(tid);
      console.log('[typuj] fetch status:', res.status, res.statusText);
      if (!res.ok) {
        const txt = await res.text();
        response = { data: null, error: { message: `HTTP ${res.status}: ${txt || res.statusText}` } };
      } else {
        response = { data: payload, error: null };
      }
    } catch (err) {
      console.error('[typuj] fetch threw:', err);
      response = {
        data: null,
        error: {
          message: err.name === 'AbortError'
            ? 'TIMEOUT — Supabase nie odpowiedzial w 10s. Sprawdz F12 -> Network.'
            : 'Wyjatek: ' + (err?.message || err)
        }
      };
    }

    const { data, error } = response;
    console.log('[typuj] upsert response:', { data, error });

    submit.disabled = false;
    if (error) {
      const msg = 'Blad zapisu: ' + error.message;
      feedback.textContent = msg;
      feedback.classList.add('error');
      showToast(msg, 'error');
      console.error('[typuj] upsert error full:', error);
      if (/predicted_1st|predicted_2nd|predicted_3rd|column/i.test(error.message)) {
        showToast('Brak migracji SQL — uruchom alter table z SUPABASE_SETUP.md (sekcja MIGRACJE).', 'error');
      } else if (/row-level security|permission|RLS/i.test(error.message)) {
        showToast('RLS blokuje zapis. Sprawdz polityki w Supabase.', 'error');
      } else if (/TIMEOUT/i.test(error.message)) {
        showToast('Zadanie wisi. Otworz F12 -> Network i sprawdz odpowiedz POST/PATCH /rest/v1/bets.', 'error');
      }
      return;
    }

    showToast('✓ Typ zapisany.', 'success');
    await loadBets();
    rebuildMyBets(user.id);
    renderList();
    renderLeaderboard();
  }

  async function ensureDataLoaded() {
    if (dataLoaded) return;
    await loadProfiles();
    dataLoaded = true;
  }

  async function refreshFor(user) {
    console.log('[typuj] refreshFor:', user ? user.email : 'null');
    if (!user) {
      lockedEl.hidden = false;
      listEl.hidden = true;
      listEl.innerHTML = '';
      const lb = document.getElementById('typuj-leaderboard');
      if (lb) lb.hidden = true;
      renderLockBanner();
      return;
    }
    lockedEl.hidden = true;
    renderLockBanner();
    // Renderuj OD RAZU — listy TEAMS/PARTICIPANTS sa dostepne natychmiast
    renderList();
    try {
      await ensureDataLoaded();
      await Promise.all([loadBets(), loadResults()]);
      console.log('[typuj] zaklady:', allBets.length);
      rebuildMyBets(user.id);
      renderList();
      renderLeaderboard();
    } catch (e) {
      console.error('[typuj] refresh error:', e);
    }
  }

  // Co minute odswiezamy countdown / sprawdzamy czy nie pora zamknac typowania.
  setInterval(() => {
    renderLockBanner();
    if (isBettingLocked()) renderList();
  }, 60000);

  console.log('[typuj] init, alkoAuth configured:', window.alkoAuth?.configured);
  window.alkoAuth.onAuthChange(refreshFor);
})();
