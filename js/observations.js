/* ════════════════════════════════════════════════
   js/observations.js
   Observation / Notes system
   — Viewers: floating button to write observations
   — Admins: inbox to review, reply, archive
════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════
   FLOATING BUTTON — visible to everyone
════════════════════════════════════════════════ */
function initObservations() {
  injectObservationButton();
  injectObservationModal();
  injectInboxModal();
}

function injectObservationButton() {
  // Remove if already exists
  document.getElementById('obs-fab')?.remove();

  const fab = document.createElement('div');
  fab.id = 'obs-fab';
  fab.innerHTML = `
    <div class="obs-fab-btn" id="obs-fab-btn" title="Add Observation">
      <span class="obs-fab-icon">📝</span>
      <span class="obs-fab-label">Observe</span>
    </div>
    <div class="obs-fab-badge" id="obs-fab-badge" style="display:none">0</div>`;
  document.body.appendChild(fab);

  document.getElementById('obs-fab-btn').addEventListener('click', () => {
    if (window.USER_ROLE === 'admin') {
      openInboxModal();
    } else {
      openObservationModal();
    }
  });

  // Load pending count for admins
  if (window.USER_ROLE === 'admin') {
    updatePendingBadge();
  }
}

async function updatePendingBadge() {
  try {
    const count = await dbGetPendingObservationCount();
    const badge = document.getElementById('obs-fab-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch (e) { /* silent */ }
}

/* ════════════════════════════════════════════════
   OBSERVATION MODAL — for viewers (and admins)
════════════════════════════════════════════════ */
function injectObservationModal() {
  document.getElementById('obs-modal-overlay')?.remove();

  const el = document.createElement('div');
  el.id = 'obs-modal-overlay';
  el.className = 'mod-overlay';
  el.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="mod-title">Add Observation</div>
      <div class="mod-sub">Share what you noticed — admins will review it</div>

      <div class="form-group">
        <label class="form-label">Your Note *</label>
        <textarea class="form-textarea" id="obs-note" rows="4"
          placeholder="Describe what you noticed, what needs attention, or any suggestion…"></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Related Company <span style="color:var(--tx3)">(optional)</span></label>
          <select class="form-select" id="obs-company">
            <option value="">No specific company</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Related Country <span style="color:var(--tx3)">(optional)</span></label>
          <select class="form-select" id="obs-country">
            <option value="">No specific country</option>
          </select>
        </div>
      </div>

      <div class="obs-tip">
        💡 Your name and email will be visible to admins so they can follow up with you.
      </div>

      <div class="mod-actions">
        <button class="btn btn-ghost" id="obs-cancel">Cancel</button>
        <button class="btn btn-primary" id="obs-submit">Submit Observation</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  el.addEventListener('click', e => { if (e.target === el) closeObservationModal(); });
  document.getElementById('obs-cancel').addEventListener('click', closeObservationModal);
  document.getElementById('obs-submit').addEventListener('click', handleSubmitObservation);
}

function openObservationModal() {
  document.getElementById('obs-note').value = '';

  // Populate company dropdown
  const coSel = document.getElementById('obs-company');
  coSel.innerHTML = `<option value="">No specific company</option>` +
    (window.ALL_COMPANIES || []).map(c =>
      `<option value="${c.id}" data-name="${c.name}">${c.name}</option>`
    ).join('');

  // Populate country dropdown
  const ctSel = document.getElementById('obs-country');
  ctSel.innerHTML = `<option value="">No specific country</option>` +
    (window.ALL_COUNTRIES || []).map(c =>
      `<option value="${c.name}">${c.flag_emoji || '🌍'} ${c.name}</option>`
    ).join('');

  document.getElementById('obs-modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('obs-note').focus(), 100);
}

function closeObservationModal() {
  document.getElementById('obs-modal-overlay')?.classList.remove('open');
}

async function handleSubmitObservation() {
  const note = document.getElementById('obs-note').value.trim();
  if (!note) { showToast('⚠️ Please write your observation'); return; }

  const coSel     = document.getElementById('obs-company');
  const companyId = coSel.value ? +coSel.value : null;
  const companyName = companyId
    ? coSel.options[coSel.selectedIndex].dataset.name
    : null;
  const countryName = document.getElementById('obs-country').value || null;

  const btn = document.getElementById('obs-submit');
  btn.textContent = 'Submitting…'; btn.disabled = true;

  try {
    await dbAddObservation({
      userEmail:   window.CURRENT_USER_NAME ? `${window.CURRENT_USER_NAME} (${window.CURRENT_USER_EMAIL})` : window.CURRENT_USER_EMAIL,
      userRole:    window.USER_ROLE,
      companyId,
      companyName,
      countryName,
      note
    });
    closeObservationModal();
    showToast('✅ Observation submitted — admins will review it');
    if (window.USER_ROLE === 'admin') updatePendingBadge();
  } catch (err) {
    showToast('⚠️ ' + err.message);
  } finally {
    btn.textContent = 'Submit Observation'; btn.disabled = false;
  }
}

/* ════════════════════════════════════════════════
   INBOX MODAL — for admins
════════════════════════════════════════════════ */
function injectInboxModal() {
  document.getElementById('obs-inbox-overlay')?.remove();

  const el = document.createElement('div');
  el.id = 'obs-inbox-overlay';
  el.className = 'mod-overlay';
  el.innerHTML = `
    <div class="modal obs-inbox-modal">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div class="mod-title" style="margin-bottom:0">Observations Inbox</div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost" id="obs-add-own" style="font-size:12px">+ Add Note</button>
          <button class="panel-btn" id="obs-inbox-close" style="width:32px;height:32px">✕</button>
        </div>
      </div>
      <div class="mod-sub" style="margin-bottom:16px">Notes and observations from your team</div>

      <div class="obs-inbox-tabs">
        <button class="obs-tab active" data-tab="pending">
          Pending <span class="obs-tab-badge" id="inbox-pending-count">0</span>
        </button>
        <button class="obs-tab" data-tab="reviewed">Reviewed</button>
        <button class="obs-tab" data-tab="visitors">Visitors</button>
        <button class="obs-tab" data-tab="mine">My Notes</button>
      </div>

      <div id="obs-inbox-content" class="obs-inbox-content">
        <div class="loading-state"><div class="spinner"></div></div>
      </div>
    </div>`;
  document.body.appendChild(el);

  el.addEventListener('click', e => { if (e.target === el) closeInboxModal(); });
  document.getElementById('obs-inbox-close').addEventListener('click', closeInboxModal);
  document.getElementById('obs-add-own').addEventListener('click', () => {
    closeInboxModal();
    openObservationModal();
  });

  document.querySelectorAll('.obs-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.obs-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadInboxTab(tab.dataset.tab);
    });
  });
}

async function openInboxModal() {
  document.getElementById('obs-inbox-overlay').classList.add('open');
  await loadInboxTab('pending');
}

function closeInboxModal() {
  document.getElementById('obs-inbox-overlay')?.classList.remove('open');
}

async function loadInboxTab(tab) {
  const content = document.getElementById('obs-inbox-content');
  content.innerHTML = `<div class="loading-state" style="padding:30px"><div class="spinner"></div></div>`;

  try {
    let observations = [];
    if (tab === 'mine') {
      observations = await dbGetMyObservations(window.CURRENT_USER_EMAIL);
    } else if (tab === 'visitors') {
      // Show ALL viewer access logs (pending + approved)
      const all = await dbGetObservations(null);
      observations = all.filter(o => o.note && o.note.includes('accessed the system'));
    } else {
      // For pending/reviewed, exclude access logs - show only real observations
      const all = await dbGetObservations(tab === 'pending' ? 'pending' : 'reviewed');
      observations = all.filter(o => !o.note?.includes('accessed the system'));
    }

    // Update pending badge
    if (tab === 'pending') {
      const pendingCount = document.getElementById('inbox-pending-count');
      if (pendingCount) pendingCount.textContent = observations.length;
      updatePendingBadge();
    }

    if (!observations.length) {
      content.innerHTML = `
        <div class="empty-state" style="padding:40px 20px">
          <div class="empty-icon">${tab === 'pending' ? '📭' : '✅'}</div>
          <p>${tab === 'pending' ? 'No pending observations' : tab === 'reviewed' ? 'No reviewed observations yet' : 'You have no notes yet'}</p>
        </div>`;
      return;
    }

    if (tab === 'visitors') {
    const pending  = observations.filter(o => o.status === 'pending');
    const approved = observations.filter(o => o.status === 'reviewed');

    content.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="font-size:12px;color:var(--tx3)">
          ${pending.length} new · ${approved.length} approved
        </div>
        <button class="btn btn-ghost" id="clear-visitors-btn"
          style="font-size:12px;color:var(--danger);padding:6px 12px">
          🗑 Delete All
        </button>
      </div>
      ${observations.length === 0
        ? '<div class="empty-state" style="padding:30px"><div class="empty-icon">👁</div><p>No visitors yet</p></div>'
        : observations.map(obs => buildVisitorCard(obs)).join('')}`;

    // Approve buttons
    content.querySelectorAll('.visitor-approve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await dbReviewObservation(+btn.dataset.id, null, window.CURRENT_USER_EMAIL);
        showToast('✓ Visitor approved');
        await loadInboxTab('visitors');
        updatePendingBadge();
      });
    });

    // Delete individual
    content.querySelectorAll('.visitor-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await dbDeleteObservation(+btn.dataset.id);
        showToast('🗑 Removed');
        await loadInboxTab('visitors');
        updatePendingBadge();
      });
    });

    // Clear all
    document.getElementById('clear-visitors-btn')?.addEventListener('click', async () => {
      if (!confirm(`Delete all ${observations.length} visitor logs?`)) return;
      for (const obs of observations) await dbDeleteObservation(obs.id);
      showToast('✓ All visitor logs deleted');
      await loadInboxTab('visitors');
      updatePendingBadge();
    });
    return;
  }
  content.innerHTML = observations.map(obs => buildObsCard(obs, tab)).join('');

    // Bind review buttons
    content.querySelectorAll('.obs-review-btn').forEach(btn => {
      btn.addEventListener('click', () => openReviewForm(+btn.dataset.id));
    });

    // Bind delete buttons
    content.querySelectorAll('.obs-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this observation?')) return;
        await dbDeleteObservation(+btn.dataset.id);
        await loadInboxTab(tab);
        updatePendingBadge();
      });
    });

    // Bind company link
    content.querySelectorAll('.obs-company-link').forEach(link => {
      link.addEventListener('click', () => {
        const id = +link.dataset.id;
        closeInboxModal();
        openCompanyDetail(id);
      });
    });

  } catch (err) {
    content.innerHTML = `<p style="color:var(--danger);font-size:13px;padding:20px">Error: ${err.message}</p>`;
  }
}

function buildObsCard(obs, tab) {
  const col = obs.user_role === 'admin' ? 'var(--accent)' : 'var(--ok)';
  const roleBadge = obs.user_role === 'admin'
    ? `<span style="font-size:10px;padding:2px 6px;border-radius:20px;background:var(--ac-soft);color:var(--accent)">Admin</span>`
    : `<span style="font-size:10px;padding:2px 6px;border-radius:20px;background:var(--ok-soft);color:var(--ok)">Viewer</span>`;

  const companyLink = obs.company_name && obs.company_id
    ? `<span class="obs-company-link" data-id="${obs.company_id}"
        style="font-size:11px;color:var(--accent);cursor:pointer;text-decoration:underline">
        🏢 ${obs.company_name}
       </span>` : '';

  const countryTag = obs.country_name
    ? `<span style="font-size:11px;color:var(--tx2)">🌍 ${obs.country_name}</span>` : '';

  const replySection = obs.admin_reply ? `
    <div class="obs-reply">
      <div style="font-size:10px;font-weight:600;color:var(--accent);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">
        Admin Reply · ${obs.reviewed_by} · ${formatObsTime(obs.reviewed_at)}
      </div>
      <div style="font-size:13px;color:var(--tx2)">${obs.admin_reply}</div>
    </div>` : '';

  const actions = tab !== 'reviewed'
    ? `<div style="display:flex;gap:6px;margin-top:10px">
        ${window.USER_ROLE === 'admin' && tab === 'pending'
          ? `<button class="btn btn-primary obs-review-btn" data-id="${obs.id}" style="font-size:12px;padding:6px 12px">
               ✓ Review & Reply
             </button>` : ''}
        <button class="btn btn-ghost obs-delete-btn" data-id="${obs.id}" style="font-size:12px;padding:6px 12px;color:var(--danger)">
          🗑 Delete
        </button>
       </div>`
    : `<div style="margin-top:8px">
        <button class="btn btn-ghost obs-delete-btn" data-id="${obs.id}" style="font-size:12px;padding:6px 12px;color:var(--danger)">
          🗑 Delete
        </button>
       </div>`;

  return `
    <div class="obs-card">
      <div class="obs-card-head">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="width:32px;height:32px;border-radius:50%;background:${col}22;border:1px solid ${col}55;
            display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${col};flex-shrink:0">
            ${obs.user_email[0].toUpperCase()}
          </div>
          <div>
            <div style="font-size:13px;font-weight:500">${obs.user_email}</div>
            <div style="font-size:11px;color:var(--tx3)">${formatObsTime(obs.created_at)}</div>
          </div>
          ${roleBadge}
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${companyLink}${countryTag}
        </div>
      </div>

      <div class="obs-note-text">${obs.note}</div>
      ${replySection}
      ${actions}
    </div>`;
}

/* ── Review form inline ── */
function openReviewForm(obsId) {
  const card = document.querySelector(`.obs-review-btn[data-id="${obsId}"]`)?.closest('.obs-card');
  if (!card) return;

  const existing = card.querySelector('.obs-review-form');
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'obs-review-form';
  form.innerHTML = `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
      <label class="form-label">Reply <span style="color:var(--tx3)">(optional)</span></label>
      <textarea class="form-textarea" id="reply-${obsId}" rows="2"
        placeholder="Add a reply or note for the team…" style="margin-bottom:10px"></textarea>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" id="confirm-review-${obsId}" style="font-size:12px;padding:6px 14px">
          ✓ Mark as Reviewed
        </button>
        <button class="btn btn-ghost" id="cancel-review-${obsId}" style="font-size:12px;padding:6px 14px">
          Cancel
        </button>
      </div>
    </div>`;
  card.appendChild(form);

  document.getElementById(`cancel-review-${obsId}`).addEventListener('click', () => form.remove());
  document.getElementById(`confirm-review-${obsId}`).addEventListener('click', async () => {
    const reply = document.getElementById(`reply-${obsId}`).value.trim();
    const btn   = document.getElementById(`confirm-review-${obsId}`);
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
      await dbReviewObservation(obsId, reply, window.CURRENT_USER_EMAIL);
      showToast('✅ Observation reviewed');
      await loadInboxTab('pending');
      updatePendingBadge();
    } catch (err) {
      showToast('⚠️ ' + err.message);
      btn.textContent = '✓ Mark as Reviewed'; btn.disabled = false;
    }
  });
}

function buildVisitorCard(obs) {
  const name     = obs.user_email || '—';
  const date     = new Date(obs.created_at).toLocaleDateString('en-GB', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
  });
  const approved = obs.status === 'reviewed';

  return `
    <div class="obs-card" style="${approved ? 'opacity:0.6' : ''}">
      <div class="obs-card-head">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:50%;
            background:${approved ? 'var(--ok)' : 'var(--ac-soft)'};
            border:1px solid ${approved ? 'var(--ok)' : 'var(--accent)'};
            display:flex;align-items:center;justify-content:center;font-size:14px">
            ${approved ? '✓' : '👁'}
          </div>
          <div>
            <div style="font-size:13px;font-weight:500">${name}</div>
            <div style="font-size:11px;color:var(--tx3)">${date}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          ${approved
            ? `<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:var(--ok-soft);color:var(--ok)">✓ Approved</span>`
            : `<button class="btn btn-ghost visitor-approve-btn" data-id="${obs.id}"
                style="font-size:11px;padding:4px 10px;color:var(--ok);border-color:var(--ok)">
                ✓ Approve
               </button>`}
          <button class="panel-btn visitor-delete-btn" data-id="${obs.id}"
            style="width:26px;height:26px;font-size:11px;color:var(--danger)">✕</button>
        </div>
      </div>
    </div>`;
}

function formatObsTime(ts) {
  if (!ts) return '—';
  const d    = new Date(ts);
  const now  = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}