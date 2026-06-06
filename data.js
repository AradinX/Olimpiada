// === Wspolne dane uzywane przez wiele stron ===
// Importowane przez: typuj.js, zespoly.js, wyniki.js, rekordy.js, wpisz-*.js
//
// Eksponuje globalne:
//   TEAMS, PARTICIPANTS, COMPETITIONS, POINTS, EVENT_START, ADMIN_EMAIL
//   personToTeam(name) -> string|null
//   isBettingLocked()
//   formatLockCountdown()

// =========================
// DRUZYNY
// =========================
const TEAMS = [
  { name: 'Druzyna 1', members: ['Bartosz', 'Patrycja D', 'Patera'] },
  { name: 'Druzyna 2', members: ['Piotr', 'Andzia', 'Mati', 'Natalia'] },
  { name: 'Druzyna 3', members: ['Michu', 'Asia', 'Maro'] },
  { name: 'Druzyna 4', members: ['Sopel', 'Martyna', 'Rosa', 'Patrycja'] },
  { name: 'Druzyna 5', members: ['Heksyn', 'Kamila', 'Kotka'] },
  { name: 'Druzyna 6', members: ['Barwa', 'Jadzia', 'Zelek'] }
];

// =========================
// UCZESTNICY (konkurencje indywidualne)
// =========================
const PARTICIPANTS = [
  'Patera', 'Martyna', 'Patrycja D.', 'Jadzia', 'Heksyn', 'Natalia',
  'Rosa', 'Kamila', 'Kotka', 'Maro', 'Bartosz', 'Zelek', 'Mati', 'Piotr',
  'Barwa', 'Andzia', 'Michu', 'Sopel', 'Patrycja', 'Asia'
];

// =========================
// LISTA KONKURENCJI
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
// PUNKTACJA TYPOWAN
// =========================
const POINTS = {
  first:       3,
  second:      2,
  third:       1,
  podiumExact: 5,
  podiumAny:   2
};

// =========================
// STAŁE SYSTEMOWE
// =========================
const EVENT_START = new Date('2026-07-25T16:00:00');
const ADMIN_EMAIL = 'xaradinx@gmail.com';

// =========================
// FLANKI — grupy i harmonogram
// Format: 2 grupy x 3 druzyny. Round-robin. Z grupy awansuje 1 do finalu, 2 do meczu o 3.
// Mecze: punkty = liczba osob ktore wypily piwo (max 3). Brak remisow.
// Druzyna 4-osobowa: wystarczy 3 z 4 wypije.
// =========================
const FLANKI_GROUPS = {
  A: ['Druzyna 2', 'Druzyna 5', 'Druzyna 1'],
  B: ['Druzyna 4', 'Druzyna 3', 'Druzyna 6']
};

// Kolejnosc: A1, B1, A2, B2, A3, B3, malyFinal, final.
// W kazdej grupie: 1) team1 vs team2  2) team3 vs team1  3) team2 vs team3
// dzieki czemu kazda druzyna ma przerwe miedzy swoimi meczami.
const FLANKI_SCHEDULE = [
  { id: 'A1', phase: 'group', group: 'A', order: 1, team_a: 'Druzyna 2', team_b: 'Druzyna 5', label: 'Grupa A • Mecz 1' },
  { id: 'B1', phase: 'group', group: 'B', order: 2, team_a: 'Druzyna 4', team_b: 'Druzyna 3', label: 'Grupa B • Mecz 1' },
  { id: 'A2', phase: 'group', group: 'A', order: 3, team_a: 'Druzyna 1', team_b: 'Druzyna 2', label: 'Grupa A • Mecz 2' },
  { id: 'B2', phase: 'group', group: 'B', order: 4, team_a: 'Druzyna 6', team_b: 'Druzyna 4', label: 'Grupa B • Mecz 2' },
  { id: 'A3', phase: 'group', group: 'A', order: 5, team_a: 'Druzyna 5', team_b: 'Druzyna 1', label: 'Grupa A • Mecz 3' },
  { id: 'B3', phase: 'group', group: 'B', order: 6, team_a: 'Druzyna 3', team_b: 'Druzyna 6', label: 'Grupa B • Mecz 3' },
  { id: 'small_final', phase: 'playoff', order: 7, team_a: null, team_b: null, label: 'Mecz o 3. miejsce', placeholder: '2 z grupy A vs 2 z grupy B' },
  { id: 'final',       phase: 'playoff', order: 8, team_a: null, team_b: null, label: 'Finał',              placeholder: '1 z grupy A vs 1 z grupy B' }
];

// Oblicza standings dla grupy z listy meczow (rozegranych).
// matchesById: { 'A1': {score_a, score_b}, ... }
// Zwraca tablice: [{ team, played, wins, scored, conceded, points }] posortowane (1 miejsce pierwsze).
function computeFlankiStandings(groupName, matchesById) {
  const teams = FLANKI_GROUPS[groupName] || [];
  const groupMatches = FLANKI_SCHEDULE.filter(m => m.phase === 'group' && m.group === groupName);
  const stats = teams.map(t => ({ team: t, played: 0, wins: 0, scored: 0, conceded: 0 }));
  const byTeam = Object.fromEntries(stats.map(s => [s.team, s]));

  groupMatches.forEach(m => {
    const r = matchesById[m.id];
    if (!r || r.score_a == null || r.score_b == null) return;
    const a = byTeam[m.team_a], b = byTeam[m.team_b];
    if (!a || !b) return;
    a.played++; b.played++;
    a.scored += r.score_a; a.conceded += r.score_b;
    b.scored += r.score_b; b.conceded += r.score_a;
    if (r.score_a > r.score_b) a.wins++;
    else if (r.score_b > r.score_a) b.wins++;
  });

  // Sort: wins desc, head-to-head, bilans (scored-conceded) desc, scored desc, alfabetycznie
  stats.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    // head-to-head: szukamy meczu miedzy nimi
    const h2h = groupMatches.find(m =>
      (m.team_a === x.team && m.team_b === y.team) ||
      (m.team_a === y.team && m.team_b === x.team)
    );
    const r = h2h ? matchesById[h2h.id] : null;
    if (r && r.score_a != null && r.score_b != null) {
      const xScore = h2h.team_a === x.team ? r.score_a : r.score_b;
      const yScore = h2h.team_a === y.team ? r.score_a : r.score_b;
      if (xScore !== yScore) return yScore - xScore;
    }
    const xDiff = x.scored - x.conceded, yDiff = y.scored - y.conceded;
    if (yDiff !== xDiff) return yDiff - xDiff;
    if (y.scored !== x.scored) return y.scored - x.scored;
    return x.team.localeCompare(y.team, 'pl');
  });

  return stats;
}

// =========================
// HELPERY
// =========================

// Znajduje druzyne danego uczestnika (po normalizacji nazwiska).
// Tolerujemy: drobne literowki, kropki, polskie znaki.
function normalizePersonName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diakrytyki
    .replace(/[.\s]+$/, '')                            // strip trailing kropek/spacji
    .trim();
}

function personToTeam(name) {
  if (!name) return null;
  const n = normalizePersonName(name);
  for (const team of TEAMS) {
    if (team.members.some(m => normalizePersonName(m) === n)) {
      return team.name;
    }
  }
  return null; // np. Natalia, Piter, Ganja — bez druzyny
}

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

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Generyczny GET do PostgREST (bypass SDK)
async function pgGet(path) {
  const token = window.alkoAuth?.getAccessToken?.();
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

// Generyczny upsert/delete do PostgREST
async function pgSend(method, path, body) {
  const token = window.alkoAuth?.getAccessToken?.();
  if (!token) return { error: { message: 'Brak tokena.' } };
  const url = window.SUPABASE_CONFIG.url + '/rest/v1/' + path;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      method,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    clearTimeout(tid);
    if (!res.ok) return { error: { message: `HTTP ${res.status}: ${await res.text()}` } };
    return { error: null };
  } catch (err) {
    clearTimeout(tid);
    return { error: { message: err.name === 'AbortError' ? 'TIMEOUT' : err.message } };
  }
}
