/* ════════════════════════════════════════════════
   js/ui.js
   Shared UI helpers: tags, toast, initials, etc.
════════════════════════════════════════════════ */

/* ── Initials from company name ── */
function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

/* ── Direction label ── */
function dirLabel(dir) {
  if (dir === 'both')    return '⇄ Both ways';
  if (dir === 'send')    return '→ Send only';
  if (dir === 'receive') return '← Receive only';
  return dir || '—';
}

/* ── Build a tag HTML string ── */
function makeTag(value, cssClass) {
  return `<span class="tag ${cssClass}">${value}</span>`;
}

/* ── Get all checked values for a checkbox group ── */
function getChecked(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value);
}

/* ── Set checkboxes programmatically ── */
function setChecked(name, values = []) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(el => {
    el.checked = values.includes(el.value);
  });
}

/* ── Toast notification ── */
function showToast(message, duration = 2800) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

/* ── Close detail panel ── */
function closePanel() {
  document.getElementById('overlay').classList.remove('open');
}

/* ── Close modal ── */
function closeModal() {
  document.getElementById('mod-overlay').classList.remove('open');
}