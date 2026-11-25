// Step editor: stable ids are independent of the visible order.
function schrittHinzufuegen(values = emptyStep(), save = true) {
  const nr = ++schrittZaehler;
  const s = values || emptyStep();
  const card = document.createElement('article');
  card.className = 'card step-card';
  card.dataset.stepId = String(nr);
  const id = name => name + '-' + nr;
  card.innerHTML = '<button type="button" class="step-toggle" aria-expanded="false" aria-controls="' + id('stepBody') + '">' +
    '<span class="step-num"></span><span class="step-summary"><span class="step-summary-title">Neuer Arbeitsschritt</span><span class="step-summary-status"></span></span><img class="step-mini" alt="" hidden><span class="step-chevron" aria-hidden="true"></span></button>' +
    '<div class="step-body" id="' + id('stepBody') + '" hidden><div class="step-main"><div class="photo-column">' +
    '<div class="image-placeholder" id="' + id('placeholder') + '"><svg width="35" height="35" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="m4 17 5-6 4 4 3-3 5 5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/></svg><span>Noch kein Foto</span></div>' +
    '<img hidden id="' + id('thumb') + '" class="step-image-preview" alt="Bearbeitetes Foto des Arbeitsschrittes – zum Bearbeiten antippen" role="button" tabindex="0">' +
    '<div class="button-row photo-actions"><button class="btn btn-blue capture-photo" type="button" title="Kamera öffnen">📷 Foto aufnehmen</button>' +
    '<button class="btn choose-photo" type="button">Bild laden</button>' +
    '<button class="btn edit-photo" type="button" aria-expanded="false" aria-controls="' + id('editor') + '">Bild bearbeiten</button>' +
    '<input type="file" hidden id="' + id('datei') + '" accept="image/*">' +
    '<input type="file" hidden id="' + id('kamera') + '" accept="image/*" capture="environment"></div>' +
    '<p class="photo-status" id="' + id('photoStatus') + '" aria-live="polite"></p></div>' +
    '<div class="step-fields"><div class="field"><label for="' + id('kurztitel') + '">Kurztitel (optional)</label><input id="' + id('kurztitel') + '" maxlength="120" type="text" placeholder="z. B. Bauteil prüfen"></div><div class="field"><div class="field-heading">' +
    '<label for="' + id('taetigkeit') + '">Tätigkeitsbeschreibung</label><button class="btn speech-step" type="button">🎙 Einsprechen</button></div>' +
    '<textarea id="' + id('taetigkeit') + '" placeholder="Was ist in diesem Schritt zu tun?"></textarea></div>' +
    '<div class="field"><label for="' + id('werkzeuge') + '">Werkzeuge / Hilfsmittel</label>' +
    '<input id="' + id('werkzeuge') + '" type="text" placeholder="Optional"></div>' +
    '<details class="step-extra"><summary>Schrittspezifische Sicherheit / PSA (optional)</summary>' +
    '<label for="' + id('sicherheit') + '" class="visually-hidden">Sicherheit / PSA für diesen Schritt</label>' +
    '<textarea id="' + id('sicherheit') + '" placeholder="Optional – bestätigte Hinweise"></textarea></details></div></div>' +
    '<div id="' + id('editor') + '" class="editor-box" hidden>' +
    '<div class="button-row"><button type="button" class="btn active tool-circle" aria-pressed="true">Roter Kreis</button>' +
    '<button type="button" class="btn tool-arrow" aria-pressed="false">Roter Pfeil</button>' +
    '<button type="button" class="btn tool-number" aria-pressed="false">Nummer setzen</button>' +
    '<button type="button" class="btn tool-pan" aria-pressed="false">Bild verschieben</button>' +
    '<button type="button" class="btn undo-mark">↩ Rückgängig</button>' +
    '<button type="button" class="btn btn-danger delete-mark">Markierung löschen</button></div>' +
    '<div class="editor-layout"><canvas class="photo-canvas" id="' + id('canvas') + '" width="440" height="330" aria-label="Bildeditor für Kreis- und Pfeilmarkierungen"></canvas>' +
    '<div class="editor-controls"><label for="' + id('zoom') + '">Bildausschnitt / Zoom</label>' +
    '<div class="zoom-row"><input type="range" min="1" max="3" step="0.05" id="' + id('zoom') + '" value="1"><output id="' + id('zoomOut') + '">100 %</output></div>' +
    '<div class="button-row"><button class="btn reset-view" type="button">Ausschnitt zurücksetzen</button><button class="btn btn-danger remove-photo" type="button">Foto entfernen</button></div>' +
    '<p class="hint">Markierung antippen und ziehen zum Verschieben. Am blauen Griff Größe und Richtung ändern. Nummern werden automatisch vergeben und können im Text referenziert werden. Die blauen Griffe erscheinen nicht im Dokument.</p></div></div></div>' +
    '<div class="step-actions"><button class="btn icon-button move-up" type="button" title="Schritt nach oben" aria-label="Schritt nach oben">▲</button>' +
    '<button class="btn icon-button move-down" type="button" title="Schritt nach unten" aria-label="Schritt nach unten">▼</button>' +
    '<button class="btn duplicate-step" type="button">Duplizieren</button><button class="btn btn-danger delete-step" type="button">Löschen</button></div></div>';
  $('schritteListe').append(card);
  $(id('kurztitel')).value=str(s.kurztitel);
  $(id('taetigkeit')).value = str(s.taetigkeit);
  $(id('werkzeuge')).value = str(s.werkzeuge);
  $(id('sicherheit')).value = str(s.sicherheit);
  card.querySelector('.step-extra').open=Boolean(str(s.sicherheit).trim());
  for (const n of ['kurztitel','taetigkeit', 'werkzeuge', 'sicherheit']) $(id(n)).addEventListener('input',()=>{updateStepSummary(nr);scheduleSave();});
  card.querySelector('.step-toggle').addEventListener('click',()=>{if(activeStepId===nr&&activeStepOpen){activeStepOpen=false;syncActiveSteps();}else setActiveStep(nr);});
  card.querySelector('.move-up').addEventListener('click', () => moveStep(nr, -1));
  card.querySelector('.move-down').addEventListener('click', () => moveStep(nr, 1));
  card.querySelector('.delete-step').addEventListener('click', () => schrittLoeschen(nr));
  card.querySelector('.duplicate-step').addEventListener('click',()=>duplicateStep(nr));
  card.querySelector('.choose-photo').addEventListener('click', () => $(id('datei')).click());
  card.querySelector('.capture-photo').addEventListener('click', () => $(id('kamera')).click());
  card.querySelector('.edit-photo').addEventListener('click', () => editorUmschalten(nr));
  $(id('thumb')).addEventListener('click', () => editorUmschalten(nr));
  $(id('thumb')).addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();editorUmschalten(nr);}});
  $(id('datei')).addEventListener('change', e => { void bildLaden(e, nr); });
  $(id('kamera')).addEventListener('change',e=>{void bildLaden(e,nr);});
  card.querySelector('.speech-step').addEventListener('click', e => einsprechen(id('taetigkeit'), e.currentTarget));
  card.querySelector('.tool-circle').addEventListener('click', () => werkzeugWaehlen(nr, 'kreis'));
  card.querySelector('.tool-arrow').addEventListener('click', () => werkzeugWaehlen(nr, 'pfeil'));
  card.querySelector('.tool-number').addEventListener('click', () => werkzeugWaehlen(nr, 'nummer'));
  card.querySelector('.tool-pan').addEventListener('click', () => werkzeugWaehlen(nr, 'pan'));
  card.querySelector('.undo-mark').addEventListener('click', () => rueckgaengig(nr));
  card.querySelector('.delete-mark').addEventListener('click', () => deleteMark(nr));
  card.querySelector('.reset-view').addEventListener('click', () => resetView(nr));
  card.querySelector('.remove-photo').addEventListener('click', () => removePhoto(nr));
  $(id('zoom')).addEventListener('input', event => {
    const st = bildStatus[nr];
    if (!st || !st.bild) return;
    changeView(st, { ...st.view, zoom: Number(event.target.value) });
    canvasNeuZeichnen(nr);
    syncEditorControls(nr);
  });
  $(id('zoom')).addEventListener('change', () => commitEdit(nr));
  canvasInitialisieren(nr, s);
  if(!applyingData) schrittNummernAktualisieren();
  if (save) {setActiveStep(nr);scheduleSave();}
  return nr;
}

function stepCards(){return Array.from($('schritteListe').querySelectorAll('.step-card'));}
function stepComplete(nr){const st=bildStatus[nr];return Boolean(st?.bildDataUrl&&(st.bild||st.pending)&&$('taetigkeit-'+nr)?.value.trim());}
function updateStepSummary(nr, refreshNav=true) {
  const card=document.querySelector('.step-card[data-step-id="'+nr+'"]'), st=bildStatus[nr];
  if(!card||!st)return;
  const title=$('kurztitel-'+nr).value.trim()||$('taetigkeit-'+nr).value.trim().replace(/\s+/g,' ');
  card.querySelector('.step-summary-title').textContent=title.length>70?title.slice(0,67)+'…':title||'Neuer Arbeitsschritt';
  const hasText=Boolean($('taetigkeit-'+nr).value.trim());
  const status=card.querySelector('.step-summary-status');
  const hasPhoto=Boolean(st.bildDataUrl);
  status.textContent=st.pending?'Foto wird geladen …':hasText&&hasPhoto?(st.bild?'Bild und Text erfasst':'Gespeichertes Bild prüfen'):[!hasPhoto?'Bild fehlt':'',!hasText?'Text fehlt':''].filter(Boolean).join(' · ');
  status.dataset.complete=String(hasPhoto&&hasText&&Boolean(st.bild));
  const thumb=card.querySelector('.step-mini'), image=$('thumb-'+nr);
  if(!image.hidden&&image.getAttribute('src')){if(thumb.getAttribute('src')!==image.getAttribute('src'))thumb.src=image.src;thumb.hidden=false;}else{thumb.hidden=true;thumb.removeAttribute('src');}
  if(refreshNav&&!applyingData)updateStepNavigation();
}
function syncActiveSteps(){
  for(const card of stepCards()){
    const open=Number(card.dataset.stepId)===activeStepId&&activeStepOpen;
    card.classList.toggle('step-open',open);
    card.querySelector('.step-toggle').setAttribute('aria-expanded',String(open));
    card.querySelector('.step-body').hidden=!open;
  }
  updateStepNavigation();
}
function setActiveStep(nr, scroll=false){
  const card=document.querySelector('.step-card[data-step-id="'+nr+'"]');
  if(!card)return;
  if(recognition&&activeStepId!==nr){try{recognition.stop();}catch(_){}}
  activeStepId=nr;activeStepOpen=true;syncActiveSteps();
  if(scroll)card.scrollIntoView({block:'start',behavior:'instant'});
}
function updateStepNavigation(){
  const cards=stepCards(), idx=cards.findIndex(c=>Number(c.dataset.stepId)===activeStepId);
  $('stepPosition').textContent=idx<0?'Arbeitsschritte':'Schritt '+(idx+1)+' von '+cards.length;
  const complete=cards.filter(c=>stepComplete(Number(c.dataset.stepId))).length;
  $('stepCount').textContent=complete+' von '+cards.length+' mit Bild und Text';
  $('stepPrevBtn').disabled=idx<=0;
  $('stepNextBtn').textContent=idx===cards.length-1?'+ Nächster Schritt':'Nächster Schritt';
  $('stepNextBtn').disabled=idx===cards.length-1&&cards.length>=250;
}
function addNewStep(){
  if(stepCards().length>=250){setStatus('Maximal 250 Arbeitsschritte pro Entwurf.','warning');return;}
  setActiveStep(schrittHinzufuegen(emptyStep()),true);
}
function navigateStep(direction){
  const cards=stepCards(), idx=cards.findIndex(c=>Number(c.dataset.stepId)===activeStepId);
  if(direction>0&&idx===cards.length-1){addNewStep();return;}
  const target=cards[idx+direction];if(target)setActiveStep(Number(target.dataset.stepId),true);
}
function duplicateStep(nr){
  const original=document.querySelector('.step-card[data-step-id="'+nr+'"]'), st=bildStatus[nr];
  if(!original||!st)return;
  if(st.pending){setStatus('Bitte warten, bis das Foto vollständig geladen ist.','warning');return;}
  if(stepCards().length>=250){setStatus('Maximal 250 Arbeitsschritte pro Entwurf.','warning');return;}
  const newId=schrittHinzufuegen(stepDataFromUI(nr),false);
  original.after(document.querySelector('.step-card[data-step-id="'+newId+'"]'));
  schrittNummernAktualisieren();setActiveStep(newId,true);scheduleSave();
}

function schrittNummernAktualisieren() {
  const cards = stepCards();
  cards.forEach((card, idx) => {
    card.querySelector('.step-num').textContent = String(idx + 1);
    card.querySelector('.move-up').disabled = idx === 0;
    card.querySelector('.move-down').disabled = idx === cards.length - 1;
    card.querySelector('.move-up').setAttribute('aria-label', 'Arbeitsschritt ' + (idx+1) + ' nach oben');
    card.querySelector('.move-down').setAttribute('aria-label', 'Arbeitsschritt ' + (idx+1) + ' nach unten');
    updateStepSummary(Number(card.dataset.stepId),false);
  });
  if(cards.length&&!cards.some(card=>Number(card.dataset.stepId)===activeStepId)){activeStepId=Number(cards[0].dataset.stepId);activeStepOpen=true;}
  syncActiveSteps();
}

function moveStep(nr, direction) {
  const card = document.querySelector('.step-card[data-step-id="' + nr + '"]');
  if (!card) return;
  // Use insertBefore deliberately: moving nodes preserves the picture editor state/listeners.
  if (direction < 0) {
    const previous = card.previousElementSibling;
    if (previous) $('schritteListe').insertBefore(card, previous);
  } else if (card.nextElementSibling) {
    $('schritteListe').insertBefore(card.nextElementSibling, card);
  }
  schrittNummernAktualisieren();
  scheduleSave();
}

function schrittLoeschen(nr) {
  const st = bildStatus[nr];
  const card = document.querySelector('.step-card[data-step-id="' + nr + '"]');
  if (!st || !card) return;
  const hasContent = st.bildDataUrl || st.pending || ['kurztitel-','taetigkeit-', 'werkzeuge-', 'sicherheit-'].some(key => $(key + nr).value.trim());
  if (hasContent && !confirm('Diesen Arbeitsschritt einschließlich Foto und Markierungen löschen?')) return;
  // Never reuse a deleted id, even while a photo is decoding asynchronously.
  const adjacent=card.nextElementSibling||card.previousElementSibling;
  if(activeStepId===nr){activeStepId=adjacent?Number(adjacent.dataset.stepId):null;activeStepOpen=true;}
  delete bildStatus[nr];
  card.remove();
  if (!$('schritteListe').children.length) schrittHinzufuegen(emptyStep(), false);
  schrittNummernAktualisieren();
  scheduleSave();
}

