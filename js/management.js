/* ════════════════════════════════════════════════
   js/management.js  —  Mohammed only
   Data Control & User Management (FIXED)
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
    const users = await mgmtGetAllUsers();
    const pendingObs = await dbGetPendingObservationCount();
    renderMgmtContent(el, stats, users, pendingObs);
  } catch(err) {
    console.error('Management error:', err);
    el.innerHTML = '<p style="color:var(--danger); padding:20px">Error: ' + err.message + '</p>';
  }
}

async function mgmtGetStats() {
  try {
    const [co, ac, al, ct, cm, obs, evt] = await Promise.all([
      sbFetch('companies?select=id').catch(() => []),
      sbFetch('activities?select=id').catch(() => []),
      sbFetch('activity_log?select=id').catch(() => []),
      sbFetch('company_contacts?select=id').catch(() => []),
      sbFetch('commissions?select=id').catch(() => []),
      sbFetch('observations?select=id').catch(() => []),
      sbFetch('events?select=id').catch(() => [])
    ]);
    return {
      companies: (co || []).length,
      activities: (ac || []).length,
      actLog: (al || []).length,
      contacts: (ct || []).length,
      commissions: (cm || []).length,
      observations: (obs || []).length,
      events: (evt || []).length
    };
  } catch(e) {
    return { companies: 0, activities: 0, actLog: 0, contacts: 0, commissions: 0, observations: 0, events: 0 };
  }
}

async function mgmtGetAllUsers() {
  try {
    // Get all profiles from your profiles table
    const profiles = await sbFetch('profiles?select=*&order=created_at.desc');
    return profiles || [];
  } catch(e) {
    console.warn('Could not fetch profiles:', e);
    return [];
  }
}

async function mgmtUpdateUserRole(userId, newRole) {
  try {
    await sbFetch(`profiles?id=eq.${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole })
    });
    return true;
  } catch(e) {
    throw new Error(e.message);
  }
}

async function mgmtDeleteUserProfile(userId) {
  try {
    await sbFetch(`profiles?id=eq.${userId}`, { method: 'DELETE', prefer: 'return=minimal' });
    return true;
  } catch(e) {
    throw new Error(e.message);
  }
}

// Function to manually add a user profile (since Supabase Auth doesn't auto-create profiles)
async function mgmtAddUserProfile(userId, email, displayName, role) {
  try {
    const [profile] = await sbFetch('profiles', {
      method: 'POST',
      body: JSON.stringify({
        id: userId,
        email: email,
        display_name: displayName,
        role: role || 'viewer'
      })
    });
    return profile;
  } catch(e) {
    throw new Error(e.message);
  }
}

function renderMgmtContent(el, stats, users, pendingObs) {
  el.innerHTML = `
    <div>
      <!-- Stats Overview -->
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
          <div class="stat-label">Observations</div>
          <div class="stat-val">${stats.observations}</div>
          <div class="stat-sub">User feedback</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Events</div>
          <div class="stat-val">${stats.events}</div>
          <div class="stat-sub">Calendar events</div>
        </div>
      </div>
    </div>

    <!-- Manual User Addition Section -->
    <div class="dash-card" style="margin-top:20px">
      <div class="dash-title" style="margin-bottom:8px">➕ Manually Add User Profile</div>
      <p style="font-size:13px; color:var(--tx2); margin-bottom:16px">After a user signs up in Supabase Auth, add their profile here to grant system access.</p>
      
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:12px; margin-bottom:16px">
        <input type="text" id="mgmt-user-id" class="form-input" placeholder="User ID (from Supabase Auth)" style="font-size:13px">
        <input type="email" id="mgmt-user-email" class="form-input" placeholder="Email" style="font-size:13px">
        <input type="text" id="mgmt-user-name" class="form-input" placeholder="Display Name" style="font-size:13px">
        <select id="mgmt-user-role" class="form-select" style="font-size:13px">
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
        <button class="btn btn-primary" id="mgmt-add-user" style="font-size:13px">+ Add User Profile</button>
      </div>
      
      <div style="font-size:12px; color:var(--tx3); padding:8px 12px; background:var(--ac-soft); border-radius:var(--r2)">
        💡 <strong>How to get User ID:</strong> Go to Supabase Dashboard → Authentication → Users → Click on a user → Copy their ID (UUID)
      </div>
    </div>

    <!-- User Management Table -->
    <div class="dash-card" style="margin-top:20px">
      <div class="dash-title" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px">
        <span>👥 Existing Users (${users.length})</span>
        <button class="btn btn-ghost" id="mgmt-refresh-users" style="font-size:11px; padding:4px 10px">⟳ Refresh</button>
      </div>
      <p style="font-size:13px; color:var(--tx2); margin-bottom:16px">Users with profiles in the system</p>
      
      <div style="overflow-x:auto">
        <table style="width:100%; border-collapse:collapse">
          <thead>
            <tr style="background:var(--bg2); border-bottom:1px solid var(--border)">
              <th style="padding:10px; text-align:left">Display Name</th>
              <th style="padding:10px; text-align:left">Email / ID</th>
              <th style="padding:10px; text-align:left">Role</th>
              <th style="padding:10px; text-align:left">Joined</th>
              <th style="padding:10px; text-align:center">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(user => `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px">
                  <div style="font-weight:600">${escapeHtml(user.display_name || '—')}</div>
                 </td>
                <td style="padding:10px; font-size:12px; color:var(--tx3)">
                  ${escapeHtml(user.email || user.id?.substring(0, 16) + '...' || '—')}
                 </td>
                <td style="padding:10px">
                  <select class="user-role-select" data-id="${user.id}" style="padding:4px 8px; border-radius:6px; background:var(--bg3); border:1px solid var(--border); font-size:12px">
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                  </select>
                 </td>
                <td style="padding:10px; font-size:12px; color:var(--tx3)">${user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</td>
                <td style="padding:10px; text-align:center">
                  <button class="btn btn-ghost delete-user-btn" data-id="${user.id}" data-name="${escapeHtml(user.display_name || 'User')}" style="font-size:11px; padding:4px 8px; color:var(--danger)">Remove</button>
                 </td>
               </tr>
            `).join('')}
            ${users.length === 0 ? '<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--tx3)">No user profiles found. Add one using the form above.</td></tr>' : ''}
          </tbody>
         </table>
      </div>
    </div>

    <!-- Pending Observations Card -->
    <div class="dash-card" style="margin-top:20px; ${pendingObs > 0 ? 'border-left:3px solid var(--danger)' : ''}">
      <div class="dash-title" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px">
        <span>📋 Pending Observations</span>
        <span class="status-tag ${pendingObs > 0 ? 'status-active' : 'status-inactive'}" style="font-size:11px">${pendingObs} pending</span>
      </div>
      <p style="font-size:13px; color:var(--tx2); margin-bottom:12px">Observations from viewers that need admin review</p>
      <button class="btn btn-primary" id="mgmt-view-observations" style="font-size:12px">Open Inbox →</button>
    </div>

    <!-- Data Control Section -->
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
            <div style="font-size:14px; font-weight:600; margin-bottom:4px">Clear All Events</div>
            <div style="font-size:12px; color:var(--tx2)">Deletes all calendar events (${stats.events} records)</div>
          </div>
          <button class="btn btn-ghost" id="mgmt-clear-events" style="color:var(--danger)">Clear</button>
        </div>
        
        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:var(--bg); border:1px solid var(--border); border-radius:var(--r2)">
          <div>
            <div style="font-size:14px; font-weight:600; margin-bottom:4px">Reset All Data</div>
            <div style="font-size:12px; color:var(--tx2)">Wipes activities, logs, contacts, commissions, observations, events — keeps companies & countries</div>
          </div>
          <button class="btn btn-ghost" id="mgmt-reset-all" style="color:var(--danger)">Reset All</button>
        </div>
      </div>
    </div>

    <!-- Export Section - FIXED with correct data -->
    <div class="dash-card" style="margin-top:20px">
      <div class="dash-title" style="margin-bottom:8px">📤 Export Data</div>
      <p style="font-size:13px; color:var(--tx2); margin-bottom:16px">Export system data for backup or analysis</p>
      
      <div style="display:flex; gap:10px; flex-wrap:wrap">
        <button class="btn btn-ghost" id="mgmt-export-companies">🏢 Export Companies</button>
        <button class="btn btn-ghost" id="mgmt-export-activities">📝 Export Activities</button>
        <button class="btn btn-ghost" id="mgmt-export-events">📅 Export Events</button>
        <button class="btn btn-ghost" id="mgmt-export-contacts">👤 Export Contacts</button>
        <button class="btn btn-ghost" id="mgmt-export-all">📦 Export All (JSON)</button>
      </div>
    </div>

    <!-- System Info -->
    <div class="dash-card" style="margin-top:20px">
      <div class="dash-title" style="margin-bottom:8px">ℹ️ System Information</div>
      <div style="font-size:13px; color:var(--tx2); line-height:1.8">
        <div><strong>App Version:</strong> v2.0.0</div>
        <div><strong>Last Login:</strong> ${new Date().toLocaleString()}</div>
        <div><strong>User Role:</strong> ${window.USER_ROLE}</div>
        <div><strong>Total Companies:</strong> ${stats.companies}</div>
        <div><strong>Total Countries:</strong> ${window.ALL_COUNTRIES?.length || 0}</div>
      </div>
    </div>

    <!-- How to Add New Users - Updated instructions -->
    <div class="dash-card" style="margin-top:20px">
      <div class="dash-title" style="margin-bottom:8px">📝 How to Add New Users (Complete Guide)</div>
      
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
          <div style="font-size:13px; color:var(--tx2)">Enter their email and set a temporary password. They will receive an email to confirm.</div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border)">
          <div style="width:24px; height:24px; background:var(--ac-soft); color:var(--accent); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700">4</div>
          <div style="font-size:13px; color:var(--tx2)">After they confirm, go back to <strong>Authentication → Users</strong> and copy their <strong>User ID (UUID)</strong></div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border)">
          <div style="width:24px; height:24px; background:var(--ac-soft); color:var(--accent); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700">5</div>
          <div style="font-size:13px; color:var(--tx2)">Use the <strong>"Manually Add User Profile"</strong> form above with their ID, email, name, and role</div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; padding:6px 0">
          <div style="width:24px; height:24px; background:var(--ac-soft); color:var(--accent); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700">6</div>
          <div style="font-size:13px; color:var(--tx2)">Done! The user can now log in with their email and password.</div>
        </div>
      </div>
      
      <div style="font-size:12px; color:var(--tx3); padding:10px 14px; background:var(--ac-soft); border-radius:var(--r2); border-left:3px solid var(--accent)">
        💡 <strong>Important:</strong> Users must be added to Supabase Auth FIRST, then their profile must be added here. The profile gives them access to the FI Tracker system.
      </div>
    </div>
  `;

  bindMgmtEvents(el);
}

function bindMgmtEvents(el) {
  // Add User Profile
  var addUserBtn = document.getElementById('mgmt-add-user');
  if (addUserBtn) {
    addUserBtn.addEventListener('click', async function() {
      const userId = document.getElementById('mgmt-user-id').value.trim();
      const email = document.getElementById('mgmt-user-email').value.trim();
      const displayName = document.getElementById('mgmt-user-name').value.trim();
      const role = document.getElementById('mgmt-user-role').value;
      
      if (!userId) {
        showToast('⚠️ Please enter the User ID from Supabase Auth');
        return;
      }
      if (!email) {
        showToast('⚠️ Please enter the user email');
        return;
      }
      if (!displayName) {
        showToast('⚠️ Please enter a display name');
        return;
      }
      
      addUserBtn.textContent = 'Adding...';
      addUserBtn.disabled = true;
      
      try {
        await mgmtAddUserProfile(userId, email, displayName, role);
        showToast(`✓ User ${displayName} added as ${role}`);
        document.getElementById('mgmt-user-id').value = '';
        document.getElementById('mgmt-user-email').value = '';
        document.getElementById('mgmt-user-name').value = '';
        renderManagement();
      } catch(e) {
        showToast('⚠️ ' + e.message);
      } finally {
        addUserBtn.textContent = '+ Add User Profile';
        addUserBtn.disabled = false;
      }
    });
  }
  
  // Refresh Users
  var refreshBtn = document.getElementById('mgmt-refresh-users');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => renderManagement());
  }

  // Clear Activities
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

  // Clear Activity Log
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

  // Clear Events
  var clearEvents = document.getElementById('mgmt-clear-events');
  if (clearEvents) {
    clearEvents.addEventListener('click', async function() {
      if (!confirm('Delete ALL calendar events? This cannot be undone.')) return;
      clearEvents.textContent = '…';
      clearEvents.disabled = true;
      try {
        await sbFetch('events?id=gt.0', { method: 'DELETE', prefer: 'return=minimal' });
        showToast('✓ All events cleared');
        renderManagement();
        if (typeof renderCalendar === 'function') renderCalendar();
      } catch(e) {
        showToast('⚠️ ' + e.message);
        clearEvents.textContent = 'Clear';
        clearEvents.disabled = false;
      }
    });
  }

  // Reset All Data
  var resetAll = document.getElementById('mgmt-reset-all');
  if (resetAll) {
    resetAll.addEventListener('click', async function() {
      var confirmed = prompt('This will delete ALL activities, logs, contacts, commissions, observations, and events.\nCompanies and countries will be kept.\n\nType RESET to confirm:');
      if (confirmed !== 'RESET') {
        showToast('Reset cancelled');
        return;
      }
      resetAll.textContent = '…';
      resetAll.disabled = true;
      try {
        await Promise.all([
          sbFetch('activities?id=gt.0', { method: 'DELETE', prefer: 'return=minimal' }),
          sbFetch('activity_log?id=gt.0', { method: 'DELETE', prefer: 'return=minimal' }),
          sbFetch('company_contacts?id=gt.0', { method: 'DELETE', prefer: 'return=minimal' }),
          sbFetch('commissions?id=gt.0', { method: 'DELETE', prefer: 'return=minimal' }),
          sbFetch('observations?id=gt.0', { method: 'DELETE', prefer: 'return=minimal' }),
          sbFetch('events?id=gt.0', { method: 'DELETE', prefer: 'return=minimal' })
        ]);
        showToast('✓ All data reset. Companies and countries kept.');
        renderManagement();
        if (typeof renderCalendar === 'function') renderCalendar();
      } catch(e) {
        showToast('⚠️ ' + e.message);
        resetAll.textContent = 'Reset All';
        resetAll.disabled = false;
      }
    });
  }

  // View Observations
  var viewObs = document.getElementById('mgmt-view-observations');
  if (viewObs) {
    viewObs.addEventListener('click', function() {
      if (typeof openInboxModal === 'function') {
        openInboxModal();
      } else {
        showToast('⚠️ Observations inbox not available');
      }
    });
  }

  // User Role Change
  document.querySelectorAll('.user-role-select').forEach(select => {
    select.addEventListener('change', async function() {
      const userId = this.dataset.id;
      const newRole = this.value;
      if (!confirm(`Change user role to ${newRole.toUpperCase()}?`)) {
        this.value = this.getAttribute('data-original') || 'viewer';
        return;
      }
      try {
        await mgmtUpdateUserRole(userId, newRole);
        showToast(`✓ User role updated to ${newRole}`);
        renderManagement();
      } catch(e) {
        showToast('⚠️ ' + e.message);
      }
    });
    select.setAttribute('data-original', select.value);
  });

  // Delete User
  document.querySelectorAll('.delete-user-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const userId = this.dataset.id;
      const userName = this.dataset.name;
      if (!confirm(`Remove "${userName}" from the system? This only removes their profile record.`)) return;
      try {
        await mgmtDeleteUserProfile(userId);
        showToast(`✓ User ${userName} removed`);
        renderManagement();
      } catch(e) {
        showToast('⚠️ ' + e.message);
      }
    });
  });

  // Export Functions - FIXED with correct data extraction
  document.getElementById('mgmt-export-companies')?.addEventListener('click', () => exportCompanies());
  document.getElementById('mgmt-export-activities')?.addEventListener('click', () => exportActivities());
  document.getElementById('mgmt-export-events')?.addEventListener('click', () => exportEvents());
  document.getElementById('mgmt-export-contacts')?.addEventListener('click', () => exportContacts());
  document.getElementById('mgmt-export-all')?.addEventListener('click', () => exportAllData());
}

// FIXED Export Functions with correct column mapping
async function exportCompanies() {
  try {
    const companies = await sbFetch('companies?select=*');
    const headers = ['id', 'name', 'company_type', 'relationship_status', 'country_of_origin', 'website', 'agreement_date', 'go_live_date', 'last_review_date', 'contact_name', 'contact_email', 'contact_phone', 'notes'];
    const csv = convertToCSV(companies, headers);
    downloadFile(csv, `companies-${new Date().toISOString().slice(0,10)}.csv`);
    showToast(`✓ ${companies.length} companies exported`);
  } catch(e) {
    showToast('⚠️ Export failed: ' + e.message);
  }
}

async function exportActivities() {
  try {
    const activities = await sbFetch('activities?select=*');
    const headers = ['id', 'company_name', 'activity_date', 'activity_type', 'note', 'status', 'urgency', 'next_action', 'follow_up_date', 'doc_ref', 'user_email', 'created_at'];
    const csv = convertToCSV(activities, headers);
    downloadFile(csv, `activities-${new Date().toISOString().slice(0,10)}.csv`);
    showToast(`✓ ${activities.length} activities exported`);
  } catch(e) {
    showToast('⚠️ Export failed: ' + e.message);
  }
}

async function exportEvents() {
  try {
    const events = await sbFetch('events?select=*');
    const headers = ['id', 'name', 'event_date', 'event_type', 'reminder_days', 'is_noticed', 'notes', 'is_recurring', 'created_by', 'created_at'];
    const csv = convertToCSV(events, headers);
    downloadFile(csv, `events-${new Date().toISOString().slice(0,10)}.csv`);
    showToast(`✓ ${events.length} events exported`);
  } catch(e) {
    showToast('⚠️ Export failed: ' + e.message);
  }
}

async function exportContacts() {
  try {
    const contacts = await sbFetch('company_contacts?select=*');
    const headers = ['id', 'company_id', 'name', 'role', 'email', 'phone', 'is_primary', 'notes'];
    const csv = convertToCSV(contacts, headers);
    downloadFile(csv, `contacts-${new Date().toISOString().slice(0,10)}.csv`);
    showToast(`✓ ${contacts.length} contacts exported`);
  } catch(e) {
    showToast('⚠️ Export failed: ' + e.message);
  }
}

async function exportAllData() {
  try {
    showToast('⏳ Preparing full export...');
    const [companies, activities, events, contacts, commissions, observations] = await Promise.all([
      sbFetch('companies?select=*').catch(() => []),
      sbFetch('activities?select=*').catch(() => []),
      sbFetch('events?select=*').catch(() => []),
      sbFetch('company_contacts?select=*').catch(() => []),
      sbFetch('commissions?select=*').catch(() => []),
      sbFetch('observations?select=*').catch(() => [])
    ]);
    
    const allData = {
      exportDate: new Date().toISOString(),
      exportedBy: window.CURRENT_USER_EMAIL,
      companies: companies || [],
      activities: activities || [],
      events: events || [],
      contacts: contacts || [],
      commissions: commissions || [],
      observations: observations || []
    };
    
    const json = JSON.stringify(allData, null, 2);
    downloadFile(json, `full-export-${new Date().toISOString().slice(0,10)}.json`, 'application/json');
    showToast('✓ Full export complete');
  } catch(e) {
    showToast('⚠️ Export failed: ' + e.message);
  }
}

function convertToCSV(data, headers) {
  if (!data || !data.length) return 'No data available';
  const escape = val => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const rows = data.map(row => headers.map(h => escape(row[h])).join(','));
  return '\uFEFF' + [headers.map(escape).join(','), ...rows].join('\n');
}

function downloadFile(content, filename, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}