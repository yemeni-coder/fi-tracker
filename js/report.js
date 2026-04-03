/* ════════════════════════════════════════════════
   js/report.js — Country Coverage Report
════════════════════════════════════════════════ */

function openReportModal() {
  // Remove if already exists
  document.getElementById('report-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'report-overlay';
  overlay.className = 'mod-overlay open';

  // Get countries that actually have partners
  const coveredNames = new Set(
    window.ALL_COMPANIES.flatMap(c => (c.countries || []).map(x => x.name))
  );
  const covered = (window.ALL_COUNTRIES || []).filter(c => coveredNames.has(c.name));

  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="mod-title">Export Country Report</div>
      <div class="mod-sub">Select countries to include in the PDF report</div>

      <div style="display:flex;gap:8px;margin-bottom:10px">
        <button class="btn btn-ghost" id="rep-all-btn" style="font-size:12px;padding:6px 12px">✓ Select All</button>
        <button class="btn btn-ghost" id="rep-none-btn" style="font-size:12px;padding:6px 12px">✕ Clear</button>
        <div class="search-wrap" style="flex:1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="search-input" type="text" id="rep-search" placeholder="Search…" style="height:34px" />
        </div>
      </div>

      <div id="rep-list" style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r2);padding:6px;display:flex;flex-direction:column;gap:2px">
        ${covered.map(c => `
          <label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:6px;cursor:pointer;transition:background 0.15s">
            <input type="checkbox" class="rep-cb" value="${c.name}" style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent);flex-shrink:0" />
            <span style="font-size:13px">${c.flag_emoji || '🌍'} ${c.name}</span>
          </label>`).join('')}
      </div>

      <div style="font-size:12px;color:var(--tx3);margin-top:8px">
        <span id="rep-count">0</span> of ${covered.length} countries selected
      </div>

      <div class="mod-actions" style="margin-top:16px">
        <button class="btn btn-ghost" id="rep-cancel">Cancel</button>
        <button class="btn btn-primary" id="rep-generate">🖨️ Generate PDF</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Close on backdrop
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('rep-cancel').addEventListener('click', () => overlay.remove());

  // Select all / clear
  document.getElementById('rep-all-btn').addEventListener('click', () => {
    overlay.querySelectorAll('.rep-cb').forEach(cb => {
      if (cb.closest('label').style.display !== 'none') cb.checked = true;
    });
    updateCount();
  });
  document.getElementById('rep-none-btn').addEventListener('click', () => {
    overlay.querySelectorAll('.rep-cb').forEach(cb => cb.checked = false);
    updateCount();
  });

  // Search filter
  document.getElementById('rep-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    overlay.querySelectorAll('#rep-list label').forEach(label => {
      const name = label.querySelector('.rep-cb').value.toLowerCase();
      label.style.display = name.includes(q) ? '' : 'none';
    });
  });

  // Count
  overlay.querySelectorAll('.rep-cb').forEach(cb => cb.addEventListener('change', updateCount));

  function updateCount() {
    document.getElementById('rep-count').textContent =
      overlay.querySelectorAll('.rep-cb:checked').length;
  }

  // Generate
  document.getElementById('rep-generate').addEventListener('click', () => {
    const selected = [...overlay.querySelectorAll('.rep-cb:checked')].map(cb => cb.value);
    if (!selected.length) { showToast('⚠️ Select at least one country'); return; }
    overlay.remove();
    generateReport(selected);
  });
}

/* ════════════════════════════════════════════════
   GENERATE & PRINT
════════════════════════════════════════════════ */
function generateReport(countryNames) {
  showToast('⏳ Building report…');

  // Build data
  const data = countryNames.map(name => {
    const country  = window.ALL_COUNTRIES.find(c => c.name === name);
    const partners = window.ALL_COMPANIES.filter(c =>
      (c.countries || []).some(x => x.name === name)
    ).map(company => {
      const link = (company.countries || []).find(x => x.name === name);
      return {
        name:         company.name,
        status:       company.relationship_status || 'Pipeline',
        direction:    link?.direction || '',
        transactions: link?.transactions || []
      };
    });
    return { name, flag: country?.flag_emoji || '🌍', partners };
  }).filter(d => d.partners.length > 0);

  if (!data.length) { showToast('⚠️ No partner data found'); return; }

  const html = buildHTML(data);
  const win  = window.open('', '_blank');
  if (!win) { showToast('⚠️ Please allow popups for this site'); return; }
  win.document.write(html);
  win.document.close();
}

/* ════════════════════════════════════════════════
   BUILD HTML
════════════════════════════════════════════════ */
function buildHTML(data) {
  const date = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  const totalPartners = [...new Set(data.flatMap(d => d.partners.map(p => p.name)))].length;
  const activeMarkets = data.filter(d => d.partners.some(p =>
    ['Sending & Receiving','Sending Only','Receiving Only'].includes(p.status)
  )).length;

  function statusBadge(status) {
    const map = {
      'Sending & Receiving':   '#22C97A', 'Sending Only': '#22C97A', 'Receiving Only': '#22C97A',
      'Agreement Signed':      '#F0A832', 'On-boarding':  '#F0A832', 'Agreement in Progress': '#F0A832',
      'Pipeline':              '#4f6ef7', 'Under Discussion': '#4f6ef7',
      'On Hold':               '#E53935', 'Suspended': '#E53935', 'Inactive': '#999'
    };
    const color = map[status] || '#999';
    return `<span style="display:inline-block;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:600;color:${color};border:1px solid ${color};background:${color}18;white-space:nowrap">${status}</span>`;
  }

  function dirLabel(d) {
    return d === 'send' ? '→ Send' : d === 'receive' ? '← Receive' : d === 'both' ? '⇄ Both' : '—';
  }

  const blocks = data.map(country => {
    const activeCount = country.partners.filter(p =>
      ['Sending & Receiving','Sending Only','Receiving Only'].includes(p.status)
    ).length;

    const allCur = [...new Set(country.partners.flatMap(p =>
      (p.transactions || []).flatMap(t => t.currencies || [])
    ))].join(' · ') || '—';

    const allSeg = [...new Set(country.partners.flatMap(p =>
      (p.transactions || []).flatMap(t => t.segments || [])
    ))].join(' · ') || '—';

    const rows = country.partners.flatMap((p, pi) => {
      const txs = p.transactions && p.transactions.length > 0 ? p.transactions : [null];
      const bg  = pi % 2 === 0 ? '#fff' : '#f8f8fc';

      return txs.map((tx, ti) => `
        <tr style="background:${bg}">
          <td style="padding:6px 10px;font-weight:${ti===0?'700':'400'};color:${ti===0?'#1A3A6B':'transparent'};border-bottom:1px solid #eee;font-size:11px">
            ${ti===0 ? p.name : '&nbsp;'}
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee">
            ${ti===0 ? statusBadge(p.status) : ''}
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;color:#555">
            ${ti===0 ? dirLabel(p.direction) : ''}
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;color:#1A3A6B;font-weight:500">
            ${tx ? (tx.txType || '—') : '—'}
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;font-weight:700;color:#2E5BBA">
            ${tx ? ((tx.currencies || []).join(' · ') || '—') : '—'}
          </td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:10px;color:#666">
            ${tx ? ((tx.segments || []).join(' · ') || '—') : '—'}
          </td>
        </tr>`);
    }).join('');

    return `
      <div style="margin-bottom:18px;page-break-inside:avoid;break-inside:avoid">
        <div style="background:#1A3A6B;color:white;padding:9px 14px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:15px;font-weight:800">${country.flag} ${country.name}</div>
          <div style="font-size:10px;opacity:0.8">${country.partners.length} partner${country.partners.length!==1?'s':''} · ${activeCount} active</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif">
          <thead>
            <tr style="background:#2E5BBA;color:white">
              <th style="padding:6px 10px;text-align:left;font-size:10px;width:17%">Company</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;width:20%">Status</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;width:10%">Direction</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;width:18%">Transaction Type</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;width:18%">Currencies</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;width:17%">Segments</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="background:#EEF2FB;padding:5px 14px;border-radius:0 0 6px 6px;font-size:10px;color:#1A3A6B;display:flex;gap:16px;flex-wrap:wrap">
          <span><b>Currencies:</b> ${allCur}</span>
          <span><b>Segments:</b> ${allSeg}</span>
        </div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Country Coverage Report — Payporter</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;color:#1A1A2E;background:#fff;padding:12mm 14mm;font-size:12px}
  @media print{body{padding:8mm 10mm}}
</style>
</head><body>

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;margin-bottom:14px;border-bottom:3px solid #1A3A6B">
  <div style="display:flex;align-items:center;gap:10px">
    <div style="width:34px;height:34px;background:#2E5BBA;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:white">FI</div>
    <div>
      <div style="font-size:17px;font-weight:800;color:#1A3A6B;letter-spacing:-0.3px">FI Tracker</div>
      <div style="font-size:10px;color:#666">Country Coverage Report — Payporter</div>
    </div>
  </div>
  <div style="text-align:right;font-size:10px;color:#666">
    <div style="font-weight:700;color:#1A3A6B;font-size:11px">Generated: ${date}</div>
    <div style="color:#E53935;font-weight:700;margin-top:2px">CONFIDENTIAL — INTERNAL USE ONLY</div>
  </div>
</div>

<!-- Summary -->
<div style="display:flex;gap:10px;margin-bottom:16px">
  ${[
    [data.length, 'Countries'],
    [totalPartners, 'Partners'],
    [activeMarkets, 'Active Markets'],
    [[...new Set(data.flatMap(d=>d.partners.flatMap(p=>(p.transactions||[]).flatMap(t=>t.currencies||[]))))].length, 'Currencies']
  ].map(([v,l]) => `
    <div style="flex:1;background:#EEF2FB;border-left:3px solid #2E5BBA;border-radius:4px;padding:8px 12px">
      <div style="font-size:20px;font-weight:800;color:#1A3A6B">${v}</div>
      <div style="font-size:10px;color:#666;margin-top:1px">${l}</div>
    </div>`).join('')}
</div>

<!-- Country blocks -->
${blocks}

<!-- Footer -->
<div style="margin-top:16px;padding-top:8px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#999">
  <span>FI Tracker — Payporter · Country Coverage Report</span>
  <span>© Payporter 2026 — All Rights Reserved</span>
</div>

<script>window.onload=()=>window.print()<\/script>
</body></html>`;
}
