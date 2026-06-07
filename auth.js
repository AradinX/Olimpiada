// === Alkoolimpiada Auth ===
// Wymaga zaladowanych wczesniej: supabase-js (CDN) + supabase-config.js
//
// Eksport:
//   window.alkoAuth = {
//     client,                 // klient Supabase
//     getUser(),              // { id, email, displayName } | null
//     onAuthChange(callback), // subskrypcja zmian sesji
//     openModal(mode),        // 'login' | 'register'
//     signOut()
//   }

(function () {
  const cfg = window.SUPABASE_CONFIG;
  const configError = validateConfig(cfg);

  function validateConfig(c) {
    if (!c) return 'Brak window.SUPABASE_CONFIG — czy supabase-config.js jest zaladowany?';
    if (!c.url || c.url === 'TWOJ_URL') return 'URL nieuzupelniony w supabase-config.js';
    try {
      const u = new URL(c.url);
      if (u.protocol !== 'https:') return 'URL musi byc na https://';
      if (!/\.supabase\.(co|in)$/i.test(u.hostname)) {
        return 'URL ma zly format. Powinien wygladac tak: https://xxxxx.supabase.co (bez sciezki na koncu).';
      }
      c.url = u.origin; // wycinamy ewentualna sciezke i trailing slash
    } catch {
      return 'URL nie jest poprawnym adresem.';
    }
    if (!c.anonKey || c.anonKey === 'TWOJ_ANON_KEY') return 'anonKey nieuzupelniony';
    const looksLikeJwt = c.anonKey.startsWith('eyJ');
    const looksLikePublishable = c.anonKey.startsWith('sb_publishable_');
    if (!looksLikeJwt && !looksLikePublishable) {
      return 'anonKey nie wyglada na poprawny klucz. Powinien zaczynac sie od "eyJ..." (JWT) albo "sb_publishable_..." (nowy format). Sprawdz Project Settings -> API -> Project API keys.';
    }
    return null;
  }

  if (configError) {
    console.warn('[alkoAuth]', configError);
    setupBrokenUi(configError);
    return;
  }
  if (typeof window.supabase === 'undefined') {
    const msg = 'Biblioteka supabase-js niezaladowana (sprawdz polaczenie z internetem i tag <script> z cdn.jsdelivr.net).';
    console.error('[alkoAuth]', msg);
    setupBrokenUi(msg);
    return;
  }

  let client;
  try {
    client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  } catch (err) {
    const msg = 'Nie udalo sie utworzyc klienta Supabase: ' + err.message;
    console.error('[alkoAuth]', msg);
    setupBrokenUi(msg);
    return;
  }

  function setupBrokenUi(message) {
    function mount() {
      mountNavButtonRaw(() => alert('Konfiguracja Supabase niepoprawna:\n\n' + message + '\n\nZobacz SUPABASE_SETUP.md'));
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount);
    } else {
      mount();
    }
    window.alkoAuth = { configured: false, error: message };
  }

  function mountNavButtonRaw(onClick) {
    const navList = document.querySelector('.navbar .nav-links');
    const templeNav = document.querySelector('.temple-nav');
    if (navList && !navList.querySelector('.auth-nav-item')) {
      const li = document.createElement('li');
      li.className = 'auth-nav-item';
      li.innerHTML = '<button type="button" class="auth-nav-btn">Zaloguj</button>';
      navList.appendChild(li);
      li.querySelector('button').addEventListener('click', onClick);
    }
    if (templeNav && !templeNav.querySelector('.auth-temple-wrap')) {
      const wrap = document.createElement('span');
      wrap.className = 'auth-temple-wrap';
      wrap.innerHTML = '<a href="#">Zaloguj</a>';
      templeNav.appendChild(wrap);
      wrap.querySelector('a').addEventListener('click', e => { e.preventDefault(); onClick(); });
    }
  }

  let currentUser = null;
  let cachedAccessToken = null;
  const listeners = new Set();

  function broadcast() {
    listeners.forEach(fn => {
      try { fn(currentUser); } catch (e) { console.error(e); }
    });
  }

  async function loadProfile(userId) {
    const { data, error } = await client
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    if (error) console.warn('[alkoAuth] profil:', error.message);
    return data?.display_name || null;
  }

  async function setSession(session) {
    if (!session?.user) {
      currentUser = null;
      cachedAccessToken = null;
      broadcast();
      return;
    }
    cachedAccessToken = session.access_token;
    // Najpierw broadcast z szybkimi danymi (email-fallback), zeby UI sie odswiezylo od razu.
    currentUser = {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.email.split('@')[0]
    };
    broadcast();
    // Potem w tle podmieniamy display_name z tabeli profiles (jesli istnieje).
    const displayName = await loadProfile(session.user.id);
    if (displayName && currentUser && currentUser.id === session.user.id) {
      currentUser.displayName = displayName;
      broadcast();
    }
  }

  let resolveReady;
  const ready = new Promise(r => { resolveReady = r; });

  // === Email-confirmation callback handler ===
  // Po kliknieciu linku z maila Supabase przekierowuje na nasza strone z hashem
  // typu #access_token=...&refresh_token=...&type=signup
  // Ten kod parsuje hash, zapisuje sesje do localStorage w formacie Supabase v2
  // i czysci URL. Robimy to recznie bo SDK auth.* sie wiesza.
  function handleEmailCallback() {
    if (!window.location.hash || window.location.hash.length < 10) return null;
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if (!accessToken) return null;

    let payload;
    try {
      const base = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base + '==='.slice((base.length + 3) % 4);
      payload = JSON.parse(atob(padded));
    } catch (e) {
      console.warn('[alkoAuth] cannot decode JWT:', e);
      return null;
    }

    const expiresIn = parseInt(hashParams.get('expires_in'), 10) || 3600;
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken || '',
      token_type: hashParams.get('token_type') || 'bearer',
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      user: {
        id: payload.sub,
        email: payload.email,
        aud: payload.aud,
        role: payload.role,
        app_metadata: payload.app_metadata || {},
        user_metadata: payload.user_metadata || {}
      }
    };

    // Supabase v2 trzyma sesje pod kluczem sb-{ref}-auth-token
    try {
      const ref = new URL(cfg.url).hostname.split('.')[0];
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
    } catch (e) { console.warn('[alkoAuth] storage write:', e); }

    // Wyczysc hash zeby refresh nie odpalal tego ponownie
    history.replaceState(null, '', window.location.pathname + window.location.search);

    console.log('[alkoAuth] email confirmation processed, session restored');
    return session;
  }

  const callbackSession = handleEmailCallback();

  if (callbackSession) {
    // Mamy swiezuteńka sesje z URL — odpal natychmiast
    setSession(callbackSession);
    resolveReady();
  } else {
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      resolveReady();
    });
  }
  client.auth.onAuthStateChange((_event, session) => setSession(session));

  // === Modal ===
  const MODAL_HTML = `
    <div class="auth-modal-backdrop" id="auth-modal" hidden>
      <div class="auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <button class="auth-modal-close" type="button" aria-label="Zamknij">&times;</button>
        <div class="auth-modal-tabs">
          <button type="button" data-tab="login" class="active">Zaloguj</button>
          <button type="button" data-tab="register">Zaloz konto</button>
        </div>
        <h2 id="auth-modal-title" class="auth-modal-title">Witaj z powrotem</h2>
        <p class="auth-modal-error" id="auth-modal-error" hidden></p>

        <form id="auth-login-form" class="auth-form" novalidate>
          <label>Email
            <input type="email" name="email" autocomplete="email" required>
          </label>
          <label>Haslo
            <input type="password" name="password" autocomplete="current-password" required>
          </label>
          <button type="submit" class="auth-submit">Zaloguj sie</button>
        </form>

        <form id="auth-register-form" class="auth-form" hidden novalidate>
          <label>Nick (widoczny przy zakladach)
            <input type="text" name="display_name" maxlength="30" required>
          </label>
          <label>Email
            <input type="email" name="email" autocomplete="email" required>
          </label>
          <label>Haslo (min. 6 znakow)
            <input type="password" name="password" autocomplete="new-password" minlength="6" required>
          </label>
          <button type="submit" class="auth-submit">Zaloz konto</button>
        </form>
      </div>
    </div>
  `;

  function mountModal() {
    if (document.getElementById('auth-modal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = MODAL_HTML;
    document.body.appendChild(wrap.firstElementChild);

    const modal = document.getElementById('auth-modal');
    const closeBtn = modal.querySelector('.auth-modal-close');
    const tabs = modal.querySelectorAll('.auth-modal-tabs button');
    const loginForm = modal.querySelector('#auth-login-form');
    const registerForm = modal.querySelector('#auth-register-form');
    const title = modal.querySelector('#auth-modal-title');
    const errorBox = modal.querySelector('#auth-modal-error');

    function showError(msg) {
      errorBox.textContent = msg;
      errorBox.hidden = !msg;
    }

    function switchTab(mode) {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === mode));
      loginForm.hidden = mode !== 'login';
      registerForm.hidden = mode !== 'register';
      title.textContent = mode === 'login' ? 'Witaj z powrotem' : 'Dolacz do areny';
      showError('');
    }

    tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = new FormData(loginForm);
      const submit = loginForm.querySelector('.auth-submit');
      submit.disabled = true; submit.textContent = 'Loguje...'; showError('');
      const { error } = await client.auth.signInWithPassword({
        email: data.get('email'),
        password: data.get('password')
      });
      submit.disabled = false; submit.textContent = 'Zaloguj sie';
      if (error) return showError(translateError(error.message));
      closeModal();
    });

    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = new FormData(registerForm);
      const submit = registerForm.querySelector('.auth-submit');
      submit.disabled = true; submit.textContent = 'Tworze...'; showError('');
      const { error } = await client.auth.signUp({
        email: data.get('email'),
        password: data.get('password'),
        options: { data: { display_name: data.get('display_name').trim() } }
      });
      submit.disabled = false; submit.textContent = 'Zaloz konto';
      if (error) return showError(translateError(error.message));
      // Jesli Confirm email wylaczone -> sesja od razu. Jesli wlaczone -> info.
      const { data: sessionData } = await client.auth.getSession();
      if (sessionData.session) {
        closeModal();
      } else {
        showError('Konto utworzone. Sprawdz email i kliknij link aktywacyjny.');
      }
    });

    modal.__switchTab = switchTab;
  }

  function translateError(msg) {
    if (!msg) return 'Cos poszlo nie tak.';
    if (/invalid login/i.test(msg)) return 'Zly email lub haslo.';
    if (/already registered/i.test(msg)) return 'Konto o tym emailu juz istnieje.';
    if (/password should be/i.test(msg)) return 'Haslo zbyt slabe (min. 6 znakow).';
    if (/rate limit/i.test(msg)) return 'Za duzo prob, sprobuj za chwile.';
    return msg;
  }

  function openModal(mode = 'login') {
    mountModal();
    const modal = document.getElementById('auth-modal');
    modal.hidden = false;
    document.body.classList.add('auth-modal-open');
    modal.__switchTab(mode);
    const firstInput = modal.querySelector('form:not([hidden]) input');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }

  function closeModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('auth-modal-open');
  }

  async function signOut() {
    console.log('[alkoAuth] signOut start');
    // SDK Supabase wisi na auth.signOut(), wiec czyscimy localStorage recznie
    // i sami powiadamiamy listenery — UI natychmiast wraca do stanu wylogowanego.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) { console.warn('[alkoAuth] clear storage:', e); }

    currentUser = null;
    cachedAccessToken = null;
    broadcast();

    // Best-effort: powiadom serwer Supabase zeby uniewaznil token.
    // Z timeoutem, zeby nie blokowac UI gdy SDK znowu zawisnie.
    Promise.race([
      client.auth.signOut(),
      new Promise(resolve => setTimeout(resolve, 1500))
    ]).catch(() => {});
  }

  // === Nav button ===
  function mountNavButton() {
    const navList = document.querySelector('.navbar .nav-links');
    // 2026-06-07: index uzywa teraz standardowego navbara — auth-temple-corner
    // zostaje wylaczony (templeCorner = null). Stara sciezka temple-corner zachowana
    // jako no-op jakby ktos chcial wrocic.
    const templeCorner = null;

    if (navList && !navList.querySelector('.auth-nav-item')) {
      const li = document.createElement('li');
      li.className = 'auth-nav-item';
      li.innerHTML = `
        <button type="button" class="auth-nav-btn" data-auth-login>Zaloguj</button>
        <div class="auth-nav-user" hidden>
          <button type="button" class="auth-nav-trigger" data-auth-trigger>
            <span class="auth-nav-name"></span>
            <span class="auth-nav-caret" aria-hidden="true">▾</span>
          </button>
          <div class="auth-nav-menu" hidden>
            <button type="button" class="auth-nav-logout" data-auth-logout>Wyloguj</button>
          </div>
        </div>
      `;
      navList.appendChild(li);
    }

    if (templeCorner && !templeCorner.querySelector('[data-auth-login]')) {
      const wrap = document.createElement('span');
      wrap.className = 'auth-temple-wrap';
      wrap.innerHTML = `
        <a href="#" data-auth-login>Zaloguj</a>
        <span class="auth-temple-user" hidden>
          <button type="button" class="auth-temple-trigger" data-auth-trigger>
            <span data-auth-name></span>
            <span class="auth-temple-caret" aria-hidden="true">▾</span>
          </button>
          <div class="auth-temple-menu" hidden>
            <button type="button" class="auth-temple-logout" data-auth-logout>Wyloguj</button>
          </div>
        </span>
      `;
      templeCorner.appendChild(wrap);
    }

    document.querySelectorAll('[data-auth-login]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); openModal('login'); });
    });
    document.querySelectorAll('[data-auth-logout]').forEach(el => {
      el.addEventListener('click', e => {
        console.log('[alkoAuth] logout clicked');
        e.preventDefault();
        e.stopPropagation();
        closeAllAuthMenus();
        signOut();
      });
    });
    document.querySelectorAll('[data-auth-trigger]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        toggleAuthMenu(el);
      });
    });

    // Klik gdziekolwiek poza menu → zamknij wszystkie otwarte
    if (!document.body.dataset.authMenuListener) {
      document.body.dataset.authMenuListener = '1';
      document.addEventListener('click', e => {
        if (!e.target.closest('.auth-nav-user, .auth-temple-user')) closeAllAuthMenus();
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeAllAuthMenus();
      });
    }
  }

  function toggleAuthMenu(trigger) {
    const container = trigger.closest('.auth-nav-user, .auth-temple-user');
    const menu = container.querySelector('.auth-nav-menu, .auth-temple-menu');
    const open = menu.hidden;
    closeAllAuthMenus();
    if (open) {
      menu.hidden = false;
      container.classList.add('open');
    }
  }

  function closeAllAuthMenus() {
    document.querySelectorAll('.auth-nav-menu, .auth-temple-menu').forEach(m => { m.hidden = true; });
    document.querySelectorAll('.auth-nav-user, .auth-temple-user').forEach(c => c.classList.remove('open'));
  }

  const ADMIN_EMAIL_NAV = 'xaradinx@gmail.com';

  function toggleAdminLink(user) {
    const isAdmin = !!(user && user.email === ADMIN_EMAIL_NAV);
    // Klasyczny navbar (greek-page)
    document.querySelectorAll('.navbar .nav-links').forEach(navList => {
      let adminLi = navList.querySelector('.auth-admin-item');
      if (isAdmin && !adminLi) {
        adminLi = document.createElement('li');
        adminLi.className = 'auth-admin-item';
        adminLi.innerHTML = '<a href="admin.html" class="auth-admin-link">⚙ Admin</a>';
        // Wstaw przed itemem z loginiem zeby byl po prawej kolejny
        const authItem = navList.querySelector('.auth-nav-item');
        if (authItem) navList.insertBefore(adminLi, authItem);
        else navList.appendChild(adminLi);
      } else if (!isAdmin && adminLi) {
        adminLi.remove();
      }
    });
    // Temple nav (index.html)
    document.querySelectorAll('.temple-nav').forEach(tn => {
      let link = tn.querySelector('.auth-admin-temple-link');
      if (isAdmin && !link) {
        link = document.createElement('a');
        link.href = 'admin.html';
        link.className = 'auth-admin-temple-link';
        link.textContent = 'Admin';
        tn.appendChild(link);
      } else if (!isAdmin && link) {
        link.remove();
      }
    });
  }

  function renderAuthState(user) {
    toggleAdminLink(user);
    document.querySelectorAll('.auth-nav-item').forEach(item => {
      const btn = item.querySelector('.auth-nav-btn');
      const userBox = item.querySelector('.auth-nav-user');
      const nameEl = item.querySelector('.auth-nav-name');
      if (user) {
        btn.hidden = true;
        userBox.hidden = false;
        nameEl.textContent = user.displayName;
      } else {
        btn.hidden = false;
        userBox.hidden = true;
      }
    });
    document.querySelectorAll('.auth-temple-wrap').forEach(wrap => {
      const loginLink = wrap.querySelector('[data-auth-login]');
      const userBox = wrap.querySelector('.auth-temple-user');
      const nameEl = wrap.querySelector('[data-auth-name]');
      if (user) {
        loginLink.hidden = true;
        userBox.hidden = false;
        nameEl.textContent = user.displayName;
      } else {
        loginLink.hidden = false;
        userBox.hidden = true;
      }
    });
  }

  function init() {
    mountNavButton();
    renderAuthState(currentUser);
  }

  listeners.add(renderAuthState);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function readTokenFromStorage() {
    // Fallback: czytamy token wprost z localStorage gdy cachedAccessToken jeszcze nie ma.
    // Supabase v2 trzyma sesje pod kluczem typu: sb-{ref}-auth-token
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const raw = localStorage.getItem(k);
          const parsed = JSON.parse(raw);
          return parsed?.access_token || parsed?.currentSession?.access_token || null;
        }
      }
    } catch (e) { console.warn('[alkoAuth] read token storage:', e); }
    return null;
  }

  window.alkoAuth = {
    configured: true,
    client,
    ready,
    getUser: () => currentUser,
    getAccessToken: () => cachedAccessToken || readTokenFromStorage(),
    onAuthChange: fn => { listeners.add(fn); fn(currentUser); return () => listeners.delete(fn); },
    openModal,
    signOut
  };
})();
