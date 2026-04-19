/* ════════════════════════════════════════════════
   js/management.js  —  Mohammed only
   3 sections: Activity Log · Health Check · Export
════════════════════════════════════════════════ */

async function isSuperAdmin() {
  /* Check is_super_admin flag in profiles table — no hardcoded names or emails */
  try {
    const stored = localStorage.getItem('fi_session');
    if (!stored) return false;
    const session = JSON.parse(stored);
    const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Authorization': `Bearer ${session.access_token}` }
    });
    if (!res.ok) return false;
    const user = await res.json();
    const rows = await sbFetch(`profiles?id=eq.${user.id}&select=is_super_admin`);
    return rows?.[0]?.is_super_admin === true;
  } catch(e) {
    return false;
  }
}

async function renderManagement() {
  const el = document.getElementById('mgmt-content');
  if (!el) return;

  if (!(await isSuperAdmin())) {
    el.innerHTML = `
      <div class="empty-state" style="padding:80px 20px">
        <div class="empty-icon">🔒</div>
        <p style="font-size:18px;font-weight:600;margin-top:12px">Access Restricted</p>
        <p style="color:var(--tx3);font-size:14px;margin-top:6px">Only accessible to Mohammed</p>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>`;

  try {
    const [stats, logs, users] = await Promise.all([
      mgmtGetStats(),
      mgmtGetFullLog(200),
      mgmtGetUsers()
    ]);
    renderMgmtUI(el, stats, logs, users);
  } catch (err) {
    el.innerHTML = `<p style="color:var(--danger);padding:20px">Error: ${err.message}</p>`;
  }
}

/* ════════════════════════════════════════════════
   DATA FETCHERS
════════════════════════════════════════════════ */

async function mgmtGetStats() {
  const [co, ac, al, ct, cm, obs, evt, ag] = await Promise.all([
    sbFetch('companies?select=id').catch(() => []),
    sbFetch('activities?select=id').catch(() => []),
    sbFetch('activity_log?select=id').catch(() => []),
    sbFetch('company_contacts?select=id').catch(() => []),
    sbFetch('commissions?select=id').catch(() => []),
    sbFetch('observations?select=id').catch(() => []),
    sbFetch('events?select=id').catch(() => []),
    sbFetch('company_agreements?select=id').catch(() => [])
  ]);
  return {
    companies:    (co  || []).length,
    activities:   (ac  || []).length,
    actLog:       (al  || []).length,
    contacts:     (ct  || []).length,
    commissions:  (cm  || []).length,
    observations: (obs || []).length,
    events:       (evt || []).length,
    agreements:   (ag  || []).length,
    countries:    (window.ALL_COUNTRIES || []).length
  };
}

async function mgmtGetFullLog(limit = 200) {
  const [actLog, obs] = await Promise.all([
    sbFetch(`activity_log?select=*&order=created_at.desc&limit=${limit}`).catch(() => []),
    sbFetch(`observations?select=*&order=created_at.desc&limit=100`).catch(() => [])
  ]);

  const logEntries = (actLog || []).map(l => ({
    id:         `al_${l.id}`,
    type:       'change',
    action:     l.action,
    user:       l.user_email || '—',
    company:    l.company_name || null,
    details:    l.details || null,
    created_at: l.created_at
  }));

  const obsEntries = (obs || []).map(o => {
    const isLogin = o.note?.includes('accessed the system');
    return {
      id:         `ob_${o.id}`,
      type:       isLogin ? 'login' : 'observation',
      action:     isLogin ? 'login' : 'observation',
      user:       o.user_email || '—',
      company:    o.company_name || null,
      details:    isLogin ? null : o.note,
      created_at: o.created_at
    };
  });

  return [...logEntries, ...obsEntries]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

async function mgmtGetUsers() {
  try {
    return await sbFetch('profiles?select=id,role,display_name&order=display_name.asc') || [];
  } catch(e) { return []; }
}

/* ════════════════════════════════════════════════
   RENDER
════════════════════════════════════════════════ */

function renderMgmtUI(el, stats, logs, users = []) {
  const uniqueUsers = [...new Set(logs.map(l => l.user).filter(Boolean))];

  el.innerHTML = `

    <!-- STAT STRIP -->
    <div class="stats-row" style="margin-bottom:24px">
      ${mgmtStat('🏢', 'Companies',    stats.companies,    'Partners')}
      ${mgmtStat('🌍', 'Countries',    stats.countries,    'Markets')}
      ${mgmtStat('📝', 'Activities',   stats.activities,   'Workspace')}
      ${mgmtStat('📋', 'Agreements',   stats.agreements,   'Contracts')}
      ${mgmtStat('👤', 'Contacts',     stats.contacts,     'People')}
      ${mgmtStat('💰', 'Commissions',  stats.commissions,  'Fee rules')}
      ${mgmtStat('📅', 'Events',       stats.events,       'Calendar')}
      ${mgmtStat('💬', 'Observations', stats.observations, 'Feedback')}
    </div>

    <!-- SECTION 1 — ACTIVITY LOG -->
    <div class="dash-card" style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <div class="dash-title" style="margin-bottom:2px">📊 Full Activity Log</div>
          <div style="font-size:12px;color:var(--tx3)">Every action on the system — logins, changes, assignments</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <select class="filter-sel" id="mgmt-log-filter-type" style="height:36px;font-size:12px">
            <option value="">All actions</option>
            <option value="login">Logins</option>
            <option value="added">Added</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
            <option value="assigned">Assigned</option>
            <option value="DELETED_ACTIVITY">Deleted Activity</option>
            <option value="observation">Observations</option>
          </select>
          <select class="filter-sel" id="mgmt-log-filter-user" style="height:36px;font-size:12px">
            <option value="">All users</option>
            ${uniqueUsers.map(u => `<option value="${mgmtEsc(u)}">${mgmtEsc(u)}</option>`).join('')}
          </select>
          <button class="btn btn-ghost" id="mgmt-log-refresh" style="font-size:12px;height:36px">⟳ Refresh</button>
          <button class="btn btn-ghost" id="mgmt-export-log" style="font-size:12px;height:36px;color:var(--ok)">↓ Export</button>
        </div>
      </div>
      <div id="mgmt-log-table" style="max-height:500px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r2)">
        ${buildLogTable(logs)}
      </div>
    </div>

    <!-- LOG GROUP DELETE CONTROLS -->
    <div id="mgmt-log-group-del" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;margin-bottom:4px;align-items:center">
      <span style="font-size:11px;color:var(--tx3);font-weight:600;text-transform:uppercase;letter-spacing:0.6px">Delete by period:</span>
      <button class="btn btn-ghost" id="mgmt-del-today" style="font-size:12px;height:32px;color:var(--danger)">Today</button>
      <button class="btn btn-ghost" id="mgmt-del-week"  style="font-size:12px;height:32px;color:var(--danger)">This Week</button>
      <button class="btn btn-ghost" id="mgmt-del-month" style="font-size:12px;height:32px;color:var(--danger)">This Month</button>
      <button class="btn btn-ghost" id="mgmt-del-all-log" style="font-size:12px;height:32px;color:var(--danger)">Clear All Log</button>
    </div>

    <!-- SECTION 2 — HEALTH CHECK -->
    <div class="dash-card" style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:10px">
        <div>
          <div class="dash-title" style="margin-bottom:2px">🏥 Health Check</div>
          <div style="font-size:12px;color:var(--tx3)">Scan all companies for missing data before going live</div>
        </div>
        <button class="btn btn-primary" id="mgmt-run-health" style="font-size:13px">Run Health Check</button>
      </div>
      <div id="mgmt-health-results">
        <div style="font-size:13px;color:var(--tx3);padding:20px;text-align:center">
          Click "Run Health Check" to scan all ${stats.companies} companies
        </div>
      </div>
    </div>

    <!-- SECTION 2b — USER MANAGEMENT -->
    <div class="dash-card" style="margin-bottom:20px" id="mgmt-users-section">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <div class="dash-title" style="margin-bottom:2px">👥 System Users</div>
          <div style="font-size:12px;color:var(--tx3)">View, edit roles and remove user access</div>
        </div>
        <button class="btn btn-ghost" id="mgmt-users-refresh" style="font-size:12px;height:36px">⟳ Refresh</button>
      </div>
      <div id="mgmt-users-list">
        ${buildUsersTable(users)}
      </div>
    </div>

    <!-- SECTION 3 — EXPORT DATA -->
    <div class="dash-card" style="margin-bottom:0">
      <div class="dash-title" style="margin-bottom:4px">📤 Export Data</div>
      <div style="font-size:12px;color:var(--tx3);margin-bottom:16px">Download system data for backup, reporting or analysis</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px">

        ${mgmtExportCard('companies',   '🏢', 'Companies',             `${stats.companies} records · includes market name, status, dates`)}
        ${mgmtExportCard('countries',   '🌍', 'Countries & Transactions', 'All country links, tx types, currencies, limits')}
        ${mgmtExportCard('activities',  '📝', 'Activities',            `${stats.activities} records · workspace activity log`)}
        ${mgmtExportCard('contacts',    '👤', 'Contacts',              `${stats.contacts} records · all company contacts`)}
        ${mgmtExportCard('commissions', '💰', 'Commissions',           `${stats.commissions} rules · fee structures per company`)}
        ${mgmtExportCard('agreements',  '📋', 'Agreements',            `${stats.agreements} records · all additional agreements`)}
        ${mgmtExportCard('events',      '📅', 'Calendar Events',       `${stats.events} events · holidays, meetings, deadlines`)}
        ${mgmtExportCard('all',         '📦', 'Full Backup',           'Everything in one JSON file — complete system backup', true)}

      </div>
    </div>
  `;

  bindMgmtEvents(logs);
}

/* ════════════════════════════════════════════════
   LOG TABLE
════════════════════════════════════════════════ */

function buildLogTable(logs) {
  if (!logs || !logs.length) {
    return `<div class="empty-state" style="padding:40px">
      <div class="empty-icon">📋</div><p>No activity recorded yet</p>
    </div>`;
  }

  const ACTION_META = {
    login:            { icon: '🔑', label: 'Login',            color: 'var(--ok)'     },
    added:            { icon: '➕', label: 'Added',            color: 'var(--accent)' },
    updated:          { icon: '✏️', label: 'Updated',          color: 'var(--warn)'   },
    deleted:          { icon: '🗑', label: 'Deleted',          color: 'var(--danger)' },
    assigned:         { icon: '👤', label: 'Assigned',         color: 'var(--accent)' },
    DELETED_ACTIVITY: { icon: '🗑', label: 'Deleted Activity', color: 'var(--danger)' },
    observation:      { icon: '💬', label: 'Observation',      color: 'var(--tx2)'    }
  };

  const rows = logs.map(l => {
    const meta   = ACTION_META[l.action] || { icon: '•', label: l.action, color: 'var(--tx3)' };
    const timeAgo = mgmtTimeAgo(l.created_at);
    const fullTs  = new Date(l.created_at).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    return `
      <tr class="mgmt-log-row" data-action="${mgmtEsc(l.action)}" data-user="${mgmtEsc(l.user)}"
          style="border-bottom:1px solid var(--border);transition:background var(--ease)"
          onmouseenter="this.style.background='var(--glass)'" onmouseleave="this.style.background=''">
        <td style="padding:9px 12px;white-space:nowrap">
          <span style="font-size:13px;margin-right:5px">${meta.icon}</span>
          <span style="font-size:11px;font-weight:600;color:${meta.color};
            padding:2px 7px;border-radius:20px;background:${meta.color}20">
            ${meta.label}
          </span>
        </td>
        <td style="padding:9px 12px;font-size:13px;font-weight:500;max-width:160px;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${mgmtEsc(l.user)}
        </td>
        <td style="padding:9px 12px;font-size:13px;color:var(--accent);font-weight:500">
          ${l.company ? mgmtEsc(l.company) : '<span style="color:var(--tx3)">—</span>'}
        </td>
        <td style="padding:9px 12px;font-size:12px;color:var(--tx2);max-width:280px;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${l.details ? mgmtEsc(l.details) : ''}
        </td>
        <td style="padding:9px 12px;font-size:11px;color:var(--tx3);white-space:nowrap"
            title="${fullTs}">
          ${timeAgo}
        </td>
        <td style="padding:9px 12px">
          ${l.type === 'change' ? `<button class="panel-btn mgmt-log-del-row" data-id="${l.id.replace('al_','')}"
            style="width:24px;height:24px;font-size:10px;color:var(--danger)" title="Delete this entry">✕</button>` : ''}
        </td>
      </tr>`;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:var(--bg2);position:sticky;top:0;z-index:1">
          <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid var(--border)">Action</th>
          <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid var(--border)">User</th>
          <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid var(--border)">Company</th>
          <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid var(--border)">Details</th>
          <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid var(--border)">When</th>
          <th style="padding:9px 12px;border-bottom:1px solid var(--border);width:36px"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ════════════════════════════════════════════════
   HEALTH CHECK
════════════════════════════════════════════════ */

async function runHealthCheck() {
  const el  = document.getElementById('mgmt-health-results');
  const btn = document.getElementById('mgmt-run-health');
  if (!el || !btn) return;

  btn.textContent = 'Scanning…'; btn.disabled = true;
  el.innerHTML = `<div class="loading-state" style="padding:30px"><div class="spinner"></div>
    <p>Scanning ${window.ALL_COMPANIES.length} companies…</p></div>`;

  try {
    const cutoff90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

    const [contacts, commissions, activities, agreements] = await Promise.all([
      sbFetch('company_contacts?select=company_id').catch(() => []),
      sbFetch('commissions?select=company_id').catch(() => []),
      sbFetch('activities?select=company_id,activity_date&order=activity_date.desc').catch(() => []),
      sbFetch('company_agreements?select=company_id').catch(() => [])
    ]);

    const hasContacts   = new Set((contacts    || []).map(r => r.company_id));
    const hasCommission = new Set((commissions || []).map(r => r.company_id));
    const hasAgreement  = new Set((agreements  || []).map(r => r.company_id));

    const lastActivity = {};
    (activities || []).forEach(a => {
      if (a.company_id && !lastActivity[a.company_id]) lastActivity[a.company_id] = a.activity_date;
    });

    const issues = [];
    const clean  = [];

    window.ALL_COMPANIES.forEach(c => {
      const flags = [];

      if (!c.countries || c.countries.length === 0)
        flags.push({ level: 'error',   text: 'No countries linked' });

      if (!hasContacts.has(c.id))
        flags.push({ level: 'warning', text: 'No contacts added' });

      if (!hasCommission.has(c.id))
        flags.push({ level: 'warning', text: 'No commission defined' });

      if (!hasAgreement.has(c.id) && !c.agreement_date)
        flags.push({ level: 'info',    text: 'No agreement recorded' });

      const lastAct = lastActivity[c.id];
      if (!lastAct)
        flags.push({ level: 'warning', text: 'No activity ever logged' });
      else if (lastAct < cutoff90)
        flags.push({ level: 'info',    text: `Last activity ${mgmtFmtDate(lastAct)} — 90+ days ago` });

      if (flags.length > 0) issues.push({ company: c, flags });
      else clean.push(c);
    });

    const errors   = issues.filter(i => i.flags.some(f => f.level === 'error')).length;
    const warnings = issues.filter(i => !i.flags.some(f => f.level === 'error') && i.flags.some(f => f.level === 'warning')).length;
    const infos    = issues.length - errors - warnings;

    if (issues.length === 0) {
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;padding:20px;
            background:var(--ok-soft);border:1px solid var(--ok);border-radius:var(--r2)">
          <span style="font-size:32px">✅</span>
          <div>
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:15px;color:var(--ok)">All Clear</div>
            <div style="font-size:13px;color:var(--tx2);margin-top:2px">All ${clean.length} companies passed the health check</div>
          </div>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <div style="padding:10px 16px;background:var(--danger-soft);border:1px solid var(--danger);border-radius:var(--r2);font-size:13px;font-weight:600">
          🔴 ${errors} critical
        </div>
        <div style="padding:10px 16px;background:var(--warn-soft);border:1px solid var(--warn);border-radius:var(--r2);font-size:13px;font-weight:600">
          🟡 ${warnings} warnings
        </div>
        <div style="padding:10px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);font-size:13px;font-weight:600">
          ℹ️ ${infos} info
        </div>
        <div style="padding:10px 16px;background:var(--ok-soft);border:1px solid var(--ok);border-radius:var(--r2);font-size:13px;font-weight:600">
          ✅ ${clean.length} clean
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${issues.map(item => `
          <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);
              padding:14px 16px;cursor:pointer;transition:border-color var(--ease)"
            onmouseenter="this.style.borderColor='var(--border-h)'"
            onmouseleave="this.style.borderColor='var(--border)'"
            onclick="openCompanyDetail(${item.company.id})">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
              <div class="co-avatar" ${avatarStyle(item.company.name, 32, 7)}>${initials(item.company.name)}</div>
              <div style="font-family:'Syne',sans-serif;font-weight:600;font-size:14px">${mgmtEsc(item.company.name)}</div>
              ${relStatusTag(item.company.partnership_status||item.company.relationship_status||'Pipeline', item.company.partnership_direction, item.company.partnership_phase)}
              <span style="font-size:11px;color:var(--tx3);margin-left:auto">Click to open →</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:5px;padding-left:42px">
              ${item.flags.map(f => {
                const color = f.level === 'error' ? 'var(--danger)' : f.level === 'warning' ? 'var(--warn)' : 'var(--tx3)';
                const icon  = f.level === 'error' ? '🔴' : f.level === 'warning' ? '🟡' : 'ℹ️';
                return `<div style="font-size:12px;color:${color}">${icon} ${mgmtEsc(f.text)}</div>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </div>`;

  } catch (err) {
    el.innerHTML = `<p style="color:var(--danger);font-size:13px">Error: ${err.message}</p>`;
  } finally {
    btn.textContent = 'Run Health Check';
    btn.disabled = false;
  }
}

/* ════════════════════════════════════════════════
   BIND EVENTS
════════════════════════════════════════════════ */

function bindMgmtEvents(logs) {

  /* Log filter */
  const applyLogFilter = () => {
    const typeFilter = document.getElementById('mgmt-log-filter-type')?.value || '';
    const userFilter = document.getElementById('mgmt-log-filter-user')?.value || '';
    const filtered   = logs.filter(l =>
      (!typeFilter || l.action === typeFilter) &&
      (!userFilter || l.user  === userFilter)
    );
    const tbl = document.getElementById('mgmt-log-table');
    if (tbl) tbl.innerHTML = buildLogTable(filtered);
  };
  document.getElementById('mgmt-log-filter-type')?.addEventListener('change', applyLogFilter);
  document.getElementById('mgmt-log-filter-user')?.addEventListener('change', applyLogFilter);

  /* Refresh */
  document.getElementById('mgmt-log-refresh')?.addEventListener('click', () => renderManagement());

  /* Export log as CSV */
  document.getElementById('mgmt-export-log')?.addEventListener('click', () => {
    const headers = ['Action', 'User', 'Company', 'Details', 'Timestamp'];
    const rows    = logs.map(l => [l.action, l.user, l.company||'', l.details||'', l.created_at]);
    mgmtDownload(mgmtToCSV(headers, rows), `activity-log-${mgmtToday()}.csv`);
    showToast(`✓ ${logs.length} log entries exported`);
  });

  /* Health Check */
  document.getElementById('mgmt-run-health')?.addEventListener('click', runHealthCheck);

  /* ── Log row delete ── */
  document.getElementById('mgmt-log-table')?.addEventListener('click', async e => {
    const btn = e.target.closest('.mgmt-log-del-row');
    if (!btn) return;
    if (!confirm('Delete this log entry?')) return;
    const id = btn.dataset.id;
    btn.textContent = '…'; btn.disabled = true;
    try {
      await sbFetch(`activity_log?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
      btn.closest('tr').remove();
      showToast('Entry deleted');
    } catch(e) {
      showToast('⚠️ ' + e.message);
      btn.textContent = '✕'; btn.disabled = false;
    }
  });

  /* ── Delete by period (only deletes from activity_log, not observations) ── */
  async function deleteLogByPeriod(label, fromDate) {
    if (!confirm(`Delete all activity log entries from ${label}? This cannot be undone.`)) return;
    try {
      await sbFetch(`activity_log?created_at=gte.${fromDate}`, { method: 'DELETE', prefer: 'return=minimal' });
      showToast(`✓ Log entries from ${label} deleted`);
      renderManagement();
    } catch(e) { showToast('⚠️ ' + e.message); }
  }

  const todayStart = mgmtToday() + 'T00:00:00.000Z';
  const weekStart  = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0);
    return d.toISOString();
  })();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  document.getElementById('mgmt-del-today')?.addEventListener('click',
    () => deleteLogByPeriod('today', todayStart));
  document.getElementById('mgmt-del-week')?.addEventListener('click',
    () => deleteLogByPeriod('this week', weekStart));
  document.getElementById('mgmt-del-month')?.addEventListener('click',
    () => deleteLogByPeriod('this month', monthStart));
  document.getElementById('mgmt-del-all-log')?.addEventListener('click', async () => {
    if (prompt('Type CLEAR to delete the entire activity log:') !== 'CLEAR') {
      showToast('Cancelled'); return;
    }
    try {
      await sbFetch('activity_log?id=gt.0', { method: 'DELETE', prefer: 'return=minimal' });
      showToast('✓ Activity log cleared');
      renderManagement();
    } catch(e) { showToast('⚠️ ' + e.message); }
  });

  /* ── Users ── */
  document.getElementById('mgmt-users-refresh')?.addEventListener('click', async () => {
    const el = document.getElementById('mgmt-users-list');
    if (el) el.innerHTML = '<div class="loading-state" style="padding:20px"><div class="spinner"></div></div>';
    const users = await mgmtGetUsers();
    if (el) el.innerHTML = buildUsersTable(users);
    bindUserEvents();
  });
  bindUserEvents();

  /* Export cards */
  document.querySelectorAll('.mgmt-export-btn').forEach(btn => {
    btn.addEventListener('click', () => mgmtRunExport(btn.dataset.export, btn));
  });
}

/* ════════════════════════════════════════════════
   EXPORTS
════════════════════════════════════════════════ */

async function mgmtRunExport(type, btn) {
  const orig = btn.textContent;
  btn.textContent = '⏳…'; btn.disabled = true;

  try {
    switch (type) {

      case 'companies': {
        const data = await sbFetch('companies?select=*&order=name.asc');
        const h    = ['id','name','local_market_name','company_type','partnership_status','partnership_direction','partnership_phase','relationship_status',
          'country_of_origin','website','agreement_date','go_live_date','last_review_date',
          'contact_name','contact_email','contact_phone','notes'];
        mgmtDownload(mgmtToCSV(h, data.map(r => h.map(k => r[k]))), `companies-${mgmtToday()}.csv`);
        showToast(`✓ ${data.length} companies exported`);
        break;
      }

      case 'countries': {
        const rows = [];
        const h    = ['Company','Local Market Name','Country','Direction',
          'Transaction Type','Currencies','Segments','Limit Min','Limit Max','Limit Currency','Limit Period'];
        window.ALL_COMPANIES.forEach(c => {
          (c.countries || []).forEach(co => {
            const txs = co.transactions && co.transactions.length ? co.transactions : [null];
            txs.forEach(tx => rows.push([
              c.name, c.local_market_name||'', co.name, co.direction||'',
              tx?.txType||'', (tx?.currencies||[]).join(', '), (tx?.segments||[]).join(', '),
              tx?.limitMin??'', tx?.limitMax??'', tx?.limitCurrency||'', tx?.limitPeriod||''
            ]));
          });
        });
        mgmtDownload(mgmtToCSV(h, rows), `countries-transactions-${mgmtToday()}.csv`);
        showToast(`✓ ${rows.length} rows exported`);
        break;
      }

      case 'activities': {
        const data = await sbFetch('activities?select=*&order=created_at.desc');
        const h    = ['id','company_name','activity_date','activity_type','note',
          'status','urgency','next_action','follow_up_date','doc_ref','user_email','created_at'];
        mgmtDownload(mgmtToCSV(h, data.map(r => h.map(k => r[k]))), `activities-${mgmtToday()}.csv`);
        showToast(`✓ ${data.length} activities exported`);
        break;
      }

      case 'contacts': {
        const data = await sbFetch('company_contacts?select=*&order=name.asc');
        const h    = ['id','company_id','name','role','email','phone','is_primary','notes'];
        mgmtDownload(mgmtToCSV(h, data.map(r => h.map(k => r[k]))), `contacts-${mgmtToday()}.csv`);
        showToast(`✓ ${data.length} contacts exported`);
        break;
      }

      case 'commissions': {
        const data = await sbFetch('commissions?select=*&order=company_id.asc');
        const h    = ['id','company_id','country_id','type','value','currency','unit','notes'];
        mgmtDownload(mgmtToCSV(h, data.map(r => h.map(k => r[k]))), `commissions-${mgmtToday()}.csv`);
        showToast(`✓ ${data.length} commissions exported`);
        break;
      }

      case 'agreements': {
        const data = await sbFetch('company_agreements?select=*&order=company_id.asc');
        const h    = ['id','company_id','name','agreement_date','notes','created_at'];
        mgmtDownload(mgmtToCSV(h, data.map(r => h.map(k => r[k]))), `agreements-${mgmtToday()}.csv`);
        showToast(`✓ ${data.length} agreements exported`);
        break;
      }

      case 'events': {
        const data = await sbFetch('events?select=*&order=event_date.asc');
        const h    = ['id','name','event_date','event_type','reminder_days',
          'is_noticed','notes','is_recurring','created_by','created_at'];
        mgmtDownload(mgmtToCSV(h, data.map(r => h.map(k => r[k]))), `events-${mgmtToday()}.csv`);
        showToast(`✓ ${data.length} events exported`);
        break;
      }

      case 'all': {
        showToast('⏳ Building full backup…');
        const [companies, activities, contacts, commissions, agreements, events, observations] =
          await Promise.all([
            sbFetch('companies?select=*').catch(() => []),
            sbFetch('activities?select=*').catch(() => []),
            sbFetch('company_contacts?select=*').catch(() => []),
            sbFetch('commissions?select=*').catch(() => []),
            sbFetch('company_agreements?select=*').catch(() => []),
            sbFetch('events?select=*').catch(() => []),
            sbFetch('observations?select=*').catch(() => [])
          ]);
        const payload = {
          exportDate:   new Date().toISOString(),
          exportedBy:   window.CURRENT_USER_NAME || window.CURRENT_USER_EMAIL,
          version:      '2.1',
          companies:    companies    || [],
          activities:   activities   || [],
          contacts:     contacts     || [],
          commissions:  commissions  || [],
          agreements:   agreements   || [],
          events:       events       || [],
          observations: observations || [],
          countries:    window.ALL_COUNTRIES || []
        };
        mgmtDownload(JSON.stringify(payload, null, 2),
          `full-backup-${mgmtToday()}.json`, 'application/json');
        showToast('✓ Full backup exported');
        break;
      }
    }
  } catch (err) {
    showToast('⚠️ Export failed: ' + err.message);
  } finally {
    btn.textContent = orig;
    btn.disabled = false;
  }
}

/* ════════════════════════════════════════════════
   USER MANAGEMENT
════════════════════════════════════════════════ */

function buildUsersTable(users) {
  if (!users || !users.length) {
    return `<div class="empty-state" style="padding:30px">
      <div class="empty-icon">👥</div>
      <p>No users found</p>
    </div>`;
  }

  const myName = (window.CURRENT_USER_NAME || '').toLowerCase();

  return `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${users.map(u => {
        const isSelf    = (u.display_name||'').toLowerCase() === myName;
        const isAdmin   = u.role === 'admin';
        const roleColor = isAdmin ? 'var(--accent)' : 'var(--tx3)';
        const roleBg    = isAdmin ? 'var(--ac-soft)'  : 'var(--bg3)';
        const initial   = (u.display_name||'?')[0].toUpperCase();
        const name      = u.display_name || '(no name)';
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;
              background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2)">
            <!-- Avatar -->
            <div style="width:38px;height:38px;border-radius:50%;background:var(--ac-soft);
                display:flex;align-items:center;justify-content:center;
                font-family:'Syne',sans-serif;font-weight:700;font-size:15px;
                color:var(--accent);flex-shrink:0">
              ${initial}
            </div>
            <!-- Name + role badge -->
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="font-weight:600;font-size:14px">${mgmtEsc(name)}</span>
                <span style="font-size:10px;padding:2px 8px;border-radius:20px;font-weight:700;
                    text-transform:uppercase;background:${roleBg};color:${roleColor};
                    border:1px solid ${roleColor}44">${u.role||'viewer'}</span>
                ${isSelf ? '<span style="font-size:11px;color:var(--tx3)">(you)</span>' : ''}
              </div>
            </div>
            <!-- Controls — same row, right side -->
            ${!isSelf ? `
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap">
              <select class="form-select mgmt-role-select" data-id="${u.id}"
                  style="height:32px;font-size:12px;padding:0 8px;min-width:100px">
                <option value="admin"  ${u.role==='admin'  ? 'selected':''}>Admin</option>
                <option value="viewer" ${u.role==='viewer' ? 'selected':''}>Viewer</option>
              </select>
              <button class="btn btn-ghost mgmt-edit-name-btn" data-id="${u.id}"
                  data-name="${mgmtEsc(u.display_name||'')}"
                  style="font-size:12px;padding:5px 12px;height:32px">
                ✏️ Rename
              </button>
              <button class="btn btn-ghost mgmt-del-user-btn" data-id="${u.id}"
                  data-name="${mgmtEsc(name)}"
                  style="font-size:12px;padding:5px 12px;height:32px;color:var(--danger)">
                Remove
              </button>
            </div>` : ''}
          </div>`;
      }).join('')}
    </div>

    <!-- How to add a new user -->
    <div style="margin-top:16px;padding:14px 16px;background:var(--ac-soft);
        border-left:3px solid var(--accent);border-radius:var(--r2);font-size:13px;
        color:var(--tx2);line-height:1.7">
      <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;
          color:var(--accent);margin-bottom:6px">➕ How to add a new user</div>
      <div><strong>1.</strong> Go to <strong>Supabase Dashboard → Authentication → Users → Add User</strong></div>
      <div><strong>2.</strong> Enter their email and a temporary password</div>
      <div><strong>3.</strong> Go to <strong>Table Editor → profiles → Insert Row</strong></div>
      <div><strong>4.</strong> Set their <strong>id</strong> (copy from Auth Users), <strong>display_name</strong>, and <strong>role</strong> (admin or viewer)</div>
      <div><strong>5.</strong> Done — they can now log in and will appear here</div>
    </div>`;
}

function bindUserEvents() {
  /* Role change */
  document.querySelectorAll('.mgmt-role-select').forEach(sel => {
    sel.addEventListener('change', async function() {
      const uid  = this.dataset.id;
      const role = this.value;
      const prev = this.getAttribute('data-prev') || (role === 'admin' ? 'viewer' : 'admin');
      if (!confirm(`Change role to ${role.toUpperCase()}?`)) { this.value = prev; return; }
      this.setAttribute('data-prev', role);
      try {
        await sbFetch(`profiles?id=eq.${uid}`, {
          method: 'PATCH', body: JSON.stringify({ role })
        });
        showToast(`✓ Role updated to ${role}`);
        const users = await mgmtGetUsers();
        const el = document.getElementById('mgmt-users-list');
        if (el) { el.innerHTML = buildUsersTable(users); bindUserEvents(); }
      } catch(e) { showToast('⚠️ ' + e.message); this.value = prev; }
    });
    sel.setAttribute('data-prev', sel.value);
  });

  /* Edit display name */
  document.querySelectorAll('.mgmt-edit-name-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const uid      = this.dataset.id;
      const current  = this.dataset.name;
      const newName  = prompt('Enter new display name:', current);
      if (!newName || newName.trim() === current) return;
      try {
        await sbFetch(`profiles?id=eq.${uid}`, {
          method: 'PATCH', body: JSON.stringify({ display_name: newName.trim() })
        });
        showToast(`✓ Name updated to "${newName.trim()}"`);
        const users = await mgmtGetUsers();
        const el = document.getElementById('mgmt-users-list');
        if (el) { el.innerHTML = buildUsersTable(users); bindUserEvents(); }
      } catch(e) { showToast('⚠️ ' + e.message); }
    });
  });

  /* Remove user */
  document.querySelectorAll('.mgmt-del-user-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const uid  = this.dataset.id;
      const name = this.dataset.name;
      if (!confirm(`Remove "${name}" from the system? They will lose access immediately.`)) return;
      try {
        await sbFetch(`profiles?id=eq.${uid}`, { method: 'DELETE', prefer: 'return=minimal' });
        showToast(`✓ ${name} removed`);
        const users = await mgmtGetUsers();
        const el = document.getElementById('mgmt-users-list');
        if (el) { el.innerHTML = buildUsersTable(users); bindUserEvents(); }
      } catch(e) { showToast('⚠️ ' + e.message); }
    });
  });
}

/* ════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════ */

function mgmtStat(icon, label, value, sub) {
  return `
    <div class="stat-card">
      <div class="stat-label">${icon} ${label}</div>
      <div class="stat-val">${value}</div>
      <div class="stat-sub">${sub}</div>
    </div>`;
}

function mgmtExportCard(type, icon, label, sub, primary = false) {
  return `
    <div style="background:var(--bg);border:1px solid ${primary ? 'var(--accent)' : 'var(--border)'};
        border-radius:var(--r2);padding:14px 16px;display:flex;flex-direction:column;gap:4px">
      <div style="font-size:22px;margin-bottom:4px">${icon}</div>
      <div style="font-family:'Syne',sans-serif;font-weight:600;font-size:13px">${label}</div>
      <div style="font-size:11px;color:var(--tx3);flex:1;line-height:1.5">${sub}</div>
      <button class="${primary ? 'btn btn-primary' : 'btn btn-ghost'} mgmt-export-btn"
          data-export="${type}"
          style="width:100%;justify-content:center;margin-top:8px;font-size:12px">
        ↓ ${primary ? 'Export JSON' : 'Export CSV'}
      </button>
    </div>`;
}

function mgmtToCSV(headers, rows) {
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  return '\uFEFF' + [
    headers.map(esc).join(','),
    ...rows.map(r => (Array.isArray(r) ? r : Object.values(r)).map(esc).join(','))
  ].join('\n');
}

function mgmtDownload(content, filename, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function mgmtTimeAgo(ts) {
  if (!ts) return '—';
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function mgmtFmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function mgmtToday() {
  return new Date().toISOString().slice(0, 10);
}

function mgmtEsc(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])
  );
}