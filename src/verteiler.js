// Canonical order and exact abbreviations, shared by both document outputs.
function verteilerCodes(value) {
  const tokens = str(value).match(/[\p{L}\p{N}_]+/gu) || [];
  return VERTEILER_CODES.filter(code => tokens.includes(code));
}
function verteilerText(value) { return verteilerCodes(value).join(', '); }
// Keep the stored and editable list unchanged; only render the footer with bullets.
function verteilerFusszeile(value) { return verteilerCodes(value).join(' • '); }

function syncVerteilerUI(value, previous = '') {
  const selected = verteilerCodes(value);
  const hidden = $('verteiler');
  hidden.value = selected.join(', ');
  hidden.dataset.previous = str(previous);
  for (const input of $('verteilerOptions').querySelectorAll('input[type="checkbox"]')) {
    input.checked = selected.includes(input.value);
  }
  $('verteilerSummary').textContent = selected.length
    ? 'Im Dokument: ' + hidden.value
    : 'Keine Abteilung ausgewählt.';
  $('verteilerLegacy').hidden = !previous;
  $('verteilerLegacy').textContent = previous
    ? 'Bisheriger Verteiler: ' + previous + ' — bitte die passenden Kürzel auswählen.' : '';
}

function bindVerteilerUI() {
  const group = $('verteilerOptions');
  for (const code of VERTEILER_CODES) {
    const label = document.createElement('label');
    label.className = 'verteiler-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = code;
    checkbox.name = 'verteilerAbteilung';
    const caption = document.createElement('span');
    caption.textContent = code;
    label.append(checkbox, caption);
    group.append(label);
  }
  group.addEventListener('change', () => {
    const selected = Array.from(group.querySelectorAll('input:checked'), input => input.value);
    syncVerteilerUI(selected.join(', '));
    scheduleSave();
  });
}

