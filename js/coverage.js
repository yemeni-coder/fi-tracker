/* ════════════════════════════════════════════════
   js/coverage.js
   Real SVG World Map — embedded directly in HTML
   No fetch, no loading issues
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
  // class-based
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
  'Mauritius':                 { type:'class', val:'Mauritius' },
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
   RENDER — SVG already embedded in DOM
════════════════════════════════════════════════ */
function renderCoverage() {
  const cos = window.ALL_COMPANIES;

  /* ── Build partner map ── */
  const countryPartners = {};
  cos.forEach(c => {
    (c.countries || []).forEach(co => {
      if (!countryPartners[co.name]) countryPartners[co.name] = [];
      if (!countryPartners[co.name].find(p => p.id === c.id)) {
        countryPartners[co.name].push({
          id: c.id, name: c.name,
          status: c.relationship_status,
          type:   c.company_type
        });
      }
    });
  });

  const covered   = Object.keys(countryPartners).length;
  const total     = window.ALL_COUNTRIES.length;
  const uncovered = total - covered;
  const pct       = Math.round(covered / total * 100);

  /* ── Stats ── */
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

  /* ── Get SVG (already in DOM) ── */
  const svgEl = document.getElementById('world-map-svg');
  if (!svgEl) {
    console.error('world-map-svg not found in DOM');
    return;
  }

  /* ── Reset all paths to base style ── */
  svgEl.querySelectorAll('path').forEach(p => {
    p.style.fill        = '';
    p.style.stroke      = '';
    p.style.strokeWidth = '';
    p.style.cursor      = 'default';
    p.style.transition  = 'fill 0.15s ease';
  });

  /* ── Color covered countries ── */
  let coloredCount = 0;

  Object.entries(countryPartners).forEach(([countryName, partners]) => {
    const svgInfo = COUNTRY_TO_SVG[countryName];
    if (!svgInfo) return;

    let elements = [];

    if (svgInfo.type === 'id') {
      const el = document.getElementById(svgInfo.val);
      if (el) elements = [el];
    } else if (svgInfo.type === 'class') {
      // Match by class attribute value exactly
      elements = [...svgEl.querySelectorAll('path')].filter(el =>
        el.getAttribute('class') === svgInfo.val
      );
    } else if (svgInfo.type === 'name') {
      elements = [...svgEl.querySelectorAll('path')].filter(el =>
        el.getAttribute('name') === svgInfo.val
      );
    }

    if (!elements.length) return;
    coloredCount++;

    const count     = partners.length;
    const intensity = count === 1 ? 0.5 : count === 2 ? 0.65 : count <= 4 ? 0.8 : 0.95;
    const hasActive = partners.some(p =>
      ['Sending & Receiving','Sending Only','Receiving Only'].includes(p.status)
    );
    const color = hasActive
      ? `rgba(79,110,247,${intensity})`
      : `rgba(240,168,50,${intensity})`;

    elements.forEach(el => {
      el.style.fill   = color;
      el.style.cursor = 'pointer';
      el.addEventListener('mouseenter', e => showMapTooltip(e, countryName, partners));
      el.addEventListener('mousemove',  e => moveMapTooltip(e));
      el.addEventListener('mouseleave', hideMapTooltip);
      el.addEventListener('click', () => {
        const flag = window.ALL_COUNTRIES.find(c => c.name === countryName)?.flag_emoji || '🌍';
        const fullPartners = partners.map(p => {
          const full = window.ALL_COMPANIES.find(c => c.id === p.id);
          const co   = full?.countries?.find(x => x.name === countryName);
          return { ...full, direction: co?.direction, transactions: co?.transactions || [] };
        });
        openCountryDetail(countryName, flag, fullPartners);
      });
    });
  });

  /* ── Highlight Turkey (Payporter home) ── */
  const turkeyEls = [...svgEl.querySelectorAll('path')].filter(el =>
    el.getAttribute('class') === 'Turkey'
  );
  turkeyEls.forEach(el => {
    el.style.fill        = 'rgba(240,82,82,0.75)';
    el.style.strokeWidth = '0.6';
    el.style.cursor      = 'pointer';
    el.addEventListener('mouseenter', e =>
      showMapTooltip(e, '🇹🇷 Turkey — Payporter', [])
    );
    el.addEventListener('mousemove',  e => moveMapTooltip(e));
    el.addEventListener('mouseleave', hideMapTooltip);
  });

  console.log(`Coverage: colored ${coloredCount}/${Object.keys(countryPartners).length} countries`);
  console.log('Countries in DB with partners:', Object.keys(countryPartners));
  console.log('Sample - first country partners:', Object.entries(countryPartners)[0]);
  
  // Show which countries had no SVG match
  const unmatched = Object.keys(countryPartners).filter(name => !COUNTRY_TO_SVG[name]);
  if (unmatched.length > 0) {
    console.warn('Countries with no SVG mapping:', unmatched);
  }

  /* ── Legend ── */
  document.getElementById('coverage-legend').innerHTML = `
    <div class="cov-legend">
      <div class="cov-legend-item">
        <div class="cov-legend-dot" style="background:rgba(79,110,247,0.85)"></div>
        <span>Active partners</span>
      </div>
      <div class="cov-legend-item">
        <div class="cov-legend-dot" style="background:rgba(240,168,50,0.85)"></div>
        <span>Pipeline / In progress</span>
      </div>
      <div class="cov-legend-item">
        <div class="cov-legend-dot" style="background:rgba(240,82,82,0.75)"></div>
        <span>🇹🇷 Payporter — Turkey</span>
      </div>
      <div class="cov-legend-item">
        <div class="cov-legend-dot" style="background:var(--cov-empty);border:1px solid var(--cov-border)"></div>
        <span>No coverage</span>
      </div>
      <div style="font-size:11px;color:var(--tx3);margin-left:auto">
        Darker = more partners · Click any country for details
      </div>
    </div>`;
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
    ['Sending & Receiving','Sending Only','Receiving Only'].includes(p.status)
  ).length;

  tip.innerHTML = `
    <div class="map-tip-name">${countryName}</div>
    ${partners.length > 0 ? `
      <div class="map-tip-count">${partners.length} partner${partners.length !== 1 ? 's' : ''}</div>
      ${activeCount > 0 ? `<div class="map-tip-active">● ${activeCount} active</div>` : ''}
      <div class="map-tip-names">${partners.slice(0,4).map(p=>p.name).join(', ')}${partners.length>4?` +${partners.length-4} more`:''}</div>
      <div class="map-tip-hint">Click to view details</div>
    ` : '<div style="font-size:11px;color:var(--tx3)">Payporter HQ</div>'}`;

  tip.style.display = 'block';
  moveMapTooltip(e);
}

function moveMapTooltip(e) {
  const tip = document.getElementById('map-tooltip');
  if (!tip) return;
  const x    = e.clientX + 14;
  const y    = e.clientY - 10;
  const tipW = tip.offsetWidth;
  const winW = window.innerWidth;
  tip.style.left = (x + tipW > winW ? x - tipW - 28 : x) + 'px';
  tip.style.top  = y + 'px';
}

function hideMapTooltip() {
  const tip = document.getElementById('map-tooltip');
  if (tip) tip.style.display = 'none';
}