# Setup Supabase dla Alkoolimpiady

Instrukcja krok po kroku — od zera do działającego logowania.

## 1. Załóż projekt Supabase

1. Wejdź na [supabase.com](https://supabase.com) i kliknij **Start your project**.
2. Zaloguj się przez GitHub (najszybciej) albo email.
3. Kliknij **New project**. Wybierz organizację (domyślną), wpisz:
   - **Name**: `alkoolimpiada`
   - **Database password**: wygeneruj mocne hasło i ZAPISZ je w menedżerze haseł (nie będzie ci potrzebne na co dzień, ale gdy je stracisz, kiepsko)
   - **Region**: `Central EU (Frankfurt)` — najbliżej Polski
   - **Pricing Plan**: Free
4. Czekaj ~2 minuty aż projekt się utworzy.

## 2. Skopiuj URL i klucz API

W dashboardzie projektu:

1. W lewym sidebar kliknij ikonkę **koła zębatego** (Project Settings) → **API**.
2. Skopiuj dwie rzeczy:
   - **Project URL** (np. `https://xxxxx.supabase.co`)
   - **anon / public key** (długi JWT zaczynający się od `eyJ...`)

Te wartości wklej do pliku [supabase-config.js](supabase-config.js) — w miejsce `TWÓJ_URL` i `TWÓJ_ANON_KEY`.

> **Bezpieczeństwo**: anon key jest publiczny — można go bez obaw commitować do GitHuba. Ochronę zapewniają reguły Row Level Security w bazie (punkt 4). Nigdy nie wklejaj tu `service_role` key.

## 3. Włącz logowanie po emailu

1. Sidebar → **Authentication** → **Providers**.
2. Email powinien być już włączony. Jeśli nie — kliknij i włącz.
3. Sidebar → **Authentication** → **Sign In / Up** → **Email** → wyłącz **Confirm email** (na czas testów; włącz później, jak będzie produkcja). Bez tego użytkownik musi kliknąć link z maila przed pierwszym logowaniem.
4. Sidebar → **Authentication** → **URL Configuration**:
   - **Site URL**: `https://aradinx.github.io/Olimpiada/` (albo Twój własny URL, jeśli inny). Lokalnie dodaj jeszcze `http://localhost:5500` do **Redirect URLs**.

## 4. Zbuduj schemat bazy (tabele + RLS)

Sidebar → **SQL Editor** → **New query**. Wklej cały blok poniżej i kliknij **Run**.

```sql
-- === PROFILE ===
-- Rozszerzenie auth.users o publiczny nick i metadane
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profile czytalne dla wszystkich zalogowanych"
  on public.profiles for select
  to authenticated
  using (true);

create policy "tworze tylko swoj profil"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "edytuje tylko swoj profil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-tworzenie profilu po rejestracji
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- === ZAKLADY ===
-- Jeden uzytkownik = jeden zaklad na konkurencje (unique constraint)
-- Typowanie podium: 1., 2. i 3. miejsce osobno.
create table public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competition text not null,            -- np. 'flanki', 'beerpong', 'sprint500'
  predicted_winner text,                -- legacy (nieuzywane, zostawione dla migracji)
  predicted_1st text,
  predicted_2nd text,
  predicted_3rd text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, competition)
);

alter table public.bets enable row level security;

create policy "kazdy widzi wszystkie zaklady"
  on public.bets for select
  to authenticated
  using (true);

create policy "stawiam zaklad tylko jako ja"
  on public.bets for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "zmieniam tylko swoj zaklad"
  on public.bets for update
  to authenticated
  using (auth.uid() = user_id);

create policy "kasuje tylko swoj zaklad"
  on public.bets for delete
  to authenticated
  using (auth.uid() = user_id);
```

## 5. Test

1. Otwórz `index.html` w przeglądarce (najlepiej przez Live Server VSCode, nie `file://`).
2. Kliknij **Zaloguj** w nawigacji → **Załóż konto** → wpisz email + hasło + nick.
3. Po rejestracji powinieneś być automatycznie zalogowany, a w nawigacji w miejscu **Zaloguj** powinien pojawić się Twój nick.
4. W dashboardzie Supabase: **Table Editor** → **profiles** → powinien tam być Twój wpis.

## 6. Co dalej

- Strona `typuj.html` — tu wbudowane jest miejsce na obstawianie konkurencji. Zaczniesz od edycji listy konkurencji wewnątrz pliku.
- Gdy będziesz gotów wejść na produkcję — włącz z powrotem **Confirm email** w Supabase, żeby nie zakładali Ci kont boty.

---

## MIGRACJE — uruchom jeśli baza była już utworzona przed wersją top-3

### 2026-06-05: typowanie top 3 (złoto/srebro/brąz)

Schemat z punktu 4 przewidywał tylko jedno pole `predicted_winner`. Wersja typowania
podium wymaga 3 osobnych kolumn. Wejdź w **SQL Editor → New query** i uruchom:

```sql
alter table public.bets
  alter column predicted_winner drop not null,
  add column if not exists predicted_1st text,
  add column if not exists predicted_2nd text,
  add column if not exists predicted_3rd text;
```

Po migracji `predicted_winner` zostaje w bazie (dla historii), ale aplikacja zapisuje
i czyta wyłącznie `predicted_1st`, `predicted_2nd`, `predicted_3rd`.

### 2026-06-06: tabela results (klasyfikacja typujących)

Żeby liczyć punkty, potrzebujemy znać prawdziwe wyniki każdej konkurencji.
Wejdź w **SQL Editor → New query** i uruchom:

```sql
create table public.results (
  competition text primary key,
  actual_1st text not null,
  actual_2nd text not null,
  actual_3rd text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.results enable row level security;

create policy "wyniki czytalne dla zalogowanych"
  on public.results for select
  to authenticated
  using (true);

create policy "admin moze wpisywac wyniki"
  on public.results for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') = 'xaradinx@gmail.com');

create policy "admin moze edytowac wyniki"
  on public.results for update
  to authenticated
  using ((auth.jwt() ->> 'email') = 'xaradinx@gmail.com');
```

**Jak wpisywać wyniki:** wejdź na `/wpisz-wyniki.html` (link nie jest w nawigacji,
wpisz URL bezpośrednio i dodaj do zakładek na telefonie). Tylko Twój email
(`xaradinx@gmail.com`) ma uprawnienia do zapisu — inni dostaną banner „brak uprawnień".

Klasyfikacja typujących na typuj.html odświeży się automatycznie po zapisie.

### 2026-06-06: tabela records (rekordy sportowe)

```sql
create table public.records (
  id uuid primary key default gen_random_uuid(),
  competition text not null,    -- np. 'sprint500', 'napol', 'smakosz', 'inwestor'
  holder text not null,         -- kto ustanowil rekord
  value numeric not null,       -- wartosc rekordu
  unit text default '',         -- 'sek', 'sztuk', 'ml' itd.
  set_at date,                  -- kiedy ustanowiony (opcjonalne)
  notes text default '',        -- ewentualne dopiski
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.records enable row level security;

create policy "rekordy czytalne dla zalogowanych"
  on public.records for select to authenticated using (true);

create policy "admin moze wpisywac rekordy"
  on public.records for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'xaradinx@gmail.com');

create policy "admin moze edytowac rekordy"
  on public.records for update to authenticated
  using ((auth.jwt() ->> 'email') = 'xaradinx@gmail.com');

create policy "admin moze kasowac rekordy"
  on public.records for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'xaradinx@gmail.com');
```

**Jak zarządzać rekordami:** strona `/wpisz-rekordy.html` (też dostępna z `/admin.html`).
