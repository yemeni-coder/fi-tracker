/* ════════════════════════════════════════════════
   js/workspace.js
   FI Workspace — activity management side
   My Desk · Companies · Log · Review
════════════════════════════════════════════════ */

const WS_ACTIVITY_TYPES = ['Call','Email','Meeting','Document Sent','Follow-up','Other'];

window.ALL_ADMINS = []; // loaded on workspace init

async function loadAdmins() {
  try {
    const profiles = await dbGetAllAdmins();
    console.log('RAW profiles from DB:', JSON.stringify(profiles));

    if (!profiles || profiles.length === 0) {
      console.warn('No profiles returned — check RLS policy on profiles table');
    }

    window.ALL_ADMINS = (profiles || [])
      .filter(p => p.role === 'admin' && p.display_name)
      .map(p => p.display_name);

    console.log('ALL_ADMINS after filter:', window.ALL_ADMINS);

    // Always include current user
    const me = window.CURRENT_USER_NAME;
    if (me && !window.ALL_ADMINS.includes(me)) {
      window.ALL_ADMINS.push(me);
    }

    console.log('Final ALL_ADMINS:', window.ALL_ADMINS);
  } catch (e) {
    console.error('loadAdmins error:', e.message);
    window.ALL_ADMINS = window.CURRENT_USER_NAME ? [window.CURRENT_USER_NAME] : [];
  }
}

const WS_ACTIVITY_ICONS = {
  'Call':          '📞',
  'Email':         '📧',
  'Meeting':       '🤝',
  'Document Sent': '📄',
  'Follow-up':     '🔔',
  'Other':         '📝'
};

/* ════════════════════════════════════════════════
   DB FUNCTIONS
════════════════════════════════════════════════ */
async function wsGetActivities(filters = {}) {
  let path = 'activities?select=*&order=created_at.desc';
  if (filters.companyId) path += `&company_id=eq.${filters.companyId}`;
  if (filters.userEmail) path += `&user_email=eq.${encodeURIComponent(filters.userEmail)}`;
  if (filters.status)    path += `&status=eq.${filters.status}`;
  if (filters.limit)     path += `&limit=${filters.limit}`;
  return await sbFetch(path);
}

async function wsGetOverdue() {
  const today = new Date().toISOString().slice(0,10);
  return await sbFetch(
    `activities?select=*&status=eq.Pending&follow_up_date=lt.${today}&order=follow_up_date.asc`
  );
}

async function wsGetThisWeek() {
  const now   = new Date();
  const day   = now.getDay();
  const diff  = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff)).toISOString().slice(0,10);
  return await sbFetch(
    `activities?select=*&created_at=gte.${monday}&order=created_at.desc`
  );
}

async function wsAddActivity(data) {
  const userLabel = window.CURRENT_USER_NAME
    ? `${window.CURRENT_USER_NAME} (${window.CURRENT_USER_EMAIL})`
    : window.CURRENT_USER_EMAIL || 'unknown';
  const [act] = await sbFetch('activities', {
    method: 'POST',
    body: JSON.stringify({
      company_id:     data.companyId     || null,
      company_name:   data.companyName   || null,
      user_email:     userLabel,
      activity_date:  data.date,
      note:           data.note,
      activity_type:  data.type          || 'Other',
      doc_ref:        data.docRef        || null,
      urgency:        data.urgency       || 'Normal',
      status:         data.status        || 'Pending',
      next_action:    data.nextAction    || null,
      follow_up_date: data.followUpDate  || null
    })
  });
  return act;
}

async function wsUpdateActivity(id, data) {
  const [act] = await sbFetch(`activities?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      company_id:     data.companyId     || null,
      company_name:   data.companyName   || null,
      activity_date:  data.date,
      note:           data.note,
      activity_type:  data.type          || 'Other',
      doc_ref:        data.docRef        || null,
      urgency:        data.urgency       || 'Normal',
      status:         data.status        || 'Pending',
      next_action:    data.nextAction    || null,
      follow_up_date: data.followUpDate  || null
    })
  });
  return act;
}

async function wsDeleteActivity(id) {
  await sbFetch(`activities?id=eq.${id}`, { method:'DELETE', prefer:'return=minimal' });
}

async function wsAssignCompany(companyId, name) {
  await sbFetch(`companies?id=eq.${companyId}`, {
    method: 'PATCH',
    body: JSON.stringify({ assigned_to: name || null })
  });
}

async function wsPinCompany(companyId, pinned) {
  await sbFetch(`companies?id=eq.${companyId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_pinned: pinned })
  });
}

async function wsGetLastActivity(companyId) {
  const rows = await sbFetch(
    `activities?company_id=eq.${companyId}&select=*&order=activity_date.desc&limit=1`
  );
  return rows?.[0] || null;
}

/* ════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════ */
function wsFormatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day:'2-digit', month:'short', year:'numeric'
  });
}

function wsTimeAgo(ts) {
  if (!ts) return '—';
  const d    = new Date(ts);
  const now  = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return wsFormatDate(d.toISOString().slice(0,10));
}

function wsIsOverdue(a) {
  if (!a.follow_up_date || a.status !== 'Pending') return false;
  return a.follow_up_date < new Date().toISOString().slice(0,10);
}

/* ════════════════════════════════════════════════
   MY DESK
════════════════════════════════════════════════ */
async function renderMyDesk() {
  const el = document.getElementById('ws-desk-content');
  if (!el) return;
  el.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  try {
    const [overdue, week, allActs] = await Promise.all([
      wsGetOverdue(),
      wsGetThisWeek(),
      wsGetActivities({ limit: 500 })
    ]);

    const myEmail    = window.CURRENT_USER_EMAIL;
    const myName     = window.CURRENT_USER_NAME;
    const myLabel    = myName ? `${myName} (${myEmail})` : myEmail;
    const myOverdue  = overdue.filter(a => a.user_email === myLabel || a.user_email === myEmail);
    const myWeek     = week.filter(a => a.user_email === myLabel || a.user_email === myEmail);
    const myPending  = allActs.filter(a => (a.user_email === myLabel || a.user_email === myEmail) && a.status === 'Pending');
    const myAssigned = window.ALL_COMPANIES.filter(c => c.assigned_to === myEmail || c.assigned_to === myLabel);

    el.innerHTML = `
      <!-- Stats row -->
      <div class="stats-row" style="margin-bottom:20px">
        <div class="stat-card ${myOverdue.length > 0 ? '' : ''}">
          <div class="stat-label">Overdue</div>
          <div class="stat-val" style="color:${myOverdue.length > 0 ? 'var(--danger)' : 'var(--ok)'}">${myOverdue.length}</div>
          <div class="stat-sub">Need attention now</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pending</div>
          <div class="stat-val">${myPending.length}</div>
          <div class="stat-sub">Open follow-ups</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">This Week</div>
          <div class="stat-val" style="color:var(--ok)">${myWeek.length}</div>
          <div class="stat-sub">Activities logged</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">My Companies</div>
          <div class="stat-val">${myAssigned.length}</div>
          <div class="stat-sub">Assigned to me</div>
        </div>
      </div>

      <!-- Overdue section -->
      ${myOverdue.length > 0 ? `
        <div class="dash-card" style="margin-bottom:16px">
          <div class="dash-title" style="color:var(--danger)">⚠️ Overdue Follow-ups (${myOverdue.length})</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${myOverdue.slice(0,5).map(a => wsActivityMiniCard(a)).join('')}
            ${myOverdue.length > 5 ? `<div style="font-size:12px;color:var(--tx3);text-align:center">+${myOverdue.length-5} more in Log</div>` : ''}
          </div>
        </div>` : ''}

      <!-- Weekly summary -->
      <div class="dash-card" style="margin-bottom:16px">
        <div class="dash-title">📅 This Week's Activity (${myWeek.length})</div>
        ${myWeek.length === 0
          ? `<p style="color:var(--tx3);font-size:13px">Nothing logged yet this week</p>`
          : `<div style="display:flex;flex-direction:column;gap:8px">
              ${myWeek.slice(0,5).map(a => wsActivityMiniCard(a)).join('')}
              ${myWeek.length > 5 ? `<div style="font-size:12px;color:var(--tx3);text-align:center">+${myWeek.length-5} more in Log</div>` : ''}
             </div>`}
      </div>

      <!-- My pinned/assigned companies -->
      ${myAssigned.length > 0 ? `
        <div class="dash-card">
          <div class="dash-title">🏢 My Companies (${myAssigned.length})</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${myAssigned.slice(0,6).map(c => wsCompanyMiniCard(c, allActs)).join('')}
          </div>
        </div>` : ''}`;

    // Bind company card clicks
    el.querySelectorAll('.ws-co-mini').forEach(card => {
      card.addEventListener('click', () => {
        navigateTo('ws-log');
        // Filter log to this company
        setTimeout(() => {
          const sel = document.getElementById('ws-log-filter-company');
          if (sel) { sel.value = card.dataset.id; renderWsLog(); }
        }, 100);
      });
    });

    // Bind activity card clicks → open edit
    el.querySelectorAll('.ws-act-mini').forEach(card => {
      card.addEventListener('click', () => openActivityModal(+card.dataset.id));
    });

  } catch (err) {
    el.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}

function wsActivityMiniCard(a) {
  const overdue = wsIsOverdue(a);
  const icon    = WS_ACTIVITY_ICONS[a.activity_type] || '📝';
  return `
    <div class="ws-act-mini ${overdue ? 'ws-overdue' : ''}" data-id="${a.id}" style="cursor:pointer">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div class="ws-type-icon">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">
            ${a.company_name ? `<span style="font-family:'Syne',sans-serif;font-weight:600;font-size:13px">${a.company_name}</span>` : ''}
            <span class="status-tag ${a.status==='Completed'?'rs-active':a.status==='Cancelled'?'rs-inactive':'rs-pipeline'}" style="font-size:10px">${a.status}</span>
            ${a.urgency==='High' ? `<span class="status-tag rs-suspended" style="font-size:10px">⚡ High</span>` : ''}
            ${overdue ? `<span class="status-tag rs-suspended" style="font-size:10px">⚠️ Overdue</span>` : ''}
          </div>
          <div style="font-size:13px;color:var(--tx);line-height:1.4;margin-bottom:4px">${a.note}</div>
          <div style="font-size:11px;color:var(--tx3)">
            ${wsFormatDate(a.activity_date)} · ${a.user_email}
            ${a.follow_up_date ? ` · Follow-up: ${wsFormatDate(a.follow_up_date)}` : ''}
          </div>
          ${a.next_action ? `<div style="font-size:11px;color:var(--accent);margin-top:3px">→ ${a.next_action}</div>` : ''}
        </div>
      </div>
    </div>`;
}

function wsCompanyMiniCard(c, allActs) {
  const last    = allActs.find(a => a.company_id === c.id);
  const col     = getCompanyColor(c.name);
  const pinned  = c.is_pinned;
  return `
    <div class="ws-co-mini" data-id="${c.id}" style="cursor:pointer;display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);transition:border-color var(--ease)">
      <div class="co-avatar" ${avatarStyle(c.name,34,8)}>${initials(c.name)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="font-family:'Syne',sans-serif;font-weight:600;font-size:13px">${c.name}</div>
          ${pinned ? `<span style="font-size:12px">📌</span>` : ''}
        </div>
        <div style="font-size:11px;color:var(--tx3)">
          ${last ? `Last: ${wsFormatDate(last.activity_date)}` : 'No activity yet'}
        </div>
      </div>
      <span style="color:var(--accent);font-size:16px">›</span>
    </div>`;
}

/* ════════════════════════════════════════════════
   WS COMPANIES
════════════════════════════════════════════════ */
async function renderWsCompanies() {
  const el = document.getElementById('ws-companies-content');
  if (!el) return;
  el.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  try {
    const allActs    = await wsGetActivities({ limit: 1000 });
    const filterName = document.getElementById('ws-co-filter-assignee')?.value || '';
    const search     = document.getElementById('ws-co-search')?.value?.toLowerCase() || '';

    // Build assignee filter — always rebuild with current state
    const admins = [...new Set(window.ALL_COMPANIES.map(c => c.assigned_to).filter(Boolean))];
    const myLabel = window.CURRENT_USER_NAME
      ? `${window.CURRENT_USER_NAME} (${window.CURRENT_USER_EMAIL})`
      : window.CURRENT_USER_EMAIL;
    if (myLabel && !admins.includes(myLabel)) admins.push(myLabel);

    const sel = document.getElementById('ws-co-filter-assignee');
    if (sel) {
      const prev = sel.value;
      sel.innerHTML = `<option value="">All companies</option>` +
        admins.map(n => `<option value="${n}" ${n===prev?'selected':''}>${n}</option>`).join('');
    }

    let cos = window.ALL_COMPANIES.filter(c => {
      const matchSearch = !search || c.name.toLowerCase().includes(search);
      // Empty filter = show all companies
      const matchFilter = !filterName || c.assigned_to === filterName;
      return matchSearch && matchFilter;
    });

    // Pinned first
    cos = [
      ...cos.filter(c => c.is_pinned),
      ...cos.filter(c => !c.is_pinned)
    ];

    if (!cos.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No companies found</p></div>`;
      return;
    }

    // Last activity map
    const lastActMap = {};
    allActs.forEach(a => {
      if (a.company_id && !lastActMap[a.company_id]) lastActMap[a.company_id] = a;
    });

    el.innerHTML = cos.map(c => {
      const last     = lastActMap[c.id];
      const overdue  = last && wsIsOverdue(last);
      const pinned   = c.is_pinned;
      const assigned = c.assigned_to || '';

      return `
        <div class="ws-company-card ${overdue ? 'ws-overdue' : ''}">
          <div class="card-top" style="margin-bottom:10px">
            <div class="co-avatar" ${avatarStyle(c.name,38,9)}>${initials(c.name)}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <div style="font-family:'Syne',sans-serif;font-weight:600;font-size:15px">${c.name}</div>
                ${pinned ? `<span title="Pinned">📌</span>` : ''}
                ${relStatusTag(c.relationship_status||'Pipeline')}
              </div>
              <div style="font-size:12px;color:var(--tx2);margin-top:2px">
                ${c.company_type||'—'}${c.country_of_origin?' · '+c.country_of_origin:''}
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
              <!-- Pin toggle -->
              <button class="panel-btn ws-pin-btn" data-id="${c.id}" data-pinned="${pinned}"
                style="width:30px;height:30px;font-size:14px" title="${pinned?'Unpin':'Pin'}">
                ${pinned ? '📌' : '📍'}
              </button>
              <!-- Log activity -->
              <button class="btn btn-primary ws-log-btn" data-id="${c.id}" data-name="${c.name}"
                style="font-size:12px;padding:6px 12px">+ Log</button>
            </div>
          </div>

          <!-- Assignment -->
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
            <span style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:0.5px">Assigned to</span>
            <select class="ws-assign-sel form-select" data-id="${c.id}"
              style="font-size:12px;padding:4px 8px;height:28px;flex:1;max-width:200px">
              <option value="">— Unassigned —</option>
              ${getAdminOptions(assigned)}
            </select>
          </div>

          <!-- Last activity -->
          ${last ? `
            <div style="font-size:12px;color:var(--tx3);padding:8px 10px;background:var(--bg);border-radius:var(--r1)">
              <span style="color:${overdue?'var(--danger)':'var(--tx2)'}">${overdue?'⚠️ Overdue · ':''}</span>
              <span>${WS_ACTIVITY_ICONS[last.activity_type]||'📝'} ${last.note}</span>
              <span style="color:var(--tx3)"> · ${wsFormatDate(last.activity_date)}</span>
              ${last.follow_up_date?`<span style="color:${overdue?'var(--danger)':'var(--tx3)'}"> · Follow-up: ${wsFormatDate(last.follow_up_date)}</span>`:''}
            </div>` : `
            <div style="font-size:12px;color:var(--tx3);font-style:italic">No activity logged yet</div>`}
        </div>`;
    }).join('');

    // Bind pin buttons
    el.querySelectorAll('.ws-pin-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pinned = btn.dataset.pinned === 'true';
        await wsPinCompany(+btn.dataset.id, !pinned);
        showToast(pinned ? '📍 Unpinned' : '📌 Pinned');
        await loadCompanies();
        renderWsCompanies();
      });
    });

    // Bind log buttons
    el.querySelectorAll('.ws-log-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        openActivityModal(null, +btn.dataset.id, btn.dataset.name)
      );
    });

    // Bind assign dropdowns
    el.querySelectorAll('.ws-assign-sel').forEach(sel => {
      sel.addEventListener('change', async () => {
        const companyName = window.ALL_COMPANIES.find(c => c.id === +sel.dataset.id)?.name || '';
        await wsAssignCompany(+sel.dataset.id, sel.value);
        await dbLogActivity('assigned', +sel.dataset.id, companyName,
          sel.value ? `Assigned to ${sel.value}` : 'Unassigned'
        );
        showToast(`✓ ${sel.value ? 'Assigned to ' + sel.value : 'Unassigned'}`);
        await loadCompanies();
        renderWsCompanies();
      });
    });

  } catch (err) {
    el.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}

function getAdminOptions(selectedEmail) {
  const myLabel = window.CURRENT_USER_NAME
    ? `${window.CURRENT_USER_NAME} (${window.CURRENT_USER_EMAIL})`
    : window.CURRENT_USER_EMAIL;

  // Collect all known assigned names + current user
  const known = [...new Set([
    myLabel,
    ...window.ALL_COMPANIES.map(c => c.assigned_to).filter(Boolean)
  ])];

  return known.map(n =>
    `<option value="${n}" ${n===selectedEmail?'selected':''}>${n}</option>`
  ).join('');
}

/* ════════════════════════════════════════════════
   WS LOG
════════════════════════════════════════════════ */
async function renderWsLog() {
  const el = document.getElementById('ws-log-content');
  if (!el) return;
  el.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  try {
    const allActs = await wsGetActivities({ limit: 500 });

    const search      = document.getElementById('ws-log-search')?.value?.toLowerCase() || '';
    const filterCo    = document.getElementById('ws-log-filter-company')?.value || '';
    const filterSt    = document.getElementById('ws-log-filter-status')?.value || '';
    const filterType  = document.getElementById('ws-log-filter-type')?.value || '';
    const filterUser  = document.getElementById('ws-log-filter-user')?.value || '';

    // Populate company filter
    const coSel = document.getElementById('ws-log-filter-company');
    if (coSel && coSel.options.length <= 1) {
      window.ALL_COMPANIES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.name;
        coSel.appendChild(opt);
      });
    }

    let acts = allActs.filter(a => {
      const matchSearch = !search || a.note?.toLowerCase().includes(search) || a.company_name?.toLowerCase().includes(search);
      const matchCo     = !filterCo   || a.company_id === +filterCo;
      const matchSt     = !filterSt   || a.status === filterSt;
      const matchType   = !filterType || a.activity_type === filterType;
      const matchUser   = !filterUser || a.user_email?.toLowerCase().includes(filterUser.toLowerCase());
      return matchSearch && matchCo && matchSt && matchType && matchUser;
    });

    if (!acts.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No activities found</p></div>`;
      return;
    }

    el.innerHTML = `
      <div style="font-size:12px;color:var(--tx3);margin-bottom:12px">${acts.length} activit${acts.length!==1?'ies':'y'}</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${acts.map(a => wsActivityFullCard(a)).join('')}
      </div>`;

    el.querySelectorAll('.ws-act-edit').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openActivityModal(+btn.dataset.id); });
    });

    el.querySelectorAll('.ws-act-delete').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Delete this activity?')) return;
        await wsDeleteActivity(+btn.dataset.id);
        showToast('🗑 Deleted');
        renderWsLog();
        renderMyDesk();
      });
    });

  } catch (err) {
    el.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}

function wsActivityFullCard(a) {
  const overdue = wsIsOverdue(a);
  const icon    = WS_ACTIVITY_ICONS[a.activity_type] || '📝';
  const myLabel = window.CURRENT_USER_NAME
    ? `${window.CURRENT_USER_NAME} (${window.CURRENT_USER_EMAIL})`
    : window.CURRENT_USER_EMAIL;
  const isOwn   = a.user_email === myLabel || a.user_email === window.CURRENT_USER_EMAIL;

  return `
    <div class="ws-act-full ${overdue?'ws-overdue':''}">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div class="ws-type-icon-lg">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
            <div>
              ${a.company_name?`<div style="font-family:'Syne',sans-serif;font-weight:600;font-size:14px;margin-bottom:3px">${a.company_name}</div>`:''}
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font-size:11px;padding:2px 7px;border-radius:20px;background:var(--bg3);color:var(--tx2);border:1px solid var(--border)">${a.activity_type||'Other'}</span>
                <span class="status-tag ${a.status==='Completed'?'rs-active':a.status==='Cancelled'?'rs-inactive':'rs-pipeline'}" style="font-size:10px">${a.status}</span>
                ${a.urgency==='High'?`<span class="status-tag rs-suspended" style="font-size:10px">⚡ High</span>`:''}
                ${overdue?`<span class="status-tag rs-suspended" style="font-size:10px">⚠️ Overdue</span>`:''}
              </div>
            </div>
            ${isOwn?`
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="panel-btn ws-act-edit" data-id="${a.id}" style="width:26px;height:26px;font-size:11px">✏️</button>
              <button class="panel-btn ws-act-delete" data-id="${a.id}" style="width:26px;height:26px;font-size:11px;color:var(--danger)">✕</button>
            </div>`:''}
          </div>
          <div style="font-size:13px;color:var(--tx);line-height:1.5;padding:8px 12px;background:var(--bg);border-radius:var(--r1);border-left:3px solid var(--accent);margin-bottom:8px">
            ${a.note}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:16px">
            ${a.next_action?`<div style="font-size:12px"><span style="color:var(--tx3)">Next: </span><span style="color:var(--accent)">${a.next_action}</span></div>`:''}
            ${a.follow_up_date?`<div style="font-size:12px;color:${overdue?'var(--danger)':'var(--tx2)'}">📅 ${wsFormatDate(a.follow_up_date)}</div>`:''}
            ${a.doc_ref?`<div style="font-size:12px;color:var(--tx2)">📎 ${a.doc_ref}</div>`:''}
          </div>
          <div style="font-size:11px;color:var(--tx3);margin-top:6px">${wsFormatDate(a.activity_date)} · ${a.user_email}</div>
        </div>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════════
   REVIEW
════════════════════════════════════════════════ */
window.WS_REVIEW = { companies: [], index: 0 };

async function initWsReview() {
  const el = document.getElementById('ws-review-content');
  if (!el) return;

  const today     = new Date().toISOString().slice(0,10);
  const todayActs = await wsGetActivities({ limit: 1000 });
  const todayDone = new Set(
    todayActs.filter(a => a.activity_date === today).map(a => a.company_id).filter(Boolean)
  );

  const myLabel   = window.CURRENT_USER_NAME
    ? `${window.CURRENT_USER_NAME} (${window.CURRENT_USER_EMAIL})`
    : window.CURRENT_USER_EMAIL;

  // Show assigned companies first, then all others
  const assigned  = window.ALL_COMPANIES.filter(c =>
    (c.assigned_to === myLabel || c.assigned_to === window.CURRENT_USER_EMAIL) && !todayDone.has(c.id)
  );
  const others    = window.ALL_COMPANIES.filter(c =>
    c.assigned_to !== myLabel && c.assigned_to !== window.CURRENT_USER_EMAIL && !todayDone.has(c.id)
  );
  const pending   = [...assigned, ...others];

  window.WS_REVIEW = { companies: pending, index: 0 };

  if (!pending.length) {
    el.innerHTML = `
      <div class="empty-state" style="padding:40px">
        <div class="empty-icon">🎉</div>
        <p style="font-size:16px;font-weight:600">All done for today!</p>
        <p style="font-size:13px;color:var(--tx3);margin-top:8px">Every company has been reviewed.</p>
      </div>`;
    return;
  }

  renderWsReviewCard(todayActs);
}

function renderWsReviewCard(allActs) {
  const el = document.getElementById('ws-review-content');
  const { companies, index } = window.WS_REVIEW;

  if (index >= companies.length) {
    el.innerHTML = `
      <div class="empty-state" style="padding:40px">
        <div class="empty-icon">✅</div>
        <p style="font-size:16px;font-weight:600">Review complete!</p>
        <p style="font-size:13px;color:var(--tx3);margin-top:8px">You reviewed all ${companies.length} companies.</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="initWsReview()">Start Again</button>
      </div>`;
    return;
  }

  const c   = companies[index];
  const pct = Math.round(index / companies.length * 100);
  const last = allActs?.find(a => a.company_id === c.id);

  el.innerHTML = `
    <!-- Progress -->
    <div style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--tx3);margin-bottom:6px">
        <span>Company ${index+1} of ${companies.length}</span>
        <span>${pct}% done</span>
      </div>
      <div style="height:5px;background:var(--bg3);border-radius:10px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:10px;transition:width 0.3s ease"></div>
      </div>
    </div>

    <!-- Company card -->
    <div class="dash-card" style="margin-bottom:16px">
      <div class="card-top" style="margin-bottom:10px">
        <div class="co-avatar" ${avatarStyle(c.name,44,11)}>${initials(c.name)}</div>
        <div style="flex:1">
          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:17px">${c.name}</div>
          <div style="font-size:12px;color:var(--tx2);margin-top:2px">${c.company_type||'—'}${c.country_of_origin?' · '+c.country_of_origin:''}</div>
          <div style="margin-top:6px">${relStatusTag(c.relationship_status||'Pipeline')}</div>
        </div>
      </div>

      <!-- Last activity -->
      <div style="font-size:12px;color:var(--tx3);margin-bottom:4px">Last activity:</div>
      ${last
        ? `<div style="font-size:13px;color:var(--tx2);padding:8px 10px;background:var(--bg);border-radius:var(--r1)">
            ${WS_ACTIVITY_ICONS[last.activity_type]||'📝'} ${last.note}
            <span style="color:var(--tx3)"> · ${wsFormatDate(last.activity_date)}</span>
           </div>`
        : `<div style="font-size:13px;color:var(--tx3);font-style:italic">No activity logged yet</div>`}
    </div>

    <!-- Actions -->
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-primary" style="justify-content:center" id="review-log-btn">
        📝 Log Activity
      </button>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" style="flex:1;justify-content:center" id="review-skip-btn">
          Skip
        </button>
        <button class="btn btn-ghost" style="flex:1;justify-content:center;color:var(--ok)" id="review-nochange-btn">
          ✓ No Change
        </button>
        <button class="btn btn-ghost" style="flex:1;justify-content:center;color:var(--tx3)" id="review-skipall-btn">
          Skip All
        </button>
      </div>
    </div>`;

  document.getElementById('review-log-btn').addEventListener('click', () =>
    openActivityModal(null, c.id, c.name)
  );
  document.getElementById('review-skip-btn').addEventListener('click', () => {
    window.WS_REVIEW.index++;
    renderWsReviewCard(allActs);
  });
  document.getElementById('review-nochange-btn').addEventListener('click', async () => {
    await wsAddActivity({
      companyId: c.id, companyName: c.name,
      date: new Date().toISOString().slice(0,10),
      note: 'No change — reviewed during end-of-day check',
      type: 'Other', status: 'Completed', urgency: 'Normal'
    });
    showToast(`✓ ${c.name} marked as reviewed`);
    window.WS_REVIEW.index++;
    renderWsReviewCard(allActs);
    renderMyDesk();
  });
  document.getElementById('review-skipall-btn').addEventListener('click', async () => {
    if (!confirm(`Skip all remaining ${companies.length - index} companies?`)) return;
    window.WS_REVIEW.index = companies.length;
    renderWsReviewCard(allActs);
  });
}

/* ════════════════════════════════════════════════
   ACTIVITY MODAL — open/close/save
════════════════════════════════════════════════ */
window.WS_EDIT_ID     = null;
window.WS_PRESET_CO   = null;
window.WS_PRESET_NAME = null;

function openActivityModal(editId = null, presetCompanyId = null, presetCompanyName = null) {
  window.WS_EDIT_ID     = editId;
  window.WS_PRESET_CO   = presetCompanyId;
  window.WS_PRESET_NAME = presetCompanyName;

  const overlay = document.getElementById('ws-activity-overlay');
  if (!overlay) return;

  // Reset form
  document.getElementById('wam-id').value          = editId || '';
  document.getElementById('wam-date').value         = new Date().toISOString().slice(0,10);
  document.getElementById('wam-note').value         = '';
  document.getElementById('wam-type').value         = 'Other';
  document.getElementById('wam-urgency').value      = 'Normal';
  document.getElementById('wam-status').value       = 'Pending';
  document.getElementById('wam-nextaction').value   = '';
  document.getElementById('wam-followup').value     = '';
  document.getElementById('wam-docref').value       = '';
  document.getElementById('wam-title').textContent  = editId ? 'Edit Activity' : 'Log Activity';
  document.getElementById('wam-save-btn').textContent = editId ? 'Save Changes' : 'Save Activity';

  // Populate company dropdown
  const coSel = document.getElementById('wam-company');
  coSel.innerHTML = `<option value="">No specific company</option>` +
    window.ALL_COMPANIES.map(c => `<option value="${c.id}" data-name="${c.name}">${c.name}</option>`).join('');

  if (presetCompanyId) coSel.value = presetCompanyId;

  // Load existing data if editing
  if (editId) {
    wsGetActivities({ limit: 1000 }).then(acts => {
      const a = acts.find(x => x.id === editId);
      if (!a) return;
      if (a.company_id) coSel.value = a.company_id;
      document.getElementById('wam-date').value       = a.activity_date || '';
      document.getElementById('wam-note').value       = a.note || '';
      document.getElementById('wam-type').value       = a.activity_type || 'Other';
      document.getElementById('wam-urgency').value    = a.urgency || 'Normal';
      document.getElementById('wam-status').value     = a.status || 'Pending';
      document.getElementById('wam-nextaction').value = a.next_action || '';
      document.getElementById('wam-followup').value   = a.follow_up_date || '';
      document.getElementById('wam-docref').value     = a.doc_ref || '';
    });
  }

  overlay.classList.add('open');
  setTimeout(() => document.getElementById('wam-note').focus(), 100);
}

function closeActivityModal() {
  document.getElementById('ws-activity-overlay')?.classList.remove('open');
}

async function handleSaveActivity() {
  const note = document.getElementById('wam-note').value.trim();
  const date = document.getElementById('wam-date').value;
  if (!note) { showToast('⚠️ Please write an activity note'); return; }
  if (!date) { showToast('⚠️ Please select a date'); return; }

  const coSel       = document.getElementById('wam-company');
  const companyId   = coSel.value ? +coSel.value : null;
  const companyName = companyId
    ? coSel.options[coSel.selectedIndex].dataset.name
    : null;

  const data = {
    companyId, companyName, date, note,
    type:        document.getElementById('wam-type').value,
    urgency:     document.getElementById('wam-urgency').value,
    status:      document.getElementById('wam-status').value,
    nextAction:  document.getElementById('wam-nextaction').value.trim() || null,
    followUpDate:document.getElementById('wam-followup').value || null,
    docRef:      document.getElementById('wam-docref').value.trim() || null
  };

  const btn = document.getElementById('wam-save-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;

  try {
    const editId = document.getElementById('wam-id').value;
    if (editId) {
      await wsUpdateActivity(+editId, data);
      showToast('✓ Activity updated');
    } else {
      await wsAddActivity(data);
      showToast('✓ Activity logged');
    }
    closeActivityModal();
    // Refresh whichever workspace page is active
    if (window.CURRENT_PAGE === 'ws-desk')      renderMyDesk();
    if (window.CURRENT_PAGE === 'ws-companies') renderWsCompanies();
    if (window.CURRENT_PAGE === 'ws-log')       renderWsLog();
    if (window.CURRENT_PAGE === 'ws-review')    initWsReview();
  } catch (err) {
    showToast('⚠️ ' + err.message);
  } finally {
    btn.textContent = document.getElementById('wam-id').value ? 'Save Changes' : 'Save Activity';
    btn.disabled = false;
  }
}

/* ════════════════════════════════════════════════
   EXPORT CSV
════════════════════════════════════════════════ */
async function exportWsCSV() {
  try {
    const acts = await wsGetActivities({ limit: 10000 });
    const headers = ['Company','Date','Type','Note','Urgency','Status','Next Action','Follow-up','Doc Ref','Logged By'];
    const escape  = val => `"${String(val||'').replace(/"/g,'""')}"`;
    const rows    = acts.map(a => [
      a.company_name||'', a.activity_date||'', a.activity_type||'',
      a.note||'', a.urgency||'', a.status||'',
      a.next_action||'', a.follow_up_date||'', a.doc_ref||'', a.user_email||''
    ].map(escape).join(','));
    const csv  = '\uFEFF' + [headers.map(escape).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `workspace-log-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
    showToast('✓ Exported');
  } catch (err) { showToast('⚠️ ' + err.message); }
}
