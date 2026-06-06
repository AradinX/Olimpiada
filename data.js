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
  { name: 'Druzyna 2', members: ['Piotr', 'Andzia', 'Mati', 'Jepka'] },
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
  'Rosa', 'Kamila', 'Kotka', 'Maro', 'Bartosz', 'Zelek', 'Mati', 'Piter',
  'Barwa', 'Ganja', 'Michu', 'Sopel', 'Patrycja', 'Asia'
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
