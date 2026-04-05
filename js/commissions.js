/* ════════════════════════════════════════════════
   js/commissions.js
   Commission management per company / country
════════════════════════════════════════════════ */

const COMMISSION_CURRENCIES = ['USD','EUR','GBP','TRY','AED','SAR','CHF','JPY','CAD','AUD'];
const COMMISSION_UNITS = ['per_transaction','monthly','annual'];
const COMMISSION_UNIT_LABELS = { per_transaction:'Per Transaction', monthly:'Monthly', annual:'Annual' };

/* ════════════════════════════════════════════════
   DB FUNCTIONS
════════════════════════════════════════════════ */
async function dbGetCommissions(companyId) {
  const comms = await sbFetch(`commissions?company_id=eq.${companyId}&select=*&order=created_at.asc`);
  if (!comms || !comms.length) return [];
  const ids = comms.map(c => c.id).join(',');
  const tiers = await sbFetch(`commission_tiers?commission_id=in.(${ids})&select=*&order=from_count.asc`);
  return comms.map(c => ({
    ...c,
    tiers: tiers.filter(t => t.commission_id === c.id)
  }));
}

async function dbAddCommission(data) {
  const [comm] = await sbFetch('commissions', {
    method: 'POST',
    body: JSON.stringify({
      company_id: data.companyId,
      country_id: data.countryId || null,
      type:       data.type,
      value:      data.value     || null,
      currency:   data.currency  || null,
      unit:       data.unit      || null,
      notes:      data.notes     || null
    })
  });
  if (data.type === 'tiered' && data.tiers?.length) {
    await dbSaveCommissionTiers(comm.id, data.tiers);
  }
  return comm;
}

async function dbUpdateCommission(id, data) {
  const [comm] = await sbFetch(`commissions?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      country_id: data.countryId || null,
      type:       data.type,
      value:      data.value     || null,
      currency:   data.currency  || null,
      unit:       data.unit      || null,
      notes:      data.notes     || null
    })
  });
  // Replace tiers
  await sbFetch(`commission_tiers?commission_id=eq.${id}`, { method:'DELETE', prefer:'return=minimal' });
  if (data.type === 'tiered' && data.tiers?.length) {
    await dbSaveCommissionTiers(id, data.tiers);
  }
  return comm;
}

async function dbDeleteCommission(id) {
  await sbFetch(`commissions?id=eq.${id}`, { method:'DELETE', prefer:'return=minimal' });
}

async function dbSaveCommissionTiers(commissionId, tiers) {
  const rows = tiers.map(t => ({
    commission_id: commissionId,
    from_count:    parseInt(t.from),
    to_count:      t.to ? parseInt(t.to) : null,
    value:         parseFloat(t.value),
    currency:      t.currency || null
  }));
  await sbFetch('commission_tiers', { method:'POST', body: JSON.stringify(rows) });
}

/* ════════════════════════════════════════════════
   RENDER COMMISSIONS IN PANEL
════════════════════════════════════════════════ */
async function renderCommissionsSection(companyId, company) {
  const el = document.getElementById('commissions-section');
  if (!el) return;

  el.innerHTML = `<div class="loading-state" style="padding:16px"><div class="spinner"></div></div>`;

  try {
    const comms   = await dbGetCommissions(companyId);
    const isAdmin = window.USER_ROLE === 'admin';

    if (!comms.length) {
      el.innerHTML = `
        <div style="color:var(--tx3);font-size:13px;margin-bottom:${isAdmin?'12px':'0'}">No commissions defined yet</div>
        ${isAdmin ? `<button class="btn btn-ghost" style="font-size:12px;padding:6px 12px" id="add-comm-btn">+ Add Commission</button>` : ''}`;
    } else {
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px" id="comm-list">
          ${comms.map(c => buildCommCard(c, company, isAdmin)).join('')}
        </div>
        ${isAdmin ? `<button class="btn btn-ghost" style="font-size:12px;padding:6px 12px;margin-top:10px;width:100%;justify-content:center" id="add-comm-btn">+ Add Commission</button>` : ''}`;
    }

    if (isAdmin) {
      document.getElementById('add-comm-btn')?.addEventListener('click', () =>
        openCommissionForm(companyId, company, null)
      );
      el.querySelectorAll('.comm-edit-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          const comms2 = await dbGetCommissions(companyId);
          const comm   = comms2.find(c => c.id === +btn.dataset.id);
          if (comm) openCommissionForm(companyId, company, comm);
        })
      );
      el.querySelectorAll('.comm-delete-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this commission rule?')) return;
          await dbDeleteCommission(+btn.dataset.id);
          showToast('Commission deleted');
          renderCommissionsSection(companyId, company);
        })
      );
    }
  } catch (err) {
    el.innerHTML = `<p style="color:var(--danger);font-size:13px">Error: ${err.message}</p>`;
  }
}

function buildCommCard(c, company, isAdmin) {
  // Find country name
  const countryName = c.country_id
    ? (window.ALL_COUNTRIES.find(x => x.id === c.country_id)?.name || 'Unknown Country')
    : null;

  // Scope label
  const scopeLabel = countryName
    ? `<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:var(--warn)22;color:var(--warn);border:1px solid var(--warn)55">${countryName} only</span>`
    : `<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:var(--ok)22;color:var(--ok);border:1px solid var(--ok)55">All countries</span>`;

  // Type badge
  const typeBadge = `<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:var(--ac-soft);color:var(--accent)">${
    c.type === 'fixed' ? 'Fixed' : c.type === 'percentage' ? 'Percentage' : 'Tiered'
  }</span>`;

  // Value display
  let valueDisplay = '';
  if (c.type === 'fixed') {
    valueDisplay = `<div style="font-size:22px;font-weight:800;color:var(--tx);font-family:'Syne',sans-serif">
      ${c.value ?? '—'} <span style="font-size:13px;font-weight:500;color:var(--tx2)">${c.currency || ''}</span>
    </div>
    <div style="font-size:11px;color:var(--tx3)">${COMMISSION_UNIT_LABELS[c.unit] || c.unit || ''}</div>`;
  } else if (c.type === 'percentage') {
    valueDisplay = `<div style="font-size:22px;font-weight:800;color:var(--tx);font-family:'Syne',sans-serif">
      ${c.value ?? '—'}<span style="font-size:16px">%</span>
    </div>
    <div style="font-size:11px;color:var(--tx3)">${COMMISSION_UNIT_LABELS[c.unit] || c.unit || ''}</div>`;
  } else if (c.type === 'tiered') {
    valueDisplay = `<div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">
      ${c.tiers.map((t, i) => `
        <div style="display:flex;align-items:center;gap:8px;font-size:12px">
          <span style="color:var(--tx3);min-width:120px">${t.from_count} – ${t.to_count ?? '∞'} transactions</span>
          <span style="font-weight:700;color:var(--accent)">${t.value} ${t.currency || ''}</span>
        </div>`).join('')}
    </div>`;
  }

  return `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:12px 14px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${typeBadge}
          ${scopeLabel}
        </div>
        ${isAdmin ? `
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="panel-btn comm-edit-btn" data-id="${c.id}" style="width:26px;height:26px;font-size:11px">✏️</button>
          <button class="panel-btn comm-delete-btn" data-id="${c.id}" style="width:26px;height:26px;font-size:11px;color:var(--danger)">✕</button>
        </div>` : ''}
      </div>
      ${valueDisplay}
      ${c.notes ? `<div style="font-size:11px;color:var(--tx3);margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">${c.notes}</div>` : ''}
    </div>`;
}

/* ════════════════════════════════════════════════
   COMMISSION FORM
════════════════════════════════════════════════ */
function openCommissionForm(companyId, company, existing) {
  document.getElementById('comm-form-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id    = 'comm-form-overlay';
  overlay.className = 'mod-overlay open';

  // Build country options — only countries this company operates in
  const companyCountries = company.countries || [];
  const countryOptions = companyCountries.map(c => {
    const ct = window.ALL_COUNTRIES.find(x => x.name === c.name);
    return `<option value="${ct?.id || ''}" ${existing?.country_id === ct?.id ? 'selected' : ''}>${c.flag || '🌍'} ${c.name}</option>`;
  }).join('');

  const type = existing?.type || 'fixed';

  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="mod-title">${existing ? 'Edit Commission' : 'Add Commission'}</div>
      <div class="mod-sub">Define the commission rule for ${company.name}</div>

      <!-- Scope -->
      <div class="form-group">
        <label class="form-label">Applies to</label>
        <select class="form-select" id="cf-country">
          <option value="">All countries</option>
          ${countryOptions}
        </select>
      </div>

      <!-- Type -->
      <div class="form-group">
        <label class="form-label">Commission Type</label>
        <div style="display:flex;gap:8px">
          ${['fixed','percentage','tiered'].map(t => `
            <button type="button" class="comm-type-btn ${type===t?'active':''}" data-type="${t}"
              style="flex:1;padding:10px 8px;border-radius:var(--r2);border:2px solid ${type===t?'var(--accent)':'var(--border)'};
              background:${type===t?'var(--ac-soft)':'none'};color:${type===t?'var(--accent)':'var(--tx2)'};
              cursor:pointer;font-size:12px;font-weight:600;transition:all var(--ease)">
              ${t==='fixed'?'Fixed':t==='percentage'?'Percentage':'Tiered'}
            </button>`).join('')}
        </div>
      </div>

      <!-- Dynamic fields -->
      <div id="cf-fields"></div>

      <!-- Notes -->
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input class="form-input" type="text" id="cf-notes" value="${existing?.notes||''}" placeholder="Any notes about this commission…" />
      </div>

      <div class="mod-actions">
        <button class="btn btn-ghost" id="cf-cancel">Cancel</button>
        <button class="btn btn-primary" id="cf-save">${existing ? 'Save Changes' : 'Add Commission'}</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Render initial fields
  renderCommFields(type, existing);

  // Type button toggle
  overlay.querySelectorAll('.comm-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.comm-type-btn').forEach(b => {
        b.style.border     = '2px solid var(--border)';
        b.style.background = 'none';
        b.style.color      = 'var(--tx2)';
        b.classList.remove('active');
      });
      btn.style.border     = '2px solid var(--accent)';
      btn.style.background = 'var(--ac-soft)';
      btn.style.color      = 'var(--accent)';
      btn.classList.add('active');
      renderCommFields(btn.dataset.type, null);
    });
  });

  // Close
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('cf-cancel').addEventListener('click', () => overlay.remove());

  // Save
  document.getElementById('cf-save').addEventListener('click', async () => {
    const activeType = overlay.querySelector('.comm-type-btn.active')?.dataset.type || 'fixed';
    const countryVal = document.getElementById('cf-country').value;
    const countryId  = countryVal ? parseInt(countryVal) : null;

    let data = {
      companyId: companyId,
      countryId,
      type:  activeType,
      notes: document.getElementById('cf-notes')?.value.trim() || null
    };

    if (activeType === 'fixed') {
      const val = parseFloat(document.getElementById('cf-value')?.value);
      if (isNaN(val)) { showToast('⚠️ Please enter a value'); return; }
      data.value    = val;
      data.currency = document.getElementById('cf-currency')?.value || null;
      data.unit     = document.getElementById('cf-unit')?.value     || null;
    } else if (activeType === 'percentage') {
      const val = parseFloat(document.getElementById('cf-pct')?.value);
      if (isNaN(val)) { showToast('⚠️ Please enter a percentage'); return; }
      data.value = val;
      data.unit  = document.getElementById('cf-pct-unit')?.value || null;
    } else if (activeType === 'tiered') {
      const tierRows = overlay.querySelectorAll('.tier-row');
      const tiers = [...tierRows].map(row => ({
        from:     row.querySelector('.tier-from')?.value,
        to:       row.querySelector('.tier-to')?.value   || null,
        value:    row.querySelector('.tier-val')?.value,
        currency: row.querySelector('.tier-cur')?.value  || null
      }));
      if (!tiers.length || !tiers[0].value) { showToast('⚠️ Add at least one tier'); return; }
      data.tiers = tiers;
    }

    const btn = document.getElementById('cf-save');
    btn.textContent = 'Saving…'; btn.disabled = true;

    try {
      if (existing) { await dbUpdateCommission(existing.id, data); showToast('✓ Commission updated'); }
      else          { await dbAddCommission(data);                  showToast('✓ Commission added'); }
      overlay.remove();
      renderCommissionsSection(companyId, company);
    } catch (err) {
      showToast('⚠️ ' + err.message);
      btn.textContent = existing ? 'Save Changes' : 'Add Commission';
      btn.disabled = false;
    }
  });
}

function renderCommFields(type, existing) {
  const el = document.getElementById('cf-fields');
  if (!el) return;

  const curOptions = COMMISSION_CURRENCIES.map(c =>
    `<option value="${c}" ${existing?.currency===c?'selected':existing?.currency?'':c==='USD'?'selected':''}>${c}</option>`
  ).join('');

  const unitOptions = COMMISSION_UNITS.map(u =>
    `<option value="${u}" ${existing?.unit===u?'selected':u==='per_transaction'?'selected':''}>${COMMISSION_UNIT_LABELS[u]}</option>`
  ).join('');

  if (type === 'fixed') {
    el.innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount *</label>
          <input class="form-input" type="number" id="cf-value" value="${existing?.value||''}" placeholder="e.g. 500" step="0.01" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Currency</label>
          <select class="form-select" id="cf-currency">${curOptions}</select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Applied</label>
        <select class="form-select" id="cf-unit">${unitOptions}</select>
      </div>`;
  } else if (type === 'percentage') {
    el.innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Percentage % *</label>
          <input class="form-input" type="number" id="cf-pct" value="${existing?.value||''}" placeholder="e.g. 1.5" step="0.01" min="0" max="100" />
        </div>
        <div class="form-group">
          <label class="form-label">Applied</label>
          <select class="form-select" id="cf-pct-unit">${unitOptions}</select>
        </div>
      </div>`;
  } else if (type === 'tiered') {
    const existingTiers = existing?.tiers?.length ? existing.tiers : [{ from_count:1, to_count:null, value:'', currency:'USD' }];
    el.innerHTML = `
      <div class="form-group">
        <label class="form-label">Tiers</label>
        <div id="tiers-list" style="display:flex;flex-direction:column;gap:8px">
          ${existingTiers.map((t,i) => buildTierRow(t, i)).join('')}
        </div>
        <button type="button" class="btn btn-ghost" id="add-tier-btn" style="font-size:12px;padding:6px 12px;margin-top:8px;width:100%;justify-content:center">+ Add Tier</button>
      </div>`;

    document.getElementById('add-tier-btn').addEventListener('click', () => {
      const list  = document.getElementById('tiers-list');
      const count = list.querySelectorAll('.tier-row').length;
      const div   = document.createElement('div');
      div.innerHTML = buildTierRow({ from_count: '', to_count: null, value: '', currency: 'USD' }, count);
      list.appendChild(div.firstElementChild);
      bindTierRemove();
    });
    bindTierRemove();
  }
}

function buildTierRow(t, i) {
  const curOptions = COMMISSION_CURRENCIES.map(c =>
    `<option value="${c}" ${(t.currency||'USD')===c?'selected':''}>${c}</option>`
  ).join('');
  return `
    <div class="tier-row" style="display:flex;align-items:center;gap:6px;background:var(--bg3);padding:8px 10px;border-radius:var(--r1)">
      <input class="form-input tier-from" type="number" value="${t.from_count||''}" placeholder="From" min="0"
        style="width:70px;height:32px;font-size:12px;padding:4px 8px" />
      <span style="font-size:12px;color:var(--tx3)">–</span>
      <input class="form-input tier-to" type="number" value="${t.to_count||''}" placeholder="∞"
        style="width:70px;height:32px;font-size:12px;padding:4px 8px" />
      <span style="font-size:11px;color:var(--tx3);white-space:nowrap">tx →</span>
      <input class="form-input tier-val" type="number" value="${t.value||''}" placeholder="Value" step="0.01" min="0"
        style="flex:1;height:32px;font-size:12px;padding:4px 8px" />
      <select class="form-select tier-cur" style="width:80px;height:32px;font-size:12px;padding:4px 6px">${curOptions}</select>
      <button type="button" class="tier-remove-btn panel-btn" style="width:26px;height:26px;font-size:12px;color:var(--danger);flex-shrink:0">✕</button>
    </div>`;
}

function bindTierRemove() {
  document.querySelectorAll('.tier-remove-btn').forEach(btn => {
    btn.onclick = () => {
      const rows = document.querySelectorAll('.tier-row');
      if (rows.length > 1) btn.closest('.tier-row').remove();
      else showToast('⚠️ At least one tier required');
    };
  });
}
