// === Panel Admina — wpisywanie wynikow konkurencji ===
// Uzywa globalnych TEAMS, PARTICIPANTS, COMPETITIONS z typuj.js (musi byc dolaczony wczesniej).
// Tylko ADMIN_EMAIL moze zapisywac (sprawdzane lokalnie + RLS po stronie Supabase).

const ADMIN_EMAIL = 'xaradinx@gmail.com';

(function () {
  const gateLoginEl = document.getElementById('wynik-gate-login');
  const gateForbiddenEl = document.getElementById('wynik-gate-forbidden');
  const listEl = document.getElementById('wynik-list');
  if (!listEl) return;

  if (!window.alkoAuth || !window.alkoAuth.configured) {
    gateForbiddenEl.hidden = false;
    gateForbiddenEl.querySelector('p').textContent =
      'Backend Supabase nie jest skonfigurowany. Zobacz SUPABASE_SETUP.md';
    return;
  }

  let resultsByComp = {};

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

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
      if (!res.ok) return { data: null, error: { message: `HTTP ${res.status}: ${await res.text()}` } };
      return { data: await res.json(), error: null };
    } catch (err) {
      clearTimeout(tid);
      return { data: null, error: { message: err.name === 'AbortError' ? 'TIMEOUT' : err.message } };
    }
  }

  async function loadResults() {
    const { data, error } = await pgGet('results?select=competition,actual_1st,actual_2nd,actual_3rd');
    if (error) {
      console.error('[wynik] load:', error.message);
      return;
    }
    resultsByComp = {};
    (data || []).forEach(r => { resultsByComp[r.competition] = r; });
    console.log('[wynik] zaladowano:', (data || []).length);
  }

  function teamOptions(selected) {
    const empty = `<option value="" ${selected ? '' : 'selected'} disabled>— wybierz —</option>`;
    return empty + TEAMS.map(t => {
      const label = `${t.name} — ${t.members.join(', ')}`;
      const sel = t.name === selected ? ' selected' : '';
      return `<option value="${escapeHTML(t.name)}"${sel}>${escapeHTML(label)}</option>`;
    }).join('');
  }

  function participantOptions(selected) {
    const empty = `<option value="" ${selected ? '' : 'selected'} disabled>— wybierz —</option>`;
    return empty + PARTICIPANTS.map(p => {
      const sel = p === selected ? ' selected' : '';
      return `<option value="${escapeHTML(p)}"${sel}>${escapeHTML(p)}</option>`;
    }).join('');
  }

  function showToast(message, kind) {
    let toast = document.getElementById('wynik-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'wynik-toast';
      toast.className = 'typuj-toast';
      document.body.appendChild(toast);
    }
    toast.className = 'typuj-toast ' + (kind || 'info');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, kind === 'error' ? 8000 : 3500);
  }

  function render() {
    listEl.hidden = false;
    listEl.innerHTML = COMPETITIONS.map(comp => {
      const r = resultsByComp[comp.id] || {};
      const v1 = r.actual_1st || '';
      const v2 = r.actual_2nd || '';
      const v3 = r.actual_3rd || '';
      const filled = v1 && v2 && v3;
      const opts = comp.type === 'team' ? teamOptions : participantOptions;
      return `
        <article class="wynik-card${filled ? ' is-filled' : ''}" data-comp="${escapeHTML(comp.id)}">
          <div class="wynik-card-head">
            <h3>${escapeHTML(comp.name)}</h3>
            <span class="wynik-card-tag">${comp.type === 'team' ? 'drużyna' : 'uczestnik'}${filled ? ' • zapisane' : ''}</span>
          </div>
          <form data-wynik-form="${escapeHTML(comp.id)}" class="wynik-form">
            <label class="wynik-slot">
              <span class="wynik-slot-label">🥇 1. miejsce</span>
              <select name="first" required>${opts(v1)}</select>
            </label>
            <label class="wynik-slot">
              <span class="wynik-slot-label">🥈 2. miejsce</span>
              <select name="second" required>${opts(v2)}</select>
            </label>
            <label class="wynik-slot">
              <span class="wynik-slot-label">🥉 3. miejsce</span>
              <select name="third" required>${opts(v3)}</select>
            </label>
            <div class="wynik-actions">
              <button type="submit">${filled ? 'Zaktualizuj' : 'Zapisz wynik'}</button>
            </div>
            <p class="wynik-feedback" data-feedback></p>
          </form>
        </article>
      `;
    }).join('');

    listEl.querySelectorAll('[data-wynik-form]').forEach(form => {
      form.addEventListener('submit', handleSave);
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const compId = form.dataset.wynikForm;
    const first  = (form.querySelector('[name="first"]')?.value  || '').trim();
    const second = (form.querySelector('[name="second"]')?.value || '').trim();
    const third  = (form.querySelector('[name="third"]')?.value  || '').trim();
    const feedback = form.querySelector('[data-feedback]');
    const submit = form.querySelector('button');

    if (!first || !second || !third) {
      feedback.textContent = 'Uzupelnij wszystkie 3 miejsca.';
      feedback.classList.add('error');
      return;
    }
    if (new Set([first, second, third]).size < 3) {
      feedback.textContent = 'Kazde miejsce musi byc inne.';
      feedback.classList.add('error');
      return;
    }

    submit.disabled = true;
    feedback.textContent = 'Zapisuje...';
    feedback.classList.remove('error');

    const payload = {
      competition: compId,
      actual_1st: first,
      actual_2nd: second,
      actual_3rd: third,
      updated_at: new Date().toISOString()
    };
    console.log('[wynik] upsert payload:', payload);

    try {
      const token = window.alkoAuth.getAccessToken();
      if (!token) throw new Error('Brak tokena.');
      const url = window.SUPABASE_CONFIG.url + '/rest/v1/results?on_conflict=competition';
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
      console.log('[wynik] fetch status:', res.status, res.statusText);
      submit.disabled = false;
      if (!res.ok) {
        const txt = await res.text();
        feedback.textContent = `Blad zapisu: HTTP ${res.status} ${txt}`;
        feedback.classList.add('error');
        showToast(`Blad zapisu (${res.status}). Sprawdz F12.`, 'error');
        return;
      }
      feedback.textContent = '✓ Zapisane.';
      showToast(`✓ Wynik konkurencji "${COMPETITIONS.find(c => c.id === compId).name}" zapisany.`, 'success');
      await loadResults();
      render();
    } catch (err) {
      submit.disabled = false;
      console.error('[wynik] fetch threw:', err);
      feedback.textContent = 'Wyjatek: ' + (err.message || err);
      feedback.classList.add('error');
    }
  }

  async function refreshFor(user) {
    console.log('[wynik] refreshFor:', user?.email);
    if (!user) {
      gateLoginEl.hidden = false;
      gateForbiddenEl.hidden = true;
      listEl.hidden = true;
      return;
    }
    if (user.email !== ADMIN_EMAIL) {
      gateLoginEl.hidden = true;
      gateForbiddenEl.hidden = false;
      listEl.hidden = true;
      return;
    }
    gateLoginEl.hidden = true;
    gateForbiddenEl.hidden = true;
    await loadResults();
    render();
  }

  console.log('[wynik] init, alkoAuth configured:', window.alkoAuth?.configured);
  window.alkoAuth.onAuthChange(refreshFor);
})();
