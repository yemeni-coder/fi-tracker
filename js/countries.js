/* ════════════════════════════════════════════════
   js/countries.js
   Countries page — role-aware panel
   Admin: full edit/delete/add access
   Viewer: read-only, no action buttons
════════════════════════════════════════════════ */

window.ACTIVE_COUNTRY = null;
window.CT_NEW_LINKS   = [];

const CT_TX_TYPES   = ['Cash','Bank Transfer','Mobile Wallet','Card','SWIFT','ACH','Airtime','Home Delivery','Wire'];
const CT_CURRENCIES = ['TRY','EUR','USD','GBP','AED','SAR','CHF','JPY','CAD','AUD'];
const CT_SEGMENTS   = ['C2C','B2C','B2B','C2B','G2C','C2G'];
const CT_DIRECTIONS = [
  { value: 'send',    label: '→ Send only'    },
  { value: 'receive', label: '← Receive only' },
  { value: 'both',    label: '⇄ Both ways'    }
];

/* ════════════════════════════════════════════════
   RENDER A-Z INDEX
════════════════════════════════════════════════ */
function renderCountries(filter = '') {
  const allCountries = window.ALL_COUNTRIES;

  if (!allCountries || allCountries.length === 0) {
    document.getElementById('alpha-jump').innerHTML = '';
    document.getElementById('ct-index').innerHTML =
      `<div class="empty-state"><div class="empty-icon">🌍</div><p>No countries found</p></div>`;
    return;
  }

  const filtered = allCountries.filter(ct =>
    ct.name.toLowerCase().includes(filter.toLowerCase())
  );

  if (!filtered.length) {
    document.getElementById('alpha-jump').innerHTML = '';
    document.getElementById('ct-index').innerHTML =
      `<div class="empty-state"><div class="empty-icon">🔍</div><p>No countries match your search</p></div>`;
    return;
  }

  const partnerMap    = buildPartnerMap();
  const grouped       = {};
  filtered.forEach(ct => {
    const letter = ct.name[0].toUpperCase();
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(ct);
  });
  const letters       = Object.keys(grouped).sort();
  const activeLetters = new Set(letters);

  // A-Z jump bar
  document.getElementById('alpha-jump').innerHTML =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => `
      <button class="alpha-btn ${activeLetters.has(l) ? 'has-data' : 'no-data'}" data-letter="${l}">
        ${l}
      </button>`).join('');

  document.querySelectorAll('.alpha-btn.has-data').forEach(btn => {
    btn.addEventListener('click', () =>
      document.getElementById(`alpha-sec-${btn.dataset.letter}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  });

  document.getElementById('ct-index').innerHTML = letters.map(letter => `
    <div class="alpha-section" id="alpha-sec-${letter}">
      <div class="alpha-letter">${letter}</div>
      <div class="ct-row">
        ${grouped[letter].map(ct => {
          const partners    = partnerMap[ct.name] || [];
          const hasPartners = partners.length > 0;
          return `
            <div class="ct-card ${hasPartners ? '' : 'ct-card-empty'}" data-ctid="${ct.id}" data-country="${ct.name}">
              <div class="ct-left">
                <span class="ct-flag">${ct.flag_emoji || '🌍'}</span>
                <div>
                  <div class="ct-name">${ct.name}</div>
                  <div class="ct-count">
                    ${hasPartners
                      ? `${partners.length} partner${partners.length !== 1 ? 's' : ''}`
                      : 'No partners yet'}
                  </div>
                </div>
              </div>
              ${hasPartners
                ? `<span class="ct-badge">${partners.length}</span>`
                : `<span class="ct-badge-empty">—</span>`}
            </div>`;
        }).join('')}
      </div>
    </div>`).join('');

  document.querySelectorAll('.ct-card').forEach(card => {
    card.addEventListener('click', () => {
      const ctId     = +card.dataset.ctid;
      const ctData   = allCountries.find(c => c.id === ctId);
      const partners = partnerMap[card.dataset.country] || [];
      openCountryPanel(ctData, partners);
    });
  });
}

/* ── Build partner map ── */
function buildPartnerMap() {
  const map = {};
  window.ALL_COMPANIES.forEach(c => {
    (c.countries || []).forEach(co => {
      if (!map[co.name]) map[co.name] = [];
      if (!map[co.name].find(p => p.id === c.id)) {
        map[co.name].push({
          id: c.id, name: c.name,
          company_type: c.company_type,
          direction:    co.direction,
          transactions: co.transactions || []
        });
      }
    });
  });
  return map;
}

/* ════════════════════════════════════════════════
   OPEN COUNTRY PANEL
════════════════════════════════════════════════ */
function openCountryPanel(ctData, partners) {
  if (!ctData) return;
  window.ACTIVE_COUNTRY = ctData;
  window.CT_NEW_LINKS   = [];

  const isAdmin = window.USER_ROLE === 'admin';

  // Header avatar & info
  const avatar = document.getElementById('p-avatar');
  avatar.textContent    = ctData.flag_emoji || '🌍';
  avatar.style.fontSize = '26px';
  document.getElementById('p-name').textContent = ctData.name;
  document.getElementById('p-type').textContent = partners.length > 0
    ? `${partners.length} active partner${partners.length !== 1 ? 's' : ''}`
    : 'No partners yet';

  // Header edit button — mark as country panel so app.js routes correctly
  const editBtn = document.getElementById('p-edit');
  editBtn.style.display     = isAdmin ? '' : 'none';
  editBtn.dataset.id        = '';
  editBtn.dataset.ctid      = ctData.id;
  editBtn.dataset.paneltype = 'country';

  renderCountryPanelBody(ctData, partners);
  document.getElementById('overlay').classList.add('open');
}

/* ── Render panel body ── */
function renderCountryPanelBody(ctData, partners) {
  const isAdmin = window.USER_ROLE === 'admin';

  /* ── Partner rows ── */
  const partnerRows = partners.length > 0
    ? partners.map(p => `
        <div class="ct-det-row">
          <div class="co-avatar" style="width:38px;height:38px;font-size:12px;border-radius:9px;flex-shrink:0">
            ${initials(p.name)}
          </div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
              <div class="det-name">${p.name}</div>
              ${isAdmin ? `
              <div style="display:flex;gap:4px;flex-shrink:0">
                <button class="panel-btn ct-co-edit-btn" data-id="${p.id}"
                  style="width:28px;height:28px;font-size:12px" title="Edit">✏️</button>
                <button class="panel-btn ct-co-unlink-btn" data-coid="${p.id}" data-ctid="${ctData.id}"
                  style="width:28px;height:28px;font-size:12px;color:var(--danger)" title="Remove">✕</button>
              </div>` : ''}
            </div>
            <div style="font-size:11px;color:var(--tx2);margin-bottom:6px">${p.company_type || '—'}</div>
            ${p.direction ? `<div style="margin-bottom:6px">${makeTag(dirLabel(p.direction), 't-dir')}</div>` : ''}
            ${buildTransactionRows(p.transactions)}
          </div>
        </div>`).join('')
    : `<div class="empty-state" style="padding:20px 0">
         <div class="empty-icon" style="font-size:28px">🏢</div>
         <p>No companies linked yet</p>
       </div>`;

  /* ── Add company section (admin only) ── */
  const companyOptions = window.ALL_COMPANIES
    .filter(c => !partners.find(p => p.id === c.id))
    .map(c => `<option value="${c.id}">${initials(c.name)} ${c.name}</option>`)
    .join('');

  const addCompanySection = isAdmin ? `
    <div>
      <div class="sec-label">Add a company to ${ctData.name}</div>
      <div class="sec">
        <div class="form-group" style="margin-bottom:12px">
          <select class="form-select" id="ct-add-company-sel" style="width:100%">
            <option value="">Select company…</option>
            ${companyOptions}
          </select>
        </div>
        <div id="ct-add-tx-wrap" style="display:none">
          <div class="form-group" style="margin-bottom:10px">
            <label class="form-label">Direction</label>
            <select class="form-select" id="ct-add-direction" style="width:100%">
              <option value="">Select…</option>
              ${CT_DIRECTIONS.map(d => `<option value="${d.value}">${d.label}</option>`).join('')}
            </select>
          </div>
          <div class="cl-field-label" style="margin-bottom:8px">Transactions</div>
          <div id="ct-add-tx-list" class="tx-pairs-list">
            <div class="tx-empty">Click "+ Add Transaction" to add one</div>
          </div>
          <button class="btn btn-ghost tx-add-btn" id="ct-tx-add-btn" type="button">+ Add Transaction</button>
          <div style="display:flex;gap:8px;margin-top:14px">
            <button class="btn btn-ghost" id="ct-add-cancel-btn" style="flex:1;justify-content:center">Cancel</button>
            <button class="btn btn-primary" id="ct-add-save-btn" style="flex:1;justify-content:center">Add to Country</button>
          </div>
        </div>
      </div>
    </div>

    <div style="padding-top:4px">
      <button class="btn btn-danger" id="ct-delete-btn" style="width:100%;justify-content:center">
        🗑 Delete ${ctData.name} from directory
      </button>
    </div>` : '';

  document.getElementById('panel-body').innerHTML = `
    <div>
      <div class="sec-label">Partners in ${ctData.name}</div>
      <div class="sec" id="ct-partners-sec">${partnerRows}</div>
    </div>
    ${addCompanySection}`;

  /* ── Bind events — admin only ── */
  if (isAdmin) {
    // Company selector → show tx form
    document.getElementById('ct-add-company-sel').addEventListener('change', e => {
      const wrap = document.getElementById('ct-add-tx-wrap');
      wrap.style.display = e.target.value ? '' : 'none';
      if (e.target.value) { window.CT_NEW_LINKS = []; renderCtTxRows(); }
    });

    document.getElementById('ct-tx-add-btn').addEventListener('click', () => {
      window.CT_NEW_LINKS.push({ txType: '', currencies: [], segments: [] });
      renderCtTxRows();
    });

    document.getElementById('ct-add-cancel-btn').addEventListener('click', () => {
      document.getElementById('ct-add-company-sel').value = '';
      document.getElementById('ct-add-tx-wrap').style.display = 'none';
      window.CT_NEW_LINKS = [];
    });

    document.getElementById('ct-add-save-btn').addEventListener('click', () =>
      handleAddCompanyToCountry(ctData));

    document.getElementById('ct-delete-btn').addEventListener('click', () =>
      handleDeleteCountry(ctData));

    // Edit company buttons
    document.querySelectorAll('.ct-co-edit-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        closePanel();
        openEditModal(+btn.dataset.id);
      });
    });

    // Unlink company
    document.querySelectorAll('.ct-co-unlink-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const coId = +btn.dataset.coid;
        const ctId = +btn.dataset.ctid;
        const co   = window.ALL_COMPANIES.find(c => c.id === coId);
        if (!confirm(`Remove ${co?.name || 'this company'} from ${ctData.name}?`)) return;
        try {
          await dbRemoveCompanyFromCountry(coId, ctId);
          showToast(`✓ Removed from ${ctData.name}`);
          await loadCompanies();
          window.ALL_COUNTRIES = await dbGetAllCountries().catch(() => []);
          const newPartners = buildPartnerMap()[ctData.name] || [];
          renderCountryPanelBody(ctData, newPartners);
          document.getElementById('p-type').textContent = newPartners.length > 0
            ? `${newPartners.length} active partner${newPartners.length !== 1 ? 's' : ''}`
            : 'No partners yet';
          renderCountries(document.getElementById('ct-search').value);
        } catch (err) { showToast('⚠️ ' + err.message); }
      });
    });
  }
}

/* ── Tx rows for add-company form ── */
function renderCtTxRows() {
  const list = document.getElementById('ct-add-tx-list');
  if (!list) return;
  if (window.CT_NEW_LINKS.length === 0) {
    list.innerHTML = `<div class="tx-empty">Click "+ Add Transaction" to add one</div>`;
    return;
  }
  list.innerHTML = window.CT_NEW_LINKS.map((tx, ti) => `
    <div class="tx-pair-row" data-ti="${ti}">
      <div class="tx-pair-head">
        <select class="tx-type-select form-select ct-tx-sel" data-ti="${ti}">
          <option value="">Transaction type…</option>
          ${CT_TX_TYPES.map(t => `<option value="${t}" ${tx.txType===t?'selected':''}>${t}</option>`).join('')}
        </select>
        <button class="cl-remove-btn" onclick="removeCtTxRow(${ti})" title="Remove">✕</button>
      </div>
      <div class="tx-sub-label">Currencies</div>
      <div class="pill-group">
        ${CT_CURRENCIES.map(cu => `
          <label class="pill">
            <input type="checkbox" class="ct-cur-cb" data-ti="${ti}" value="${cu}"
              ${(tx.currencies||[]).includes(cu)?'checked':''} />${cu}
          </label>`).join('')}
      </div>
      <div class="tx-sub-label" style="margin-top:8px">Customer Segments</div>
      <div class="pill-group">
        ${CT_SEGMENTS.map(s => `
          <label class="pill">
            <input type="checkbox" class="ct-seg-cb" data-ti="${ti}" value="${s}"
              ${(tx.segments||[]).includes(s)?'checked':''} />${s}
          </label>`).join('')}
      </div>
    </div>`).join('');
}

function removeCtTxRow(ti) {
  syncCtTxRows();
  window.CT_NEW_LINKS.splice(ti, 1);
  renderCtTxRows();
}

function syncCtTxRows() {
  document.querySelectorAll('#ct-add-tx-list .tx-pair-row').forEach((row, ti) => {
    const sel  = row.querySelector('.ct-tx-sel');
    const curs = [...row.querySelectorAll('.ct-cur-cb:checked')].map(el => el.value);
    const segs = [...row.querySelectorAll('.ct-seg-cb:checked')].map(el => el.value);
    if (window.CT_NEW_LINKS[ti]) {
      window.CT_NEW_LINKS[ti].txType     = sel?.value || '';
      window.CT_NEW_LINKS[ti].currencies = curs;
      window.CT_NEW_LINKS[ti].segments   = segs;
    }
  });
}

async function handleAddCompanyToCountry(ctData) {
  const companyId = +document.getElementById('ct-add-company-sel').value;
  const direction = document.getElementById('ct-add-direction').value;
  if (!companyId) { showToast('⚠️ Please select a company'); return; }
  syncCtTxRows();
  const btn = document.getElementById('ct-add-save-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    await dbAddCompanyToCountry(companyId, ctData.id, direction, window.CT_NEW_LINKS);
    showToast('✓ Company added to ' + ctData.name);
    await loadCompanies();
    const newPartners = buildPartnerMap()[ctData.name] || [];
    renderCountryPanelBody(ctData, newPartners);
    document.getElementById('p-type').textContent =
      `${newPartners.length} active partner${newPartners.length !== 1 ? 's' : ''}`;
    renderCountries(document.getElementById('ct-search').value);
  } catch (err) {
    showToast('⚠️ ' + err.message);
  } finally {
    btn.textContent = 'Add to Country'; btn.disabled = false;
  }
}

async function handleDeleteCountry(ctData) {
  if (!confirm(`Delete "${ctData.name}" from the directory? This will also remove all company links for this country.`)) return;
  try {
    await dbDeleteCountry(ctData.id);
    showToast(`🗑 ${ctData.name} deleted`);
    closePanel();
    window.ALL_COUNTRIES = await dbGetAllCountries().catch(() => []);
    await loadCompanies();
    renderCountries(document.getElementById('ct-search').value);
  } catch (err) { showToast('⚠️ ' + err.message); }
}

/* ════════════════════════════════════════════════
   EDIT COUNTRY FORM (admin only)
════════════════════════════════════════════════ */
function openCountryEditForm(ctData, partners) {
  document.getElementById('panel-body').innerHTML = `
    <div>
      <div class="sec-label">Edit Country</div>
      <div class="sec">
        <div class="form-group">
          <label class="form-label">Country Name *</label>
          <input class="form-input" type="text" id="ct-edit-name" value="${ctData.name}" />
        </div>
        <div class="form-group">
          <label class="form-label">Flag Emoji</label>
          <input class="form-input" type="text" id="ct-edit-flag" value="${ctData.flag_emoji || ''}" maxlength="4" />
        </div>
        <div class="form-group">
          <label class="form-label">Region</label>
          <select class="form-select" id="ct-edit-region">
            <option value="">Select region…</option>
            ${['Europe','Middle East','Asia','Africa','Americas','Oceania'].map(r =>
              `<option value="${r}" ${ctData.region === r ? 'selected' : ''}>${r}</option>`
            ).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-ghost" id="ct-edit-cancel" style="flex:1;justify-content:center">Cancel</button>
          <button class="btn btn-primary" id="ct-edit-save" style="flex:1;justify-content:center">Save Changes</button>
        </div>
      </div>
    </div>`;

  document.getElementById('ct-edit-cancel').addEventListener('click', () =>
    renderCountryPanelBody(ctData, partners));

  document.getElementById('ct-edit-save').addEventListener('click', async () => {
    const name   = document.getElementById('ct-edit-name').value.trim();
    const flag   = document.getElementById('ct-edit-flag').value.trim();
    const region = document.getElementById('ct-edit-region').value;
    if (!name) { showToast('⚠️ Country name is required'); return; }
    const btn = document.getElementById('ct-edit-save');
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
      await dbUpdateCountry(ctData.id, { name, flag, region });
      showToast(`✓ ${name} updated`);
      const ct = window.ALL_COUNTRIES.find(c => c.id === ctData.id);
      if (ct) { ct.name = name; ct.flag_emoji = flag; ct.region = region; }
      const updatedCtData = { ...ctData, name, flag_emoji: flag, region };
      window.ACTIVE_COUNTRY = updatedCtData;
      document.getElementById('p-avatar').textContent = flag || '🌍';
      document.getElementById('p-name').textContent   = name;
      await loadCompanies();
      const newPartners = buildPartnerMap()[name] || [];
      renderCountryPanelBody(updatedCtData, newPartners);
      renderCountries(document.getElementById('ct-search').value);
    } catch (err) {
      showToast('⚠️ ' + err.message);
      btn.textContent = 'Save Changes'; btn.disabled = false;
    }
  });
}
