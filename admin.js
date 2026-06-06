// === Admin dashboard ===
// Sprawdza czy user to admin i pokazuje narzedzia.
// Korzysta z ADMIN_EMAIL z data.js.

(function () {
  const gateLogin = document.getElementById('admin-gate-login');
  const gateForbidden = document.getElementById('admin-gate-forbidden');
  const tools = document.getElementById('admin-tools');
  if (!tools) return;

  if (!window.alkoAuth || !window.alkoAuth.configured) {
    gateForbidden.hidden = false;
    gateForbidden.querySelector('p').textContent =
      'Backend Supabase nie jest skonfigurowany. Zobacz SUPABASE_SETUP.md';
    return;
  }

  function refreshFor(user) {
    if (!user) {
      gateLogin.hidden = false;
      gateForbidden.hidden = true;
      tools.hidden = true;
      return;
    }
    if (user.email !== ADMIN_EMAIL) {
      gateLogin.hidden = true;
      gateForbidden.hidden = false;
      tools.hidden = true;
      return;
    }
    gateLogin.hidden = true;
    gateForbidden.hidden = true;
    tools.hidden = false;
  }

  window.alkoAuth.onAuthChange(refreshFor);
})();
