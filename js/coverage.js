/* ════════════════════════════════════════════════
   js/coverage.js
   World Map with Zoom/Pan + Hover Stats Panel
════════════════════════════════════════════════ */

const COUNTRY_TO_SVG = {
  'Afghanistan':               { type:'id',    val:'AF' },
  'Albania':                   { type:'id',    val:'AL' },
  'Algeria':                   { type:'id',    val:'DZ' },
  'Armenia':                   { type:'id',    val:'AM' },
  'Austria':                   { type:'id',    val:'AT' },
  'Bahrain':                   { type:'id',    val:'BH' },
  'Bangladesh':                { type:'id',    val:'BD' },
  'Barbados':                  { type:'id',    val:'BB' },
  'Belarus':                   { type:'id',    val:'BY' },
  'Belgium':                   { type:'id',    val:'BE' },
  'Belize':                    { type:'id',    val:'BZ' },
  'Benin':                     { type:'id',    val:'BJ' },
  'Bhutan':                    { type:'id',    val:'BT' },
  'Bolivia':                   { type:'id',    val:'BO' },
  'Bosnia and Herzegovina':    { type:'id',    val:'BA' },
  'Botswana':                  { type:'id',    val:'BW' },
  'Brazil':                    { type:'id',    val:'BR' },
  'Brunei':                    { type:'name',  val:'Brunei Darussalam' },
  'Bulgaria':                  { type:'id',    val:'BG' },
  'Burkina Faso':              { type:'id',    val:'BF' },
  'Burundi':                   { type:'id',    val:'BI' },
  'Cambodia':                  { type:'id',    val:'KH' },
  'Cameroon':                  { type:'id',    val:'CM' },
  'Central African Republic':  { type:'id',    val:'CF' },
  'Chad':                      { type:'id',    val:'TD' },
  'Colombia':                  { type:'id',    val:'CO' },
  'Congo':                     { type:'id',    val:'CG' },
  'Costa Rica':                { type:'id',    val:'CR' },
  'Croatia':                   { type:'id',    val:'HR' },
  'Cuba':                      { type:'id',    val:'CU' },
  'Czech Republic':            { type:'id',    val:'CZ' },
  'Djibouti':                  { type:'id',    val:'DJ' },
  'Dominica':                  { type:'id',    val:'DM' },
  'Dominican Republic':        { type:'id',    val:'DO' },
  'DRC':                       { type:'id',    val:'CD' },
  'Democratic Republic of Congo': { type:'id', val:'CD' },
  'Congo (DRC)':               { type:'id',    val:'CD' },
  'Ecuador':                   { type:'id',    val:'EC' },
  'Egypt':                     { type:'id',    val:'EG' },
  'El Salvador':               { type:'id',    val:'SV' },
  'Equatorial Guinea':         { type:'id',    val:'GQ' },
  'Eritrea':                   { type:'id',    val:'ER' },
  'Estonia':                   { type:'id',    val:'EE' },
  'Ethiopia':                  { type:'id',    val:'ET' },
  'Finland':                   { type:'id',    val:'FI' },
  'Gabon':                     { type:'id',    val:'GA' },
  'Gambia':                    { type:'id',    val:'GM' },
  'Georgia':                   { type:'id',    val:'GE' },
  'Ghana':                     { type:'id',    val:'GH' },
  'Grenada':                   { type:'id',    val:'GD' },
  'Guatemala':                 { type:'id',    val:'GT' },
  'Guinea':                    { type:'id',    val:'GN' },
  'Guinea-Bissau':             { type:'id',    val:'GW' },
  'Guyana':                    { type:'id',    val:'GY' },
  'Haiti':                     { type:'id',    val:'HT' },
  'Honduras':                  { type:'id',    val:'HN' },
  'Hungary':                   { type:'id',    val:'HU' },
  'Iceland':                   { type:'id',    val:'IS' },
  'India':                     { type:'id',    val:'IN' },
  'Iran':                      { type:'id',    val:'IR' },
  'Iraq':                      { type:'id',    val:'IQ' },
  'Ireland':                   { type:'id',    val:'IE' },
  'Israel':                    { type:'id',    val:'IL' },
  'Jamaica':                   { type:'id',    val:'JM' },
  'Jordan':                    { type:'id',    val:'JO' },
  'Kazakhstan':                { type:'id',    val:'KZ' },
  'Kenya':                     { type:'id',    val:'KE' },
  'Kuwait':                    { type:'id',    val:'KW' },
  'Kyrgyzstan':                { type:'id',    val:'KG' },
  'Laos':                      { type:'id',    val:'LA' },
  'Latvia':                    { type:'id',    val:'LV' },
  'Lebanon':                   { type:'id',    val:'LB' },
  'Lesotho':                   { type:'id',    val:'LS' },
  'Liberia':                   { type:'id',    val:'LR' },
  'Libya':                     { type:'id',    val:'LY' },
  'Lithuania':                 { type:'id',    val:'LT' },
  'Luxembourg':                { type:'id',    val:'LU' },
  'Madagascar':                { type:'id',    val:'MG' },
  'Malawi':                    { type:'id',    val:'MW' },
  'Maldives':                  { type:'id',    val:'MV' },
  'Mali':                      { type:'id',    val:'ML' },
  'Mauritania':                { type:'id',    val:'MR' },
  'Mauritius':                 { type:'class', val:'Mauritius' },
  'Mexico':                    { type:'id',    val:'MX' },
  'Moldova':                   { type:'id',    val:'MD' },
  'Mongolia':                  { type:'id',    val:'MN' },
  'Montenegro':                { type:'id',    val:'ME' },
  'Morocco':                   { type:'id',    val:'MA' },
  'Mozambique':                { type:'id',    val:'MZ' },
  'Myanmar':                   { type:'id',    val:'MM' },
  'Namibia':                   { type:'id',    val:'NA' },
  'Nepal':                     { type:'id',    val:'NP' },
  'Netherlands':               { type:'id',    val:'NL' },
  'Nicaragua':                 { type:'id',    val:'NI' },
  'Niger':                     { type:'id',    val:'NE' },
  'Nigeria':                   { type:'id',    val:'NG' },
  'North Korea':               { type:'id',    val:'KP' },
  'North Macedonia':           { type:'id',    val:'MK' },
  'Pakistan':                  { type:'id',    val:'PK' },
  'Palestine':                 { type:'id',    val:'PS' },
  'Panama':                    { type:'id',    val:'PA' },
  'Paraguay':                  { type:'id',    val:'PY' },
  'Peru':                      { type:'id',    val:'PE' },
  'Poland':                    { type:'id',    val:'PL' },
  'Portugal':                  { type:'id',    val:'PT' },
  'Qatar':                     { type:'id',    val:'QA' },
  'Romania':                   { type:'id',    val:'RO' },
  'Rwanda':                    { type:'id',    val:'RW' },
  'Saudi Arabia':              { type:'id',    val:'SA' },
  'Senegal':                   { type:'id',    val:'SN' },
  'Serbia':                    { type:'id',    val:'RS' },
  'Sierra Leone':              { type:'id',    val:'SL' },
  'Slovakia':                  { type:'id',    val:'SK' },
  'Slovenia':                  { type:'id',    val:'SI' },
  'Somalia':                   { type:'id',    val:'SO' },
  'South Africa':              { type:'id',    val:'ZA' },
  'South Korea':               { type:'id',    val:'KR' },
  'South Sudan':               { type:'id',    val:'SS' },
  'Spain':                     { type:'id',    val:'ES' },
  'Sri Lanka':                 { type:'id',    val:'LK' },
  'Sudan':                     { type:'id',    val:'SD' },
  'Suriname':                  { type:'id',    val:'SR' },
  'Sweden':                    { type:'id',    val:'SE' },
  'Switzerland':               { type:'id',    val:'CH' },
  'Syria':                     { type:'id',    val:'SY' },
  'Taiwan':                    { type:'id',    val:'TW' },
  'Tajikistan':                { type:'id',    val:'TJ' },
  'Tanzania':                  { type:'id',    val:'TZ' },
  'Thailand':                  { type:'id',    val:'TH' },
  'Togo':                      { type:'id',    val:'TG' },
  'Tunisia':                   { type:'id',    val:'TN' },
  'Turkmenistan':              { type:'id',    val:'TM' },
  'Uganda':                    { type:'id',    val:'UG' },
  'Ukraine':                   { type:'id',    val:'UA' },
  'United Arab Emirates':      { type:'id',    val:'AE' },
  'Uruguay':                   { type:'id',    val:'UY' },
  'Uzbekistan':                { type:'id',    val:'UZ' },
  'Venezuela':                 { type:'id',    val:'VE' },
  'Vietnam':                   { type:'id',    val:'VN' },
  'Yemen':                     { type:'id',    val:'YE' },
  'Zambia':                    { type:'id',    val:'ZM' },
  'Zimbabwe':                  { type:'id',    val:'ZW' },
  'Turkey':                    { type:'class', val:'Turkey' },
  'France':                    { type:'class', val:'France' },
  'Russia':                    { type:'class', val:'Russian Federation' },
  'United Kingdom':            { type:'class', val:'United Kingdom' },
  'United States':             { type:'class', val:'United States' },
  'China':                     { type:'class', val:'China' },
  'Japan':                     { type:'class', val:'Japan' },
  'Italy':                     { type:'class', val:'Italy' },
  'Germany':                   { type:'class', val:'Germany' },
  'Norway':                    { type:'class', val:'Norway' },
  'Denmark':                   { type:'class', val:'Denmark' },
  'Greece':                    { type:'class', val:'Greece' },
  'Australia':                 { type:'class', val:'Australia' },
  'New Zealand':               { type:'class', val:'New Zealand' },
  'Canada':                    { type:'class', val:'Canada' },
  'Indonesia':                 { type:'class', val:'Indonesia' },
  'Malaysia':                  { type:'class', val:'Malaysia' },
  'Philippines':               { type:'class', val:'Philippines' },
  'Angola':                    { type:'class', val:'Angola' },
  'Argentina':                 { type:'class', val:'Argentina' },
  'Azerbaijan':                { type:'class', val:'Azerbaijan' },
  'Bahamas':                   { type:'class', val:'Bahamas' },
  'Cape Verde':                { type:'class', val:'Cape Verde' },
  'Chile':                     { type:'class', val:'Chile' },
  'Comoros':                   { type:'class', val:'Comoros' },
  'Cyprus':                    { type:'class', val:'Cyprus' },
  'Fiji':                      { type:'class', val:'Fiji' },
  'Malta':                     { type:'class', val:'Malta' },
  'Oman':                      { type:'class', val:'Oman' },
  'Papua New Guinea':          { type:'class', val:'Papua New Guinea' },
  'Samoa':                     { type:'class', val:'Samoa' },
  'Seychelles':                { type:'class', val:'Seychelles' },
  'Solomon Islands':           { type:'class', val:'Solomon Islands' },
  'Trinidad and Tobago':       { type:'class', val:'Trinidad and Tobago' },
  'Vanuatu':                   { type:'class', val:'Vanuatu' },
  'St. Kitts and Nevis':       { type:'class', val:'Saint Kitts and Nevis' },
};
/* ════════════════════════════════════════════════
   RENDER
════════════════════════════════════════════════ */
function renderCoverage() {
  const cos = window.ALL_COMPANIES;

  /* ── Build partner map ── */
  const countryPartners = {};
  cos.forEach(c => {
    (c.countries || []).forEach(co => {
      if (!co.name) return;
      if (!countryPartners[co.name]) countryPartners[co.name] = [];
      if (!countryPartners[co.name].find(p => p.id === c.id)) {
        countryPartners[co.name].push({
          id: c.id, name: c.name,
          status: c.partnership_status || c.relationship_status || 'Pipeline',
          type: c.company_type
        });
      }
    });
  });

  const covered   = Object.keys(countryPartners).length;
  const total     = window.ALL_COUNTRIES.length;
  const uncovered = total - covered;
  const pct       = Math.round(covered / total * 100);

  /* ── Stats above map ── */
  document.getElementById('coverage-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Countries Covered</div>
      <div class="stat-val" style="color:var(--ok)">${covered}</div>
      <div class="stat-sub">of ${total} in directory</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">No Coverage</div>
      <div class="stat-val" style="color:var(--tx3)">${uncovered}</div>
      <div class="stat-sub">opportunity markets</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Coverage Rate</div>
      <div class="stat-val">${pct}%</div>
      <div class="stat-sub">of known markets</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Partners</div>
      <div class="stat-val">${cos.length}</div>
      <div class="stat-sub">in the system</div>
    </div>`;

  const svgEl = document.getElementById('world-map-svg');
  if (!svgEl) { console.error('world-map-svg not found'); return; }

  /* ── Ocean background ── */
  svgEl.style.backgroundColor = '#86cbe2';

  /* ── CREATE ZOOM LAYER FIRST before anything else ── */
  /* This ensures pins get placed inside it so they move with the map on zoom */
  if (!svgEl.querySelector('g.zoom-layer')) {
    const zoomG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    zoomG.setAttribute('class', 'zoom-layer');
    while (svgEl.firstChild) zoomG.appendChild(svgEl.firstChild);
    svgEl.appendChild(zoomG);
  }
  const zoomLayer = svgEl.querySelector('g.zoom-layer');

  /* ── Helper: get country name from path ── */
  function getCountryName(path) {
    const id  = path.getAttribute('id');
    const cls = path.getAttribute('class');
    const nm  = path.getAttribute('name');
    for (const [country, info] of Object.entries(COUNTRY_TO_SVG)) {
      if (info.type === 'id'    && info.val === id)  return country;
      if (info.type === 'class' && info.val === cls) return country;
      if (info.type === 'name'  && info.val === nm)  return country;
    }
    return null;
  }

  /* ── Color countries ── */
  zoomLayer.querySelectorAll('path').forEach(path => {
    const countryName = getCountryName(path);
    if (!countryName) { path.style.fill = '#8b8c89'; return; }

    if (countryName === 'Turkey') {
      path.style.fill = '#e63946';
      path.style.cursor = 'pointer';
      path.addEventListener('mouseenter', e => showMapTooltip(e, '🇹🇷 TURKEY — Payporter HQ', []));
      path.addEventListener('mousemove',  e => moveMapTooltip(e));
      path.addEventListener('mouseleave', hideMapTooltip);
      return;
    }

    const partners = countryPartners[countryName];
    if (partners && partners.length > 0) {
      path.style.fill   = '#f4a261';
      path.style.cursor = 'pointer';
      path.addEventListener('mouseenter', e => showMapTooltip(e, countryName, partners));
      path.addEventListener('mousemove',  e => moveMapTooltip(e));
      path.addEventListener('mouseleave', hideMapTooltip);
      path.addEventListener('click', () => {
        const flag = (window.ALL_COUNTRIES||[]).find(c => c.name === countryName)?.flag_emoji || '🌍';
        const fullPartners = partners.map(p => {
          const full = window.ALL_COMPANIES.find(c => c.id === p.id);
          const co   = full?.countries?.find(x => x.name === countryName);
          return { ...full, direction: co?.direction, transactions: co?.transactions || [] };
        });
        openCountryDetail(countryName, flag, fullPartners);
      });
    } else {
      path.style.fill   = '#8b8c89';
      path.style.cursor = 'default';
      path.addEventListener('mouseenter', e => showMapTooltip(e, countryName, []));
      path.addEventListener('mousemove',  e => moveMapTooltip(e));
      path.addEventListener('mouseleave', hideMapTooltip);
    }
  });

  /* ── Remove old pins ── */
  zoomLayer.querySelectorAll('.map-pin-group').forEach(p => p.remove());

  /* ── Place pin — appended to zoomLayer so it moves with map on zoom ── */
  function placePinCentered(el, pinFill, pinStroke, isPartner, partners, countryName) {
    try {
      const bbox = el.getBBox();
      if (bbox.width < 2 || bbox.height < 2) return;
      const cx = bbox.x + bbox.width  / 2;
      const cy = bbox.y + bbox.height / 2;
      const g  = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'map-pin-group');
      g.style.cursor = isPartner ? 'pointer' : 'default';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
      circle.setAttribute('r', isPartner ? 10 : 5);
      circle.setAttribute('fill', pinFill); circle.setAttribute('stroke', pinStroke);
      circle.setAttribute('stroke-width', '1.5');
      circle.style.filter = 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))';
      g.appendChild(circle);

      if (isPartner && partners) {
        const num = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        num.setAttribute('x', cx); num.setAttribute('y', cy + 0.5);
        num.setAttribute('text-anchor', 'middle'); num.setAttribute('dominant-baseline', 'middle');
        num.setAttribute('fill', '#0c0000'); num.setAttribute('font-size', '10');
        num.setAttribute('font-weight', 'bold'); num.setAttribute('font-family', 'Arial, sans-serif');
        num.style.pointerEvents = 'none';
        num.textContent = partners.length;
        g.appendChild(num);
        g.addEventListener('mouseenter', e => showMapTooltip(e, countryName, partners));
        g.addEventListener('mousemove',  e => moveMapTooltip(e));
        g.addEventListener('mouseleave', hideMapTooltip);
        g.addEventListener('click', () => {
          const flag = (window.ALL_COUNTRIES||[]).find(c => c.name === countryName)?.flag_emoji || '🌍';
          const fullPartners = partners.map(p => {
            const full = window.ALL_COMPANIES.find(c => c.id === p.id);
            const co   = full?.countries?.find(x => x.name === countryName);
            return { ...full, direction: co?.direction, transactions: co?.transactions || [] };
          });
          openCountryDetail(countryName, flag, fullPartners);
        });
      }
      /* ✅ CRITICAL FIX: append to zoomLayer not svgEl */
      zoomLayer.appendChild(g);
    } catch(e) {}
  }

  /* ── Orange pins for partner countries ── */
  Object.entries(countryPartners).forEach(([name, partners]) => {
    const svgInfo = COUNTRY_TO_SVG[name]; if (!svgInfo) return;
    let el = null;
    if (svgInfo.type === 'id')    el = zoomLayer.querySelector('#' + svgInfo.val) || document.getElementById(svgInfo.val);
    else if (svgInfo.type === 'class') el = [...zoomLayer.querySelectorAll('path')].find(e => e.getAttribute('class') === svgInfo.val);
    else if (svgInfo.type === 'name')  el = [...zoomLayer.querySelectorAll('path')].find(e => e.getAttribute('name') === svgInfo.val);
    if (el) placePinCentered(el, '#f4a261', '#ffffff', true, partners, name);
  });

  /* ── Turkey star pin — also inside zoomLayer ── */
  const tkEl = [...zoomLayer.querySelectorAll('path')].find(e => e.getAttribute('class') === 'Turkey');
  if (tkEl) {
    try {
      const bbox = tkEl.getBBox();
      const cx = bbox.x + bbox.width/2, cy = bbox.y + bbox.height/2;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class','map-pin-group'); g.style.cursor='pointer';
      const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
      c.setAttribute('cx',cx); c.setAttribute('cy',cy); c.setAttribute('r','12');
      c.setAttribute('fill','#e63946'); c.setAttribute('stroke','#ffffff'); c.setAttribute('stroke-width','2');
      c.style.filter='drop-shadow(0 1px 4px rgba(0,0,0,0.5))'; g.appendChild(c);
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x',cx); t.setAttribute('y',cy+1);
      t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
      t.setAttribute('fill','#ffffff'); t.setAttribute('font-size','12'); t.setAttribute('font-weight','bold');
      t.style.pointerEvents='none'; t.textContent='★'; g.appendChild(t);
      g.addEventListener('mouseenter', e => showMapTooltip(e, '🇹🇷 TURKEY — Payporter HQ', []));
      g.addEventListener('mousemove',  e => moveMapTooltip(e));
      g.addEventListener('mouseleave', hideMapTooltip);
      /* ✅ CRITICAL FIX: append to zoomLayer */
      zoomLayer.appendChild(g);
    } catch(e) {}
  }

  /* ── Legend ── */
  document.getElementById('coverage-legend').innerHTML = `
    <div class="cov-legend">
      <div class="cov-legend-item"><div class="cov-legend-dot" style="background:#86cbe2"></div><span>Ocean</span></div>
      <div class="cov-legend-item"><div class="cov-legend-dot" style="background:#f4a261"></div><span>Countries with Partners</span></div>
      <div class="cov-legend-item"><div class="cov-legend-dot" style="background:#8b8c89"></div><span>No Partners</span></div>
      <div class="cov-legend-item"><div class="cov-legend-dot" style="background:#e63946"></div><span>🇹🇷 Payporter HQ</span></div>
    </div>`;

  /* ── Init zoom/pan + hover panel ── */
  initMapZoomPan(svgEl, covered, total, uncovered, pct, cos.length);
}

/* ════════════════════════════════════════════════
   ZOOM / PAN + HOVER STATS PANEL
════════════════════════════════════════════════ */
function initMapZoomPan(svgEl, covered, total, uncovered, pct, totalPartners) {
  const wrap = document.getElementById('coverage-map-wrap');
  if (!wrap || wrap.dataset.zoomInit) return;
  wrap.dataset.zoomInit = '1';

  /* zoomLayer already created in renderCoverage */
  const zoomG = svgEl.querySelector('g.zoom-layer');

  let scale = 1, tx = 0, ty = 0;
  let isDragging = false, startX = 0, startY = 0, startTx = 0, startTy = 0;
  const MIN_SCALE = 1, MAX_SCALE = 8;

  function applyTransform() {
    zoomG.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`);
  }

  /* Scroll to zoom */
  svgEl.addEventListener('wheel', e => {
    e.preventDefault();
    const rect   = svgEl.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width  * 2000;
    const mouseY = (e.clientY - rect.top)  / rect.height * 857;
    const delta  = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * delta));
    tx = mouseX - (mouseX - tx) * (newScale / scale);
    ty = mouseY - (mouseY - ty) * (newScale / scale);
    scale = newScale;
    if (scale <= MIN_SCALE) { scale = MIN_SCALE; tx = 0; ty = 0; }
    applyTransform();
  }, { passive: false });

  /* Drag to pan */
  svgEl.addEventListener('mousedown', e => {
    if (scale <= 1) return;
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    startTx = tx; startTy = ty;
    svgEl.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const rect   = svgEl.getBoundingClientRect();
    const scaleX = 2000 / rect.width;
    const scaleY = 857  / rect.height;
    tx = startTx + (e.clientX - startX) * scaleX;
    ty = startTy + (e.clientY - startY) * scaleY;
    applyTransform();
  });
  window.addEventListener('mouseup', () => {
    isDragging = false;
    svgEl.style.cursor = scale > 1 ? 'grab' : 'default';
  });

  /* Double-click to zoom in */
  svgEl.addEventListener('dblclick', e => {
    const rect   = svgEl.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width  * 2000;
    const mouseY = (e.clientY - rect.top)  / rect.height * 857;
    const newScale = Math.min(MAX_SCALE, scale * 2);
    tx = mouseX - (mouseX - tx) * (newScale / scale);
    ty = mouseY - (mouseY - ty) * (newScale / scale);
    scale = newScale;
    applyTransform();
    svgEl.style.cursor = 'grab';
  });

  /* Reset button */
  const resetBtn = document.createElement('button');
  resetBtn.textContent = '⟳ Reset';
  resetBtn.style.cssText = 'position:absolute;top:12px;right:12px;z-index:10;background:var(--bg);border:1px solid var(--border);border-radius:var(--r2);padding:5px 12px;font-size:11px;font-weight:600;color:var(--tx2);cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.15)';
  resetBtn.addEventListener('click', () => {
    scale = 1; tx = 0; ty = 0;
    applyTransform();
    svgEl.style.cursor = 'default';
  });
  wrap.style.position = 'relative';
  wrap.appendChild(resetBtn);

  /* ── Hover stats panel ── */
  const panel = document.createElement('div');
  panel.id = 'map-stats-panel';
  panel.style.cssText = `
    position:absolute;
    bottom:16px;
    left:16px;
    width:170px;
    background:var(--bg);
    border:1px solid var(--border);
    border-radius:var(--r2);
    padding:14px;
    box-shadow:0 4px 16px rgba(0,0,0,0.15);
    z-index:10;
    opacity:0;
    pointer-events:none;
    transition:opacity 0.2s ease;
    font-family:'Syne',sans-serif;
  `;
  panel.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px">Coverage Stats</div>
    <div style="margin-bottom:10px">
      <div style="font-size:11px;color:var(--tx2);margin-bottom:2px">Countries with Partners</div>
      <div style="font-size:22px;font-weight:800;color:var(--ok)">${covered}</div>
      <div style="font-size:10px;color:var(--tx3)">active markets</div>
    </div>
    <div style="margin-bottom:10px">
      <div style="font-size:11px;color:var(--tx2);margin-bottom:2px">Countries with No Partners</div>
      <div style="font-size:22px;font-weight:800;color:var(--tx3)">${uncovered}</div>
      <div style="font-size:10px;color:var(--tx3)">opportunity markets</div>
    </div>
    <div style="margin-bottom:10px">
      <div style="font-size:11px;color:var(--tx2);margin-bottom:2px">Coverage Rate</div>
      <div style="font-size:22px;font-weight:800;color:var(--accent)">${pct}%</div>
      <div style="font-size:10px;color:var(--tx3)">of directory</div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--tx2);margin-bottom:2px">Total Partners</div>
      <div style="font-size:22px;font-weight:800;color:var(--tx)">${totalPartners}</div>
      <div style="font-size:10px;color:var(--tx3)">in the system</div>
    </div>`;
  wrap.appendChild(panel);

  wrap.addEventListener('mouseenter', () => { panel.style.opacity = '1'; });
  wrap.addEventListener('mouseleave', () => { panel.style.opacity = '0'; });
}

/* ════════════════════════════════════════════════
   TOOLTIP
════════════════════════════════════════════════ */
function showMapTooltip(e, countryName, partners) {
  let tip = document.getElementById('map-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'map-tooltip';
    tip.className = 'map-tooltip';
    document.body.appendChild(tip);
  }
  const activeCount = partners.filter(p =>
    p.status==='Active'||['Sending & Receiving','Sending Only','Receiving Only'].includes(p.status)
  ).length;

  if (countryName.includes('TURKEY')) {
    tip.innerHTML = `<div class="map-tip-name">🇹🇷 Turkey</div><div class="map-tip-count">Payporter Headquarters</div>`;
  } else if (partners.length > 0) {
    tip.innerHTML = `
      <div class="map-tip-name">${countryName}</div>
      <div class="map-tip-count">📊 ${partners.length} partner${partners.length!==1?'s':''}</div>
      ${activeCount>0?`<div class="map-tip-active">✅ ${activeCount} active</div>`:''}
      <div class="map-tip-names">🏢 ${partners.slice(0,4).map(p=>p.name).join(', ')}${partners.length>4?` +${partners.length-4} more`:''}</div>
      <div class="map-tip-hint">🔍 Click to view details</div>`;
  } else {
    tip.innerHTML = `
      <div class="map-tip-name">${countryName}</div>
      <div class="map-tip-count">📭 No partners yet</div>
      <div class="map-tip-hint">✨ Opportunity market</div>`;
  }
  tip.style.display = 'block';
  moveMapTooltip(e);
}

function moveMapTooltip(e) {
  const tip = document.getElementById('map-tooltip');
  if (!tip) return;
  const x = e.clientX + 14, y = e.clientY - 10;
  const tipW = tip.offsetWidth, winW = window.innerWidth;
  tip.style.left = (x + tipW > winW ? x - tipW - 28 : x) + 'px';
  tip.style.top  = y + 'px';
}

function hideMapTooltip() {
  const tip = document.getElementById('map-tooltip');
  if (tip) tip.style.display = 'none';
}