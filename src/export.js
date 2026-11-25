function fileBase(stand) {
  const rev = revisionText(stand.docRev);
  const normalize = text => String(text).replace(/ä/g,'ae').replace(/Ä/g,'Ae').replace(/ö/g,'oe').replace(/Ö/g,'Oe').replace(/ü/g,'ue').replace(/Ü/g,'Ue').replace(/ß/g,'ss');
  return normalize([stand.docNr,stand.docTitel,rev ? 'Rev'+rev : ''].filter(Boolean).join('_'))
    .replace(/[<>:"/\\|?*\x00-\x1F]/g,'-').replace(/\s+/g,'_').replace(/_+/g,'_').slice(0,160).replace(/[ ._]+$/,'') || 'Arbeitsanweisung';
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = fileName;
  document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

function showPanel(panel, scrollTop=false) {
  activePanel=panel;
  const preview = panel==='preview';
  $('editorPanel').hidden=preview;
  $('previewPanel').hidden=!preview;
  $('editTab').setAttribute('aria-selected',String(!preview));
  $('previewTab').setAttribute('aria-selected',String(preview));
  if (preview) requestAnimationFrame(fitPreview);
  if (scrollTop) window.scrollTo({top:0,behavior:'instant'});
}

function setBusy(isBusy) {
  busy=isBusy;
  for (const id of ['resetBtn','saveBtn','wordBtn','printBtn','previewTab','bottomPreviewBtn','previewImageSize']) $(id).disabled=isBusy||!ready;
  $('editorPanel').inert = Boolean(isBusy);
}

function validateExport(model) {
  if (!model.docNr.trim() || !model.docTitel.trim()) throw new Error('Bitte Dokumenten-Nr. und Titel in den Kopfdaten eintragen.');
  if (!model.rows.length) throw new Error('Bitte mindestens einen Arbeitsschritt erfassen.');
}

async function openPreview() {
  if (!ready || busy) return;
  if (previewCurrent) { showPanel('preview',true); return; }
  setBusy(true); showPanel('preview',true);
  $('previewSheets').replaceChildren(); $('previewMessage').hidden=true;
  $('previewTitle').textContent='DIN-A4-Vorschau wird aufgebaut …';
  setStatus('Dokumentenvorschau wird erstellt …');
  try {
    const model=await collectDocument();
    mountPages(paginate(model),model);
    setStatus('Dokumentenvorschau aktuell.','ok');
  } catch (error) {
    $('previewTitle').textContent='DIN-A4-Vorschau';
    $('previewMessage').hidden=false; $('previewMessage').textContent=error.message;
    setStatus(error.message,'error');
  } finally {setBusy(false);}
}

async function exportWord() {
  if (!ready || busy) return;
  setBusy(true);
  setStatus('Word-Dokument wird erstellt …');
  try {
    const model=await collectDocument();
    validateExport(model);
    const pages=paginate(model);
    mountPages(pages,model);
    const word=buildWordDocument(model,{...pages.layout,pageCount:pages.pages.length});
    const blob=await docx.Packer.toBlob(word);
    downloadBlob(blob,fileBase(model)+'.docx');
    setStatus('Word-Datei erstellt. Die Datei wurde zum Download bereitgestellt.','ok');
  } catch (error) {
    setStatus(error.message || 'Word-Export fehlgeschlagen.','error');
  } finally {setBusy(false);}
}

async function printDocument() {
  if (!ready || busy) return;
  setBusy(true);
  setStatus('Druckansicht wird erstellt …');
  try {
    const model=await collectDocument();
    validateExport(model);
    mountPages(paginate(model),model);
    showPanel('preview',true);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    // Wait for embedded images to decode, including on a slower phone.
    await Promise.all(Array.from($('previewSheets').querySelectorAll('img')).map(img=>img.decode ? img.decode().catch(()=>{}) : Promise.resolve()));
    setStatus('Druckansicht bereit.','ok');
    window.print();
  } catch (error) {setStatus(error.message || 'Druckansicht fehlgeschlagen.','error');}
  finally {setBusy(false);}
}

async function backupDraft() {
  if (!ready) return;
  try {
    // Backups preserve the original photo and the editable vector annotations.
    await Promise.allSettled([...Object.values(bildStatus).map(st=>st.pending).filter(Boolean),...(logoPending?[logoPending]:[])]);
    const stand=collectStand();
    downloadBlob(new Blob([JSON.stringify(stand,null,2)],{type:'application/json'}),fileBase(stand)+'_Entwurf.json');
    setStatus('JSON-Sicherung einschließlich Fotos und Markierungen erstellt.','ok');
  } catch (error) {setStatus('Sicherung konnte nicht erstellt werden.','error');}
}

async function adoptDraft(stand,successMessage) {
  if (recognition) {try{recognition.abort();}catch(_){}}
  storageProtected=false;
  applyStand(stand); showPanel('edit',true);
  await Promise.allSettled(Object.values(bildStatus).map(st=>st.pending).filter(Boolean));
  const saved=await speichernLokal(true);
  if (saved) setStatus(successMessage,'ok');
  return saved;
}

async function importDraft(event) {
  const file=event.target.files && event.target.files[0];
  event.target.value='';
  if (!file || !ready || busy) return;
  setBusy(true);
  try {
    if (file.size>120*1024*1024) throw new Error('Die Sicherung ist größer als 120 MB.');
    const parsed=normalizeStand(JSON.parse(await file.text()));
    if (!confirm('Den aktuellen Entwurf durch die ausgewählte Sicherung ersetzen?')) return;
    setStatus('Entwurf und Fotos werden geladen …');
    await adoptDraft(parsed,'Entwurf aus Sicherung geladen.');
  } catch (error) {setStatus(error.message || 'Sicherung konnte nicht geladen werden.','error');}
  finally {setBusy(false);}
}

