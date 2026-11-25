async function restorePreviousDraft(source) {
  if(!ready||busy)return;
  setBusy(true);
  try{
    await readPreviousDrafts();
    const old=previousDrafts[source];
    if(!old)throw new Error('Kein älterer Entwurf in diesem Browser verfügbar.');
    const normalized=normalizeStand(old);
    const label=source==='v1'?'GitHub-Version V1':'Testversion V2';
    if(!confirm('Den aktuellen Entwurf durch eine Kopie aus der '+label+' ersetzen? Der alte Entwurf bleibt erhalten.'))return;
    setStatus('Älterer Entwurf wird übernommen …');
    await adoptDraft(normalized,'Entwurf aus der '+label+' übernommen. Ursprünglicher Entwurf unverändert.');
  }catch(e){setStatus(e.message,'error');}
  finally{updatePreviousDraftControls();setBusy(false);}
}

async function entwurfZuruecksetzen() {
  if (!ready || busy) return;
  if (!confirm('Eine neue Arbeitsanweisung beginnen? Der bisherige Entwurf wird ersetzt. Falls du ihn später weiterbearbeiten möchtest, sichere ihn zuerst als JSON. Unternehmen, Logo, Verteiler, Ersteller und Bildgröße werden übernommen.')) return;
  setBusy(true);
  if (recognition) {try{recognition.abort();}catch(_){}}
  try{
    await Promise.allSettled([...Object.values(bildStatus).map(st=>st.pending).filter(Boolean),...(logoPending?[logoPending]:[])]);
    const previous=collectStand(), wasProtected=storageProtected, next=defaultStand(false);
    next.docFirma=previous.docFirma;
    next.logoDataUrl=previous.logoDataUrl;
    next.verteiler=previous.verteiler;
    next.verteilerAlt=previous.verteilerAlt;
    next.erstelltDurch=previous.erstelltDurch;
    next.docBildgroesse=previous.docBildgroesse;
    if(await adoptDraft(next,'Neue AA begonnen und lokal gespeichert. Unternehmensdaten bleiben erhalten.')){
      $('kopfDetails').open=true;
      $('fussDetails').open=false;
    }else{
      // Never discard the visible working draft when the replacement could
      // not be written to either storage backend.
      storageProtected=wasProtected;
      applyStand(previous); showPanel('edit',true);
      dirty=true;
      setStatus('Neue AA konnte nicht gespeichert werden. Der bisherige Entwurf bleibt geöffnet. Bitte als JSON sichern.','error');
    }
  }finally{setBusy(false);}
}

function bindUI() {
  bindVerteilerUI();
  for (const id of META_IDS) {
    $(id).addEventListener('input',()=>{
      if (['docNr','docTitel','docArbeitsplatz'].includes(id)) aktualisiereKopfKurz();
      scheduleSave();
    });
  }
  $('docBildgroesse').addEventListener('change',()=>{$('previewImageSize').value=$('docBildgroesse').value;scheduleSave();});
  $('previewImageSize').addEventListener('change',()=>{$('docBildgroesse').value=$('previewImageSize').value;scheduleSave();void openPreview();});
  $('psaFeld').addEventListener('input',()=>{$('psaHeading').textContent='Sicherheit / PSA · '+($('psaFeld').value.trim()?'erfasst':'fehlt');});
  $('logoChooseBtn').addEventListener('click',()=>$('logoFile').click());
  $('logoFile').addEventListener('change',event=>{void logoLaden(event);});
  $('logoRemoveBtn').addEventListener('click',()=>{
    if (!confirm('Unternehmenslogo aus diesem Entwurf entfernen?')) return;
    logoLoadToken++; logoPending=null; logoDataUrl=''; updateLogoUI(); scheduleSave();
  });
  for (const button of document.querySelectorAll('[data-speech]')) button.addEventListener('click',()=>einsprechen(button.dataset.speech,button));
  $('addStepBtn').addEventListener('click',addNewStep);
  $('stepPrevBtn').addEventListener('click',()=>navigateStep(-1));
  $('stepNextBtn').addEventListener('click',()=>navigateStep(1));
  $('saveBtn').addEventListener('click',async()=>{
    if (!ready || busy) return;
    requestPersistentStorage();
    setStatus('Entwurf wird gespeichert …');
    await Promise.allSettled([...Object.values(bildStatus).map(st=>st.pending).filter(Boolean),...(logoPending?[logoPending]:[])]);
    await speichernLokal(true);
  });
  $('wordBtn').addEventListener('click',()=>{void exportWord();});
  $('printBtn').addEventListener('click',()=>{void printDocument();});
  $('previewTab').addEventListener('click',()=>{void openPreview();});
  $('bottomPreviewBtn').addEventListener('click',()=>{void openPreview();});
  $('editTab').addEventListener('click',()=>showPanel('edit'));
  $('backBtn').addEventListener('click',()=>showPanel('edit',true));
  for (const [id,zoom] of [['fitBtn','fit'],['actualSizeBtn','actual']]) $(id).addEventListener('click',()=>{
    previewZoom=zoom; $('fitBtn').setAttribute('aria-pressed',String(zoom==='fit'));
    $('actualSizeBtn').setAttribute('aria-pressed',String(zoom==='actual'));
    fitPreview();
  });
  $('backupBtn').addEventListener('click',()=>{void backupDraft();});
  $('restoreBtn').addEventListener('click',()=>$('restoreFile').click());
  $('restoreFile').addEventListener('change',event=>{void importDraft(event);});
  $('legacyV1Btn').addEventListener('click',()=>{void restorePreviousDraft('v1');});
  $('legacyV2Btn').addEventListener('click',()=>{void restorePreviousDraft('v2');});
  $('resetBtn').addEventListener('click',()=>{void entwurfZuruecksetzen();});
  window.addEventListener('resize',fitPreview);
  window.addEventListener('keydown',event=>{
    if ((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='p') {
      event.preventDefault(); void printDocument();
    }
  });
  if (window.ResizeObserver) new ResizeObserver(fitPreview).observe($('previewScroll'));
  document.addEventListener('change',flushPendingDraft);
  document.addEventListener('focusout',()=>{if(saveTimer!==null)flushPendingDraft();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushPendingDraft();});
  window.addEventListener('pagehide',flushPendingDraft);
  window.addEventListener('beforeunload',event=>{
    flushPendingDraft();
    if (dirty || logoPending || Object.values(bildStatus).some(st=>st.pending)) {
      event.preventDefault(); event.returnValue='';
    }
  });
}

async function initialize() {
  bindUI(); setBusy(false);
  try {
    const result=await loadInitialStand();
    applyStand(result.stand);
    updatePreviousDraftControls();
    ready=true;
    $('initialLoading').hidden=true;
    showPanel('edit'); setBusy(false);
    if (result.migrated) {
      setBusy(true);
      setStatus('Älterer Browser-Entwurf wird übernommen …');
      try{
        await Promise.allSettled(Object.values(bildStatus).map(st=>st.pending).filter(Boolean));
        if(await speichernLokal(true))setStatus('Entwurf aus '+(result.source==='v1'?'V1':'V2')+' vollständig übernommen. Der alte Entwurf bleibt unverändert.','ok');
      }finally{setBusy(false);}
    } else if (result.readFailed || storageMode==='none') {
      setStatus('Lokaler Speicher eingeschränkt. Bitte den Entwurf zusätzlich als JSON sichern.','warning');
    } else if (result.existing) {
      setStatus('Letzte AA wiederhergestellt · Änderungen werden automatisch gespeichert.','ok');
    } else {
      setStatus('Bereit · Letzte AA wird automatisch in diesem Browser gespeichert.');
    }
  } catch (error) {
    // Do not silently overwrite a damaged saved draft.
    applyStand(defaultStand(true));
    ready=true;
    storageProtected=true;
    $('initialLoading').hidden=true;
    showPanel('edit'); setBusy(false);
    updatePreviousDraftControls();
    setStatus('Gespeicherter Entwurf konnte nicht geladen werden. ' + error.message + ' Bitte eine JSON-Sicherung verwenden.','error');
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') void initialize();
