/* ════════════════════════════════════════════════
   js/dashboard.js
   FI Tracker Dashboard — shows ONLY company/country data
   (Workspace data removed — belongs in FI Workspace)
════════════════════════════════════════════════ */

function renderDashboard() {
  const cos = window.ALL_COMPANIES;

  const allCountryNames = [...new Set(cos.flatMap(c => (c.countries||[]).map(x=>x.name)))];
  const allCurrencies   = [...new Set(cos.flatMap(c => (c.countries||[]).flatMap(x=>(x.transactions||[]).flatMap(t=>t.currencies||[]))))];
  const active          = cos.filter(c => ['Sending & Receiving','Sending Only','Receiving Only'].includes(c.relationship_status));

  /* ── Export button ── */
  document.getElementById('dash-export-wrap').innerHTML = `
    <button class="btn btn-ghost export-btn" id="export-excel-btn">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export to Excel
    </button>`;
  document.getElementById('export-excel-btn').addEventListener('click', exportToExcel);

  /* ── Stat cards — FI Tracker only (no Workspace data) ── */
  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card stat-clickable" data-dash="all-companies">
      <div class="stat-label">Total Partners</div>
      <div class="stat-val">${cos.length}</div>
      <div class="stat-sub">Click to view all →</div>
    </div>
    <div class="stat-card stat-clickable" data-dash="active-companies">
      <div class="stat-label">Active Partners</div>
      <div class="stat-val" style="color:var(--ok)">${active.length}</div>
      <div class="stat-sub">Currently operational →</div>
    </div>
    <div class="stat-card stat-clickable" data-dash="all-countries">
      <div class="stat-label">Countries</div>
      <div class="stat-val">${allCountryNames.length}</div>
      <div class="stat-sub">Markets covered →</div>
    </div>
    <div class="stat-card stat-clickable" data-dash="all-currencies">
      <div class="stat-label">Currencies</div>
      <div class="stat-val">${allCurrencies.length}</div>
      <div class="stat-sub">In active use →</div>
    </div>`;

  /* ── Breakdowns ── */
  const statusCount = {};
  const typeCount   = {};
  const curCount    = {};
  const txCount     = {};
  const ctryCount   = {};

  cos.forEach(c => {
    const rs = c.relationship_status || 'Pipeline';
    statusCount[rs] = (statusCount[rs]||0) + 1;
    const t = c.company_type || 'Unknown';
    typeCount[t] = (typeCount[t]||0) + 1;
    (c.countries||[]).forEach(co => {
      ctryCount[co.name] = (ctryCount[co.name]||0) + 1;
      (co.transactions||[]).forEach(tx => {
        (tx.currencies||[]).forEach(cu => { curCount[cu] = (curCount[cu]||0)+1; });
        if (tx.txType) { txCount[tx.txType] = (txCount[tx.txType]||0)+1; }
      });
    });
  });

  const maxStatus = Math.max(1, ...Object.values(statusCount));
  const maxType   = Math.max(1, ...Object.values(typeCount));
  const maxCur    = Math.max(1, ...Object.values(curCount));

  /* ── Top countries (ranked) ── */
  const topCountries = Object.entries(ctryCount)
    .sort(([,a],[,b]) => b-a)
    .slice(0, 10);
  const maxCtry = Math.max(1, ...topCountries.map(([,v])=>v));

  const topCountriesHTML = topCountries.map(([name, count], i) => {
    const flag = (window.ALL_COUNTRIES.find(c=>c.name===name)?.flag_emoji) || '🌍';
    return `
      <div class="bar-item bar-clickable" data-dash="country" data-value="${name}">
        <div style="width:22px;font-size:12px;color:var(--tx3);text-align:right;flex-shrink:0">#${i+1}</div>
        <div class="bar-label" style="width:120px">
          <span style="margin-right:4px">${flag}</span>${name}
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${Math.round(count/maxCtry*100)}%"></div>
        </div>
        <div class="bar-count">${count}</div>
      </div>`;
  }).join('');

  document.getElementById('dash-grid').innerHTML = `

    <div class="dash-card">
      <div class="dash-title">Relationship Status</div>
      ${Object.entries(statusCount).sort(([,a],[,b])=>b-a).map(([k,v])=>`
        <div class="bar-item bar-clickable" data-dash="status" data-value="${k}">
          <div class="bar-label">${k}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxStatus*100)}%"></div></div>
          <div class="bar-count">${v}</div>
        </div>`).join('')}
    </div>

    <div class="dash-card">
      <div class="dash-title">Partners by type</div>
      ${Object.entries(typeCount).sort(([,a],[,b])=>b-a).map(([k,v])=>`
        <div class="bar-item bar-clickable" data-dash="type" data-value="${k}">
          <div class="bar-label">${k}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxType*100)}%"></div></div>
          <div class="bar-count">${v}</div>
        </div>`).join('')}
    </div>

    <div class="dash-card">
      <div class="dash-title">Currencies used</div>
      ${Object.entries(curCount).sort(([,a],[,b])=>b-a).map(([k,v])=>`
        <div class="bar-item bar-clickable" data-dash="currency" data-value="${k}">
          <div class="bar-label">${k}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxCur*100)}%"></div></div>
          <div class="bar-count">${v}</div>
        </div>`).join('')}
    </div>

    <div class="dash-card">
      <div class="dash-title">Top countries by partner count</div>
      ${topCountriesHTML}
    </div>

    <div class="dash-card full">
      <div class="dash-title">Transaction types — click to explore</div>
      <div class="tx-grid">
        ${Object.entries(txCount).sort(([,a],[,b])=>b-a).map(([k,v])=>`
          <div class="tx-card tx-clickable" data-dash="txtype" data-value="${k}">
            <div class="tx-val">${v}</div>
            <div class="tx-label">${k}</div>
          </div>`).join('')}
      </div>
    </div>`;

  bindDashboardClicks();
}

/* ════════════════════════════════════════════════
   BIND CLICKS
════════════════════════════════════════════════ */
function bindDashboardClicks() {
  document.querySelectorAll('.stat-clickable').forEach(el =>
    el.addEventListener('click', () => handleDashClick(el.dataset.dash, null)));
  document.querySelectorAll('.bar-clickable').forEach(el =>
    el.addEventListener('click', () => handleDashClick(el.dataset.dash, el.dataset.value)));
  document.querySelectorAll('.tx-clickable').forEach(el =>
    el.addEventListener('click', () => handleDashClick(el.dataset.dash, el.dataset.value)));
}

function handleDashClick(type, value) {
  const cos = window.ALL_COMPANIES;
  switch (type) {
    case 'all-companies':
      openDashPanel('🏢', 'All Partners', `${cos.length} companies`, buildCompanyListHTML(cos)); break;
    case 'active-companies': {
      const f = cos.filter(c=>['Sending & Receiving','Sending Only','Receiving Only'].includes(c.relationship_status));
      openDashPanel('✅', 'Active Partners', `${f.length} operational`, buildCompanyListHTML(f)); break;
    }
    case 'all-countries': {
      const names = [...new Set(cos.flatMap(c=>(c.countries||[]).map(x=>x.name)))].sort();
      openDashPanel('🌍', 'All Countries', `${names.length} markets`, buildCountryListHTML(names)); break;
    }
    case 'all-currencies': {
      const curs = [...new Set(cos.flatMap(c=>(c.countries||[]).flatMap(x=>(x.transactions||[]).flatMap(t=>t.currencies||[]))))].sort();
      openDashPanel('💱', 'All Currencies', `${curs.length} in use`, buildCurrencyListHTML(curs, cos)); break;
    }
    case 'status': {
      const f = cos.filter(c=>(c.relationship_status||'Pipeline')===value);
      openDashPanel('🏷️', value, `${f.length} partner${f.length!==1?'s':''}`, buildCompanyListHTML(f)); break;
    }
    case 'type': {
      const f = cos.filter(c=>(c.company_type||'Unknown')===value);
      openDashPanel('🏷️', value, `${f.length} partner${f.length!==1?'s':''}`, buildCompanyListHTML(f)); break;
    }
    case 'currency': {
      const f = cos.filter(c=>(c.countries||[]).some(x=>(x.transactions||[]).some(t=>(t.currencies||[]).includes(value))));
      openDashPanel('💱', `${value} Partners`, `${f.length} using ${value}`, buildCompanyListHTML(f)); break;
    }
    case 'country': {
      const f = cos.filter(c=>(c.countries||[]).some(x=>x.name===value));
      const flag = window.ALL_COUNTRIES.find(c=>c.name===value)?.flag_emoji||'🌍';
      openDashPanel(flag, value, `${f.length} partner${f.length!==1?'s':''}`, buildCompanyListHTML(f)); break;
    }
    case 'txtype': {
      const f = cos.filter(c=>(c.countries||[]).some(x=>(x.transactions||[]).some(t=>t.txType===value)));
      openDashPanel('💳', value, `${f.length} partner${f.length!==1?'s':''}`, buildCompanyListHTML(f, value)); break;
    }
  }
}

function openDashPanel(avatarText, title, subtitle, bodyHTML) {
  const avatar = document.getElementById('p-avatar');
  avatar.textContent      = avatarText;
  avatar.style.fontSize   = '22px';
  avatar.style.background = 'var(--ac-soft)';
  avatar.style.border     = '1px solid var(--ac-glow)';
  avatar.style.color      = 'var(--accent)';
  avatar.style.borderRadius = '12px';
  document.getElementById('p-name').textContent = title;
  document.getElementById('p-type').textContent = subtitle;
  document.getElementById('p-edit').style.display = 'none';
  document.getElementById('panel-body').innerHTML = bodyHTML;
  document.querySelectorAll('.dash-co-row').forEach(row =>
    row.addEventListener('click', () => openCompanyDetail(+row.dataset.id)));
  document.getElementById('overlay').classList.add('open');
}

/* ── HTML builders ── */
function buildCompanyListHTML(companies, highlightTx=null) {
  if (!companies.length) return `<div class="empty-state"><div class="empty-icon">🔍</div><p>No companies found</p></div>`;
  const rows = companies.map(c => {
    const col    = getCompanyColor(c.name);
    const allTx  = getAllTxTypes(c);
    const allCur = getAllCurrencies(c);
    return `
      <div class="dash-co-row ct-det-row" data-id="${c.id}" style="cursor:pointer">
        <div class="co-avatar" ${avatarStyle(c.name,38,9)}>${initials(c.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <div class="det-name">${c.name}</div>
            ${relStatusTag(c.relationship_status||'Pipeline')}
          </div>
          <div style="font-size:11px;color:var(--tx2);margin-bottom:4px">${c.company_type||'—'} · ${(c.countries||[]).length} countr${(c.countries||[]).length!==1?'ies':'y'}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${allCur.slice(0,4).map(cu=>makeTag(cu,'t-cur')).join('')}
            ${highlightTx?makeTag(highlightTx,'t-type'):allTx.slice(0,2).map(t=>makeTag(t,'t-type')).join('')}
          </div>
        </div>
        <div style="color:var(--tx3);font-size:18px;flex-shrink:0">›</div>
      </div>`;
  }).join('');
  return `<div><div class="sec-label">${companies.length} partner${companies.length!==1?'s':''}</div><div class="sec">${rows}</div></div>`;
}

function buildCountryListHTML(countryNames) {
  const cos  = window.ALL_COMPANIES;
  const rows = countryNames.map(name => {
    const partners = cos.filter(c=>(c.countries||[]).some(x=>x.name===name));
    const flag     = (cos.flatMap(c=>c.countries||[]).find(x=>x.name===name))?.flag||'🌍';
    return `
      <div class="ct-det-row">
        <span style="font-size:20px">${flag}</span>
        <div style="flex:1"><div class="det-name">${name}</div><div style="font-size:11px;color:var(--tx2)">${partners.length} partner${partners.length!==1?'s':''}</div></div>
        <span class="ct-badge">${partners.length}</span>
      </div>`;
  }).join('');
  return `<div><div class="sec-label">${countryNames.length} countries</div><div class="sec">${rows}</div></div>`;
}

function buildCurrencyListHTML(currencies, companies) {
  const rows = currencies.map(cu => {
    const using = companies.filter(c=>(c.countries||[]).some(x=>(x.transactions||[]).some(t=>(t.currencies||[]).includes(cu))));
    return `
      <div class="ct-det-row">
        <div style="width:38px;height:38px;border-radius:9px;background:var(--warn-soft);border:1px solid var(--warn);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:700;font-size:11px;color:var(--warn);flex-shrink:0">${cu}</div>
        <div style="flex:1">
          <div class="det-name">${cu}</div>
          <div style="font-size:11px;color:var(--tx2)">${using.length} partner${using.length!==1?'s':''} use this</div>
          <div style="font-size:11px;color:var(--tx3);margin-top:2px">${using.slice(0,5).map(c=>c.name).join(', ')}${using.length>5?` +${using.length-5} more`:''}</div>
        </div>
      </div>`;
  }).join('');
  return `<div><div class="sec-label">${currencies.length} currencies</div><div class="sec">${rows}</div></div>`;
}

/* ════════════════════════════════════════════════
   EXPORT TO EXCEL
════════════════════════════════════════════════ */
function exportToExcel() {
  const btn = document.getElementById('export-excel-btn');
  btn.textContent = 'Preparing…'; btn.disabled = true;
  try {
    const cos = window.ALL_COMPANIES;
    const rows = [];
    cos.forEach(c => {
      if (!c.countries||c.countries.length===0) {
        rows.push({ 'Company':c.name,'Type':c.company_type||'','Origin':c.country_of_origin||'','Status':c.relationship_status||'','Agreement Date':c.agreement_date||'','Go-Live Date':c.go_live_date||'','Contact':c.contact_name||'','Email':c.contact_email||'','Phone':c.contact_phone||'','Country':'','Direction':'','Transaction Type':'','Currencies':'','Segments':'','Notes':c.notes||'' });
      } else {
        c.countries.forEach(co => {
          if (!co.transactions||co.transactions.length===0) {
            rows.push({ 'Company':c.name,'Type':c.company_type||'','Origin':c.country_of_origin||'','Status':c.relationship_status||'','Agreement Date':c.agreement_date||'','Go-Live Date':c.go_live_date||'','Contact':c.contact_name||'','Email':c.contact_email||'','Phone':c.contact_phone||'','Country':co.name,'Direction':co.direction||'','Transaction Type':'','Currencies':'','Segments':'','Notes':c.notes||'' });
          } else {
            co.transactions.forEach(tx => {
              rows.push({ 'Company':c.name,'Type':c.company_type||'','Origin':c.country_of_origin||'','Status':c.relationship_status||'','Agreement Date':c.agreement_date||'','Go-Live Date':c.go_live_date||'','Contact':c.contact_name||'','Email':c.contact_email||'','Phone':c.contact_phone||'','Country':co.name,'Direction':co.direction||'','Transaction Type':tx.txType||'','Currencies':(tx.currencies||[]).join(', '),'Segments':(tx.segments||[]).join(', '),'Notes':c.notes||'' });
            });
          }
        });
      }
    });
    const headers  = Object.keys(rows[0]||{});
    const escape   = val => `"${String(val).replace(/"/g,'""')}"`;
    const csv      = '\uFEFF' + [headers.map(escape).join(','), ...rows.map(r=>headers.map(h=>escape(r[h])).join(','))].join('\n');
    const blob     = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url      = URL.createObjectURL(blob);
    const today    = new Date().toISOString().slice(0,10);
    const link     = document.createElement('a');
    link.href      = url; link.download = `fi-tracker-${today}.csv`;
    document.body.appendChild(link); link.click();
    document.body.removeChild(link); URL.revokeObjectURL(url);
    showToast(`✓ Exported ${rows.length} rows`);
  } catch(err) {
    showToast('⚠️ Export failed: '+err.message);
  } finally {
    const b = document.getElementById('export-excel-btn');
    if (b) { b.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export to Excel`; b.disabled=false; }
  }
}