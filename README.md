# Alkoolimpiada MMXXVI

Strona-eventowa Alkoolimpiady (25.07.2026, Sobin) z systemem konta, typowaniem konkurencji, klasyfikacjami, panelem admina i archiwum rekordów.

- **Stack:** statyczny HTML/CSS/JS hostowany na GitHub Pages
- **Backend:** Supabase (auth + Postgres + RLS)
- **Konfiguracja Supabase:** patrz [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
- **Konto admina:** `xaradinx@gmail.com` (auth-gated, RLS przy edycji)

## 📂 Struktura plików

```
index.html         — strona główna
wyniki.html        — klasyfikacja indywidualna uczestników
zespoly.html       — drużyny (6 ekip)
flanki.html        — turniej Flanków: grupy + harmonogram + drabinka
rekordy.html       — historyczne rekordy Sprint na 500
typuj.html         — typowanie konkurencji + klasyfikacja typujących
zazalenia.html     — formularz zgłaszania zażaleń

admin.html         — hub panelu admina (link tylko dla maila admina)
wpisz-wyniki.html  — wpisywanie top 3 dla każdej konkurencji
wpisz-rekordy.html — CRUD rekordów + import historyczny z Google Sheets
wpisz-flanki.html  — wpisywanie wyników meczów Flanków

data.js            — wspólne stałe (TEAMS, PARTICIPANTS, COMPETITIONS, opisy konkurencji)
auth.js            — logowanie/rejestracja, sesja, admin link injection
scripts.js         — countdown, ticker zażaleń, animacje
styles.css         — wszystkie style
```

## 📃 Publiczne strony

### 🏛️ `index.html` — Strona główna
Wizytówka imprezy w klimacie antycznego forum.

- **Nawigacja z brandem** (logo + tytuł na jednym pasku z linkami)
- **Hero** (parchmentowa karta arena-temple) z dwoma modułami:
  - **ALKOOLIMPIADA** — eyebrow „Edycja MMXXVI", tytuł, lead, dwa CTA
  - **Odliczanie do startu** — zegar dni/godz/min/sek
- **Top 5 medalistów** + **Rekord Sprint na 500** (auto z Supabase)
- **Konkurencje** (timeline 6 prób + plakat)
- **Ceremonia** (data + opis startu)
- **Mapa dojazdu** (klik → Google Maps)
- **Ticker zażaleń** u dołu strony

### 🏆 `wyniki.html` — Klasyfikacja indywidualna
Tabela uczestników posortowana wg medali zdobytych w 6 konkurencjach.

- Kolumny: Miejsce | Uczestnik | Drużyna | 6× konkurencja (medal emoji) | 🥇🥈🥉 | Suma
- **Mapowanie:** dla konkurencji drużynowych (Flanki, Spacer) medal idzie do każdego członka wygrywającej drużyny
- Mobilna wersja: tabela scrolluje horyzontalnie + cieniowanie po prawej
- Auto-refresh co 60s

### 👥 `zespoly.html` — Drużyny
6 małych tabel renderowanych z `TEAMS` w [data.js](data.js).

- Każda drużyna: nagłówek z numerem + lista członków
- Brak fetch z Google Sheets — dane hardcoded
- Edycja składu: edytuj `TEAMS` w `data.js` i pushnij

### ⚔️ `flanki.html` — Turniej Flanki
Pełny widok rozgrywek Flanki: 2 grupy po 3 drużyny, mecze grupowe + faza pucharowa.

- **Intro** z zasadami konkurencji
- **Tabele grup A i B** (Drużyna | M | Pkt) — sortowanie: zwycięstwa → bilans bezpośredni → różnica punktów
- **Harmonogram** podzielony na 3 kolejki (Kolejka 1: A1+B1, Kolejka 2: A2+B2, Kolejka 3: A3+B3), z battle-cards drużyn ze składami
- **Drabinka pucharowa** — Mecz o 3 miejsce + Finał (drużyny ustalają się automatycznie po zakończeniu grup)
- Auto-refresh co 30s

### 📜 `rekordy.html` — Rekordy
Historyczne rekordy Sprint na 500 (jedyna konkurencja śledzona historycznie).

- **Top 3 Sprint na 500** — najszybsze czasy ever, z medalami i rokiem ustanowienia
- **Pivot tabela** — kolumny: Uczestnik | 2026 | 2025 | 2024 | ... — w komórkach najlepszy czas tego zawodnika w danym roku
- Sortowanie: po najlepszym czasie z najnowszego roku ASC

### 🎯 `typuj.html` — Typowanie i klasyfikacja
Centrum aktywności społecznej — obstawianie wyników z punktacją.

- **Banner blokady czasowej** — odliczanie do startu eventu albo „🔒 Typowanie zamknięte"
- **Sekcja zasad i punktacji** (3 pkt za 1m, 2 pkt za 2m, 1 pkt za 3m, bonusy +5/+2 za podium)
- **🏆 Klasyfikacja typujących** — ranking z medalami (top 3), Twoja pozycja wyróżniona, breakdown po kliku
- **6 kart konkurencji**, w każdej:
  - Opis konkurencji (kursywa, bursztynowa kreska)
  - **Zielone podium z wynikami** (jeśli admin już je wpisał)
  - Formularz top 3 (3 dropdowny: 🥇/🥈/🥉)
  - Rozwijane „Aktualne typy" (kto co obstawił)
- Lock po `EVENT_START` (25.07.2026 16:00) — wszystkie dropdowny `disabled`
- Wymaga logowania (gating banner gdy niezalogowany)

### 📢 `zazalenia.html` — Zażalenia
Anonimowe (lub podpisane) zgłoszenia uwag.

- Formularz: imię + treść
- Zapisywane do Google Sheets przez Apps Script (legacy, działa)
- Po wysłaniu przekierowanie na index z fragmentem do tickera

## 🛠️ Panel admina

Wszystkie strony admina wymagają zalogowania jako `ADMIN_EMAIL`.

### 🎛️ `admin.html` — Dashboard
Hub z linkami do wszystkich narzędzi admina.

- **Wyniki konkurencji** → `wpisz-wyniki.html`
- **Rekordy sportowe** → `wpisz-rekordy.html`
- **Flanki — mecze grup i pucharu** → `wpisz-flanki.html`

Link „⚙ ADMIN" automatycznie pojawia się w navbarze gdy zalogowany jako admin (auto-injection przez `auth.js`).

### 🏁 `wpisz-wyniki.html` — Wpis top 3
6 kart, każda z 3 dropdownami (🥇/🥈/🥉) wypełnianymi z TEAMS lub PARTICIPANTS w zależności od typu konkurencji.

- Walidacja: 3 różne pozycje
- Karta zmienia kolor na zielony po wpisaniu
- Zapis → tabela `results` w Supabase → klasyfikacja typujących odświeża się automatycznie

### 📜 `wpisz-rekordy.html` — CRUD rekordów
- **Import historyczny** z Google Sheets (jednym kliknięciem) — czyta stary arkusz i wlewa do tabeli `records` z pominięciem duplikatów
- **Formularz dodawania** (konkurencja + rekordzista + wynik + jednostka + rok + notatki)
- **Lista istniejących** z buttonami Edytuj/Skasuj

### ⚔️ `wpisz-flanki.html` — Wyniki meczów
8 kart (6 grupowych + mecz o 3 miejsce + finał).

- Mecze grupowe: drużyny sztywne (z `FLANKI_SCHEDULE`), dropdowny 0-3 dla każdej drużyny
- Mecze pucharowe: dropdowny wyboru drużyn z **automatyczną sugestią** (na podstawie standings z grup)
- Walidacja: jedna drużyna musi mieć dokładnie 3 (brak remisów)
- Karta zmienia status na „zapisany" po wpisaniu wyniku
- Przycisk **Reset** kasuje wpis

## 🔐 System kont i RLS

- **Logowanie** przez email + hasło (Supabase Auth, bez confirmation email)
- **Rejestracja** otwarta dla każdego
- **Sesja** trzymana w `localStorage` (klucz `sb-{ref}-auth-token`)
- **Wszystkie operacje** czytają i piszą przez raw `fetch` do PostgREST (bypass SDK który ma bugi z hangiem)

**Tabele Supabase:**
- `profiles` — id + display_name (auto-trigger przy rejestracji)
- `bets` — typowania (user_id + competition + predicted_1st/2nd/3rd)
- `results` — wyniki konkurencji (competition + actual_1st/2nd/3rd)
- `records` — rekordy sportowe (competition + holder + value + year)
- `flanki_matches` — wyniki meczów Flanków (match_id + team_a/b + score_a/b)

**RLS (Row Level Security):**
- SELECT: dla wszystkich zalogowanych
- INSERT/UPDATE/DELETE na `results`, `records`, `flanki_matches`: tylko admin (sprawdzane przez `auth.jwt() ->> 'email'`)
- INSERT/UPDATE na `bets`: tylko własne rekordy (`auth.uid() = user_id`)

## 🎨 Klimat wizualny

- Antyczne forum (kremowy parchment, granatowe akcenty, bursztynowe linie)
- Font: **Cinzel** (tytuły) + **Source Sans 3** (treść)
- Mobilna responsywność — wszystkie strony testowane 320-2560px
- Dark mode: brak na razie

## 📞 Stack i deployment

1. **Static hosting**: GitHub Pages (auto-deploy z `main`)
2. **Auth & DB**: Supabase Free tier
3. **CDN**: jsdelivr (supabase-js)
4. **Cache busting**: `?v=N` na każdym pliku JS/CSS

## ⏭️ Plany na przyszłość

- [ ] Favicon + Open Graph meta tags
- [ ] PWA manifest (install na telefon)
- [ ] Strona 404
- [ ] Konfetti przy wpisaniu finału Flanków
- [ ] Statystyki edycji („rok w liczbach")
- [ ] Sprzątanie CSS (>5500 linii, dużo duplikatów po iteracjach)
