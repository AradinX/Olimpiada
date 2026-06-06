// === Admin: zarzadzanie rekordami ===
// CRUD na tabeli records w Supabase.

(function () {
  const gateLogin = document.getElementById('rekord-gate-login');
  const gateForbidden = document.getElementById('rekord-gate-forbidden');
  const adminWrap = document.getElementById('rekord-admin');
  const newForm = document.getElementById('rekord-new-form');
  const listEl = document.getElementById('rekord-list');
  if (!adminWrap || !newForm || !listEl) return;

  if (!window.alkoAuth || !window.alkoAuth.configured) {
    gateForbidden.hidden = false;
    gateForbidden.querySelector('p').textContent = 'Backend Supabase nie jest skonfigurowany.';
    return;
  }

  let records = [];

  function showToast(message, kind) {
    let toast = document.getElementById('rekord-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'rekord-toast';
      toast.className = 'typuj-toast';
      document.body.appendChild(toast);
    }
    toast.className = 'typuj-toast ' + (kind || 'info');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, kind === 'error' ? 8000 : 3500);
  }

  function fillCompetitionDropdown(select) {
    select.innerHTML = '<option value="" disabled selected>— wybierz —</option>' +
      COMPETITIONS.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join('');
  }

  function fillHolderDropdown(select) {
    // Wszyscy uczestnicy + nazwy druzyn (na wypadek gdyby rekord dotyczyl druzyny)
    const all = [...PARTICIPANTS, ...TEAMS.map(t => t.name)];
    select.innerHTML = '<option value="" disabled selected>— wybierz —</option>' +
      all.map(n => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join('');
  }

  function compName(id) {
    const c = COMPETITIONS.find(x => x.id === id);
    return c ? c.name : id;
  }

  async function loadRecords() {
    const { data, error } = await pgGet('records?select=id,competition,holder,value,unit,set_at,notes&order=competition.asc,value.asc');
    if (error) {
      console.error('[wpisz-rekordy] load:', error.message);
      showToast('Blad ladowania: ' + error.message, 'error');
      return;
    }
    records = data || [];
    renderList();
  }

  function renderList() {
    if (!records.length) {
      listEl.innerHTML = '<p style="color:#a7adbb;font-style:italic;">Brak rekordów. Dodaj pierwszy formularzem wyżej.</p>';
      return;
    }
    listEl.innerHTML = records.map(r => `
      <article class="wynik-card" data-id="${escapeHTML(r.id)}">
        <div class="wynik-card-head">
          <h3>${escapeHTML(compName(r.competition))}</h3>
          <span class="wynik-card-tag">${escapeHTML(r.holder)}</span>
        </div>
        <p style="color:#1f2f44;font-size:0.95rem;">
          <strong>${escapeHTML(String(r.value))}${r.unit ? ' ' + escapeHTML(r.unit) : ''}</strong>
          ${r.set_at ? ` • ${escapeHTML(new Date(r.set_at).toLocaleDateString('pl-PL'))}` : ''}
          ${r.notes ? `<br><em>${escapeHTML(r.notes)}</em>` : ''}
        </p>
        <div class="wynik-actions" style="gap:8px;">
          <button type="button" data-edit="${escapeHTML(r.id)}" style="background:#3a4a60;">Edytuj</button>
          <button type="button" data-delete="${escapeHTML(r.id)}" style="background:#b32f2f;">Skasuj</button>
        </div>
      </article>
    `).join('');
    listEl.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', handleEdit));
    listEl.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', handleDelete));
  }

  function buildPayload(form) {
    const fd = new FormData(form);
    const payload = {
      competition: fd.get('competition'),
      holder: fd.get('holder'),
      value: parseFloat(fd.get('value')),
      unit: (fd.get('unit') || '').trim(),
      notes: (fd.get('notes') || '').trim(),
      updated_at: new Date().toISOString()
    };
    const setAt = fd.get('set_at');
    if (setAt) payload.set_at = setAt;
    return payload;
  }

  async function pgUpsert(payload) {
    const token = window.alkoAuth.getAccessToken();
    if (!token) return { error: { message: 'Brak tokena.' } };
    const url = window.SUPABASE_CONFIG.url + '/rest/v1/records';
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      });
      clearTimeout(tid);
      if (!res.ok) return { error: { message: `HTTP ${res.status}: ${await res.text()}` } };
      return { error: null };
    } catch (err) {
      clearTimeout(tid);
      return { error: { message: err.message } };
    }
  }

  async function pgPatch(id, payload) {
    const token = window.alkoAuth.getAccessToken();
    const url = window.SUPABASE_CONFIG.url + '/rest/v1/records?id=eq.' + encodeURIComponent(id);
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) return { error: { message: `HTTP ${res.status}: ${await res.text()}` } };
      return { error: null };
    } catch (err) { return { error: { message: err.message } }; }
  }

  async function pgDelete(id) {
    const token = window.alkoAuth.getAccessToken();
    const url = window.SUPABASE_CONFIG.url + '/rest/v1/records?id=eq.' + encodeURIComponent(id);
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'apikey': window.SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) return { error: { message: `HTTP ${res.status}: ${await res.text()}` } };
      return { error: null };
    } catch (err) { return { error: { message: err.message } }; }
  }

  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submit = newForm.querySelector('button[type="submit"]');
    const feedback = newForm.querySelector('[data-feedback]');
    const payload = buildPayload(newForm);
    if (!payload.competition || !payload.holder || isNaN(payload.value)) {
      feedback.textContent = 'Uzupelnij konkurencje, rekordziste i wynik.';
      feedback.classList.add('error');
      return;
    }
    submit.disabled = true;
    feedback.textContent = 'Zapisuje...';
    feedback.classList.remove('error');
    const { error } = await pgUpsert(payload);
    submit.disabled = false;
    if (error) {
      feedback.textContent = 'Blad: ' + error.message;
      feedback.classList.add('error');
      showToast('Blad zapisu. Sprawdz F12.', 'error');
      console.error('[wpisz-rekordy] insert:', error);
      return;
    }
    feedback.textContent = '✓ Zapisane.';
    showToast('✓ Rekord dodany.', 'success');
    newForm.reset();
    await loadRecords();
  });

  async function handleEdit(e) {
    const id = e.currentTarget.dataset.edit;
    const record = records.find(r => r.id === id);
    if (!record) return;
    const newValue = prompt(`Nowy wynik dla "${record.holder}" w "${compName(record.competition)}":`, record.value);
    if (newValue === null) return;
    const v = parseFloat(newValue);
    if (isNaN(v)) { showToast('Wynik musi byc liczba.', 'error'); return; }
    const { error } = await pgPatch(id, { value: v, updated_at: new Date().toISOString() });
    if (error) { showToast('Blad edycji: ' + error.message, 'error'); return; }
    showToast('✓ Zaktualizowane.', 'success');
    await loadRecords();
  }

  async function handleDelete(e) {
    const id = e.currentTarget.dataset.delete;
    const record = records.find(r => r.id === id);
    if (!record) return;
    if (!confirm(`Skasować rekord "${record.holder}" w "${compName(record.competition)}"?`)) return;
    const { error } = await pgDelete(id);
    if (error) { showToast('Blad: ' + error.message, 'error'); return; }
    showToast('✓ Skasowane.', 'success');
    await loadRecords();
  }

  function init() {
    fillCompetitionDropdown(newForm.querySelector('[name="competition"]'));
    fillHolderDropdown(newForm.querySelector('[name="holder"]'));
  }

  function refreshFor(user) {
    if (!user) {
      gateLogin.hidden = false;
      gateForbidden.hidden = true;
      adminWrap.hidden = true;
      return;
    }
    if (user.email !== ADMIN_EMAIL) {
      gateLogin.hidden = true;
      gateForbidden.hidden = false;
      adminWrap.hidden = true;
      return;
    }
    gateLogin.hidden = true;
    gateForbidden.hidden = true;
    adminWrap.hidden = false;
    init();
    loadRecords();
  }

  window.alkoAuth.onAuthChange(refreshFor);
})();
