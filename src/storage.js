// Separate V3 draft. localStorage is the primary store. IndexedDB holds the
// complete snapshot if the browser's smaller Web Storage quota is exhausted.
// V1 and V2 records are accessed read-only and never cleared or overwritten.
function openDraftDB(name=DB_NAME, create=true) {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB nicht verfügbar')); return; }
    let settled = false;
    const request = indexedDB.open(name, 1);
    const timer = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error('Lokaler Speicher antwortet nicht')); }
    }, 3000);
    request.onupgradeneeded = () => {
      if (!create) {
        // The older store does not exist: abort creation, leaving it untouched.
        request.transaction.abort();
        clearTimeout(timer);
        if(!settled){settled=true;resolve(null);}
        return;
      }
      if (!request.result.objectStoreNames.contains('entwuerfe')) request.result.createObjectStore('entwuerfe');
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (settled) { request.result.close(); return; }
      settled = true; resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(request.error || new Error('Datenbank gesperrt')); }
    };
    request.onblocked = () => {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(new Error('Datenbank gesperrt')); }
    };
  });
}

function dbRead(connection=db) {
  return new Promise((resolve, reject) => {
    if(!connection){resolve(null);return;}
    const tx = connection.transaction('entwuerfe', 'readonly');
    const req = tx.objectStore('entwuerfe').get('current');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('Entwurf konnte nicht gelesen werden'));
    tx.onabort = () => reject(tx.error || new Error('Entwurf konnte nicht gelesen werden'));
  });
}

function dbWrite(stand) {
  return new Promise((resolve, reject) => {
    let tx;
    // Prefer a durable commit where supported; older browsers use their
    // normal transaction mode.
    try { tx = db.transaction('entwuerfe', 'readwrite', {durability:'strict'}); }
    catch (_) { tx = db.transaction('entwuerfe', 'readwrite'); }
    tx.objectStore('entwuerfe').put(stand, 'current');
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Entwurf konnte nicht gespeichert werden'));
  });
}

function readLocal(key) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

function newestDraft(...drafts) {
  return drafts.filter(Boolean).sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0))[0]||null;
}

async function readPreviousDrafts() {
  let v1=null, v2Local=null, v2Database=null, previousDb=null;
  try {v1=readLocal(STORAGE_KEY_V1);} catch (_) {}
  try {v2Local=readLocal(STORAGE_KEY_V2);} catch (_) {}
  try {
    previousDb=await openDraftDB(DB_NAME_V2,false);
    v2Database=await dbRead(previousDb);
  } catch (_) {}
  finally {if(previousDb)previousDb.close();}
  previousDrafts={v1,v2:newestDraft(v2Local,v2Database)};
  return previousDrafts;
}

function updatePreviousDraftControls(){
  const labels=[['v1','legacyV1Btn','GitHub-Version V1'],['v2','legacyV2Btn','Testversion V2']];
  let found=false;
  for(const [key,id,label] of labels){
    const draft=previousDrafts[key];
    $(id).hidden=!draft;found=found||Boolean(draft);
    if(draft){
      $(id).textContent=label+' übernehmen';
      const info=[str(draft.docNr),Array.isArray(draft.schritte)?draft.schritte.length+' Schritte':''].filter(Boolean).join(' · ');
      $(id).title=info;
    }
  }
  $('legacyDraftControls').hidden=!found;
}

async function loadInitialStand() {
  let savedIDB=null, savedLocal=null, readFailed=false;
  let localReadable=true;
  try { savedLocal=readLocal(STORAGE_KEY); }
  catch(e){
    readFailed=true;
    // A JSON-corrupt current snapshot must not be silently replaced.
    try{localReadable=localStorage.getItem(STORAGE_KEY)===null;}catch(_){localReadable=false;localWritable=false;}
  }
  try {
    db = await openDraftDB();
    savedIDB = await dbRead();
  } catch (e) {
    if (db) db.close();
    db = null;
  }
  const old=await readPreviousDrafts();
  const stored=newestDraft(savedLocal,savedIDB);
  storageMode=localWritable?'localStorage':db?'indexedDB':'none';
  if(stored){
    storageMode=stored===savedLocal?'localStorage':'indexedDB';
    if(stored===savedLocal)lastSnapshotSize=JSON.stringify(savedLocal).length;
    return {stand:normalizeStand(stored),migrated:false,readFailed,existing:true};
  }
  if(!localReadable&&localWritable)throw new Error('Der gespeicherte V3-Entwurf ist beschädigt.');
  const source=old.v2?'v2':old.v1?'v1':null;
  if(source)return {stand:normalizeStand(old[source]),migrated:true,source,readFailed,existing:true};
  return { stand: defaultStand(true), migrated: false, readFailed, existing: false };
}

function scheduleSave(immediate = false) {
  if (!ready || applyingData) return;
  if (typeof navigator!=='undefined' && navigator.userActivation?.isActive) requestPersistentStorage();
  dirty = true;
  previewCurrent = false;
  document.body.removeAttribute('data-print-ready');
  if (!busy) setStatus('Änderungen werden gespeichert …');
  // A small draft is saved synchronously at each input. For large pictures,
  // save on a short timer to keep typing responsive, and flush on exit.
  // Unlike a debounce, continuous typing cannot postpone the first write.
  if (immediate || (!storageProtected&&localWritable&&storageMode==='localStorage'&&lastSnapshotSize<=512*1024)) {
    void speichernLokal(); return;
  }
  if (saveTimer === null) saveTimer = setTimeout(() => { void speichernLokal(); }, 160);
}

function speichernLokal(manual = false) {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!ready || applyingData) return Promise.resolve(false);
  const snapshot = collectStand(), seq = ++saveSeq;
  dirty=true;
  const finish=(success,mode)=>{
    if (savingSeq === seq) savingSeq = 0;
    if (seq === saveSeq && saveTimer === null) {
      dirty = !success;
      if (success) {
        storageMode=mode;
        if (!busy || manual) {
          const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          setStatus('Automatisch gespeichert · '+time+(mode==='indexedDB'?' · großer Bildspeicher':'')+' · bleibt beim nächsten Öffnen erhalten','ok');
        }
      } else {
        setStatus('Entwurf konnte nicht gespeichert werden. Bitte als JSON sichern; der aktuelle Inhalt bleibt im geöffneten Fenster erhalten.', 'error');
      }
    }
    return success;
  };
  // Start the synchronous write now, including on focus loss or exit.
  if(!storageProtected&&localWritable){
    try {
      const serialized=JSON.stringify(snapshot);
      lastSnapshotSize=serialized.length;
      localStorage.setItem(STORAGE_KEY,serialized);
      savingSeq=0;
      return Promise.resolve(finish(true,'localStorage'));
    } catch (_) {
      // Retain the previous snapshot and try IndexedDB. Never purge old keys.
    }
  }
  if(storageProtected||!db)return Promise.resolve(finish(false,'none'));
  // IndexedDB itself serializes overlapping readwrite transactions. Create
  // the transaction immediately, not in a later promise queue: a closing
  // mobile browser might suspend the JS context before that queue runs.
  savingSeq=seq;
  return dbWrite(snapshot).then(()=>finish(true,'indexedDB'),()=>finish(false,'none'));
}

function flushPendingDraft() {
  if(ready&&!applyingData&&dirty&&(saveTimer!==null||!savingSeq)) void speichernLokal();
}

function requestPersistentStorage() {
  // Best effort only. Browsers may decline or still clear data at the user's
  // request. Ask from the explicit Save action, never block the editor.
  if(persistentStorageRequested||!navigator.storage?.persist) return;
  persistentStorageRequested=true;
  try { void navigator.storage.persist().catch(()=>{}); } catch (_) {}
}

async function waitForImages() {
  const waits = Object.values(bildStatus).map(st => st.pending).filter(Boolean);
  if (logoPending) waits.push(logoPending);
  if (waits.length) await Promise.allSettled(waits);
  const invalid = Object.values(bildStatus).find(st => st.bildDataUrl && !st.bild);
  if (invalid) throw new Error('Mindestens ein gespeichertes Foto konnte nicht geladen werden. Bitte das betreffende Bild ersetzen.');
}

function updateLogoUI() {
  const img = $('logoPreview');
  img.hidden = !logoDataUrl;
  $('logoEmpty').hidden = Boolean(logoDataUrl);
  $('logoRemoveBtn').hidden = !logoDataUrl;
  if (logoDataUrl) img.src = logoDataUrl; else img.removeAttribute('src');
}

function applyStand(stand) {
  applyingData = true;
  try {
    logoLoadToken++;
    logoPending = null;
    lastSnapshotAt=Math.max(lastSnapshotAt,Number(stand.updatedAt)||0);
    for (const id of META_IDS) $(id).value = str(stand[id]);
    $('docBildgroesse').value=stand.docBildgroesse==='kompakt'?'kompakt':'gross';
    $('previewImageSize').value=$('docBildgroesse').value;
    $('psaDetails').open=!str(stand.psaFeld).trim();
    $('psaHeading').textContent='Sicherheit / PSA · '+(str(stand.psaFeld).trim()?'erfasst':'fehlt');
    syncVerteilerUI(stand.verteiler, stand.verteilerAlt);
    logoDataUrl = stand.logoDataUrl || '';
    updateLogoUI();
    $('schritteListe').replaceChildren();
    activeStepId=null; activeStepOpen=true;
    for (const key of Object.keys(bildStatus)) delete bildStatus[key];
    for (const step of stand.schritte) schrittHinzufuegen(step, false);
    if (!$('schritteListe').children.length) schrittHinzufuegen(emptyStep(), false);
    aktualisiereKopfKurz();
    schrittNummernAktualisieren();
    const firstIncomplete=stepCards().find(card=>!stepComplete(Number(card.dataset.stepId)));
    setActiveStep(Number((firstIncomplete||stepCards()[0]).dataset.stepId));
    previewCurrent = false;
    document.body.removeAttribute('data-print-ready');
  } finally {
    applyingData = false;
  }
}

