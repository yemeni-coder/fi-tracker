/* ════════════════════════════════════════════════
   js/notes.js
   Personal workspace notes — not shared
════════════════════════════════════════════════ */

/* ── DB ── */
async function wsGetNotes() {
  const myName  = window.CURRENT_USER_NAME  || '';
  const myEmail = window.CURRENT_USER_EMAIL || '';
  const myLabel = myName ? `${myName} (${myEmail})` : myEmail;
  const all = await sbFetch('activities?activity_type=eq.Note&order=created_at.desc&limit=1000');
  return (all || []).filter(a => {
    const ue = a.user_email || '';
    // Match name-only, email-only, or "Name (email)" format
    return ue === myName || ue === myEmail || ue === myLabel
      || (myName && ue.startsWith(myName + ' ('));
  });
}

async function wsAddNote(data) {
  // Store as name-only for consistency
  const userLabel = window.CURRENT_USER_NAME || window.CURRENT_USER_EMAIL || 'unknown';
  const [note] = await sbFetch('activities', {
    method: 'POST',
    body: JSON.stringify({
      company_id:    data.companyId    || null,
      company_name:  data.companyName  || null,
      user_email:    userLabel,
      activity_date: new Date().toISOString().slice(0,10),
      note:          data.note,
      activity_type: 'Note',
      urgency:       'Normal',
      status:        'Completed',
      next_action:   null,
      follow_up_date:null,
      doc_ref:       data.tag          || null
    })
  });
  return note;
}

async function wsUpdateNote(id, data) {
  const [note] = await sbFetch(`activities?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      company_id:   data.companyId   || null,
      company_name: data.companyName || null,
      note:         data.note,
      doc_ref:      data.tag         || null
    })
  });
  return note;
}

/* ── RENDER ── */
async function renderWsNotes() {
  const el = document.getElementById('ws-notes-content');
  if (!el) return;
  el.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;

  try {
    const notes  = await wsGetNotes();
    const search = document.getElementById('ws-notes-search')?.value?.toLowerCase() || '';
    const filterCo = document.getElementById('ws-notes-filter-co')?.value || '';

    // Populate company filter dropdown
    const coSel = document.getElementById('ws-notes-filter-co');
    if (coSel && coSel.options.length <= 1) {
      const names = [...new Set(notes.map(n => n.company_name).filter(Boolean))].sort();
      names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        coSel.appendChild(opt);
      });
    }

    let filtered = notes.filter(n => {
      const matchS  = !search   || n.note?.toLowerCase().includes(search) || n.company_name?.toLowerCase().includes(search) || n.doc_ref?.toLowerCase().includes(search);
      const matchCo = !filterCo || n.company_name === filterCo;
      return matchS && matchCo;
    });

    if (!filtered.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#x1F4DD;</div>
          <p>${notes.length ? 'No notes match your search' : 'No notes yet — write your first one'}</p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div style="font-size:12px;color:var(--tx3);margin-bottom:12px">${filtered.length} note${filtered.length !== 1 ? 's' : ''}</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${filtered.map(n => buildNoteCard(n)).join('')}
      </div>`;

    el.querySelectorAll('.note-edit-btn').forEach(btn =>
      btn.addEventListener('click', () => openNoteForm(+btn.dataset.id))
    );
    el.querySelectorAll('.note-delete-btn').forEach(btn =>
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this note?')) return;
        await sbFetch(`activities?id=eq.${btn.dataset.id}`, { method: 'DELETE', prefer: 'return=minimal' });
        showToast('Note deleted');
        renderWsNotes();
      })
    );

  } catch (err) {
    el.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}

function buildNoteCard(n) {
  const date = n.activity_date
    ? new Date(n.activity_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const tag = n.doc_ref;
  return `
    <div class="ws-note-card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${n.company_name ? `<span style="font-family:'Syne',sans-serif;font-weight:600;font-size:13px;color:var(--accent)">${n.company_name}</span>` : ''}
          ${tag ? `<span style="font-size:10px;padding:2px 8px;border-radius:20px;background:var(--bg);border:1px solid var(--border);color:var(--tx3)">#${tag}</span>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="panel-btn note-edit-btn" data-id="${n.id}" style="width:26px;height:26px;font-size:11px">&#x270F;&#xFE0F;</button>
          <button class="panel-btn note-delete-btn" data-id="${n.id}" style="width:26px;height:26px;font-size:11px;color:var(--danger)">&#x2715;</button>
        </div>
      </div>
      <div style="font-size:13px;color:var(--tx);line-height:1.65;white-space:pre-wrap">${n.note}</div>
      <div style="font-size:11px;color:var(--tx3);margin-top:8px">${date}</div>
    </div>`;
}

/* ── NOTE FORM ── */
function openNoteForm(editId) {
  document.getElementById('ws-note-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ws-note-overlay';
  overlay.className = 'mod-overlay open';

  const coOptions = (window.ALL_COMPANIES || []).map(c =>
    `<option value="${c.id}" data-name="${c.name}">${c.name}</option>`
  ).join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="mod-title">${editId ? 'Edit Note' : 'New Note'}</div>
      <div class="mod-sub">Personal only &#x2014; not shared with your team</div>
      <input type="hidden" id="wn-id" value="${editId || ''}" />

      <div class="form-group">
        <label class="form-label">Link to Company <span style="color:var(--tx3)">(optional)</span></label>
        <select class="form-select" id="wn-company">
          <option value="">No specific company</option>
          ${coOptions}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Tag <span style="color:var(--tx3)">(optional)</span></label>
        <input class="form-input" type="text" id="wn-tag" placeholder="e.g. swift, commission, process, contact" />
      </div>

      <div class="form-group">
        <label class="form-label">Note *</label>
        <textarea class="form-textarea" id="wn-note" rows="7"
          placeholder="Write anything you want to remember &#x2014; what you learned, how something works, a process, a contact detail..."></textarea>
      </div>

      <div class="mod-actions">
        <button class="btn btn-ghost" id="wn-cancel">Cancel</button>
        <button class="btn btn-primary" id="wn-save">${editId ? 'Save Changes' : 'Save Note'}</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('wn-note')?.focus(), 100);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('wn-cancel').addEventListener('click', () => overlay.remove());

  if (editId) {
    wsGetNotes().then(notes => {
      const n = notes.find(x => x.id === editId);
      if (!n) return;
      if (n.company_id) document.getElementById('wn-company').value = n.company_id;
      document.getElementById('wn-tag').value  = n.doc_ref || '';
      document.getElementById('wn-note').value = n.note    || '';
    });
  }

  document.getElementById('wn-save').addEventListener('click', async () => {
    const note = document.getElementById('wn-note').value.trim();
    if (!note) { showToast('Please write something'); return; }

    const coSel       = document.getElementById('wn-company');
    const companyId   = coSel.value ? +coSel.value : null;
    const companyName = companyId
      ? coSel.options[coSel.selectedIndex].dataset.name
      : null;

    const data = {
      companyId, companyName, note,
      tag: document.getElementById('wn-tag').value.trim() || null
    };

    const btn = document.getElementById('wn-save');
    btn.textContent = 'Saving...'; btn.disabled = true;

    try {
      const id = document.getElementById('wn-id').value;
      if (id) { await wsUpdateNote(+id, data); showToast('Note updated'); }
      else    { await wsAddNote(data);          showToast('Note saved'); }
      overlay.remove();
      renderWsNotes();
    } catch (err) {
      showToast('Error: ' + err.message);
      btn.textContent = editId ? 'Save Changes' : 'Save Note';
      btn.disabled = false;
    }
  });
}
