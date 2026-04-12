/* ════════════════════════════════════════════════
   js/contacts.js
   Multiple contacts per company
════════════════════════════════════════════════ */

const CONTACT_ROLES = [
  'Primary Contact','Commercial','Technical','Compliance',
  'Finance','Operations','Legal','Support','Other'
];

const CONTACT_ROLE_COLORS = {
  'Primary Contact': 'var(--accent)',
  'Commercial':      'var(--ok)',
  'Technical':       'var(--warn)',
  'Compliance':      'var(--danger)',
  'Finance':         '#a84ff7',
  'Operations':      '#4fd2f7',
  'Legal':           '#f7824f',
  'Support':         '#4ff7a8',
};

async function renderContactsSection(companyId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `<div class="loading-state" style="padding:16px"><div class="spinner"></div></div>`;

  try {
    const contacts = await dbGetContacts(companyId);
    const isAdmin  = window.USER_ROLE === 'admin';

    if (!contacts || contacts.length === 0) {
      container.innerHTML = `
        <div style="padding:4px 0">
          <p style="color:var(--tx3);font-size:13px;margin-bottom:${isAdmin?'12px':'0'}">No contacts added yet</p>
          ${isAdmin ? `<button class="btn btn-ghost" style="font-size:12px;padding:6px 12px" id="add-contact-btn-${companyId}">+ Add Contact</button>` : ''}
        </div>`;
    } else {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${contacts.map(ct => buildContactCard(ct, isAdmin)).join('')}
        </div>
        ${isAdmin ? `<button class="btn btn-ghost" style="font-size:12px;padding:6px 12px;margin-top:10px;width:100%;justify-content:center" id="add-contact-btn-${companyId}">+ Add Another Contact</button>` : ''}`;
    }

    document.getElementById(`add-contact-btn-${companyId}`)
      ?.addEventListener('click', () => openContactForm(companyId, null, containerId));

    container.querySelectorAll('.contact-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ct = contacts.find(c => c.id === +btn.dataset.id);
        if (ct) openContactForm(companyId, ct, containerId);
      });
    });

    container.querySelectorAll('.contact-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this contact?')) return;
        await dbDeleteContact(+btn.dataset.id);
        showToast('Contact removed');
        renderContactsSection(companyId, containerId);
      });
    });

  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger);font-size:13px">Error: ${err.message}</p>`;
  }
}

function buildContactCard(ct, isAdmin) {
  const color = CONTACT_ROLE_COLORS[ct.role] || 'var(--tx2)';
  return `
    <div class="contact-card">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:${color}22;border:1px solid ${color}55;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${color};flex-shrink:0">
          ${ct.name[0].toUpperCase()}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">
            <div style="font-family:'Syne',sans-serif;font-weight:600;font-size:14px">${ct.name}</div>
            ${ct.is_primary?`<span style="font-size:10px;padding:2px 6px;border-radius:20px;background:var(--ac-soft);color:var(--accent)">Primary</span>`:''}
          </div>
          ${ct.role?`<div style="font-size:11px;font-weight:600;color:${color};margin-bottom:5px;text-transform:uppercase;letter-spacing:0.5px">${ct.role}</div>`:''}
          <div style="display:flex;flex-direction:column;gap:3px">
            ${ct.email?`<a href="mailto:${ct.email}" style="font-size:12px;color:var(--accent);text-decoration:none">${ct.email}</a>`:''}
            ${ct.phone?`<span style="font-size:12px;color:var(--tx2)">${ct.phone}</span>`:''}
            ${ct.notes?`<span style="font-size:11px;color:var(--tx3);margin-top:2px">${ct.notes}</span>`:''}
          </div>
        </div>
        ${isAdmin?`
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="panel-btn contact-edit-btn" data-id="${ct.id}" style="width:26px;height:26px;font-size:11px">✏️</button>
          <button class="panel-btn contact-delete-btn" data-id="${ct.id}" style="width:26px;height:26px;font-size:11px;color:var(--danger)">✕</button>
        </div>`:''}
      </div>
    </div>`;
}

function openContactForm(companyId, existing, containerId) {
  document.getElementById('contact-form-wrap')?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'contact-form-wrap';
  wrap.style.marginTop = '12px';
  wrap.innerHTML = `
    <div class="contact-form">
      <div style="font-family:'Syne',sans-serif;font-weight:600;font-size:14px;margin-bottom:14px">
        ${existing?'Edit Contact':'Add New Contact'}
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Name *</label>
          <input class="form-input" type="text" id="cf-name" value="${existing?.name||''}" placeholder="Full name" />
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Role</label>
          <select class="form-select" id="cf-role">
            <option value="">Select role…</option>
            ${CONTACT_ROLES.map(r=>`<option value="${r}" ${existing?.role===r?'selected':''}>${r}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Email</label>
          <input class="form-input" type="email" id="cf-email" value="${existing?.email||''}" placeholder="email@company.com" />
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Phone</label>
          <input class="form-input" type="text" id="cf-phone" value="${existing?.phone||''}" placeholder="+1 234 567 8900" />
        </div>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Notes</label>
        <input class="form-input" type="text" id="cf-notes" value="${existing?.notes||''}" placeholder="Any notes…" />
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <input type="checkbox" id="cf-primary" ${existing?.is_primary?'checked':''} style="width:15px;height:15px;cursor:pointer" />
        <label for="cf-primary" style="font-size:13px;color:var(--tx2);cursor:pointer">Set as primary contact</label>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" id="cf-cancel" style="flex:1;justify-content:center">Cancel</button>
        <button class="btn btn-primary" id="cf-save" style="flex:1;justify-content:center">${existing?'Save Changes':'Add Contact'}</button>
      </div>
    </div>`;

  const container = document.getElementById(containerId);
  container.parentNode.insertBefore(wrap, container.nextSibling);
  setTimeout(() => wrap.scrollIntoView({ behavior:'smooth', block:'nearest' }), 50);

  document.getElementById('cf-cancel').addEventListener('click', () => wrap.remove());
  document.getElementById('cf-save').addEventListener('click', async () => {
    const name = document.getElementById('cf-name').value.trim();
    if (!name) { showToast('⚠️ Name is required'); return; }
    const data = {
      name,
      role:      document.getElementById('cf-role').value       || null,
      email:     document.getElementById('cf-email').value.trim()  || null,
      phone:     document.getElementById('cf-phone').value.trim()  || null,
      notes:     document.getElementById('cf-notes').value.trim()  || null,
      isPrimary: document.getElementById('cf-primary').checked
    };
    const btn = document.getElementById('cf-save');
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
      if (existing) { await dbUpdateContact(existing.id, data); showToast('✓ Contact updated'); }
      else          { await dbAddContact(companyId, data);       showToast('✓ Contact added'); }
      wrap.remove();
      renderContactsSection(companyId, containerId);
    } catch (err) {
      showToast('⚠️ ' + err.message);
      btn.textContent = existing ? 'Save Changes' : 'Add Contact';
      btn.disabled = false;
    }
  });
}