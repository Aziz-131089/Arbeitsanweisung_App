function setStatus(message, kind = '') {
  $('speicherStatus').textContent = message;
  $('speicherStatus').dataset.kind = kind;
}

function aktualisiereKopfKurz() {
  const nr = $('docNr').value.trim();
  const place = $('docArbeitsplatz').value.trim() || $('docTitel').value.trim();
  const shortPlace = /(?:^|\s)([A-ZÄÖÜ]{2,12}[-_]\d[\w.-]*)\s*$/.exec(place)?.[1] || place;
  const summary = [nr, shortPlace].filter(Boolean).join(' · ') || 'Neue Arbeitsanweisung';
  $('kopfKurz').textContent = summary;
  $('kopfSummary').textContent = 'Kopfdaten: ' + summary;
  document.title = (nr || 'Arbeitsanweisung') + (place ? ' – ' + place : '') + ' · V__APP_VERSION__';
}

function collectStand() {
  lastSnapshotAt=Math.max(Date.now(),lastSnapshotAt+1);
  const stand = { version: DATA_VERSION, updatedAt: lastSnapshotAt, logoDataUrl, schritte: [] };
  for (const id of META_IDS) stand[id] = $(id).value;
  stand.verteiler = verteilerText(stand.verteiler);
  stand.verteilerAlt = $('verteiler').dataset.previous || '';
  for (const card of $('schritteListe').querySelectorAll('.step-card')) {
    const id = Number(card.dataset.stepId), st = bildStatus[id];
    if (!st) continue;
    stand.schritte.push(stepDataFromUI(id));
  }
  return stand;
}

function stepDataFromUI(id) {
  const st=bildStatus[id];
  return {kurztitel:$('kurztitel-'+id).value,taetigkeit:$('taetigkeit-'+id).value,werkzeuge:$('werkzeuge-'+id).value,sicherheit:$('sicherheit-'+id).value,
    bildDataUrl:st.bildDataUrl,formen:clone(st.formen),view:clone(st.view),canvasSize:clone(st.canvasSize),werkzeug:st.werkzeug,
    verlauf:clone(st.verlauf),legacyStretch:Boolean(st.legacyStretch)};
}

