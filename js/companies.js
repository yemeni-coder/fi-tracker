/* ════════════════════════════════════════════════
   js/companies.js
════════════════════════════════════════════════ */

const RELATIONSHIP_STATUSES = [
  'Sending & Receiving','Sending Only','Receiving Only',
  'Pipeline','Under Discussion','Agreement in Progress',
  'Agreement Signed','On-boarding','On Hold','Suspended','Inactive'
];

const REL_STATUS_STYLE = {
  'Sending & Receiving':   { cls: 'rs-active',       label: '⇄ Sending & Receiving'   },
  'Sending Only':          { cls: 'rs-active',        label: '→ Sending Only'           },
  'Receiving Only':        { cls: 'rs-active',        label: '← Receiving Only'         },
  'Pipeline':              { cls: 'rs-pipeline',      label: '◎ Pipeline'               },
  'Under Discussion':      { cls: 'rs-pipeline',      label: '◎ Under Discussion'       },
  'Agreement in Progress': { cls: 'rs-progress',      label: '◐ Agreement in Progress'  },
  'Agreement Signed':      { cls: 'rs-progress',      label: '◐ Agreement Signed'       },
  'On-boarding':           { cls: 'rs-progress',      label: '◐ On-boarding'            },
  'On Hold':               { cls: 'rs-hold',          label: '⏸ On Hold'                },
  'Suspended':             { cls: 'rs-suspended',     label: '⊘ Suspended'              },
  'Inactive':              { cls: 'rs-inactive',      label: '○ Inactive'               }
};

/* ── Consistent color per company based on name hash ── */
const AVATAR_COLORS = [
  { bg: 'rgba(79,110,247,0.15)',  border: 'rgba(79,110,247,0.4)',  text: '#4f6ef7' },
  { bg: 'rgba(34,201,122,0.15)', border: 'rgba(34,201,122,0.4)',  text: '#22c97a' },
  { bg: 'rgba(240,168,50,0.15)', border: 'rgba(240,168,50,0.4)',  text: '#f0a832' },
  { bg: 'rgba(240,82,82,0.15)',  border: 'rgba(240,82,82,0.4)',   text: '#f05252' },
  { bg: 'rgba(168,79,247,0.15)', border: 'rgba(168,79,247,0.4)', text: '#a84ff7' },
  { bg: 'rgba(79,210,247,0.15)', border: 'rgba(79,210,247,0.4)', text: '#4fd2f7' },
  { bg: 'rgba(247,130,79,0.15)', border: 'rgba(247,130,79,0.4)', text: '#f7824f' },
  { bg: 'rgba(79,247,168,0.15)', border: 'rgba(79,247,168,0.4)', text: '#4ff7a8' },
];

function getCompanyColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function avatarStyle(name, size = 44, radius = 10) {
  const c = getCompanyColor(name);
  return `style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${c.bg};border:1px solid ${c.border};display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:700;font-size:${Math.floor(size*0.34)}px;color:${c.text};flex-shrink:0"`;
}

function relStatusTag(status) {
  const s = REL_STATUS_STYLE[status] || REL_STATUS_STYLE['Pipeline'];
  return `<span class="status-tag ${s.cls}">${s.label}</span>`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

async function loadCompanies() {
  const loading = document.getElementById('co-loading');
  loading.style.display = 'flex';
  document.getElementById('co-grid').style.display  = 'none';
  document.getElementById('co-list').style.display  = 'none';
  document.getElementById('co-empty').style.display = 'none';
  try {
    window.ALL_COMPANIES = await dbGetCompanies();
    fillCountryFilter();
    renderCompanies();
  } catch (err) {
    console.error(err);
    showToast('⚠️ Could not load: ' + err.message);
  } finally {
    loading.style.display = 'none';
  }
}

function getFilteredCompanies() {
  const query   = (document.getElementById('co-search').value || '').toLowerCase();
  const dirVal  = document.getElementById('filter-dir').value;
  const ctryVal = document.getElementById('filter-country').value;
  const statVal = document.getElementById('filter-status')?.value || '';
  return window.ALL_COMPANIES.filter(c => {
    const dirs      = (c.countries||[]).map(x=>x.direction);
    const ctryNames = (c.countries||[]).map(x=>x.name);
    const matchName = c.name.toLowerCase().includes(query);
    const matchDir  = !dirVal || dirs.includes(dirVal) || (dirVal==='both'&&dirs.includes('send')&&dirs.includes('receive'));
    const matchCtry = !ctryVal || ctryNames.includes(ctryVal);
    const matchStat = !statVal || (c.relationship_status||'') === statVal;
    return matchName && matchDir && matchCtry && matchStat;
  });
}

function renderCompanies() {
  const companies = getFilteredCompanies();
  const grid  = document.getElementById('co-grid');
  const list  = document.getElementById('co-list');
  const tbody = document.getElementById('co-tbody');
  const empty = document.getElementById('co-empty');
  const view  = window.CURRENT_VIEW || 'grid';
  if (!companies.length) {
    grid.style.display='none'; list.style.display='none'; empty.style.display='block'; return;
  }
  empty.style.display = 'none';
  if (view === 'grid') {
    list.style.display='none'; grid.style.display='';
    grid.innerHTML = companies.map(buildCompanyCard).join('');
    grid.querySelectorAll('.co-card').forEach(card =>
      card.addEventListener('click', () => openCompanyDetail(+card.dataset.id)));
  } else {
    grid.style.display='none'; list.style.display='';
    tbody.innerHTML = companies.map(buildCompanyRow).join('');
    tbody.querySelectorAll('tr').forEach(row =>
      row.addEventListener('click', () => openCompanyDetail(+row.dataset.id)));
  }
}

function getAllTxTypes(c) {
  return [...new Set((c.countries||[]).flatMap(co=>(co.transactions||[]).map(t=>t.txType).filter(Boolean)))];
}
function getAllCurrencies(c) {
  return [...new Set((c.countries||[]).flatMap(co=>(co.transactions||[]).flatMap(t=>t.currencies||[])))];
}

function buildCompanyCard(c) {
  const allDirs = [...new Set((c.countries||[]).map(x=>x.direction))];
  const dir     = (allDirs.includes('both')||(allDirs.includes('send')&&allDirs.includes('receive')))?'both':allDirs[0]||'';
  const allTx   = getAllTxTypes(c);
  const allCur  = getAllCurrencies(c);
  const pills   = (c.countries||[]).slice(0,4).map(co=>`<span class="co-pill"><span>${co.flag}</span>${co.name}</span>`).join('');
  const more    = (c.countries||[]).length>4?`<span class="co-pill">+${c.countries.length-4}</span>`:'';
  return `
    <div class="co-card" data-id="${c.id}">
      <div class="card-top">
        <div class="co-avatar" ${avatarStyle(c.name)}>${initials(c.name)}</div>
        <div style="flex:1;min-width:0">
          <div class="co-name">${c.name}</div>
          <div class="co-meta">${c.company_type||'—'}${c.country_of_origin?' · '+c.country_of_origin:''}</div>
          <div style="margin-top:5px">${relStatusTag(c.relationship_status||'Pipeline')}</div>
        </div>
      </div>
      <div class="co-pills">${pills}${more}</div>
      <div class="card-tags">
        ${dir?makeTag(dirLabel(dir),'t-dir'):''}
        ${allCur.slice(0,4).map(cu=>makeTag(cu,'t-cur')).join('')}
        ${allTx.slice(0,2).map(t=>makeTag(t,'t-type')).join('')}
        ${allTx.length>2?makeTag(`+${allTx.length-2}`,'t-seg'):''}
      </div>
    </div>`;
}

function buildCompanyRow(c) {
  const allDirs = [...new Set((c.countries||[]).map(x=>x.direction))];
  const dir     = (allDirs.includes('both')||(allDirs.includes('send')&&allDirs.includes('receive')))?'both':allDirs[0]||'';
  const allCur  = getAllCurrencies(c);
  const allTx   = getAllTxTypes(c);
  return `
    <tr data-id="${c.id}">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="co-avatar" ${avatarStyle(c.name,32,7)}>${initials(c.name)}</div>
          <div>
            <div style="font-family:'Syne',sans-serif;font-weight:600;font-size:14px">${c.name}</div>
            <div style="font-size:11px;color:var(--tx2)">${c.company_type||'—'}${c.country_of_origin?' · '+c.country_of_origin:''}</div>
          </div>
        </div>
      </td>
      <td>${relStatusTag(c.relationship_status||'Pipeline')}</td>
      <td>${(c.countries||[]).length}</td>
      <td>${dir?makeTag(dirLabel(dir),'t-dir'):'—'}</td>
      <td>${allCur.slice(0,3).map(cu=>makeTag(cu,'t-cur')).join(' ')||'—'}</td>
      <td>${allTx.slice(0,2).map(t=>makeTag(t,'t-type')).join(' ')}${allTx.length>2?makeTag(`+${allTx.length-2}`,'t-seg'):''}</td>
    </tr>`;
}

function fillCountryFilter() {
  const sel  = document.getElementById('filter-country');
  const prev = sel.value;
  const names = [...new Set(window.ALL_COMPANIES.flatMap(c=>(c.countries||[]).map(x=>x.name)))].sort();
  sel.innerHTML = `<option value="">All countries</option>` +
    names.map(n=>`<option value="${n}" ${n===prev?'selected':''}>${n}</option>`).join('');
}

function buildTransactionRows(transactions) {
  if (!transactions||transactions.length===0)
    return `<p style="color:var(--tx3);font-size:13px;margin-top:6px">No transactions added</p>`;
  return `<div class="tx-pairs-display">
    ${transactions.map(tx=>`
      <div class="tx-pair-display-row">
        <div class="tx-pair-type">${makeTag(tx.txType,'t-type')}</div>
        <div class="tx-pair-detail">
          <div class="tx-pair-curs">${(tx.currencies||[]).map(cu=>makeTag(cu,'t-cur')).join('')}</div>
          <div class="tx-pair-segs">${(tx.segments||[]).map(s=>makeTag(s,'t-seg')).join('')}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

/* ════════════════════════════════════════════════
   COMPANY DETAIL PANEL
════════════════════════════════════════════════ */
function openCompanyDetail(id) {
  const c = window.ALL_COMPANIES.find(x => x.id === id);
  if (!c) return;

  const col    = getCompanyColor(c.name);
  const avatar = document.getElementById('p-avatar');
  avatar.textContent    = initials(c.name);
  avatar.style.fontSize = '';
  avatar.style.background  = col.bg;
  avatar.style.border      = `1px solid ${col.border}`;
  avatar.style.color       = col.text;
  avatar.style.borderRadius = '12px';

  document.getElementById('p-name').textContent = c.name;
  document.getElementById('p-type').textContent =
    `${c.company_type||'Partner Company'}${c.country_of_origin?' · '+c.country_of_origin:''}`;

  const editBtn = document.getElementById('p-edit');
  editBtn.style.display = window.USER_ROLE === 'admin' ? '' : 'none';
  editBtn.dataset.id    = id;

  const allCur = getAllCurrencies(c);
  const allTx  = getAllTxTypes(c);
  const allSeg = [...new Set((c.countries||[]).flatMap(co=>(co.transactions||[]).flatMap(t=>t.segments||[])))];

  const ctRows = (c.countries||[]).length
    ? (c.countries||[]).map(co=>`
        <div class="ct-det-row">
          <span class="det-flag">${co.flag}</span>
          <div style="flex:1">
            <div class="det-name">${co.name}</div>
            ${co.direction?`<div style="margin-top:4px">${makeTag(dirLabel(co.direction),'t-dir')}</div>`:''}
            ${buildTransactionRows(co.transactions)}
          </div>
        </div>`).join('')
    : '<p style="color:var(--tx3);font-size:13px">No countries linked yet</p>';

  const hasContact = c.contact_name||c.contact_email||c.contact_phone;
  const hasDates   = c.agreement_date||c.go_live_date||c.last_review_date;

  /* PDF button — admin only */
  const pdfBtn = window.USER_ROLE === 'admin'
    ? `<button class="btn btn-ghost" id="pdf-btn" data-id="${c.id}"
        style="width:100%;justify-content:center;margin-bottom:4px">
        🖨️ Export PDF Profile
       </button>` : '';

  document.getElementById('panel-body').innerHTML = `
    ${pdfBtn}

    <div>
      <div class="sec-label">Relationship Status</div>
      <div class="sec" style="padding:14px 18px">
        ${relStatusTag(c.relationship_status||'Pipeline')}
        ${c.website?`<a href="${c.website}" target="_blank" style="font-size:12px;color:var(--accent);margin-left:10px">${c.website} ↗</a>`:''}
      </div>
    </div>

    <div>
      <div class="sec-label">Overview</div>
      <div class="sec">
        <div class="tag-row">
          ${allCur.map(cu=>makeTag(cu,'t-cur')).join('')}
          ${allTx.map(t=>makeTag(t,'t-type')).join('')}
          ${allSeg.map(s=>makeTag(s,'t-seg')).join('')}
        </div>
      </div>
    </div>

    <div>
      <div class="sec-label">Countries & Transactions</div>
      <div class="sec">${ctRows}</div>
    </div>

    ${hasDates?`
    <div>
      <div class="sec-label">Key Dates</div>
      <div class="sec">
        ${c.agreement_date  ?`<div class="profile-row"><span class="profile-row-label">Agreement</span><span>${formatDate(c.agreement_date)}</span></div>`:''}
        ${c.go_live_date    ?`<div class="profile-row"><span class="profile-row-label">Go-Live</span><span>${formatDate(c.go_live_date)}</span></div>`:''}
        ${c.last_review_date?`<div class="profile-row"><span class="profile-row-label">Last Review</span><span>${formatDate(c.last_review_date)}</span></div>`:''}
      </div>
    </div>`:''}

    ${c.notes?`
    <div>
      <div class="sec-label">Notes</div>
      <div class="notes-box">${c.notes}</div>
    </div>`:''}

    <div>
      <div class="sec-label">Contacts</div>
      <div class="sec" id="contacts-section-${c.id}">
        <div class="loading-state" style="padding:12px"><div class="spinner"></div></div>
      </div>
    </div>

    <div>
      <div class="sec-label">Commissions</div>
      <div id="commissions-section">
        <div class="loading-state" style="padding:12px"><div class="spinner"></div></div>
      </div>
    </div>`;

  // Bind PDF button
  document.getElementById('pdf-btn')?.addEventListener('click', () => exportCompanyPDF(c));

  // Load contacts
  renderContactsSection(c.id, `contacts-section-${c.id}`);

  // Load commissions
  renderCommissionsSection(c.id, c);

  document.getElementById('overlay').classList.add('open');
}

/* ════════════════════════════════════════════════
   PDF EXPORT
════════════════════════════════════════════════ */
async function exportCompanyPDF(c) {
  const col = getCompanyColor(c.name);

  // Fetch commissions
  let commissions = [];
  try { commissions = await dbGetCommissions(c.id); } catch(e) {}

  // Get commission for a specific country
  function getCommForCountry(coName) {
    const ct = (window.ALL_COUNTRIES||[]).find(x => x.name === coName);
    const specific = ct ? commissions.find(cm => cm.country_id === ct.id) : null;
    const general  = commissions.find(cm => !cm.country_id);
    return specific ? {comm:specific, isOverride:true} : general ? {comm:general, isOverride:false} : null;
  }

  function commBadge(coName) {
    const found = getCommForCountry(coName);
    if (!found) return '';
    const {comm, isOverride} = found;
    let val = '';
    if (comm.type === 'fixed')
      val = (comm.value||'—') + ' ' + (comm.currency||'') + ' / ' + (comm.unit||'').replace(/_/g,' ');
    else if (comm.type === 'percentage')
      val = (comm.value||'—') + '% ' + (comm.unit||'').replace(/_/g,' ');
    else if (comm.type === 'tiered')
      val = 'Tiered (' + (comm.tiers?comm.tiers.length:0) + ' tiers)';
    return '<div style="font-size:11px;color:#1565c0;margin-bottom:6px;padding:4px 10px;background:#e3f2fd;border-radius:4px;display:inline-block">' +
      '\uD83D\uDCB0 Commission: <strong>' + val + '</strong>' +
      (isOverride ? ' <span style="color:#e65100;font-size:10px">(country-specific)</span>' : '') +
      '</div>';
  }

  // Build country rows
  const ctRows = (c.countries||[]).map(co => {
    const txRows = (co.transactions||[]).map(tx =>
      '<tr>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">' + (tx.txType||'—') + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">' + ((tx.currencies||[]).join(', ')||'—') + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">' + ((tx.segments||[]).join(', ')||'—') + '</td>' +
      '</tr>'
    ).join('');

    const dirBadge = co.direction
      ? '<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:#e8f5e9;color:#2e7d32">' + dirLabel(co.direction) + '</span>'
      : '';

    const txTable = txRows
      ? '<table style="width:100%;border-collapse:collapse;font-family:sans-serif">' +
        '<thead><tr style="background:#f5f5f5">' +
        '<th style="padding:6px 10px;text-align:left;font-size:11px;color:#666;font-weight:600">TYPE</th>' +
        '<th style="padding:6px 10px;text-align:left;font-size:11px;color:#666;font-weight:600">CURRENCIES</th>' +
        '<th style="padding:6px 10px;text-align:left;font-size:11px;color:#666;font-weight:600">SEGMENTS</th>' +
        '</tr></thead><tbody>' + txRows + '</tbody></table>'
      : '<p style="color:#999;font-size:12px">No transactions</p>';

    return '<div style="margin-bottom:16px;break-inside:avoid">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
      '<span style="font-size:20px">' + co.flag + '</span>' +
      '<strong style="font-size:14px">' + co.name + '</strong> ' +
      dirBadge + '</div>' +
      commBadge(co.name) +
      txTable + '</div>';
  }).join('');

  // Build full commission section
  function buildCommSection() {
    if (!commissions.length) return '<p style="color:#999;font-size:12px">No commissions defined</p>';
    return commissions.map(comm => {
      const ctName = comm.country_id
        ? ((window.ALL_COUNTRIES||[]).find(x=>x.id===comm.country_id)||{}).name || 'Specific Country'
        : null;
      const scopeLabel = ctName
        ? '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:#fff3e0;color:#e65100;border:1px solid #ffcc80">' + ctName + ' only</span>'
        : '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7">All Countries</span>';
      const typeBadge = '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:#e3f2fd;color:#1565c0;border:1px solid #90caf9">' +
        (comm.type==='fixed'?'Fixed':comm.type==='percentage'?'Percentage':'Tiered') + '</span>';
      let val = '';
      if (comm.type==='fixed')
        val = '<strong style="font-size:16px">' + (comm.value||'—') + ' ' + (comm.currency||'') + '</strong>' +
          ' <span style="color:#666;font-size:11px">' + (comm.unit||'').replace(/_/g,' ') + '</span>';
      else if (comm.type==='percentage')
        val = '<strong style="font-size:16px">' + (comm.value||'—') + '%</strong>' +
          ' <span style="color:#666;font-size:11px">' + (comm.unit||'').replace(/_/g,' ') + '</span>';
      else if (comm.type==='tiered')
        val = (comm.tiers||[]).map(t =>
          '<div style="font-size:12px;padding:3px 0;border-bottom:1px solid #f0f0f0">' +
          '<span style="color:#666;min-width:140px;display:inline-block">' + t.from_count + ' – ' + (t.to_count||'∞') + ' tx</span>' +
          '<strong>' + t.value + ' ' + (t.currency||'') + '</strong></div>'
        ).join('');
      return '<div style="padding:10px 14px;border:1px solid #eee;border-radius:6px;margin-bottom:8px">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">' + typeBadge + ' ' + scopeLabel + '</div>' +
        '<div>' + val + '</div>' +
        (comm.notes ? '<div style="font-size:11px;color:#888;margin-top:6px;padding-top:6px;border-top:1px solid #f5f5f5">' + comm.notes + '</div>' : '') +
        '</div>';
    }).join('');
  }

  const notesHTML = c.notes
    ? '<div style="background:#f9f9f9;border-left:3px solid '+col.text+';padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:28px;font-size:13px;color:#444">' +
      '<strong style="display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999">Notes</strong>' +
      c.notes + '</div>'
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${c.name} \u2014 Partner Profile</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1a1a2e; background:#fff; padding:40px; }
  @media print { body { padding:20px; } .no-print { display:none; } }
</style>
</head>
<body>

  <div style="display:flex;align-items:center;gap:20px;padding-bottom:24px;border-bottom:3px solid ${col.text};margin-bottom:28px">
    <div style="width:64px;height:64px;border-radius:14px;background:${col.bg};border:2px solid ${col.border};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:${col.text};flex-shrink:0">
      ${initials(c.name)}
    </div>
    <div style="flex:1">
      <h1 style="font-size:26px;font-weight:800;letter-spacing:-0.5px">${c.name}</h1>
      <div style="font-size:13px;color:#666;margin-top:4px">${c.company_type||''}${c.country_of_origin?' \xb7 '+c.country_of_origin:''}${c.website?' \xb7 <a href="'+c.website+'" style="color:'+col.text+'">'+c.website+'</a>':''}</div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:11px;color:#999;margin-bottom:4px">RELATIONSHIP STATUS</div>
      <div style="font-size:13px;font-weight:600;color:${col.text}">${c.relationship_status||'Pipeline'}</div>
      <div style="font-size:11px;color:#999;margin-top:8px">Generated ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px">
    <div>
      <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Key Dates</div>
      <table style="width:100%;font-size:13px">
        <tr><td style="color:#666;padding:4px 0;width:120px">Agreement Date</td><td style="font-weight:500">${formatDate(c.agreement_date)}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Go-Live Date</td><td style="font-weight:500">${formatDate(c.go_live_date)}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Last Review</td><td style="font-weight:500">${formatDate(c.last_review_date)}</td></tr>
      </table>
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Contact Person</div>
      <table style="width:100%;font-size:13px">
        <tr><td style="color:#666;padding:4px 0;width:60px">Name</td><td style="font-weight:500">${c.contact_name||'—'}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Email</td><td style="font-weight:500">${c.contact_email||'—'}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Phone</td><td style="font-weight:500">${c.contact_phone||'—'}</td></tr>
      </table>
    </div>
  </div>

  ${notesHTML}

  <div style="margin-bottom:28px">
    <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #eee">
      Countries & Transaction Details (${(c.countries||[]).length} markets)
    </div>
    ${ctRows||'<p style="color:#999;font-size:13px">No countries linked</p>'}
  </div>

  <div style="margin-bottom:28px">
    <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #eee">
      Commission Structure
    </div>
    ${buildCommSection()}
  </div>

  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:11px;color:#999">Payporter FI Tracker \u2014 Confidential Internal Document</div>
    <div style="font-size:11px;color:#999">${c.name} Partner Profile</div>
  </div>

  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}
