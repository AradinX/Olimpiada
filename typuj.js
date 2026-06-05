// === Strona Typowania ===
// Renderuje liste konkurencji + formularze do obstawiania zwyciezcy.
// Zapisuje do tabeli public.bets w Supabase.
//
// =========================
// EDYTUJ TUTAJ: DRUZYNY
// Format: { name: 'nazwa', members: ['imie', 'imie', ...] }
// W dropdownie pokaza sie jako "Druzyna 1 — Bartosz, Patrycja D, Patera"
// =========================
const TEAMS = [
  { name: 'Druzyna 1', members: ['Bartosz', 'Patrycja D', 'Patera'] },
  { name: 'Druzyna 2', members: ['Piotr', 'Andzia', 'Mati', 'Jepka'] },
  { name: 'Druzyna 3', members: ['Michu', 'Asia', 'Maro'] },
  { name: 'Druzyna 4', members: ['Sopel', 'Martyna', 'Rosa', 'Patrycja'] },
  { name: 'Druzyna 5', members: ['Heksyn', 'Kamila', 'Kotka'] },
  { name: 'Druzyna 6', members: ['Barwa', 'Jadzia', 'Zelek'] }
];

// =========================
// EDYTUJ TUTAJ: UCZESTNICY (konkurencje indywidualne)
// =========================
const PARTICIPANTS = [
  'Patera',
  'Martyna',
  'Patrycja D.',
  'Jadzia',
  'Heksyn',
  'Natalia',
  'Rosa',
  'Kamila',
  'Kotka',
  'Maro',
  'Bartosz',
  'Zelek',
  'Mati',
  'Piter',
  'Barwa',
  'Ganja',
  'Michu',
  'Sopel',
  'Patrycja',
  'Asia'
];

// =========================
// EDYTUJ TUTAJ: LISTA KONKURENCJI
// type: 'team'        -> dropdown z DRUZYN
// type: 'participant' -> dropdown z UCZESTNIKOW
// =========================
const COMPETITIONS = [
  { id: 'sprint500', name: 'Sprint na 500',     type: 'participant' },
  { id: 'flanki',    name: 'Flanki',            type: 'team' },
  { id: 'napol',     name: 'Na pol',            type: 'participant' },
  { id: 'smakosz',   name: 'Smakosz',           type: 'participant' },
  { id: 'beerpong',  name: 'Spacer na sciezke', type: 'team' },
  { id: 'inwestor',  name: 'Inwestor',          type: 'participant' }
];

// =========================
// PUNKTACJA — uzywana tylko w UI (sekcja zasad).
// Realne liczenie punktow zrobimy pozniej, jak wprowadzisz wyniki konkurencji.
// =========================
const POINTS = {
  first:    3,
  second:   2,
  third:    1,
  podiumExact: 5,   // bonus za caly podium w idealnej kolejnosci
  podiumAny:   2    // bonus za trafione 3 osoby w dowolnej kolejnosci
};

// =========================
// BLOKADA CZASOWA — typowanie zamyka sie o starcie imprezy.
// Synchronizuj z scripts.js: const targetDate = new Date('2026-07-25T16:00:00');
// =========================
const EVENT_START = new Date('2026-07-25T16:00:00');

function isBettingLocked() {
  return Date.now() >= EVENT_START.getTime();
}

function formatLockCountdown() {
  const diff = EVENT_START.getTime() - Date.now();
  if (diff <= 0) return null;
  const sec = Math.floor(diff / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  return `${days}d ${hours}g ${minutes}m do zamkniecia typowan`;
}

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

      return `
        <article class="typuj-card${locked ? ' locked' : ''}" data-comp="${escapeHTML(comp.id)}">
          <div class="typuj-card-head">
            <h3>${escapeHTML(comp.name)}</h3>
            <span class="typuj-card-tag">${comp.type === 'team' ? 'druzyna' : 'uczestnik'}</span>
          </div>
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
      renderLockBanner();
      return;
    }
    lockedEl.hidden = true;
    renderLockBanner();
    // Renderuj OD RAZU — listy TEAMS/PARTICIPANTS sa dostepne natychmiast
    renderList();
    try {
      await ensureDataLoaded();
      await loadBets();
      console.log('[typuj] zaklady:', allBets.length);
      rebuildMyBets(user.id);
      renderList();
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
