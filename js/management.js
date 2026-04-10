/* ════════════════════════════════════════════════
   js/management.js  —  Mohammed only
   Data Control only - using existing dashboard styles
════════════════════════════════════════════════ */

function isSuperAdmin() {
  var name  = (window.CURRENT_USER_NAME  || '').trim().toLowerCase();
  var email = (window.CURRENT_USER_EMAIL || '').trim().toLowerCase();
  return name === 'mohammed' || email === 'user1@gmail.com';
}

async function renderManagement() {
  var el = document.getElementById('mgmt-content');
  if (!el) return;
  
  if (!isSuperAdmin()) {
    el.innerHTML = `
      <div class="empty-state" style="padding:80px 20px; text-align:center">
        <div class="empty-icon" style="font-size:48px; margin-bottom:16px">🔒</div>
        <p style="font-size:18px; font-weight:600; margin-bottom:8px">Access Restricted</p>
        <p style="color:var(--tx3); font-size:14px">This page is only accessible to Mohammed</p>
      </div>`;
    return;
  }
  
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading management data...</p></div>';
  
  try {
    const stats = await mgmtGetStats();
    renderMgmtContent(el, stats);
  } catch(err) {
    el.innerHTML = '<p style="color:var(--danger); padding:20px">Error: ' + err.message + '</p>';
  }
}

async function mgmtGetStats() {
  try {
    const [co, ac, al, ct, cm, ev] = await Promise.all([
      sbFetch('companies?select=id').catch(() => []),
      sbFetch('activities?select=id').catch(() => []),
      sbFetch('activity_log?select=id').catch(() => []),
      sbFetch('company_contacts?select=id').catch(() => []),
      sbFetch('commissions?select=id').catch(() => []),
      sbFetch('events?select=id').catch(() => [])
    ]);
    return {
      companies: (co || []).length,
      activities: (ac || []).length,
      actLog: (al || []).length,
      contacts: (ct || []).length,
      commissions: (cm || []).length,
      events: (ev || []).length
    };
  } catch(e) {
    return { companies: 0, activities: 0, actLog: 0, contacts: 0, commissions: 0 };
  }
}

function renderMgmtContent(el, stats) {
  // Use EXISTING classes from dashboard
  el.innerHTML = `
    <div>
      <div class="sec-label" style="margin-bottom:12px">Database Overview</div>
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">Companies</div>
          <div class="stat-val">${stats.companies}</div>
          <div class="stat-sub">Total partners</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Activities</div>
          <div class="stat-val">${stats.activities}</div>
          <div class="stat-sub">Workspace entries</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tracker Log</div>
          <div class="stat-val">${stats.actLog}</div>
          <div class="stat-sub">Change history</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Contacts</div>
          <div class="stat-val">${stats.contacts}</div>
          <div class="stat-sub">Company contacts</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Commissions</div>
          <div class="stat-val">${stats.commissions}</div>
          <div class="stat-sub">Fee structures</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Events</div>
          <div class="stat-val">${stats.events || 0}</div>
          <div class="stat-sub">Calendar events</div>
        </div>
      </div>
    </div>

    <div class="dash-card" style="margin-top:20px">
      <div class="dash-title" style="color:var(--danger); margin-bottom:8px">⚠️ Data Control</div>
      <p style="font-size:13px; color:var(--tx2); margin-bottom:16px">Use these to clean test data before going live. All actions are permanent and cannot be undone.</p>
      
      <div style="display:flex; flex-direction:column; gap:10px">
        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:var(--bg); border:1px solid var(--border); border-radius:var(--r2)">
          <div>
            <div style="font-size:14px; font-weight:600; margin-bottom:4px">Clear All Activities</div>
            <div style="font-size:12px; color:var(--tx2)">Deletes all workspace activities (${stats.activities} records)</div>
          </div>
          <button class="btn btn-ghost" id="mgmt-clear-activities" style="color:var(--danger)">Clear</button>
        </div>
        
        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:var(--bg); border:1px solid var(--border); border-radius:var(--r2)">
          <div>
            <div style="font-size:14px; font-weight:600; margin-bottom:4px">Clear Activity Log</div>
            <div style="font-size:12px; color:var(--tx2)">Clears FI Tracker recent activity log (${stats.actLog} records)</div>
          </div>
          <button class="btn btn-ghost" id="mgmt-clear-log" style="color:var(--danger)">Clear</button>
        </div>
        
        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:var(--bg); border:1px solid var(--border); border-radius:var(--r2)">
          <div>
            <div style="font-size:14px; font-weight:600; margin-bottom:4px">Reset All Data</div>
            <div style="font-size:12px; color:var(--tx2)">Wipes activities, logs, contacts, commissions, observations, and events — keeps companies & countries</div>
          </div>
          <button class="btn btn-ghost" id="mgmt-reset-all" style="color:var(--danger)">Reset All</button>
        </div>
      </div>
    </div>

    <div class="dash-card" style="margin-top:20px">
      <div class="dash-title" style="margin-bottom:8px">📝 How to Add New Users</div>
      <p style="font-size:13px; color:var(--tx2); margin-bottom:12px">To add a new admin or viewer to the system:</p>
      
      <div style="background:var(--bg); border:1px solid var(--border); border-radius:var(--r2); padding:14px 16px; margin-bottom:16px">
        <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border)">
          <div style="width:24px; height:24px; background:var(--ac-soft); color:var(--accent); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700">1</div>
          <div style="font-size:13px; color:var(--tx2)">Go to <strong>Supabase Dashboard</strong> → Authentication → Users</div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border)">
          <div style="width:24px; height:24px; background:var(--ac-soft); color:var(--accent); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700">2</div>
          <div style="font-size:13px; color:var(--tx2)">Click <strong>"Add User"</strong> or <strong>"Invite User"</strong></div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border)">
          <div style="width:24px; height:24px; background:var(--ac-soft); color:var(--accent); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700">3</div>
          <div style="font-size:13px; color:var(--tx2)">Enter their email and set a temporary password</div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border)">
          <div style="width:24px; height:24px; background:var(--ac-soft); color:var(--accent); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700">4</div>
          <div style="font-size:13px; color:var(--tx2)">After they sign up, go to <strong>Table Editor → profiles</strong></div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; padding:6px 0">
          <div style="width:24px; height:24px; background:var(--ac-soft); color:var(--accent); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700">5</div>
          <div style="font-size:13px; color:var(--tx2)">Add a row with their <strong>user ID</strong>, set <strong>role</strong> (admin/viewer), and <strong>display_name</strong></div>
        </div>
      </div>
      
      <div style="font-size:12px; color:var(--tx3); padding:10px 14px; background:var(--ac-soft); border-radius:var(--r2); border-left:3px solid var(--accent)">
        💡 <strong>Tip:</strong> You can find the user ID in Authentication → Users after they sign up for the first time.
      </div>
    </div>
  `;

  bindMgmtEvents(el);
}

function bindMgmtEvents(el) {
  var clearAct = document.getElementById('mgmt-clear-activities');
  if (clearAct) {
    clearAct.addEventListener('click', async function() {
      if (!confirm('Delete ALL workspace activities? This cannot be undone.')) return;
      clearAct.textContent = '…';
      clearAct.disabled = true;
      try {
        await sbFetch('activities?id=gt.0', { method: 'DELETE', prefer: 'return=minimal' });
        showToast('✓ All activities cleared');
        renderManagement();
      } catch(e) {
        showToast('⚠️ ' + e.message);
        clearAct.textContent = 'Clear';
        clearAct.disabled = false;
      }
    });
  }

  var clearLog = document.getElementById('mgmt-clear-log');
  if (clearLog) {
    clearLog.addEventListener('click', async function() {
      if (!confirm('Clear the activity log? This cannot be undone.')) return;
      clearLog.textContent = '…';
      clearLog.disabled = true;
      try {
        await sbFetch('activity_log?id=gt.0', { method: 'DELETE', prefer: 'return=minimal' });
        showToast('✓ Activity log cleared');
        renderManagement();
      } catch(e) {
        showToast('⚠️ ' + e.message);
        clearLog.textContent = 'Clear';
        clearLog.disabled = false;
      }
    });
  }

  var resetAll = document.getElementById('mgmt-reset-all');
  if (resetAll) {
    resetAll.addEventListener('click', async function() {
      var confirmed = prompt('This will delete ALL activities, logs, contacts, commissions, and observations.\nCompanies and countries will be kept.\n\nType RESET to confirm:');
      if (confirmed !== 'RESET') {
        showToast('Reset cancelled');
        return;
      }
      resetAll.textContent = '…';
      resetAll.disabled = true;
      try {
        await Promise.all([
          sbFetch('activities?id=gt.0',       { method: 'DELETE', prefer: 'return=minimal' }),
          sbFetch('activity_log?id=gt.0',     { method: 'DELETE', prefer: 'return=minimal' }),
          sbFetch('company_contacts?id=gt.0', { method: 'DELETE', prefer: 'return=minimal' }),
          sbFetch('commissions?id=gt.0',      { method: 'DELETE', prefer: 'return=minimal' }),
          sbFetch('observations?id=gt.0',     { method: 'DELETE', prefer: 'return=minimal' }),
          sbFetch('events?id=gt.0',           { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {})
        ]);
        showToast('✓ All data reset. Companies and countries kept.');
        renderManagement();
      } catch(e) {
        showToast('⚠️ ' + e.message);
        resetAll.textContent = 'Reset All';
        resetAll.disabled = false;
      }
    });
  }
}