/* ════════════════════════════════════════════════
   js/app.js
════════════════════════════════════════════════ */

window.ALL_COMPANIES        = [];
window.ALL_COUNTRIES        = [];
window.COUNTRY_LINKS        = [];
window.USER_ROLE            = 'viewer';
window.CURRENT_USER_EMAIL   = '';
window.LOGIN_MODE           = 'admin'; // 'admin' | 'viewer'
window.CURRENT_USER_NAME    = '';
window.CURRENT_VIEW         = 'grid';
window.CURRENT_PAGE         = 'companies';
window.IS_DARK              = false;
window.ACTIVE_SIDE          = 'tracker'; // 'tracker' | 'workspace'
window.LOGIN_TYPE           = 'admin'; // 'admin' | 'viewer'

const TX_TYPES   = ['Cash','Bank Transfer','Mobile Wallet','Card','SWIFT','ACH','Airtime','Home Delivery','Wire'];
const CURRENCIES = ['TRY','EUR','USD','GBP','AED','SAR','CHF','JPY','CAD','AUD'];
const SEGMENTS   = ['C2C','B2C','B2B','C2B','G2C','C2G'];
const DIRECTIONS = [
  { value: 'send',    label: '→ Send only'    },
  { value: 'receive', label: '← Receive only' },
  { value: 'both',    label: '⇄ Both ways'    }
];

/* ════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════ */
async function authSignIn(email, password) {
  const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Login failed');
  return data;
}

async function authRefreshSession() {
  try {
    const stored = localStorage.getItem('fi_session');
    if (!stored) return null;
    const session = JSON.parse(stored);
    if (!session.refresh_token) return null;
    const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    if (!res.ok) { localStorage.removeItem('fi_session'); return null; }
    const data = await res.json();
    localStorage.setItem('fi_session', JSON.stringify({
      access_token: data.access_token, refresh_token: data.refresh_token
    }));
    return data;
  } catch(e) { return null; }
}

async function authGetSession() {
  const stored = localStorage.getItem('fi_session');
  if (!stored) return null;
  const session = JSON.parse(stored);
  let res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Authorization': `Bearer ${session.access_token}` }
  });
  if (!res.ok) {
    const refreshed = await authRefreshSession();
    if (!refreshed) { localStorage.removeItem('fi_session'); return null; }
    res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Authorization': `Bearer ${refreshed.access_token}` }
    });
    if (!res.ok) { localStorage.removeItem('fi_session'); return null; }
    return { ...refreshed, user: await res.json() };
  }
  return { ...session, user: await res.json() };
}

async function authSignOut() {
  const stored = localStorage.getItem('fi_session');
  if (stored) {
    const session = JSON.parse(stored);
    await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Authorization': `Bearer ${session.access_token}` }
    }).catch(() => {});
  }
  localStorage.removeItem('fi_session');
}

/* ════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  loadSavedTheme();
  bindTheme();
  bindLogin();
  window.addEventListener('offline', () => showToast('⚠️ You are offline — changes may not save'));
  window.addEventListener('online',  () => showToast('✓ Connection restored'));
  const session = await authGetSession();
  if (session) {
    const profile             = await dbGetUserProfile(session.user.id).catch(() => ({ role:'viewer', display_name:null }));
    window.USER_ROLE          = profile.role || 'viewer';
    window.CURRENT_USER_NAME  = profile.display_name || '';
    window.CURRENT_USER_EMAIL = session.user.email || '';
    showApp();
  } else {
    showLogin();
  }
});

/* ════════════════════════════════════════════════
   LOGIN
════════════════════════════════════════════════ */
/* ── Login type selector ── */
function selectLoginType(type) {
  window.LOGIN_TYPE = type;

  // Update buttons
  document.getElementById('type-admin').classList.toggle('active', type==='admin');
  document.getElementById('type-viewer').classList.toggle('active', type==='viewer');

  // Show/hide viewer name field
  const nameWrap = document.getElementById('viewer-name-wrap');
  if (nameWrap) nameWrap.style.display = type==='viewer' ? '' : 'none';

  // Update submit button text
  const btnText = document.getElementById('login-btn-text');
  if (btnText) btnText.textContent = type==='admin' ? 'Sign In as Admin' : 'Sign In as Viewer';
}

function bindLogin() {
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  ['login-email','login-password','login-name'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => { if (e.key==='Enter') handleLogin(); });
  });

  // Password eye toggle
  document.getElementById('toggle-password')?.addEventListener('click', () => {
    const input   = document.getElementById('login-password');
    const eyeIcon = document.getElementById('eye-icon');
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    eyeIcon.innerHTML = isHidden
      ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  });
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl  = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');
  // For viewers, name is required
  if (window.LOGIN_TYPE === 'viewer') {
    const name = document.getElementById('login-name')?.value.trim();
    if (!name) { errorEl.textContent='Please enter your name.'; return; }
  }
  if (!email||!password) { errorEl.textContent='Please enter your email and password.'; return; }

  btn.textContent='Signing in…'; btn.disabled=true; errorEl.textContent='';
  try {
    const session = await authSignIn(email, password);
    localStorage.setItem('fi_session', JSON.stringify({
      access_token: session.access_token, refresh_token: session.refresh_token
    }));
    const profile    = await dbGetUserProfile(session.user.id).catch(() => ({ role:'viewer', display_name:null }));
    const actualRole = profile.role || 'viewer';

    // BLOCK: viewer trying to use admin panel — sign out immediately
    if (window.LOGIN_TYPE === 'admin' && actualRole !== 'admin') {
      localStorage.removeItem('fi_session');
      await authSignOut();
      errorEl.textContent = 'You are not an admin or your credentials are incorrect.';
      btn.textContent = 'Sign In as Admin';
      btn.disabled = false;
      return;
    }

    window.USER_ROLE          = actualRole;
    window.CURRENT_USER_EMAIL = session.user.email || email;

    if (actualRole === 'admin') {
      window.CURRENT_USER_NAME = profile.display_name || '';
      /* Log admin login to activity_log so it appears in Management → Activity Log */
      dbLogActivity('login', null, null, `Admin signed in`).catch(() => {});
    } else {
      const viewerName = document.getElementById('login-name')?.value.trim() || '';
      window.CURRENT_USER_NAME = viewerName || 'Viewer';
      // Auto-log viewer access
      dbAddObservation({
        userEmail:   `${window.CURRENT_USER_NAME} (${window.CURRENT_USER_EMAIL})`,
        userRole:    'viewer',
        note:        `👁 Viewer accessed the system`,
        companyId:   null,
        companyName: null,
        countryName: null
      }).catch(() => {});
    }

    showApp();
  } catch (err) {
    errorEl.textContent = err.message || 'Incorrect email or password.';
    btn.textContent='Sign In'; btn.disabled=false;
  }
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  selectLoginType('admin');
  document.getElementById('login-name').value = '';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').textContent = '';
  /* Always reset the login button — fixes "Signing in…" stuck state after sign out */
  const btn = document.getElementById('login-btn');
  if (btn) btn.disabled = false;
  const btnText = document.getElementById('login-btn-text');
  if (btnText) btnText.textContent = 'Sign In as Admin';
  setTimeout(() => document.getElementById('login-email')?.focus(), 100);
}

async function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  // Always reset to tracker + companies on every login
  window.ACTIVE_SIDE  = 'tracker';
  window.CURRENT_PAGE = 'companies';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-companies')?.classList.add('active');

  applyRoleUI();
  bindNavigation();
  bindViewToggle();
  bindSearch();
  bindDetailPanel();
  bindModal();
  bindCountryModal();
  bindLogout();
  window.ALL_COUNTRIES = await dbGetAllCountries().catch(() => []);
  await loadCompanies();
  buildTopNav();
  buildBottomNav();
  initObservations();
  bindWorkspace();
  await loadAdmins();
  
  // Initialize user menu after everything is loaded
  initUserMenu();
}

/* ════════════════════════════════════════════════
   ROLE UI
════════════════════════════════════════════════ */
function applyRoleUI() {
  const isAdmin = window.USER_ROLE === 'admin';

  // Mobile FAB — admin only
  const fabMob = document.getElementById('add-btn-mob');
  if (fabMob) fabMob.style.display = isAdmin ? '' : 'none';

  // Switch to Organizer — admin only
  const switchBtn = document.getElementById('organizer-switch-btn');
  if (switchBtn) switchBtn.style.display = isAdmin ? '' : 'none';

  // Bind switch button (desktop)
  document.getElementById('organizer-switch-btn')?.addEventListener('click', openOrganizerSwitch);

  // Update mobile header
  updateMobileHeader();
}

function updateMobileHeader() {
  const isAdmin = window.USER_ROLE === 'admin';
  const name    = window.CURRENT_USER_NAME || '';

  // Name — with greeting for viewers
  const mobName = document.getElementById('mob-name');
  if (mobName) {
    if (!isAdmin && name) {
      const hour     = new Date().getHours();
      const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
      mobName.textContent = `${greeting}, ${name} 👋`;
    } else {
      mobName.textContent = name;
    }
  }

  // Switch button — admin only
  const mobSwitch = document.getElementById('mob-switch-btn');
  if (mobSwitch) {
    mobSwitch.style.display = isAdmin ? '' : 'none';
    mobSwitch.onclick = isAdmin ? openOrganizerSwitch : null;
  }

  // Theme toggle
  const mobTheme = document.getElementById('theme-toggle-mob');
  if (mobTheme) mobTheme.onclick = toggleTheme;

  // Logout button
  const mobLogout = document.getElementById('logout-btn-mob');
  if (mobLogout) {
    mobLogout.onclick = async () => {
      if (!confirm('Sign out?')) return;
      await authSignOut();
      window.ALL_COMPANIES = [];
      window.ALL_COUNTRIES = [];
      showLogin();
    };
  }
}

function updateMobileSwitchLabel() {
  const btn  = document.getElementById('mob-switch-btn');
  if (!btn) return;
  if (window.ACTIVE_SIDE === 'workspace') {
    btn.textContent = '⇄ FI Tracker';
    btn.classList.add('organizer');
  } else {
    btn.textContent = '⇄ Workspace';
    btn.classList.remove('organizer');
  }
}

function openOrganizerSwitch() {
  if (window.ACTIVE_SIDE === 'workspace') {
    switchToTracker();
  } else {
    switchToWorkspace();
  }
}

function switchToWorkspace() {
  if (window.USER_ROLE !== 'admin') return; // viewers cannot access workspace
  window.ACTIVE_SIDE = 'workspace';
  const btn = document.getElementById('organizer-switch-btn');
  if (btn) {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> FI Tracker`;
    btn.style.borderColor = 'var(--ok)';
    btn.style.color = 'var(--ok)';
  }
  buildTopNav();
  buildBottomNav();
  updateMobileSwitchLabel();
  navigateTo('ws-desk');
}

function switchToTracker() {
  window.ACTIVE_SIDE = 'tracker';
  const btn = document.getElementById('organizer-switch-btn');
  if (btn) {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> FI Workspace`;
    btn.style.borderColor = '';
    btn.style.color = '';
  }
  buildTopNav();
  buildBottomNav();
  updateMobileSwitchLabel();
  navigateTo('companies');
}

/* ════════════════════════════════════════════════
   LOGOUT
════════════════════════════════════════════════ */
function bindLogout() {
  // Logout is now handled by the user menu, but keep for mobile
}

/* ════════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════════ */
function bindNavigation() {
  // Nav items are built dynamically — just build them now
  buildTopNav();
  buildBottomNav();
}

function buildBottomNav() {
  const nav     = document.getElementById('botnav');
  if (!nav) return;
  const isAdmin = window.USER_ROLE === 'admin';
  const page    = window.CURRENT_PAGE;
  const side    = window.ACTIVE_SIDE;

  const TRACKER_ITEMS = [
    { page:'companies', label:'Companies', icon:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>' },
    { page:'countries', label:'Countries', icon:'<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
    { page:'corridor',  label:'Corridor',  icon:'<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>' },
    { page:'dashboard', label:'Dashboard', icon:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>' },
    { page:'coverage',  label:'Map',       icon:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' }
  ];

  const WORKSPACE_ITEMS = [
    { page:'ws-desk',      label:'My Desk',   icon:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
    { page:'ws-companies', label:'Companies', icon:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    { page:'ws-log',       label:'Activities', icon:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
    { page:'ws-notes',     label:'Notes',      icon:'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>' },
    { page:'ws-deleted',   label:'Deleted',    icon:'<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>' },
    { page:'ws-review',    label:'Review',    icon:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
    { page:'ws-calendar',  label:'Calendar',  icon:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' }
  ];

  const items = side === 'workspace' ? WORKSPACE_ITEMS : TRACKER_ITEMS;

  nav.innerHTML = items.map(item => `
    <button class="bot-btn ${page===item.page?'active':''}" data-page="${item.page}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${item.icon}</svg>
      ${item.label}
    </button>`).join('') + (isAdmin ? `
    <button class="bot-btn fab" id="add-btn-mob">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add
    </button>` : '');

  // Bind clicks
  nav.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
  document.getElementById('add-btn-mob')?.addEventListener('click', openFabMenu);
}

function buildTopNav() {
  const nav  = document.getElementById('topnav-items');
  if (!nav) return;
  const side = window.ACTIVE_SIDE;
  const page = window.CURRENT_PAGE;

  const TRACKER = [
    ['companies','Companies'],
    ['countries','Countries'],
    ['corridor','Corridor'],
    ['dashboard','Dashboard'],
    ['coverage','Map']
  ];
  const WORKSPACE = [
    ['ws-desk','My Desk'],
    ['ws-companies','Companies'],
    ['ws-log','Log'],
    ['ws-review','Review'],
    ['ws-calendar','Calendar']
  ];

  const items = side === 'workspace' ? WORKSPACE : TRACKER;
  nav.innerHTML = items.map(([p, label]) =>
    `<button class="nav-btn ${page===p?'active':''}" data-page="${p}">${label}</button>`
  ).join('');

  nav.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
}


/* ════════════════════════════════════════════════
   USER MENU (account dropdown)
════════════════════════════════════════════════ */
function initUserMenu() {
  const wrap     = document.getElementById('user-menu-wrap');
  const btn      = document.getElementById('user-menu-btn');
  const dropdown = document.getElementById('user-menu-dropdown');
  const nameEl   = document.getElementById('user-menu-name');
  if (!wrap || !btn || !dropdown) return;

  // Set the button text based on current page
  function updateUserMenuButton() {
    if (!nameEl) return;
    
    const isWS = window.ACTIVE_SIDE === 'workspace';
    const page = window.CURRENT_PAGE;
    
    // Menu pages that should show the page name instead of user name
    const menuPages = ['ws-notes', 'ws-deleted', 'management'];
    
    if (menuPages.includes(page)) {
      // Show the page name
      if (page === 'ws-notes') nameEl.textContent = 'Notes';
      else if (page === 'ws-deleted') nameEl.textContent = 'Deleted';
      else if (page === 'management') nameEl.textContent = 'Management';
      else nameEl.textContent = 'Menu';
      
      // Highlight the button
      btn.style.color = 'var(--accent)';
      btn.style.fontWeight = '600';
    } else {
      // Show the user name
      nameEl.textContent = window.CURRENT_USER_NAME || 'Account';
      btn.style.color = '';
      btn.style.fontWeight = '';
    }
  }

  const isAdmin    = window.USER_ROLE === 'admin';
  const isWS       = window.ACTIVE_SIDE === 'workspace';
  const isMohammed = window.CURRENT_USER_NAME === 'Mohammed';

  // Show/hide workspace-only items
  const notesBtn   = document.getElementById('menu-notes-btn');
  const deletedBtn = document.getElementById('menu-deleted-btn');
  const mgmtBtn    = document.getElementById('menu-mgmt-btn');
  const mgmtDiv    = document.getElementById('menu-mgmt-divider');

  if (notesBtn)   { notesBtn.style.display   = isAdmin && isWS ? 'flex' : 'none'; }
  if (deletedBtn) { deletedBtn.style.display  = isAdmin && isWS ? 'flex' : 'none'; }
  if (mgmtBtn)    { mgmtBtn.style.display    = isMohammed ? 'flex' : 'none'; }
  if (mgmtDiv)    { mgmtDiv.style.display    = isMohammed ? '' : 'none'; }

  // Update button text initially
  updateUserMenuButton();

  // Hover on items
  dropdown.querySelectorAll('.user-menu-item').forEach(item => {
    item.addEventListener('mouseenter', () => item.style.background = 'var(--bg3)');
    item.addEventListener('mouseleave', () => item.style.background = '');
  });

  // Toggle — bind only once
  if (btn.dataset.bound) return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = dropdown.style.display === 'flex';
    dropdown.style.display = open ? 'none' : 'flex';
  });

  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) dropdown.style.display = 'none';
  }, { capture: true });

  // Handle menu item clicks
  dropdown.querySelectorAll('.user-menu-item[data-action="nav"]').forEach(item => {
    item.addEventListener('click', () => {
      dropdown.style.display = 'none';
      navigateTo(item.dataset.page);
    });
  });
  
  // Handle Add Company button
  const addCompanyBtn = document.getElementById('add-btn');
  if (addCompanyBtn) {
    addCompanyBtn.addEventListener('click', () => {
      dropdown.style.display = 'none';
      openAddModal();
    });
  }
  
  // Handle Add Country button
  const addCountryBtn = document.getElementById('add-country-page-btn');
  if (addCountryBtn) {
    addCountryBtn.addEventListener('click', () => {
      dropdown.style.display = 'none';
      openCountryModal();
    });
  }
  
  // Handle Sign out button
  const signoutBtn = dropdown.querySelector('[data-action="signout"]');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', async () => {
      dropdown.style.display = 'none';
      if (!confirm('Sign out?')) return;
      await authSignOut();
      window.ALL_COMPANIES = [];
      window.ALL_COUNTRIES = [];
      showLogin();
    });
  }
  
  // Store update function to call on page changes
  window.updateUserMenuButton = updateUserMenuButton;
}

function navigateTo(page) {
  if (page===window.CURRENT_PAGE && page!=='companies') return;
  window.CURRENT_PAGE = page;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  buildTopNav();
  buildBottomNav();
  initUserMenu(); // Re-initialize to update button text
  if (window.updateUserMenuButton) window.updateUserMenuButton();
  if (page==='countries') renderCountries(document.getElementById('ct-search').value);
  if (page==='dashboard') renderDashboard();
  if (page==='corridor')    initCorridorPage();
  if (page==='coverage')    initCoveragePage();
  if (page==='ws-desk')     renderMyDesk();
  if (page==='ws-companies') { loadAdmins().then(() => renderWsCompanies()); }
  if (page==='ws-log')      renderWsLog();
  if (page==='ws-notes')    renderWsNotes();
  if (page==='ws-deleted')  renderWsDeleted();
  if (page==='ws-review')   initWsReview();
  if (page==='management')   renderManagement();
  if (page==='ws-calendar')  renderCalendar();
}

/* ════════════════════════════════════════════════
   VIEW TOGGLE
════════════════════════════════════════════════ */
function bindViewToggle() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.CURRENT_VIEW = btn.dataset.view;
      document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===window.CURRENT_VIEW));
      renderCompanies();
    });
  });
}

/* ════════════════════════════════════════════════
   SEARCH
════════════════════════════════════════════════ */
function bindSearch() {
  document.getElementById('co-search').addEventListener('input', renderCompanies);
  document.getElementById('filter-dir').addEventListener('change', renderCompanies);
  document.getElementById('filter-country').addEventListener('change', renderCompanies);
  document.getElementById('filter-status').addEventListener('change', renderCompanies);
  document.getElementById('ct-search').addEventListener('input', e=>renderCountries(e.target.value));
  document.getElementById('export-report-btn')?.addEventListener('click', openReportModal);
}

/* ════════════════════════════════════════════════
   CORRIDOR
════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════
   COVERAGE MAP PAGE
════════════════════════════════════════════════ */
async function initCoveragePage() {
  const wrap = document.getElementById('coverage-map-wrap');
  if (!wrap) return;

  /* Make sure companies are loaded first */
  if (!window.ALL_COMPANIES || window.ALL_COMPANIES.length === 0) {
    await loadCompanies();
  }

  /* If SVG already loaded just re-render colors */
  if (document.getElementById('world-map-svg')) {
    renderCoverage();
    return;
  }

  /* Load SVG via XMLHttpRequest */
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'assets/world.svg', true);
  xhr.onload = function() {
    if (xhr.status === 200) {
      wrap.innerHTML = xhr.responseText;
      const svgEl = wrap.querySelector('svg');
      if (svgEl) {
        svgEl.id = 'world-map-svg';
        svgEl.style.cssText = 'width:100%;height:auto;display:block;border-radius:var(--r2)';
      }
      renderCoverage();
    } else {
      showMapError(wrap);
    }
  };
  xhr.onerror = function() { showMapError(wrap); };
  xhr.send();
}

function showMapError(wrap) {
  wrap.innerHTML = `
    <div class="empty-state" style="padding:60px 20px;text-align:center">
      <div class="empty-icon">🗺️</div>
      <p style="font-weight:600;font-size:16px;margin-top:12px">Map file not found</p>
      <p style="color:var(--tx3);font-size:13px;margin-top:8px">
        Make sure <strong>assets/world.svg</strong> is in your project folder</p>
    </div>`;
}

/* Bridge function — coverage.js calls openCountryDetail, which maps to openCountryPanel */
function openCountryDetail(countryName, flag, partners) {
  const ctData = window.ALL_COUNTRIES.find(c => c.name === countryName)
    || { id: null, name: countryName, flag_emoji: flag };
  openCountryPanel(ctData, partners);
}

function initCorridorPage() {
  const linkedCountries = [...new Map(
    window.ALL_COMPANIES.flatMap(c=>(c.countries||[])).map(co=>[co.name,co])
  ).values()].sort((a,b)=>a.name.localeCompare(b.name));

  // Populate datalist
  injectCorridorFilters();
  const datalist = document.getElementById('corridor-countries-list');
  if (datalist) {
    datalist.innerHTML = linkedCountries.map(co =>
      `<option value="${co.flag} ${co.name}"></option>`
    ).join('');
  }

  document.getElementById('corridor-results').innerHTML =
    `<div class="empty-state"><div class="empty-icon">🌍</div><p>Select a destination country to see available partners</p></div>`;

  // Bind input
  const corridorInput = document.getElementById('corridor-to-input');
  if (corridorInput) {
    corridorInput.value = '';
    const handler = () => {
      const val = corridorInput.value.trim();
      const match = linkedCountries.find(co => co.flag + ' ' + co.name === val || co.name === val);
      if (match) runCorridorSearch(match.name);
    };
    corridorInput.addEventListener('change', handler);
    corridorInput.addEventListener('input', handler);
  }

  // Search filter for corridor dropdown
  const corridorSearch = document.getElementById('corridor-search');
  const corridorSelect = document.getElementById('corridor-to');
  if (corridorSearch && corridorSelect) {
    corridorSearch.addEventListener('input', () => {
      const q = corridorSearch.value.toLowerCase().trim();
      const opts = corridorSelect.options;
      let firstMatch = null;
      for (let i = 1; i < opts.length; i++) {
        const match = opts[i].text.toLowerCase().includes(q);
        opts[i].style.display = match ? '' : 'none';
        if (match && !firstMatch) firstMatch = opts[i].value;
      }
      // Auto-select if exact match
      if (q.length >= 2 && firstMatch && corridorSelect.value !== firstMatch) {
        const exactMatch = [...opts].find(o => o.text.toLowerCase() === q);
        if (exactMatch) {
          corridorSelect.value = exactMatch.value;
          runCorridorSearch();
        }
      }
    });
    corridorSearch.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        // Select first visible option and run search
        const opts = [...corridorSelect.options].filter(o => o.value && o.style.display !== 'none');
        if (opts.length > 0) {
          corridorSelect.value = opts[0].value;
          runCorridorSearch();
          corridorSearch.blur();
        }
      }
    });
  }
}

/* ════════════════════════════════════════════════
   CORRIDOR SEARCH FILTERS
════════════════════════════════════════════════ */
function injectCorridorFilters() {
  if (document.getElementById('corridor-filter-bar')) return;
  const corridorBox = document.querySelector('.corridor-box');
  if (!corridorBox) return;
  const bar = document.createElement('div');
  bar.id = 'corridor-filter-bar';
  bar.style.cssText = 'display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:flex-end;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r3);padding:16px 20px';
  bar.innerHTML = `
    <div style="flex:1;min-width:160px">
      <div style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:5px">Transaction Type</div>
      <select class="filter-sel" id="corridor-filter-type" style="width:100%;height:40px">
        <option value="">All types</option>
        ${TX_TYPES.map(t=>`<option value="${t}">${t}</option>`).join('')}
      </select>
    </div>
    <div style="flex:1;min-width:140px">
      <div style="font-size:11px;font-weight:600;color:var(--tx3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:5px">Currency</div>
      <select class="filter-sel" id="corridor-filter-currency" style="width:100%;height:40px">
        <option value="">All currencies</option>
        ${CURRENCIES.map(c=>`<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary" id="corridor-filter-btn" style="height:40px;align-self:flex-end;flex-shrink:0">
      🔍 Apply Filters
    </button>
    <button class="btn btn-ghost" id="corridor-filter-clear" style="height:40px;align-self:flex-end;flex-shrink:0;display:none">
      ✕ Clear
    </button>`;
  corridorBox.insertAdjacentElement('afterend', bar);
  document.getElementById('corridor-filter-btn').addEventListener('click', () => {
    const hasTx  = !!document.getElementById('corridor-filter-type').value;
    const hasCur = !!document.getElementById('corridor-filter-currency').value;
    document.getElementById('corridor-filter-clear').style.display = (hasTx||hasCur) ? '' : 'none';
    runCorridorSearch();
  });
  document.getElementById('corridor-filter-clear').addEventListener('click', () => {
    document.getElementById('corridor-filter-type').value     = '';
    document.getElementById('corridor-filter-currency').value = '';
    document.getElementById('corridor-filter-clear').style.display = 'none';
    runCorridorSearch();
  });
}

async function runCorridorSearch(destination) {
  if (!destination) {
    const val = document.getElementById('corridor-to-input')?.value?.trim() || '';
    const match = (window.ALL_COUNTRIES||[]).find(co => co.flag_emoji + ' ' + co.name === val || co.name === val);
    destination = match?.name || '';
  }
  const res = document.getElementById('corridor-results');
  if (!destination) { res.innerHTML=`<div class="empty-state"><div class="empty-icon">🌍</div><p>Select a destination country to see available partners</p></div>`; return; }
  const filterTxType = document.getElementById('corridor-filter-type')?.value  || '';
  const filterCur    = document.getElementById('corridor-filter-currency')?.value || '';
  let partners = window.ALL_COMPANIES.filter(c=>(c.countries||[]).some(co=>co.name===destination));
  if (filterTxType) {
    partners = partners.filter(c=>(c.countries||[]).some(co=>co.name===destination &&
      (co.transactions||[]).some(t=>t.txType===filterTxType)));
  }
  if (filterCur) {
    partners = partners.filter(c=>(c.countries||[]).some(co=>co.name===destination &&
      (co.transactions||[]).some(t=>(t.currencies||[]).includes(filterCur))));
  }
  if (!partners.length) { res.innerHTML=`<div class="empty-state"><div class="empty-icon">😔</div><p>No partners found for ${destination}</p></div>`; return; }
  const commMap = {};
  await Promise.all(partners.map(async p => {
    try { commMap[p.id] = await dbGetCommissions(p.id); } catch(e) { commMap[p.id] = []; }
  }));
  const destCountry = window.ALL_COUNTRIES.find(c=>c.name===destination);
  function getBestComm(company) {
    const comms = commMap[company.id]||[];
    const specific = destCountry ? comms.find(cm=>cm.country_id===destCountry.id) : null;
    return specific || comms.find(cm=>!cm.country_id) || null;
  }
  function sortVal(cm) {
    if (!cm) return 999999;
    if (cm.type==='tiered') return parseFloat(cm.tiers?.[0]?.value)||0;
    return parseFloat(cm.value)||0;
  }
  function commLabel(cm) {
    if (!cm) return '<div style="font-size:11px;color:var(--tx3);font-style:italic;padding:4px 0">No commission defined</div>';
    const ov = destCountry && cm.country_id===destCountry.id;
    const typeTag = '<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;margin-right:6px;'
      + (cm.type==='fixed' ? 'background:#e3f2fd;color:#1565c0' : cm.type==='percentage' ? 'background:#e8f5e9;color:#2e7d32' : 'background:#fff3e0;color:#e65100')
      + '">' + (cm.type==='fixed'?'Fixed':cm.type==='percentage'?'Percentage':'Tiered') + '</span>';
    const overrideTag = ov ? '<span style="font-size:10px;color:var(--warn);margin-left:4px">(country rate)</span>' : '';
    let detail = '';
    if (cm.type==='fixed') {
      detail = '<strong style="font-size:13px">' + cm.value + ' ' + (cm.currency||'') + '</strong>'
        + ' <span style="font-size:11px;color:var(--tx3)">' + (cm.unit||'').replace(/_/g,' ') + '</span>';
    } else if (cm.type==='percentage') {
      detail = '<strong style="font-size:13px">' + cm.value + '%</strong>'
        + ' <span style="font-size:11px;color:var(--tx3)">' + (cm.unit||'').replace(/_/g,' ') + '</span>';
    } else if (cm.type==='tiered') {
      const tiers = cm.tiers||[];
      detail = '<div style="margin-top:4px;display:flex;flex-direction:column;gap:2px">'
        + tiers.map(t =>
            '<div style="font-size:11px;display:flex;gap:8px;align-items:center">'
            + '<span style="color:var(--tx3);min-width:110px">' + t.from_count + '–' + (t.to_count ?? '∞') + ' tx</span>'
            + '<strong>' + t.value + ' ' + (t.currency||'') + '</strong>'
            + '</div>'
          ).join('')
        + '</div>';
    }
    return '<div style="font-size:12px;padding:4px 0">'
      + '💰 ' + typeTag + overrideTag
      + '<div style="margin-top:4px;margin-left:2px">' + detail + '</div>'
      + '</div>';
  }
  const cheapSort = arr => [...arr].sort((a,b)=>sortVal(getBestComm(a))-sortVal(getBestComm(b)));

    const active   = partners.filter(c=>['Sending & Receiving','Sending Only','Receiving Only'].includes(c.relationship_status));
  const inprog   = partners.filter(c=>['Agreement Signed','On-boarding','Agreement in Progress'].includes(c.relationship_status));
  const pipeline = partners.filter(c=>['Pipeline','Under Discussion'].includes(c.relationship_status));
  const other    = partners.filter(c=>!active.includes(c)&&!inprog.includes(c)&&!pipeline.includes(c));
  const destFlag = window.ALL_COUNTRIES.find(c=>c.name===destination)?.flag_emoji||'🌍';
  const section  = (title,items) => items.length===0?'': `
    <div class="sec-label" style="margin-bottom:10px">${title} (${items.length})</div>
    <div class="corridor-cards" style="margin-bottom:20px">${cheapSort(items).map(c=>buildCorridorCard(c,destination,commLabel(getBestComm(c)))).join('')}</div>`;
  res.innerHTML = `
    <div class="corridor-header">
      <div class="corridor-route">
        <div class="corridor-end"><span style="font-size:28px">🇹🇷</span><div><div class="corridor-end-name">Payporter</div><div class="corridor-end-sub">Turkey · Sender</div></div></div>
        <div class="corridor-route-arrow">→</div>
        <div class="corridor-end"><span style="font-size:28px">${destFlag}</span><div><div class="corridor-end-name">${destination}</div><div class="corridor-end-sub">${partners.length} partner${partners.length!==1?'s':''} · cheapest first</div></div></div>
      </div>
    </div>
    <div style="margin-top:10px"><button class="btn btn-ghost" id="corridor-pdf-btn" style="font-size:12px">🖨 Export PDF</button></div>
    ${section('● Active',active)}${section('◐ In Progress',inprog)}${section('◎ Pipeline',pipeline)}${section('Other',other)}`;
  res.querySelectorAll('.corridor-card').forEach(card=>card.addEventListener('click',()=>openCompanyDetail(+card.dataset.id)));
  document.getElementById('corridor-pdf-btn')?.addEventListener('click',()=>{
    const txLabel  = document.getElementById('corridor-filter-type')?.value     || '';
    const curLabel = document.getElementById('corridor-filter-currency')?.value || '';
    exportCorridorPDF(destination,destFlag,partners,commMap,getBestComm,txLabel,curLabel);
  });
}

function buildCorridorCard(c,destination,commLabelHTML) {
  const co=(c.countries||[]).find(x=>x.name===destination); if(!co) return '';
  const allCur=[...new Set((co.transactions||[]).flatMap(t=>t.currencies||[]))];
  const allTx=[...new Set((co.transactions||[]).map(t=>t.txType).filter(Boolean))];
  return `
    <div class="corridor-card" data-id="${c.id}">
      <div class="card-top" style="margin-bottom:12px">
        <div class="co-avatar" ${avatarStyle(c.name)}>${initials(c.name)}</div>
        <div style="flex:1"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div class="co-name">${c.name}</div>${relStatusTag(c.partnership_status||c.relationship_status||'Pipeline', c.partnership_direction, c.partnership_phase)}</div>
        <div class="co-meta">${c.company_type||'—'}${c.country_of_origin?' · '+c.country_of_origin:''}</div></div>
      </div>
      <div class="corridor-detail">
        <div class="corridor-detail-label">${co.flag} ${destination} ${co.direction?makeTag(dirLabel(co.direction),'t-dir'):''}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${allCur.map(cu=>makeTag(cu,'t-cur')).join('')}${allTx.map(t=>makeTag(t,'t-type')).join('')}</div>
      </div>
      <div style="padding:8px 0 2px;border-top:1px solid var(--border);margin-top:10px">${commLabelHTML||'<span style="font-size:11px;color:var(--tx3);font-style:italic">No commission defined</span>'}</div>
      <div class="corridor-card-footer"><span style="font-size:12px;color:var(--tx3)">Click to view full profile</span><span style="color:var(--accent);font-size:16px">›</span></div>
    </div>`;
}

/* ════════════════════════════════════════════════
   DETAIL PANEL
════════════════════════════════════════════════ */
function bindDetailPanel() {
  document.getElementById('overlay').addEventListener('click', e=>{
    if (e.target===document.getElementById('overlay')) closePanel();
  });
  document.getElementById('p-close').addEventListener('click', closePanel);
  document.getElementById('p-edit').addEventListener('click', () => {
    const id=+document.getElementById('p-edit').dataset.id; if(!id) return;
    closePanel(); openEditModal(id);
  });
}

/* ════════════════════════════════════════════════
   ADD COUNTRY MODAL
════════════════════════════════════════════════ */
function bindCountryModal() {
  document.getElementById('add-country-page-btn')?.addEventListener('click', openCountryModal);
  document.getElementById('country-mod-overlay').addEventListener('click', e=>{
    if (e.target===document.getElementById('country-mod-overlay')) closeCountryModal();
  });
  document.getElementById('ct-mod-cancel').addEventListener('click', closeCountryModal);
  document.getElementById('ct-mod-save').addEventListener('click', handleSaveCountry);
  document.getElementById('ct-name').addEventListener('keydown', e=>{ if(e.key==='Enter') handleSaveCountry(); });
}

function openCountryModal() {
  document.getElementById('ct-name').value='';
  document.getElementById('ct-flag').value='';
  document.getElementById('ct-region').value='';
  document.getElementById('country-mod-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('ct-name').focus(),100);
}

function closeCountryModal() { document.getElementById('country-mod-overlay').classList.remove('open'); }

async function handleSaveCountry() {
  const name=document.getElementById('ct-name').value.trim();
  const flag=document.getElementById('ct-flag').value.trim();
  const region=document.getElementById('ct-region').value;
  if (!name) { showToast('⚠️ Country name is required'); return; }
  const exists=window.ALL_COUNTRIES.find(c=>c.name.toLowerCase()===name.toLowerCase());
  if (exists) { showToast(`⚠️ "${name}" already exists`); return; }
  const btn=document.getElementById('ct-mod-save');
  btn.textContent='Saving…'; btn.disabled=true;
  try {
    await dbAddCountry({name,flag,region});
    showToast(`✓ ${name} added`); closeCountryModal();
    window.ALL_COUNTRIES=await dbGetAllCountries().catch(()=>[]);
    if (window.CURRENT_PAGE==='countries') renderCountries(document.getElementById('ct-search').value);
  } catch(err) { showToast('⚠️ '+err.message); }
  finally { btn.textContent='Add Country'; btn.disabled=false; }
}

/* ════════════════════════════════════════════════
   COMPANY MODAL
════════════════════════════════════════════════ */

function updatePhaseVisibility() {
  const status    = document.getElementById('f-partnership-status')?.value;
  const phaseWrap = document.getElementById('f-partnership-phase-wrap');
  if (phaseWrap) phaseWrap.style.display = status === 'In Progress' ? '' : 'none';
}

function bindModal() {
  document.getElementById('mod-overlay')?.addEventListener('click', e=>{
    if (e.target===document.getElementById('mod-overlay')) closeModal();
  });
  document.getElementById('mod-cancel')?.addEventListener('click', closeModal);
  document.getElementById('f-partnership-status')?.addEventListener('change', updatePhaseVisibility);
  document.getElementById('mod-save')?.addEventListener('click', handleSave);
  document.getElementById('mod-del')?.addEventListener('click', handleDelete);
  document.getElementById('add-country-btn')?.addEventListener('click', addCountryRow);
}

function populateOriginDropdown() {
  const sel=document.getElementById('f-origin');
  const prev=sel.value;
  sel.innerHTML=`<option value="">Select country…</option>`+
    window.ALL_COUNTRIES.map(c=>`<option value="${c.name}" ${c.name===prev?'selected':''}>${c.flag_emoji||'🌍'} ${c.name}</option>`).join('');
}

function clearModal() {
  ['f-id','f-name','f-local-market-name','f-website','f-contact-name','f-contact-email',
   'f-contact-phone','f-notes','f-agreement-date','f-golive-date','f-review-date']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('f-type').value='';
  document.getElementById('f-partnership-status').value='Pipeline';
  document.getElementById('f-partnership-direction').value='';
  document.getElementById('f-partnership-phase').value='';
  updatePhaseVisibility();
}

function openAddModal() {
  clearModal();
  populateOriginDropdown();
  window.COUNTRY_LINKS=[];
  renderCountryLinks();
  document.getElementById('mod-title').textContent='Add New Partner';
  document.getElementById('mod-sub').textContent='Fill in the company profile';
  document.getElementById('mod-save').textContent='Add Partner';
  document.getElementById('mod-del').style.display='none';
  document.getElementById('mod-overlay').classList.add('open');
}

function openEditModal(id) {
  const c=window.ALL_COMPANIES.find(x=>x.id===id); if(!c) return;
  document.getElementById('f-id').value            =c.id;
  document.getElementById('f-name').value          =c.name;
  document.getElementById('f-local-market-name').value =c.local_market_name||'';
  document.getElementById('f-type').value          =c.company_type         ||'';
  document.getElementById('f-partnership-status').value    = c.partnership_status    || 'Pipeline';
  document.getElementById('f-partnership-direction').value = c.partnership_direction || '';
  document.getElementById('f-partnership-phase').value     = c.partnership_phase     || '';
  updatePhaseVisibility();
  document.getElementById('f-website').value       =c.website              ||'';
  document.getElementById('f-agreement-date').value=c.agreement_date       ||'';
  document.getElementById('f-golive-date').value   =c.go_live_date          ||'';
  document.getElementById('f-review-date').value   =c.last_review_date     ||'';
  document.getElementById('f-contact-name').value  =c.contact_name         ||'';
  document.getElementById('f-contact-email').value =c.contact_email        ||'';
  document.getElementById('f-contact-phone').value =c.contact_phone        ||'';
  document.getElementById('f-notes').value         =c.notes                ||'';
  populateOriginDropdown();
  document.getElementById('f-origin').value        =c.country_of_origin    ||'';
  window.COUNTRY_LINKS=(c.countries||[]).map(co=>({
    countryId:co.id,countryName:co.name,flag:co.flag,direction:co.direction||'',
    transactions:(co.transactions||[]).map(t=>({
      txType:t.txType,currencies:t.currencies||[],segments:t.segments||[],
      limitMin:t.limitMin??'',limitMax:t.limitMax??'',
      limitCurrency:t.limitCurrency||'',limitPeriod:t.limitPeriod||''
    }))
  }));
  renderCountryLinks();
  document.getElementById('mod-title').textContent=`Edit Partner`;
  document.getElementById('mod-sub').textContent=`Editing ${c.name}`;
  document.getElementById('mod-save').textContent='Save Changes';
  document.getElementById('mod-del').style.display='inline-flex';
  document.getElementById('mod-overlay').classList.add('open');
}

/* ── Country rows ── */
function addCountryRow() {
  window.COUNTRY_LINKS.push({countryId:'',countryName:'',flag:'🌍',direction:'',transactions:[]});
  renderCountryLinks();
  setTimeout(()=>{document.getElementById('country-links-list').scrollTop=99999;},50);
}
function removeCountryRow(ci){window.COUNTRY_LINKS.splice(ci,1);renderCountryLinks();}
function addTxRow(ci){syncCountryRow(ci);window.COUNTRY_LINKS[ci].transactions.push({txType:'',currencies:[],segments:[],limitMin:'',limitMax:'',limitCurrency:'',limitPeriod:''});renderCountryLinks();}
function removeTxRow(ci,ti){syncCountryRow(ci);window.COUNTRY_LINKS[ci].transactions.splice(ti,1);renderCountryLinks();}

function syncCountryRow(ci) {
  const row=document.querySelector(`.country-link-row[data-ci="${ci}"]`); if(!row) return;
  const selEl=row.querySelector('.cl-country-select');
  const dirEl=row.querySelector('.cl-direction');
  window.COUNTRY_LINKS[ci].countryId  =selEl.value;
  window.COUNTRY_LINKS[ci].countryName=selEl.options[selEl.selectedIndex]?.text?.replace(/^..\s/,'')||'';
  window.COUNTRY_LINKS[ci].direction  =dirEl.value;
  row.querySelectorAll('.tx-pair-row').forEach((txRow,ti)=>{
    const txSel=txRow.querySelector('.tx-type-select');
    const curs=[...txRow.querySelectorAll('input[data-type="cur"]:checked')].map(el=>el.value);
    const segs=[...txRow.querySelectorAll('input[data-type="seg"]:checked')].map(el=>el.value);
    if(window.COUNTRY_LINKS[ci].transactions[ti]){
      window.COUNTRY_LINKS[ci].transactions[ti].txType        = txSel.value;
      window.COUNTRY_LINKS[ci].transactions[ti].currencies    = curs;
      window.COUNTRY_LINKS[ci].transactions[ti].segments      = segs;
      window.COUNTRY_LINKS[ci].transactions[ti].limitMin      = txRow.querySelector('.tx-limit-min')?.value ?? '';
      window.COUNTRY_LINKS[ci].transactions[ti].limitMax      = txRow.querySelector('.tx-limit-max')?.value ?? '';
      window.COUNTRY_LINKS[ci].transactions[ti].limitCurrency = txRow.querySelector('.tx-limit-cur')?.value || '';
      window.COUNTRY_LINKS[ci].transactions[ti].limitPeriod   = txRow.querySelector('.tx-limit-per')?.value || '';
    }
  });
}

function renderCountryLinks() {
  const container=document.getElementById('country-links-list');
  if(window.COUNTRY_LINKS.length===0){container.innerHTML=`<div class="cl-empty">No countries added yet — click "+ Add Country" above</div>`;return;}
  const countryOptions=window.ALL_COUNTRIES.map(ct=>`<option value="${ct.id}">${ct.flag_emoji||'🌍'} ${ct.name}</option>`).join('');
  container.innerHTML=window.COUNTRY_LINKS.map((link,ci)=>`
    <div class="country-link-row" data-ci="${ci}">
      <div class="cl-row-head">
        <select class="cl-country-select form-select" onchange="syncCountryRow(${ci})">
          <option value="">Select country…</option>
          ${countryOptions.replace(`value="${link.countryId}"`,`value="${link.countryId}" selected`)}
        </select>
        <select class="cl-direction form-select" onchange="syncCountryRow(${ci})">
          <option value="">Direction…</option>
          ${DIRECTIONS.map(d=>`<option value="${d.value}" ${link.direction===d.value?'selected':''}>${d.label}</option>`).join('')}
        </select>
        <button class="cl-remove-btn" onclick="removeCountryRow(${ci})" title="Remove">✕</button>
      </div>
      <div class="cl-field">
        <div class="cl-field-label">Transactions</div>
        <div class="tx-pairs-list">
          ${link.transactions.length===0
            ?`<div class="tx-empty">No transactions yet — click "+ Add Transaction" below</div>`
            :link.transactions.map((tx,ti)=>`
              <div class="tx-pair-row" data-ti="${ti}">
                <div class="tx-pair-head">
                  <select class="tx-type-select form-select" onchange="syncCountryRow(${ci})">
                    <option value="">Transaction type…</option>
                    ${TX_TYPES.map(t=>`<option value="${t}" ${tx.txType===t?'selected':''}>${t}</option>`).join('')}
                  </select>
                  <button class="cl-remove-btn" onclick="removeTxRow(${ci},${ti})" title="Remove">✕</button>
                </div>
                <div class="tx-sub-label">Currencies</div>
                <div class="pill-group">${CURRENCIES.map(cu=>`<label class="pill"><input type="checkbox" data-type="cur" value="${cu}" onchange="syncCountryRow(${ci})" ${(tx.currencies||[]).includes(cu)?'checked':''}/>${cu}</label>`).join('')}</div>
                <div class="tx-sub-label" style="margin-top:8px">Customer Segments</div>
                <div class="pill-group">${SEGMENTS.map(s=>`<label class="pill"><input type="checkbox" data-type="seg" value="${s}" onchange="syncCountryRow(${ci})" ${(tx.segments||[]).includes(s)?'checked':''}/>${s}</label>`).join('')}</div>
                <div class="tx-sub-label" style="margin-top:12px">Transaction Limits <span style="font-size:10px;color:var(--tx3);font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></div>
                <div style="display:grid;grid-template-columns:1fr 1fr 80px 1fr;gap:6px">
                  <div>
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:3px">Min Amount</div>
                    <input class="form-input tx-limit-min" type="number" step="0.01" min="0" onchange="syncCountryRow(${ci})" value="${tx.limitMin??''}" placeholder="e.g. 10" style="height:34px;font-size:12px" />
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:3px">Max Amount</div>
                    <input class="form-input tx-limit-max" type="number" step="0.01" min="0" onchange="syncCountryRow(${ci})" value="${tx.limitMax??''}" placeholder="e.g. 10000" style="height:34px;font-size:12px" />
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:3px">Currency</div>
                    <select class="form-select tx-limit-cur" onchange="syncCountryRow(${ci})" style="height:34px;font-size:12px;padding:0 6px">
                      <option value="">—</option>
                      ${CURRENCIES.map(cu=>`<option value="${cu}" ${tx.limitCurrency===cu?'selected':''}>${cu}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:3px">Per Period</div>
                    <select class="form-select tx-limit-per" onchange="syncCountryRow(${ci})" style="height:34px;font-size:12px;padding:0 6px">
                      <option value="">—</option>
                      <option value="per_transaction" ${tx.limitPeriod==='per_transaction'?'selected':''}>Per Transaction</option>
                      <option value="per_day"         ${tx.limitPeriod==='per_day'?'selected':''}>Per Day</option>
                      <option value="per_week"        ${tx.limitPeriod==='per_week'?'selected':''}>Per Week</option>
                      <option value="per_month"       ${tx.limitPeriod==='per_month'?'selected':''}>Per Month</option>
                      <option value="per_year"        ${tx.limitPeriod==='per_year'?'selected':''}>Per Year</option>
                    </select>
                  </div>
                </div>
              </div>`).join('')}
        </div>
        <button class="btn btn-ghost tx-add-btn" onclick="addTxRow(${ci})" type="button">+ Add Transaction</button>
      </div>
    </div>`).join('');
}

/* ── Save with duplicate detection + activity log ── */
async function handleSave() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { showToast('⚠️ Company name is required'); return; }

  const id = document.getElementById('f-id').value;

  /* ── Duplicate detection ── */
  const isDuplicate = await dbCheckDuplicateName(name, id ? +id : null);
  if (isDuplicate) {
    const proceed = confirm(`⚠️ A company named "${name}" already exists. Are you sure you want to save anyway?`);
    if (!proceed) return;
  }

  window.COUNTRY_LINKS.forEach((_,ci)=>syncCountryRow(ci));
  const invalid=window.COUNTRY_LINKS.find(l=>!l.countryId);
  if (invalid) { showToast('⚠️ Please select a country for every row'); return; }

  const payload = {
    name,
    localMarketName:       document.getElementById('f-local-market-name').value.trim()||null,
    type:                  document.getElementById('f-type').value ||null,
    partnershipStatus:     document.getElementById('f-partnership-status').value     ||'Pipeline',
    partnershipDirection:  document.getElementById('f-partnership-direction').value  ||null,
    partnershipPhase:      document.getElementById('f-partnership-phase').value      ||null,
    relationshipStatus:    document.getElementById('f-partnership-status').value     ||'Pipeline',
    countryOfOrigin:     document.getElementById('f-origin').value         ||null,
    website:             document.getElementById('f-website').value.trim() ||null,
    agreementDate:       document.getElementById('f-agreement-date').value ||null,
    goLiveDate:          document.getElementById('f-golive-date').value     ||null,
    lastReviewDate:      document.getElementById('f-review-date').value    ||null,
    contactName:         document.getElementById('f-contact-name').value.trim()  ||null,
    contactEmail:        document.getElementById('f-contact-email').value.trim() ||null,
    contactPhone:        document.getElementById('f-contact-phone').value.trim() ||null,
    notes:               document.getElementById('f-notes').value.trim()   ||null,
    countryLinks:        window.COUNTRY_LINKS
  };

  const btn=document.getElementById('mod-save');
  btn.textContent='Saving…'; btn.disabled=true;
  try {
    if (id) {
      await dbUpdateCompany(+id, payload);
      await dbLogActivity('updated', +id, name, `Status: ${payload.partnershipStatus}${payload.partnershipPhase?' · '+payload.partnershipPhase:''}`);
      showToast(`✓ ${name} updated`);
    } else {
      const company = await dbAddCompany(payload);
      await dbLogActivity('added', company.id, name, `Type: ${payload.type||'—'}`);
      showToast(`✓ ${name} added`);
    }
    closeModal();
    await loadCompanies();
    if (window.CURRENT_PAGE==='countries') renderCountries(document.getElementById('ct-search').value);
    if (window.CURRENT_PAGE==='dashboard') renderDashboard();
  } catch(err) {
    console.error(err); showToast('⚠️ '+err.message);
  } finally {
    btn.textContent=id?'Save Changes':'Add Partner'; btn.disabled=false;
  }
}

async function handleDelete() {
  const id  =+document.getElementById('f-id').value;
  const name= document.getElementById('f-name').value;
  if (!id) return;
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await dbLogActivity('deleted', id, name, 'Company removed from system');
    await dbDeleteCompany(id);
    showToast(`🗑 ${name} deleted`);
    closeModal(); await loadCompanies();
    if (window.CURRENT_PAGE==='countries') renderCountries();
    if (window.CURRENT_PAGE==='dashboard') renderDashboard();
  } catch(err) { showToast('⚠️ '+err.message); }
}

/* ════════════════════════════════════════════════
   MOBILE FAB
════════════════════════════════════════════════ */
function openFabMenu() {
  closeFabMenu();
  const backdrop=document.createElement('div'); backdrop.className='fab-backdrop'; backdrop.id='fab-backdrop';
  backdrop.addEventListener('click',closeFabMenu);
  const menu=document.createElement('div'); menu.className='fab-menu'; menu.id='fab-menu';
  const isAdmin = window.USER_ROLE==='admin';

  if (!isAdmin) {
    menu.innerHTML=`<p style="color:var(--tx3);font-size:13px;text-align:center;padding:8px">View only access</p>`;
  } else if (window.ACTIVE_SIDE === 'workspace') {
    menu.innerHTML=`<button class="fab-menu-item primary" id="fab-log-act">📝 Log Activity</button>`;
  } else {
    menu.innerHTML=`
      <button class="fab-menu-item primary" id="fab-add-company">+ Add Company</button>
      <button class="fab-menu-item secondary" id="fab-add-country">+ Add Country</button>`;
  }

  document.body.appendChild(backdrop); document.body.appendChild(menu);
  document.getElementById('fab-add-company')?.addEventListener('click',()=>{closeFabMenu();openAddModal();});
  document.getElementById('fab-add-country')?.addEventListener('click',()=>{closeFabMenu();openCountryModal();});
  document.getElementById('fab-log-act')?.addEventListener('click',()=>{closeFabMenu();openActivityModal();});
}

function closeFabMenu() {
  document.getElementById('fab-backdrop')?.remove();
  document.getElementById('fab-menu')?.remove();
}

/* ════════════════════════════════════════════════
   WORKSPACE BINDING
════════════════════════════════════════════════ */
function bindWorkspace() {
  // Switch button
  document.getElementById('organizer-switch-btn')?.addEventListener('click', openOrganizerSwitch);

  // Quick log buttons
  document.getElementById('ws-quick-log-btn')?.addEventListener('click', () => openActivityModal());
  document.getElementById('ws-log-add-btn')?.addEventListener('click', () => openActivityModal());
  document.getElementById('ws-start-review-btn')?.addEventListener('click', () => initWsReview());

  // Export buttons
  document.getElementById('ws-log-export-btn')?.addEventListener('click', exportWsCSV);
  document.getElementById('ws-co-export-btn')?.addEventListener('click', exportWsCSV);

  // Activity modal close/save
  document.getElementById('ws-activity-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('ws-activity-overlay')) closeActivityModal();
  });
  document.getElementById('wam-cancel-btn')?.addEventListener('click', closeActivityModal);
  document.getElementById('wam-save-btn')?.addEventListener('click', handleSaveActivity);

  // Search/filter bindings for workspace pages
  ['ws-co-search','ws-co-filter-assignee'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderWsCompanies);
    document.getElementById(id)?.addEventListener('change', renderWsCompanies);
  });
  ['ws-notes-search','ws-notes-filter-co'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderWsNotes);
    document.getElementById(id)?.addEventListener('change', renderWsNotes);
  });
  document.getElementById('ws-add-note-btn')?.addEventListener('click', () => openNoteForm(null));
  ['ws-log-search','ws-log-filter-company','ws-log-filter-type','ws-log-filter-status','ws-log-filter-user'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderWsLog);
    document.getElementById(id)?.addEventListener('change', renderWsLog);
  });
}

/* ════════════════════════════════════════════════
   THEME
════════════════════════════════════════════════ */
function bindTheme() {
  document.getElementById('theme-toggle')?.addEventListener('click',toggleTheme);
  document.getElementById('theme-toggle-mob')?.addEventListener('click',toggleTheme);
}

function toggleTheme() {
  window.IS_DARK = !window.IS_DARK;
  const theme = window.IS_DARK ? 'dark' : 'light';
  applyTheme(theme);
  try { localStorage.setItem('fi_theme', theme); } catch(e) {}
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  // iOS Safari fix — directly set critical colors on body
  if (isDark) {
    document.body.style.backgroundColor = '#0a0a0f';
    document.body.style.color           = '#e8e8f5';
  } else {
    document.body.style.backgroundColor = '#f4f4f8';
    document.body.style.color           = '#1a1a2e';
  }

  // Update all toggle buttons
  const icon = isDark ? '☀️' : '🌙';
  ['theme-toggle','theme-toggle-mob','mob-theme-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = icon;
  });

  // Force repaint on iOS
  document.body.style.display = 'none';
  document.body.offsetHeight;
  document.body.style.display = '';
}

function loadSavedTheme() {
  try {
    const saved = localStorage.getItem('fi_theme') || 'light';
    window.IS_DARK = saved === 'dark';
    applyTheme(saved);
  } catch(e) {}
}

/* ════════════════════════════════════════════════
   CORRIDOR PDF EXPORT
════════════════════════════════════════════════ */
function exportCorridorPDF(destination, destFlag, partners, commMap, getBestComm, filterTxType='', filterCurrency='') {
  const date = new Date().toLocaleDateString('en-GB', {day:'2-digit', month:'long', year:'numeric'});

  function sortVal(cm) {
    if (!cm) return 999999;
    if (cm.type==='tiered') return parseFloat(cm.tiers?.[0]?.value)||0;
    return parseFloat(cm.value)||0;
  }
  const cheapSort = arr => [...arr].sort((a,b)=>sortVal(getBestComm(a))-sortVal(getBestComm(b)));

  function commText(c) {
    const cm = getBestComm(c);
    if (!cm) return '<span style="color:#999;font-style:italic">Not defined</span>';
    const ov = cm.country_id !== null;
    let v='';
    if (cm.type==='fixed') v='<strong>'+cm.value+' '+(cm.currency||'')+'</strong> '+(cm.unit||'').replace(/_/g,' ');
    else if (cm.type==='percentage') v='<strong>'+cm.value+'%</strong> '+(cm.unit||'').replace(/_/g,' ');
    else v='<strong>Tiered</strong> — from '+(cm.tiers?.[0]?.value||'?')+' '+(cm.tiers?.[0]?.currency||'');
    return '\uD83D\uDCB0 '+v+(ov?' <span style="color:#e65100;font-size:10px">(country rate)</span>':'');
  }

  const active   = partners.filter(c=>['Sending & Receiving','Sending Only','Receiving Only'].includes(c.relationship_status));
  const inprog   = partners.filter(c=>['Agreement Signed','On-boarding','Agreement in Progress'].includes(c.relationship_status));
  const pipeline = partners.filter(c=>['Pipeline','Under Discussion'].includes(c.relationship_status));
  const other    = partners.filter(c=>!active.includes(c)&&!inprog.includes(c)&&!pipeline.includes(c));

  function buildRows(arr, label) {
    if (!arr.length) return '';
    const cards = cheapSort(arr).map((c, i) => {
      const co  = (c.countries||[]).find(x=>x.name===destination);
      const txs = (co?.transactions||[]);
      const txRows = txs.length
        ? txs.map(tx =>
            '<tr>'+
            '<td style="padding:5px 10px;font-size:11px;color:#1A3A6B;font-weight:600;border-bottom:1px solid #f0f0f0;white-space:nowrap">'+(tx.txType||'—')+'</td>'+
            '<td style="padding:5px 10px;font-size:11px;font-weight:700;color:#2E5BBA;border-bottom:1px solid #f0f0f0">'+((tx.currencies||[]).join(' · ')||'—')+'</td>'+
            '<td style="padding:5px 10px;font-size:10px;color:#666;border-bottom:1px solid #f0f0f0">'+((tx.segments||[]).join(', ')||'—')+'</td>'+
            '</tr>'
          ).join('')
        : '<tr><td colspan="3" style="padding:5px 10px;font-size:11px;color:#999">No transactions defined</td></tr>';
      const statusColor = (c.partnership_status||c.relationship_status)==='Active'||['Sending & Receiving','Sending Only','Receiving Only'].includes(c.relationship_status)
        ? '#22c97a' : (c.partnership_status||c.relationship_status)==='In Progress'||['Agreement Signed','On-boarding','Agreement in Progress'].includes(c.relationship_status)
        ? '#f0a832' : '#4f6ef7';
      const bg = i%2===0 ? '#fff' : '#f9f9fc';
      return '<div style="background:'+bg+';border:1px solid #e8e8f0;border-radius:8px;margin-bottom:10px;overflow:hidden">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f4f4f8;border-bottom:1px solid #e8e8f0">'+
          '<div style="display:flex;align-items:center;gap:10px">'+
            '<div style="width:32px;height:32px;border-radius:8px;background:'+statusColor+'22;border:1px solid '+statusColor+'55;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:'+statusColor+'">'+
              c.name.trim().split(/\s+/).slice(0,2).map(w=>w[0].toUpperCase()).join('')+
            '</div>'+
            '<div>'+
              '<div style="font-size:13px;font-weight:800;color:#1A3A6B">'+c.name+'</div>'+
              '<div style="font-size:10px;color:#888;margin-top:1px">'+(c.company_type||'Partner')+(c.country_of_origin?' · '+c.country_of_origin:'')+'</div>'+
            '</div>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:10px">'+
            '<span style="font-size:10px;padding:3px 9px;border-radius:20px;font-weight:700;color:'+statusColor+';border:1px solid '+statusColor+';background:'+statusColor+'18">'+
              (c.partnership_status||c.relationship_status)+
            '</span>'+
            '<div style="font-size:11px;text-align:right">'+commText(c)+'</div>'+
          '</div>'+
        '</div>'+
        '<div style="padding:6px 14px 10px">'+
          '<table style="width:100%;border-collapse:collapse">'+
            '<thead><tr>'+
              '<th style="padding:4px 10px 4px 0;text-align:left;font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.8px;width:28%">Transaction Type</th>'+
              '<th style="padding:4px 10px;text-align:left;font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.8px;width:35%">Currencies</th>'+
              '<th style="padding:4px 10px;text-align:left;font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.8px">Segments</th>'+
            '</tr></thead>'+
            '<tbody>'+txRows+'</tbody>'+
          '</table>'+
        '</div>'+
      '</div>';
    }).join('');
    return '<div style="margin-bottom:24px">'+
      '<div style="font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;padding:8px 14px;background:#1A3A6B;border-radius:6px 6px 0 0;margin-bottom:8px">'+
        label+' ('+arr.length+')'+
      '</div>'+
      cards+
    '</div>';
  }

  const summCards = [
    ['Partners', partners.length],
    ['Active', active.length],
    ['In Progress', inprog.length],
    ['Pipeline', pipeline.length]
  ].map(([l,v]) =>
    '<div style="flex:1;background:#EEF2FB;border-left:3px solid #2E5BBA;border-radius:4px;padding:8px 12px">'+
    '<div style="font-size:18px;font-weight:800;color:#1A3A6B">'+v+'</div>'+
    '<div style="font-size:10px;color:#666">'+l+'</div></div>'
  ).join('');

  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Corridor: '+destination+'</title>'+
    '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#1a1a2e;background:#fff;padding:12mm 14mm}@media print{body{padding:8mm 10mm}}</style>'+
    '</head><body>'+

    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;margin-bottom:14px;border-bottom:3px solid #1A3A6B">'+
    '<div style="display:flex;align-items:center;gap:10px">'+
    '<div style="width:34px;height:34px;background:#2E5BBA;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:white">FI</div>'+
    '<div><div style="font-size:17px;font-weight:800;color:#1A3A6B">Corridor Report</div>'+
    '<div style="font-size:10px;color:#666">\uD83C\uDDF9\uD83C\uDDF7 Turkey (Payporter) \u2192 '+destFlag+' '+destination+'</div></div></div>'+
    '<div style="text-align:right;font-size:10px;color:#666">'+
    '<div style="font-weight:700;color:#1A3A6B">Generated: '+date+'</div>'+
    (filterTxType||filterCurrency ? '<div style="color:#1565c0;margin-top:2px">Filtered: '+(filterTxType||'All types')+' · '+(filterCurrency||'All currencies')+'</div>' : '')+
    '<div style="color:#E53935;font-weight:700;margin-top:2px">CONFIDENTIAL</div></div></div>'+

    '<div style="display:flex;gap:10px;margin-bottom:12px">'+summCards+'</div>'+
    '<p style="font-size:11px;color:#888;margin-bottom:14px;font-style:italic">Sorted cheapest commission first. Partners with no commission defined appear last.</p>'+

    buildRows(active,   '\u25CF Active')+
    buildRows(inprog,   '\u25D0 In Progress')+
    buildRows(pipeline, '\u25CE Pipeline')+
    buildRows(other,    'Other')+

    '<div style="margin-top:16px;padding-top:8px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#999">'+
    '<span>FI Tracker \u2014 Payporter \xb7 Corridor: '+destination+'</span>'+
    '<span>\xa9 Payporter 2026 \u2014 All Rights Reserved</span></div>'+
    '<script>window.onload=()=>window.print()<\/script>'+
    '</body></html>';

  const win = window.open('', '_blank');
  if (!win) { showToast('\u26A0\uFE0F Please allow popups'); return; }
  win.document.write(html);
  win.document.close();
}