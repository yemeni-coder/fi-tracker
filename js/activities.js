/* ════════════════════════════════════════════════
   js/activities.js
   Activity logging system — integrated from FI Organizer
   Works for Admins and Colleagues
   Viewers cannot log activities
════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════
   RENDER ACTIVITIES PAGE
════════════════════════════════════════════════ */
async function renderActivitiesPage() {
  const content = document.getElementById('activities-page-content');
  if (!content) return;

  content.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading activities…</p></div>`;

  try {
    const activities = await dbGetActivities({ limit: 200 });
    renderActivitiesList(activities, content);
  } catch (err) {
    content.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}

function renderActivitiesList(activities, container) {
  // Filters
  const search    = document.getElementById('act-search')?.value?.toLowerCase() || '';
  const filterSt  = document.getElementById('act-filter-status')?.value || '';
  const filterUr  = document.getElementById('act-filter-urgency')?.value || '';
  const filterCo  = document.getElementById('act-filter-company')?.value || '';

  let filtered = activities.filter(a => {
    const matchSearch  = !search   || a.note?.toLowerCase().includes(search) || a.company_name?.toLowerCase().includes(search);
    const matchStatus  = !filterSt || a.status === filterSt;
    const matchUrgency = !filterUr || a.urgency === filterUr;
    const matchCompany = !filterCo || a.company_id === +filterCo;
    return matchSearch && matchStatus && matchUrgency && matchCompany;
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No activities found</p></div>`;
    return;
  }

  const canEdit = window.USER_ROLE === 'admin';

  container.innerHTML = filtered.map(a => buildActivityCard(a, canEdit)).join('');

  // Bind edit/delete
  container.querySelectorAll('.act-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openActivityModal(+btn.dataset.id); });
  });
  container.querySelectorAll('.act-delete-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Delete this activity?')) return;
      await dbDeleteActivity(+btn.dataset.id);
      showToast('🗑 Activity deleted');
      renderActivitiesPage();
      updateDashboardStats();
    });
  });

  // Click card → open company detail
  container.querySelectorAll('.act-card[data-company-id]').forEach(card => {
    card.addEventListener('click', () => {
      const id = +card.dataset.companyId;
      if (id) openCompanyDetail(id);
    });
  });
}

function buildActivityCard(a, canEdit) {
  const urgencyColor = a.urgency === 'High' ? 'var(--danger)' : 'var(--tx3)';
  const statusStyle  = {
    'Pending':   'rs-pipeline',
    'Completed': 'rs-active',
    'Cancelled': 'rs-inactive'
  }[a.status] || 'rs-pipeline';

  const today    = new Date().toISOString().slice(0, 10);
  const isOverdue = a.follow_up_date && a.follow_up_date < today && a.status === 'Pending';

  return `
    <div class="act-card ${isOverdue ? 'act-card-overdue' : ''}" 
      data-company-id="${a.company_id || ''}" 
      style="${a.company_id ? 'cursor:pointer' : ''}">
      <div class="act-card-head">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${a.company_name ? `
            <div class="co-avatar" ${typeof avatarStyle === 'function' ? avatarStyle(a.company_name, 32, 7) : ''}>
              ${initials(a.company_name)}
            </div>
            <div>
              <div style="font-family:'Syne',sans-serif;font-weight:600;font-size:14px">${a.company_name}</div>
              <div style="font-size:11px;color:var(--tx3)">${formatActivityDate(a.activity_date)}</div>
            </div>` : `
            <div style="font-size:13px;color:var(--tx2)">${formatActivityDate(a.activity_date)}</div>`}
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap">
          <span class="status-tag ${statusStyle}">${a.status}</span>
          ${a.urgency === 'High' ? `<span class="status-tag rs-suspended">⚡ High</span>` : ''}
          ${isOverdue ? `<span class="status-tag rs-suspended">⚠️ Overdue</span>` : ''}
          ${canEdit ? `
            <button class="panel-btn act-edit-btn" data-id="${a.id}" style="width:26px;height:26px;font-size:11px">✏️</button>
            <button class="panel-btn act-delete-btn" data-id="${a.id}" style="width:26px;height:26px;font-size:11px;color:var(--danger)">✕</button>
          ` : ''}
        </div>
      </div>

      <div class="act-note">${a.note}</div>

      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px">
        ${a.next_action ? `
          <div style="font-size:12px;color:var(--tx2)">
            <span style="color:var(--tx3);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Next Action</span><br>
            ${a.next_action}
          </div>` : ''}
        ${a.follow_up_date ? `
          <div style="font-size:12px;color:${isOverdue ? 'var(--danger)' : 'var(--tx2)'}">
            <span style="color:var(--tx3);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Follow-up</span><br>
            ${formatActivityDate(a.follow_up_date)}
          </div>` : ''}
        ${a.doc_ref ? `
          <div style="font-size:12px;color:var(--tx2)">
            <span style="color:var(--tx3);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Doc Ref</span><br>
            ${a.doc_ref}
          </div>` : ''}
      </div>

      <div style="font-size:10px;color:var(--tx3);margin-top:6px">by ${window.CURRENT_USER_NAME || a.user_email}</div>
    </div>`;
}

function formatActivityDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

/* ════════════════════════════════════════════════
   ACTIVITY MODAL — log / edit
════════════════════════════════════════════════ */
function openActivityModal(editId = null, presetCompanyId = null) {
  const overlay = document.getElementById('activity-modal-overlay');
  if (!overlay) return;

  // Clear form
  document.getElementById('am-id').value          = editId || '';
  document.getElementById('am-date').value         = new Date().toISOString().slice(0, 10);
  document.getElementById('am-note').value         = '';
  document.getElementById('am-docref').value       = '';
  document.getElementById('am-urgency').value      = 'Normal';
  document.getElementById('am-status').value       = 'Pending';
  document.getElementById('am-nextaction').value   = '';
  document.getElementById('am-followup').value     = '';
  document.getElementById('am-company').value      = '';
  document.getElementById('am-company-id').value   = '';
  document.getElementById('am-title').textContent  = editId ? 'Edit Activity' : 'Log Activity';
  document.getElementById('am-save-btn').textContent = editId ? 'Save Changes' : 'Save Activity';

  // Populate company dropdown
  const sel = document.getElementById('am-company');
  sel.innerHTML = `<option value="">No specific company</option>` +
    window.ALL_COMPANIES.map(c =>
      `<option value="${c.id}" data-name="${c.name}">${c.name}</option>`
    ).join('');

  if (presetCompanyId) {
    sel.value = presetCompanyId;
    document.getElementById('am-company-id').value = presetCompanyId;
  }

  // Load existing data if editing
  if (editId) {
    dbGetActivities({ limit: 1000 }).then(acts => {
      const a = acts.find(x => x.id === editId);
      if (!a) return;
      if (a.company_id) sel.value = a.company_id;
      document.getElementById('am-date').value       = a.activity_date || '';
      document.getElementById('am-note').value       = a.note || '';
      document.getElementById('am-docref').value     = a.doc_ref || '';
      document.getElementById('am-urgency').value    = a.urgency || 'Normal';
      document.getElementById('am-status').value     = a.status || 'Pending';
      document.getElementById('am-nextaction').value = a.next_action || '';
      document.getElementById('am-followup').value   = a.follow_up_date || '';
    });
  }

  overlay.classList.add('open');
  setTimeout(() => document.getElementById('am-note').focus(), 100);
}

function closeActivityModal() {
  document.getElementById('activity-modal-overlay')?.classList.remove('open');
}

async function handleSaveActivity() {
  const note = document.getElementById('am-note').value.trim();
  const date = document.getElementById('am-date').value;
  if (!note) { showToast('⚠️ Please write an activity note'); return; }
  if (!date) { showToast('⚠️ Please select a date');         return; }

  const coSel      = document.getElementById('am-company');
  const companyId  = coSel.value ? +coSel.value : null;
  const companyName = companyId
    ? coSel.options[coSel.selectedIndex].dataset.name
    : null;

  const data = {
    companyId,
    companyName,
    userEmail:    window.CURRENT_USER_NAME ? `${window.CURRENT_USER_NAME} (${window.CURRENT_USER_EMAIL})` : window.CURRENT_USER_EMAIL,
    date,
    note,
    docRef:       document.getElementById('am-docref').value.trim()      || null,
    urgency:      document.getElementById('am-urgency').value,
    status:       document.getElementById('am-status').value,
    nextAction:   document.getElementById('am-nextaction').value.trim()  || null,
    followUpDate: document.getElementById('am-followup').value           || null
  };

  const btn = document.getElementById('am-save-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;

  try {
    const editId = document.getElementById('am-id').value;
    if (editId) {
      await dbUpdateActivity(+editId, data);
      showToast('✓ Activity updated');
    } else {
      await dbAddActivity(data);
      showToast('✓ Activity logged');
    }
    closeActivityModal();
    // Refresh whichever page is active
    if (window.CURRENT_PAGE === 'activities') renderActivitiesPage();
    if (window.CURRENT_PAGE === 'dashboard')  renderDashboard();
    // If a company panel is open, refresh its activity section
    const panelId = document.getElementById('p-edit')?.dataset?.id;
    if (panelId) renderCompanyActivities(+panelId);
    updateDashboardStats();
  } catch (err) {
    showToast('⚠️ ' + err.message);
  } finally {
    btn.textContent = document.getElementById('am-id').value ? 'Save Changes' : 'Save Activity';
    btn.disabled = false;
  }
}

/* ════════════════════════════════════════════════
   COMPANY ACTIVITY SECTION — inside detail panel
════════════════════════════════════════════════ */
async function renderCompanyActivities(companyId) {
  const container = document.getElementById(`company-activities-${companyId}`);
  if (!container) return;

  container.innerHTML = `<div class="loading-state" style="padding:16px"><div class="spinner"></div></div>`;

  try {
    const activities = await dbGetActivities({ companyId });
    const canLog     = window.USER_ROLE === 'admin';

    if (!activities.length) {
      container.innerHTML = `
        <div style="padding:12px 0">
          <p style="color:var(--tx3);font-size:13px;margin-bottom:${canLog ? '12px' : '0'}">No activities logged yet</p>
          ${canLog ? `
            <button class="btn btn-ghost" style="font-size:12px;padding:6px 12px"
              id="log-act-btn-${companyId}">+ Log Activity</button>` : ''}
        </div>`;
    } else {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${activities.slice(0, 5).map(a => buildMiniActivityCard(a, canLog)).join('')}
        </div>
        ${activities.length > 5 ? `
          <div style="font-size:12px;color:var(--tx3);margin-top:8px;text-align:center">
            +${activities.length - 5} more — view in Activities page
          </div>` : ''}
        ${canLog ? `
          <button class="btn btn-ghost" style="font-size:12px;padding:6px 12px;margin-top:10px;width:100%;justify-content:center"
            id="log-act-btn-${companyId}">+ Log Activity</button>` : ''}`;
    }

    document.getElementById(`log-act-btn-${companyId}`)
      ?.addEventListener('click', () => openActivityModal(null, companyId));

    container.querySelectorAll('.act-mini-edit').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openActivityModal(+btn.dataset.id); });
    });

    container.querySelectorAll('.act-mini-delete').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Delete this activity?')) return;
        await dbDeleteActivity(+btn.dataset.id);
        showToast('🗑 Deleted');
        renderCompanyActivities(companyId);
        updateDashboardStats();
      });
    });

  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger);font-size:13px">Error: ${err.message}</p>`;
  }
}

function buildMiniActivityCard(a, canEdit) {
  const today     = new Date().toISOString().slice(0, 10);
  const isOverdue = a.follow_up_date && a.follow_up_date < today && a.status === 'Pending';
  const statusStyle = {
    'Pending':   'rs-pipeline',
    'Completed': 'rs-active',
    'Cancelled': 'rs-inactive'
  }[a.status] || 'rs-pipeline';

  return `
    <div class="act-mini-card ${isOverdue ? 'act-card-overdue' : ''}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;color:var(--tx3);margin-bottom:3px">
            ${formatActivityDate(a.activity_date)} · ${a.user_email}
          </div>
          <div style="font-size:13px;color:var(--tx);line-height:1.4">${a.note}</div>
          ${a.follow_up_date ? `
            <div style="font-size:11px;color:${isOverdue ? 'var(--danger)' : 'var(--tx3)'};margin-top:4px">
              ${isOverdue ? '⚠️ Overdue' : '📅'} Follow-up: ${formatActivityDate(a.follow_up_date)}
            </div>` : ''}
          ${a.next_action ? `
            <div style="font-size:11px;color:var(--tx2);margin-top:2px">→ ${a.next_action}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
          <span class="status-tag ${statusStyle}" style="font-size:10px">${a.status}</span>
          ${a.urgency === 'High' ? `<span class="status-tag rs-suspended" style="font-size:10px">⚡</span>` : ''}
          ${canEdit ? `
            <button class="panel-btn act-mini-edit" data-id="${a.id}"
              style="width:22px;height:22px;font-size:10px">✏️</button>
            <button class="panel-btn act-mini-delete" data-id="${a.id}"
              style="width:22px;height:22px;font-size:10px;color:var(--danger)">✕</button>
          ` : ''}
        </div>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════════
   DASHBOARD STATS — overdue + today
════════════════════════════════════════════════ */
async function updateDashboardStats() {
  try {
    const [overdue, today] = await Promise.all([
      dbGetOverdueActivities(),
      dbGetTodayActivities()
    ]);

    // Update overdue badge in dashboard
    const overdueEl = document.getElementById('dash-overdue-count');
    if (overdueEl) {
      overdueEl.textContent = overdue.length;
      overdueEl.style.color = overdue.length > 0 ? 'var(--danger)' : 'var(--ok)';
    }

    const todayEl = document.getElementById('dash-today-count');
    if (todayEl) todayEl.textContent = today.length;

    // Render overdue list
    const overdueList = document.getElementById('dash-overdue-list');
    if (overdueList) {
      if (!overdue.length) {
        overdueList.innerHTML = `
          <div class="empty-state" style="padding:20px">
            <div class="empty-icon">🎉</div>
            <p>No overdue follow-ups</p>
          </div>`;
      } else {
        overdueList.innerHTML = overdue.slice(0, 5).map(a => `
          <div class="act-mini-card act-card-overdue"
            style="${a.company_id ? 'cursor:pointer' : ''}"
            onclick="${a.company_id ? `openCompanyDetail(${a.company_id})` : ''}">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              ${a.company_name ? `
                <div class="co-avatar" ${typeof avatarStyle === 'function' ? avatarStyle(a.company_name, 24, 5) : ''}
                  style="width:24px;height:24px;font-size:8px">
                  ${initials(a.company_name)}
                </div>
                <span style="font-family:'Syne',sans-serif;font-weight:600;font-size:13px">${a.company_name}</span>
              ` : ''}
              <span style="font-size:11px;color:var(--danger);margin-left:auto">
                Due ${formatActivityDate(a.follow_up_date)}
              </span>
            </div>
            <div style="font-size:12px;color:var(--tx2)">${a.note}</div>
            ${a.next_action ? `<div style="font-size:11px;color:var(--tx3);margin-top:3px">→ ${a.next_action}</div>` : ''}
          </div>`).join('') +
          (overdue.length > 5 ? `<div style="font-size:12px;color:var(--tx3);text-align:center;padding:8px">+${overdue.length - 5} more in Activities page</div>` : '');
      }
    }
  } catch (e) { console.warn('Dashboard stats error:', e); }
}

/* ════════════════════════════════════════════════
   END OF DAY REVIEW
════════════════════════════════════════════════ */
window.REVIEW_STATE = { companies: [], index: 0 };

async function initReviewPage() {
  const content = document.getElementById('review-page-content');
  if (!content) return;

  // Load companies that haven't had activity today
  const today      = new Date().toISOString().slice(0, 10);
  const todayActs  = await dbGetTodayActivities();
  const todayCoIds = new Set(todayActs.map(a => a.company_id).filter(Boolean));

  const pending = window.ALL_COMPANIES.filter(c => !todayCoIds.has(c.id));

  window.REVIEW_STATE = { companies: pending, index: 0 };

  if (!pending.length) {
    content.innerHTML = `
      <div class="empty-state" style="padding:40px">
        <div class="empty-icon">🎉</div>
        <p style="font-size:16px;font-weight:600">All companies reviewed today!</p>
        <p style="font-size:13px;color:var(--tx3);margin-top:8px">Great work — every partner has been touched.</p>
      </div>`;
    return;
  }

  renderReviewCard();
}

function renderReviewCard() {
  const content = document.getElementById('review-page-content');
  const { companies, index } = window.REVIEW_STATE;

  if (index >= companies.length) {
    content.innerHTML = `
      <div class="empty-state" style="padding:40px">
        <div class="empty-icon">✅</div>
        <p style="font-size:16px;font-weight:600">Review complete!</p>
        <p style="font-size:13px;color:var(--tx3);margin-top:8px">You've gone through all ${companies.length} companies.</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="initReviewPage()">Start Again</button>
      </div>`;
    return;
  }

  const c   = companies[index];
  const col = getCompanyColor(c.name);
  const pct = Math.round((index / companies.length) * 100);

  content.innerHTML = `
    <div>
      <!-- Progress -->
      <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--tx3);margin-bottom:6px">
          <span>Company ${index + 1} of ${companies.length}</span>
          <span>${pct}% done</span>
        </div>
        <div style="height:6px;background:var(--bg3);border-radius:10px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:10px;transition:width 0.3s ease"></div>
        </div>
      </div>

      <!-- Company card -->
      <div class="dash-card" style="margin-bottom:16px">
        <div class="card-top" style="margin-bottom:12px">
          <div class="co-avatar" ${avatarStyle(c.name, 48, 12)}>${initials(c.name)}</div>
          <div style="flex:1">
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:18px">${c.name}</div>
            <div style="font-size:13px;color:var(--tx2)">${c.company_type || '—'}${c.country_of_origin ? ' · ' + c.country_of_origin : ''}</div>
            <div style="margin-top:6px">${relStatusTag(c.relationship_status || 'Pipeline')}</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--tx3)">
          ${(c.countries || []).length} countr${(c.countries || []).length !== 1 ? 'ies' : 'y'} linked
        </div>
      </div>

      <!-- Last activity -->
      <div id="review-last-activity" style="margin-bottom:16px">
        <div class="sec-label">Last Activity</div>
        <div class="sec" id="review-last-act-content">
          <div class="loading-state" style="padding:12px"><div class="spinner"></div></div>
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-primary" style="justify-content:center"
          onclick="openActivityModal(null, ${c.id}); document.getElementById('activity-modal-overlay').dataset.reviewMode = '1'">
          📝 Log Activity
        </button>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" style="flex:1;justify-content:center"
            onclick="reviewSkip()">Skip for now</button>
          <button class="btn btn-ghost" style="flex:1;justify-content:center;color:var(--ok)"
            onclick="reviewNoChange()">✓ No change needed</button>
        </div>
      </div>
    </div>`;

  // Load last activity for this company
  dbGetCompanyLastActivity(c.id).then(last => {
    const el = document.getElementById('review-last-act-content');
    if (!el) return;
    if (!last) {
      el.innerHTML = `<p style="color:var(--tx3);font-size:13px">No activity recorded yet</p>`;
    } else {
      el.innerHTML = buildMiniActivityCard(last, false);
    }
  });
}

function reviewSkip() {
  window.REVIEW_STATE.index++;
  renderReviewCard();
}

async function reviewNoChange() {
  const c = window.REVIEW_STATE.companies[window.REVIEW_STATE.index];
  await dbAddActivity({
    companyId:   c.id,
    companyName: c.name,
    userEmail:   window.CURRENT_USER_EMAIL,
    date:        new Date().toISOString().slice(0, 10),
    note:        'No change — reviewed during end-of-day check',
    status:      'Completed',
    urgency:     'Normal'
  });
  showToast(`✓ ${c.name} marked as reviewed`);
  window.REVIEW_STATE.index++;
  renderReviewCard();
  updateDashboardStats();
}

/* ════════════════════════════════════════════════
   EXPORT CSV
════════════════════════════════════════════════ */
async function exportActivitiesCSV() {
  try {
    const activities = await dbGetActivities({ limit: 10000 });
    const headers = ['Company','Date','Note','Doc Ref','Urgency','Status','Next Action','Follow-up Date','Logged By'];
    const escape  = val => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows    = activities.map(a => [
      a.company_name || '', a.activity_date || '', a.note || '',
      a.doc_ref || '', a.urgency || '', a.status || '',
      a.next_action || '', a.follow_up_date || '', a.user_email || ''
    ].map(escape).join(','));

    const csv  = '\uFEFF' + [headers.map(escape).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href  = url;
    link.download = `activities-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link); link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('✓ Activities exported');
  } catch (err) {
    showToast('⚠️ Export failed: ' + err.message);
  }
}

/* ════════════════════════════════════════════════
   ORG COMPANIES — Colleague view
   Shows all companies with last activity + log button
════════════════════════════════════════════════ */
async function renderOrgCompanies() {
  const content = document.getElementById('org-companies-content');
  if (!content) return;

  content.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  try {
    const search = document.getElementById('org-co-search')?.value?.toLowerCase() || '';
    const cos    = window.ALL_COMPANIES.filter(c =>
      !search || c.name.toLowerCase().includes(search)
    );

    if (!cos.length) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">🏢</div><p>No companies found</p></div>`;
      return;
    }

    // Load last activities for all companies in one query
    const acts = await dbGetActivities({ limit: 500 });
    const lastActMap = {};
    acts.forEach(a => {
      if (a.company_id && !lastActMap[a.company_id]) {
        lastActMap[a.company_id] = a;
      }
    });

    const today   = new Date().toISOString().slice(0, 10);
    const canLog  = ['admin','colleague'].includes(window.USER_ROLE);

    content.innerHTML = cos.map(c => {
      const last      = lastActMap[c.id];
      const hasToday  = last && last.activity_date === today;
      const isOverdue = last && last.follow_up_date && last.follow_up_date < today && last.status === 'Pending';
      const col       = getCompanyColor(c.name);

      return `
        <div class="act-card" style="margin-bottom:12px">
          <div class="card-top" style="margin-bottom:10px">
            <div class="co-avatar" ${avatarStyle(c.name,38,9)}>${initials(c.name)}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <div style="font-family:'Syne',sans-serif;font-weight:600;font-size:15px">${c.name}</div>
                ${relStatusTag(c.relationship_status || 'Pipeline')}
                ${hasToday ? `<span class="status-tag rs-active" style="font-size:10px">✓ Done today</span>` : ''}
                ${isOverdue ? `<span class="status-tag rs-suspended" style="font-size:10px">⚠️ Overdue</span>` : ''}
              </div>
              <div style="font-size:12px;color:var(--tx2);margin-top:2px">
                ${c.company_type||'—'}${c.country_of_origin?' · '+c.country_of_origin:''}
              </div>
            </div>
            ${canLog ? `
              <button class="btn btn-ghost org-log-btn" data-id="${c.id}"
                style="font-size:12px;padding:6px 12px;flex-shrink:0">
                + Log
              </button>` : ''}
          </div>

          ${last ? `
            <div style="font-size:12px;color:var(--tx3);margin-bottom:4px">
              Last: ${formatActivityDate(last.activity_date)} · ${last.status}
            </div>
            <div style="font-size:13px;color:var(--tx2)">${last.note}</div>
            ${last.follow_up_date ? `
              <div style="font-size:11px;color:${isOverdue?'var(--danger)':'var(--tx3)'};margin-top:4px">
                ${isOverdue?'⚠️ Overdue':'📅'} Follow-up: ${formatActivityDate(last.follow_up_date)}
              </div>` : ''}
          ` : `<div style="font-size:12px;color:var(--tx3)">No activity logged yet</div>`}
        </div>`;
    }).join('');

    // Bind log buttons
    content.querySelectorAll('.org-log-btn').forEach(btn => {
      btn.addEventListener('click', () => openActivityModal(null, +btn.dataset.id));
    });

    // Search
    document.getElementById('org-co-search')?.addEventListener('input', renderOrgCompanies);

  } catch (err) {
    content.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}
