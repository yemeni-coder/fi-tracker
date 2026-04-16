/* ════════════════════════════════════════════════
   js/db.js
════════════════════════════════════════════════ */

async function sbFetch(path, options = {}) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey':        CONFIG.SUPABASE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        options.prefer || 'return=representation',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Database error');
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ── Role & Profile ── */
async function dbGetUserProfile(userId) {
  const rows = await sbFetch(`profiles?id=eq.${userId}&select=role,display_name`);
  return rows?.[0] || { role: 'viewer', display_name: null };
}

async function dbGetUserRole(userId) {
  const profile = await dbGetUserProfile(userId);
  return profile.role || 'viewer';
}

/* ── Countries ── */
async function dbGetAllCountries() {
  return await sbFetch('countries?select=id,name,flag_emoji,region&order=name.asc');
}

async function dbAddCountry(data) {
  const [c] = await sbFetch('countries', {
    method: 'POST',
    body: JSON.stringify({ name: data.name, flag_emoji: data.flag||null, region: data.region||null })
  });
  return c;
}

async function dbUpdateCountry(id, data) {
  const [c] = await sbFetch(`countries?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: data.name, flag_emoji: data.flag||null, region: data.region||null })
  });
  return c;
}

async function dbDeleteCountry(id) {
  await sbFetch(`countries?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
}

/* ── Companies ── */
async function dbGetCompanies() {
  const companies = await sbFetch('companies?select=*&order=name.asc');
  const relations = await sbFetch('company_countries?select=*,countries(id,name,flag_emoji)&order=countries(name).asc');
  let txPairs = [];
  if (relations.length > 0) {
    const ccIds = relations.map(r => r.id).join(',');
    txPairs = await sbFetch(`company_country_transactions?select=*&cc_id=in.(${ccIds})`);
  }
  return companies.map(c => ({
    ...c,
    countries: relations
      .filter(r => r.company_id === c.id)
      .map(r => ({
        id:           r.countries.id,
        name:         r.countries.name,
        flag:         r.countries.flag_emoji || '🌍',
        direction:    r.direction,
        transactions: txPairs
          .filter(p => p.cc_id === r.id)
          .map(p => ({
            id:            p.id,
            txType:        p.tx_type,
            currencies:    p.currencies    || [],
            segments:      p.segments      || [],
            /* FEATURE 2 — transaction limits */
            limitMin:      p.limit_min     ?? null,
            limitMax:      p.limit_max     ?? null,
            limitCurrency: p.limit_currency || null,
            limitPeriod:   p.limit_period   || null
          }))
      }))
  }));
}

/* ── Check for duplicate company name ── */
async function dbCheckDuplicateName(name, excludeId = null) {
  const path = `companies?select=id,name&name=ilike.${encodeURIComponent(name.trim())}`;
  const rows = await sbFetch(path);
  if (!rows || rows.length === 0) return false;
  if (excludeId) return rows.some(r => r.id !== excludeId);
  return rows.length > 0;
}

/* FEATURE 1 — local_market_name included in buildCompanyBody */
function buildCompanyBody(data) {
  return {
    name:                data.name,
    local_market_name:   data.localMarketName    || null,
    company_type:        data.type               || null,
    country_of_origin:   data.countryOfOrigin    || null,
    relationship_status: data.relationshipStatus || 'Pipeline',
    agreement_date:      data.agreementDate      || null,
    go_live_date:        data.goLiveDate          || null,
    last_review_date:    data.lastReviewDate      || null,
    contact_name:        data.contactName        || null,
    contact_email:       data.contactEmail       || null,
    contact_phone:       data.contactPhone       || null,
    website:             data.website            || null,
    notes:               data.notes              || null
  };
}

async function dbAddCompany(data) {
  const [company] = await sbFetch('companies', {
    method: 'POST',
    body: JSON.stringify(buildCompanyBody(data))
  });
  if (data.countryLinks?.length > 0) await dbSaveCountryLinks(company.id, data.countryLinks);
  return company;
}

async function dbUpdateCompany(id, data) {
  const [company] = await sbFetch(`companies?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(buildCompanyBody(data))
  });
  await sbFetch(`company_countries?company_id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  if (data.countryLinks?.length > 0) await dbSaveCountryLinks(id, data.countryLinks);
  return company;
}

async function dbDeleteCompany(id) {
  await sbFetch(`companies?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
}

/* FEATURE 2 — transaction limits saved with each tx row */
async function dbSaveCountryLinks(companyId, links) {
  for (const link of links) {
    const [ccRow] = await sbFetch('company_countries', {
      method: 'POST',
      body: JSON.stringify({ company_id: companyId, country_id: link.countryId, direction: link.direction||null })
    });
    const txRows = (link.transactions||[]).filter(t=>t.txType).map(t=>({
      cc_id:          ccRow.id,
      tx_type:        t.txType,
      currencies:     t.currencies    || [],
      segments:       t.segments      || [],
      limit_min:      (t.limitMin  !== '' && t.limitMin  != null) ? parseFloat(t.limitMin)  : null,
      limit_max:      (t.limitMax  !== '' && t.limitMax  != null) ? parseFloat(t.limitMax)  : null,
      limit_currency: t.limitCurrency || null,
      limit_period:   t.limitPeriod   || null
    }));
    if (txRows.length > 0) await sbFetch('company_country_transactions', { method: 'POST', body: JSON.stringify(txRows) });
  }
}

async function dbAddCompanyToCountry(companyId, countryId, direction, transactions) {
  const [ccRow] = await sbFetch('company_countries', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, country_id: countryId, direction: direction||null })
  });
  const txRows = (transactions||[]).filter(t=>t.txType).map(t=>({
    cc_id:          ccRow.id,
    tx_type:        t.txType,
    currencies:     t.currencies    || [],
    segments:       t.segments      || [],
    limit_min:      (t.limitMin  !== '' && t.limitMin  != null) ? parseFloat(t.limitMin)  : null,
    limit_max:      (t.limitMax  !== '' && t.limitMax  != null) ? parseFloat(t.limitMax)  : null,
    limit_currency: t.limitCurrency || null,
    limit_period:   t.limitPeriod   || null
  }));
  if (txRows.length > 0) await sbFetch('company_country_transactions', { method: 'POST', body: JSON.stringify(txRows) });
  return ccRow;
}

async function dbRemoveCompanyFromCountry(companyId, countryId) {
  await sbFetch(`company_countries?company_id=eq.${companyId}&country_id=eq.${countryId}`, {
    method: 'DELETE', prefer: 'return=minimal'
  });
}

/* ── Activity Log ── */
async function dbLogActivity(action, companyId, companyName, details) {
  try {
    await sbFetch('activity_log', {
      method: 'POST',
      body: JSON.stringify({
        user_email:   window.CURRENT_USER_NAME || window.CURRENT_USER_EMAIL || 'unknown',
        action,
        company_id:   companyId   || null,
        company_name: companyName || null,
        details:      details     || null
      })
    });
  } catch (e) {
    console.warn('Activity log failed:', e);
  }
}

async function dbGetActivityLog(limit = 50) {
  return await sbFetch(`activity_log?select=*&order=created_at.desc&limit=${limit}`);
}

/* ── Workspace Activities ── */
async function dbGetActivities(filters = {}) {
  let path = 'activities?select=*&order=created_at.desc';
  if (filters.companyId) path += `&company_id=eq.${filters.companyId}`;
  if (filters.userEmail) path += `&user_email=eq.${encodeURIComponent(filters.userEmail)}`;
  if (filters.status)    path += `&status=eq.${filters.status}`;
  if (filters.limit)     path += `&limit=${filters.limit}`;
  return await sbFetch(path);
}

async function dbAddActivity(data) {
  const userLabel = window.CURRENT_USER_NAME || window.CURRENT_USER_EMAIL || 'unknown';
  const [act] = await sbFetch('activities', {
    method: 'POST',
    body: JSON.stringify({
      company_id:     data.companyId     || null,
      company_name:   data.companyName   || null,
      user_email:     userLabel,
      activity_date:  data.date          || new Date().toISOString().slice(0,10),
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

async function dbUpdateActivity(id, data) {
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

async function dbDeleteActivity(id) {
  await sbFetch(`activities?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
}

async function dbGetOverdueActivities() {
  const today = new Date().toISOString().slice(0,10);
  return await sbFetch(`activities?select=*&status=eq.Pending&follow_up_date=lt.${today}&order=follow_up_date.asc`);
}

async function dbGetTodayActivities() {
  const today = new Date().toISOString().slice(0,10);
  return await sbFetch(`activities?select=*&activity_date=eq.${today}&order=created_at.desc`);
}

async function dbGetCompanyLastActivity(companyId) {
  const rows = await sbFetch(`activities?company_id=eq.${companyId}&select=*&order=activity_date.desc,created_at.desc&limit=1`);
  return rows?.[0] || null;
}

/* ── Observations ── */
async function dbAddObservation(data) {
  const [obs] = await sbFetch('observations', {
    method: 'POST',
    body: JSON.stringify({
      user_email:   data.userEmail,
      user_role:    data.userRole    || 'viewer',
      company_id:   data.companyId   || null,
      company_name: data.companyName || null,
      country_name: data.countryName || null,
      note:         data.note,
      status:       'pending'
    })
  });
  return obs;
}

async function dbGetObservations(status = null) {
  const filter = status ? `&status=eq.${status}` : '';
  return await sbFetch(`observations?select=*&order=created_at.desc${filter}`);
}

async function dbGetMyObservations(email) {
  return await sbFetch(`observations?select=*&user_email=eq.${encodeURIComponent(email)}&order=created_at.desc`);
}

async function dbReviewObservation(id, reply, reviewerEmail) {
  const [obs] = await sbFetch(`observations?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status:      'reviewed',
      admin_reply: reply || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerEmail
    })
  });
  return obs;
}

async function dbDeleteObservation(id) {
  await sbFetch(`observations?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
}

async function dbGetPendingObservationCount() {
  const rows = await sbFetch('observations?select=id,note&status=eq.pending');
  if (!rows) return 0;
  return rows.filter(r => !r.note?.includes('accessed the system')).length;
}

/* ── Company Contacts ── */
async function dbGetContacts(companyId) {
  return await sbFetch(`company_contacts?company_id=eq.${companyId}&select=*&order=is_primary.desc,name.asc`);
}

async function dbAddContact(companyId, data) {
  const [c] = await sbFetch('company_contacts', {
    method: 'POST',
    body: JSON.stringify({
      company_id: companyId,
      name:       data.name,
      role:       data.role      || null,
      email:      data.email     || null,
      phone:      data.phone     || null,
      is_primary: data.isPrimary || false,
      notes:      data.notes     || null
    })
  });
  return c;
}

async function dbUpdateContact(id, data) {
  const [c] = await sbFetch(`company_contacts?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name:       data.name,
      role:       data.role      || null,
      email:      data.email     || null,
      phone:      data.phone     || null,
      is_primary: data.isPrimary || false,
      notes:      data.notes     || null
    })
  });
  return c;
}

async function dbDeleteContact(id) {
  await sbFetch(`company_contacts?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
}

/* ── Get all admin profiles ── */
async function dbGetAllAdmins() {
  return await sbFetch(`profiles?select=id,role,display_name`);
}

/* ── Calendar Events ── */
async function dbGetUpcomingEvents() {
  const today = new Date().toISOString().slice(0, 10);
  return await sbFetch(`events?event_date=gte.${today}&order=event_date.asc`);
}

/* ════════════════════════════════════════════════
   FEATURE 3 — Additional Agreements
════════════════════════════════════════════════ */

async function dbGetAgreements(companyId) {
  return await sbFetch(
    `company_agreements?company_id=eq.${companyId}&select=*&order=agreement_date.asc,created_at.asc`
  );
}

async function dbAddAgreement(companyId, data) {
  const [a] = await sbFetch('company_agreements', {
    method: 'POST',
    body: JSON.stringify({
      company_id:     companyId,
      name:           data.name,
      agreement_date: data.agreementDate || null,
      notes:          data.notes         || null
    })
  });
  return a;
}

async function dbUpdateAgreement(id, data) {
  const [a] = await sbFetch(`company_agreements?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name:           data.name,
      agreement_date: data.agreementDate || null,
      notes:          data.notes         || null
    })
  });
  return a;
}

async function dbDeleteAgreement(id) {
  await sbFetch(`company_agreements?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
}
