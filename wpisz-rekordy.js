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

  function fillHolderDatalist(datalist) {
    // Podpowiedzi: uczestnicy + druzyny + historyczni rekordziści (dodajemy po imporcie).
    const all = [...PARTICIPANTS, ...TEAMS.map(t => t.name)];
    datalist.innerHTML = all.map(n => `<option value="${escapeHTML(n)}">`).join('');
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
          ${r.set_at ? ` • ${new Date(r.set_at).getFullYear()}` : ''}
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
    // Rok -> data 1 stycznia danego roku (kolumna w bazie to nadal DATE).
    const yearStr = fd.get('year');
    if (yearStr) {
      const y = parseInt(yearStr, 10);
      if (!isNaN(y) && y >= 1900 && y <= 2100) {
        payload.set_at = `${y}-01-01`;
      }
    }
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
    fillHolderDatalist(document.getElementById('holder-suggestions'));
    const importBtn = document.getElementById('btn-import-history');
    if (importBtn && !importBtn._wired) {
      importBtn._wired = true;
      importBtn.addEventListener('click', handleImportHistory);
    }
  }

  async function handleImportHistory() {
    const btn = document.getElementById('btn-import-history');
    if (!confirm('Importować historyczne wyniki Sprint na 500 z arkusza? Duplikaty zostaną pominięte.')) return;
    btn.disabled = true;
    const oldLabel = btn.textContent;
    btn.textContent = 'Importuję...';

    try {
      if (typeof fetchCSV !== 'function' || typeof SHEET_URL_REKORDY === 'undefined') {
        throw new Error('Brakuje fetchCSV / SHEET_URL_REKORDY (scripts.js)');
      }
      const rows = await fetchCSV(SHEET_URL_REKORDY);
      if (rows.length < 3) throw new Error('Arkusz ma za mało wierszy.');
      const eventHeader = rows[0] || [];
      const yearHeader  = rows[1] || [];
      const dataRows    = rows.slice(2).filter(r => r.some(Boolean));

      // Znajdź kolumny Sprint na 500
      const sprintCols = eventHeader
        .map((eventName, idx) => ({ eventName, idx, year: parseInt(String(yearHeader[idx] || '').trim(), 10) }))
        .filter(c => String(c.eventName).toLowerCase().includes('sprint na 500') && Number.isFinite(c.year));

      if (!sprintCols.length) throw new Error('Brak kolumn z "Sprint na 500" + roku.');

      // Zbuduj liste rekordow do wstawienia
      const toInsert = [];
      sprintCols.forEach(col => {
        dataRows.forEach(row => {
          const holder = String(row[0] || '').trim();
          const rawVal = String(row[col.idx] || '').replace(',', '.').trim();
          const v = parseFloat(rawVal);
          if (!holder || isNaN(v) || v <= 0) return;
          toInsert.push({
            competition: 'sprint500',
            holder,
            value: v,
            unit: 'sek',
            set_at: `${col.year}-01-01`,
            notes: 'Import historyczny',
            updated_at: new Date().toISOString()
          });
        });
      });

      if (!toInsert.length) throw new Error('Nic do zaimportowania.');

      // Eliminuj duplikaty (holder + year + value identyczne jak juz w bazie)
      const existingKey = r => `${(r.holder||'').toLowerCase()}|${r.set_at}|${parseFloat(r.value)}`;
      const existingKeys = new Set(records.map(existingKey));
      const fresh = toInsert.filter(r => !existingKeys.has(existingKey(r)));

      if (!fresh.length) {
        showToast(`Wszystkie ${toInsert.length} rekordy już są w bazie.`, 'info');
        btn.disabled = false; btn.textContent = oldLabel;
        return;
      }

      // Wsadz hurtem
      const token = window.alkoAuth.getAccessToken();
      const url = window.SUPABASE_CONFIG.url + '/rest/v1/records';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(fresh)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      showToast(`✓ Zaimportowano ${fresh.length} rekordów (pominięto ${toInsert.length - fresh.length} duplikatów).`, 'success');
      await loadRecords();
    } catch (err) {
      console.error('[wpisz-rekordy] import:', err);
      showToast('Błąd importu: ' + (err.message || err), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = oldLabel;
    }
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
