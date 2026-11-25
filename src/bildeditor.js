function snapshot(st) {
  return { formen: clone(st.formen), view: clone(st.view) };
}

function standSpeichern(nr) {
  const st = bildStatus[nr];
  if (!st) return false;
  const state = snapshot(st);
  if (st.verlauf.length && JSON.stringify(st.verlauf[st.verlauf.length - 1]) === JSON.stringify(state)) return false;
  st.verlauf.push(state);
  if (st.verlauf.length > HISTORY_LIMIT) st.verlauf.shift();
  return true;
}

function invalidatePhoto(st) { st.rendered = null; }

function commitEdit(nr) {
  const st = bildStatus[nr];
  if (!st) return;
  const changed = standSpeichern(nr);
  invalidatePhoto(st);
  canvasNeuZeichnen(nr);
  syncEditorControls(nr);
  updateThumbnail(nr);
  if (changed) scheduleSave();
}

function restoreSnapshot(st, snap) {
  st.formen = clone(snap.formen);
  st.view = clone(snap.view);
  st.ausgewaehltIndex = -1;
  invalidatePhoto(st);
}

function rueckgaengig(nr) {
  const st = bildStatus[nr];
  if (!st || st.verlauf.length <= 1) return;
  st.verlauf.pop();
  restoreSnapshot(st, st.verlauf[st.verlauf.length - 1]);
  canvasNeuZeichnen(nr);
  syncEditorControls(nr);
  updateThumbnail(nr);
  scheduleSave();
}

function deleteMark(nr) {
  const st = bildStatus[nr];
  if (!st || st.ausgewaehltIndex < 0) return;
  st.formen.splice(st.ausgewaehltIndex, 1);
  st.ausgewaehltIndex = -1;
  commitEdit(nr);
}

function imageRect(st, view = st.view, size = st.canvasSize || CANVAS_SIZE) {
  if (!st.bild) return { x: 0, y: 0, w: size.w, h: size.h };
  const w = st.bild.naturalWidth || st.bild.width, h = st.bild.naturalHeight || st.bild.height;
  const factor = Math.min(size.w / w, size.h / h) * view.zoom;
  const drawW = w * factor, drawH = h * factor;
  const maxX = Math.max(0, (drawW - size.w) / 2), maxY = Math.max(0, (drawH - size.h) / 2);
  const dx = clamp(view.x, -maxX, maxX), dy = clamp(view.y, -maxY, maxY);
  return { x: (size.w - drawW) / 2 + dx, y: (size.h - drawH) / 2 + dy, w: drawW, h: drawH };
}

function constrainedView(st, next, size = st.canvasSize || CANVAS_SIZE) {
  const v = sanitizeView(next);
  if (!st.bild) return { zoom: 1, x: 0, y: 0 };
  const rect = imageRect(st, { zoom: v.zoom, x: 0, y: 0 },size);
  v.x = clamp(v.x, -Math.max(0, (rect.w-size.w)/2), Math.max(0, (rect.w-size.w)/2));
  v.y = clamp(v.y, -Math.max(0, (rect.h-size.h)/2), Math.max(0, (rect.h-size.h)/2));
  return v;
}

function transformForms(st, from, to) {
  const sx = to.w / from.w, sy = to.h / from.h;
  const x = val => to.x + (val - from.x) * sx;
  const y = val => to.y + (val - from.y) * sy;
  for (const f of st.formen) {
    if (f.typ === 'kreis' || f.typ === 'nummer') {
      f.cx = x(f.cx); f.cy = y(f.cy); f.r *= Math.min(sx, sy);
    } else {
      f.x1 = x(f.x1); f.y1 = y(f.y1); f.x2 = x(f.x2); f.y2 = y(f.y2);
    }
  }
}

// Convert old 4:3 editor snapshots and all undo states to the actual photo
// orientation. Map through the original image coordinates so marks stay put.
function adaptPhotoViewport(st) {
  const old = st.canvasSize || CANVAS_SIZE, next = photoCanvasSize(st.bild);
  if(old.w!==next.w || old.h!==next.h) {
    const remap = state => {
      const from=imageRect(st,state.view,old);
      const centered=imageRect(st,{zoom:state.view.zoom,x:0,y:0},next);
      const scale=centered.w/from.w;
      const view=constrainedView(st,{zoom:state.view.zoom,x:state.view.x*scale,y:state.view.y*scale},next);
      transformForms(state,from,imageRect(st,view,next));
      state.view=view;
    };
    remap(st);
    for(const history of st.verlauf) remap(history);
    st.canvasSize=next;
    invalidatePhoto(st);
  }
}

function changeView(st, requested) {
  if (!st.bild) return;
  const old = imageRect(st), next = constrainedView(st, requested);
  const target = imageRect(st, next);
  transformForms(st, old, target);
  st.view = next;
  invalidatePhoto(st);
}

function resetView(nr) {
  const st = bildStatus[nr];
  if (!st || !st.bild) return;
  changeView(st, { zoom: 1, x: 0, y: 0 });
  st.ausgewaehltIndex = -1;
  commitEdit(nr);
}

function griffPosition(form) {
  return form.typ === 'kreis' || form.typ==='nummer' ? { x: form.cx + form.r, y: form.cy } : { x: form.x2, y: form.y2 };
}

function nextMarkerNumber(forms){
  const used=new Set(forms.filter(f=>f.typ==='nummer').map(f=>f.nummer));
  const n=Math.max(0,...used)+1;if(n<=999)return n;
  for(let i=1;i<1000;i++)if(!used.has(i))return i;
  return 999;
}

function formZeichnen(ctx, form, ausgewaehlt) {
  ctx.save();
  ctx.strokeStyle = '#dc2626';
  ctx.fillStyle = '#dc2626';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if(form.typ==='nummer'){
    const r=Math.max(8,form.r);
    ctx.beginPath();ctx.arc(form.cx,form.cy,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='700 '+Math.max(9,r*(form.nummer>=100?.85:1.2))+'px Arial';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(form.nummer),form.cx,form.cy+.5);
  } else if (form.typ === 'kreis') {
    ctx.beginPath();
    ctx.arc(form.cx, form.cy, Math.max(1, form.r), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(form.x1, form.y1); ctx.lineTo(form.x2, form.y2); ctx.stroke();
    const winkel = Math.atan2(form.y2 - form.y1, form.x2 - form.x1);
    const spitze = Math.min(15, Math.max(7, Math.hypot(form.x2 - form.x1, form.y2 - form.y1) * .5));
    ctx.beginPath(); ctx.moveTo(form.x2, form.y2);
    ctx.lineTo(form.x2 - spitze * Math.cos(winkel - Math.PI / 6), form.y2 - spitze * Math.sin(winkel - Math.PI / 6));
    ctx.lineTo(form.x2 - spitze * Math.cos(winkel + Math.PI / 6), form.y2 - spitze * Math.sin(winkel + Math.PI / 6));
    ctx.closePath(); ctx.fill();
  }
  if (ausgewaehlt) {
    const gp = griffPosition(form);
    ctx.fillStyle = '#1d4ed8'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(gp.x, gp.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function canvasNeuZeichnen(nr) {
  const st = bildStatus[nr], canvas = $('canvas-' + nr);
  if (!st || !canvas) return;
  const size=st.canvasSize || CANVAS_SIZE;
  if(canvas.width!==size.w) canvas.width=size.w;
  if(canvas.height!==size.h) canvas.height=size.h;
  canvas.style.maxWidth=size.w+'px';
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size.w, size.h);
  ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, size.w, size.h);
  if (st.bild) {
    const rect = imageRect(st);
    ctx.drawImage(st.bild, rect.x, rect.y, rect.w, rect.h);
    st.formen.forEach((form, i) => formZeichnen(ctx, form, i === st.ausgewaehltIndex && st.werkzeug !== 'pan'));
  } else {
    ctx.fillStyle = '#334155'; ctx.font = '15px Arial';
    ctx.fillText(st.pending ? 'Foto wird geladen …' : 'Zuerst ein Foto laden', 20, 40);
  }
}

function getPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const contentW = canvas.clientWidth || rect.width, contentH = canvas.clientHeight || rect.height;
  // CSS borders are excluded from the coordinate transform.
  return {
    x: clamp((event.clientX - rect.left - canvas.clientLeft) * canvas.width / contentW, 0, canvas.width),
    y: clamp((event.clientY - rect.top - canvas.clientTop) * canvas.height / contentH, 0, canvas.height)
  };
}

function formTreffer(form, p) {
  if (form.typ === 'kreis'||form.typ==='nummer') return Math.hypot(p.x - form.cx, p.y - form.cy) <= form.r + 12;
  const dx = form.x2-form.x1, dy = form.y2-form.y1;
  const t = clamp(((p.x-form.x1)*dx + (p.y-form.y1)*dy)/(dx*dx + dy*dy || 1), 0, 1);
  return Math.hypot(p.x - (form.x1+t*dx), p.y-(form.y1+t*dy)) <= 16;
}

function canvasInitialisieren(nr, values) {
  const canvas = $('canvas-' + nr);
  const st = bildStatus[nr] = {
    bild: null, bildDataUrl: values.bildDataUrl || null, formen: sanitizeForms(values.formen),
    view: sanitizeView(values.view), canvasSize: sanitizeCanvasSize(values.canvasSize), legacyStretch: Boolean(values.legacyStretch),
    werkzeug: ['kreis','pfeil','nummer','pan'].includes(values.werkzeug)?values.werkzeug:'kreis',
    verlauf: sanitizeHistory(values.verlauf), ausgewaehltIndex: -1, aktion: null, rendered: null,
    pending: null, token: 0
  };
  standSpeichern(nr);
  canvas.addEventListener('pointerdown', event => {
    if (!st.bild || st.aktion || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const p = getPoint(canvas, event);
    const a = st.aktion = { pointer: event.pointerId, type: '', before: snapshot(st), last: p };
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
    if (st.werkzeug === 'pan') {
      a.type = 'pan'; st.ausgewaehltIndex = -1;
    } else {
      const current = st.formen[st.ausgewaehltIndex];
      const grip = current && griffPosition(current);
      if (grip && Math.hypot(p.x-grip.x, p.y-grip.y) <= 19) {
        a.type = 'groesse';
      } else {
        const hit = st.formen.findLastIndex
          ? st.formen.findLastIndex(f => formTreffer(f, p))
          : (() => { for (let i = st.formen.length-1; i >= 0; i--) if (formTreffer(st.formen[i],p)) return i; return -1; })();
        if (hit >= 0) {
          st.ausgewaehltIndex = hit; a.type = 'verschieben';
        } else {
          if (st.formen.length >= 500) { st.aktion = null; return; }
          const endX = p.x > canvas.width-28 ? p.x-26 : p.x+26;
          st.formen.push(st.werkzeug === 'kreis'
            ? { typ:'kreis', cx:p.x, cy:p.y, r:24 }
            : st.werkzeug==='nummer'?{typ:'nummer',cx:clamp(p.x,18,canvas.width-18),cy:clamp(p.y,18,canvas.height-18),r:16,nummer:nextMarkerNumber(st.formen)}
            : { typ:'pfeil', x1:p.x, y1:p.y, x2:endX, y2:p.y });
          st.ausgewaehltIndex = st.formen.length-1; a.type = st.werkzeug==='nummer'?'verschieben':'neu';
        }
      }
    }
    invalidatePhoto(st); canvasNeuZeichnen(nr); syncEditorControls(nr);
  });
  canvas.addEventListener('pointermove', event => {
    const a = st.aktion;
    if (!a || a.pointer !== event.pointerId) return;
    event.preventDefault();
    const p = getPoint(canvas, event), dx = p.x-a.last.x, dy = p.y-a.last.y;
    const form = st.formen[st.ausgewaehltIndex];
    if (a.type === 'pan') {
      changeView(st, { ...st.view, x: st.view.x + dx, y: st.view.y + dy });
    } else if (form && (a.type === 'neu' || a.type === 'groesse')) {
      if (form.typ === 'kreis'||form.typ==='nummer') form.r = Math.max(14, Math.hypot(form.cx-p.x, form.cy-p.y));
      else { form.x2 = p.x; form.y2 = p.y; }
    } else if (form && a.type === 'verschieben') {
      if (form.typ === 'kreis'||form.typ==='nummer') {
        form.cx += dx; form.cy += dy;
      } else {
        form.x1 += dx; form.y1 += dy; form.x2 += dx; form.y2 += dy;
      }
    }
    a.last = p;
    invalidatePhoto(st); canvasNeuZeichnen(nr);
  });
  const finish = (event, cancel = false) => {
    const a = st.aktion;
    if (!a || a.pointer !== event.pointerId) return;
    st.aktion = null;
    if (cancel) restoreSnapshot(st, a.before);
    try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch (_) {}
    if (cancel) { canvasNeuZeichnen(nr); syncEditorControls(nr); updateThumbnail(nr); }
    else commitEdit(nr);
  };
  canvas.addEventListener('pointerup', event => finish(event));
  canvas.addEventListener('pointercancel', event => finish(event, true));
  canvas.addEventListener('lostpointercapture', event => finish(event, true));
  werkzeugWaehlen(nr,st.werkzeug,false);
  canvasNeuZeichnen(nr);
  syncEditorControls(nr);
  if (st.bildDataUrl) restorePhoto(nr, st);
}

function werkzeugWaehlen(nr, typ, save=true) {
  const st = bildStatus[nr];
  if (!st) return;
  const changed=st.werkzeug!==typ;
  st.werkzeug = typ;
  if (typ === 'pan') st.ausgewaehltIndex = -1;
  const card = document.querySelector('.step-card[data-step-id="' + nr + '"]');
  for (const [type, sel] of [['kreis','.tool-circle'],['pfeil','.tool-arrow'],['nummer','.tool-number'],['pan','.tool-pan']]) {
    const button = card.querySelector(sel);
    button.classList.toggle('active', type === typ);
    button.setAttribute('aria-pressed', String(type === typ));
  }
  $('canvas-' + nr).style.cursor = typ === 'pan' ? 'grab' : 'crosshair';
  canvasNeuZeichnen(nr); syncEditorControls(nr);
  if(changed&&save)scheduleSave();
}

function syncEditorControls(nr) {
  const st = bildStatus[nr], card = document.querySelector('.step-card[data-step-id="' + nr + '"]');
  if (!st || !card) return;
  $('zoom-' + nr).value = String(st.view.zoom);
  $('zoomOut-' + nr).textContent = Math.round(st.view.zoom * 100) + ' %';
  $('zoom-' + nr).disabled = !st.bild;
  card.querySelector('.undo-mark').disabled = st.verlauf.length <= 1;
  card.querySelector('.delete-mark').disabled = !st.bild || st.ausgewaehltIndex < 0;
  card.querySelector('.reset-view').disabled = !st.bild;
  card.querySelector('.remove-photo').disabled = !st.bildDataUrl && !st.pending;
  for (const sel of ['.tool-circle','.tool-arrow','.tool-number','.tool-pan']) card.querySelector(sel).disabled = !st.bild;
  card.querySelector('.edit-photo').disabled=!st.bild;
}

function editorUmschalten(nr, force) {
  const box = $('editor-' + nr);
  if (!box) return;
  const visible = typeof force === 'boolean' ? force : box.hidden;
  box.hidden = !visible;
  const button = document.querySelector('.step-card[data-step-id="' + nr + '"] .edit-photo');
  button.textContent = visible ? 'Editor schließen' : 'Bild bearbeiten';
  button.setAttribute('aria-expanded', String(visible));
  if (visible) {canvasNeuZeichnen(nr);if(typeof force!=='boolean')box.scrollIntoView({block:'start',behavior:'instant'});}
}

function setPhotoStatus(nr, message, error = false) {
  const element = $('photoStatus-' + nr);
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error', error);
  updateStepSummary(nr);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => img.naturalWidth && img.naturalHeight ? resolve(img) : reject(new Error('Bild hat keine gültigen Abmessungen.'));
    img.onerror = () => reject(new Error('Das Bildformat konnte nicht geöffnet werden. Bitte JPG oder PNG verwenden.'));
    img.src = src;
  });
}

async function resizeUpload(file, maxSide, transparency = false, quality=PHOTO_JPEG_QUALITY) {
  if (!file || !file.size) throw new Error('Die Bilddatei ist leer.');
  if (file.size > 45 * 1024 * 1024) throw new Error('Das Foto ist größer als 45 MB. Bitte eine kleinere Datei auswählen.');
  if (file.type && !file.type.startsWith('image/')) throw new Error('Bitte eine Bilddatei auswählen.');
  const source = URL.createObjectURL(file);
  try {
    const image = await loadImage(source);
    const factor = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth*factor));
    canvas.height = Math.max(1, Math.round(image.naturalHeight*factor));
    const ctx = canvas.getContext('2d');
    if (!transparency) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const url = transparency ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
    if (!isImageData(url)) throw new Error('Das Foto konnte nicht verarbeitet werden.');
    return { url, image: await loadImage(url) };
  } finally { URL.revokeObjectURL(source); }
}

function restorePhoto(nr, st) {
  const token = ++st.token;
  st.pending = loadImage(st.bildDataUrl).then(img => {
    if (bildStatus[nr] !== st || token !== st.token) return;
    st.bild = img;
    st.view = constrainedView(st, st.view);
    if (st.legacyStretch) {
      // V1 stretched each image across its 4:3 canvas. Map the old marks onto
      // the original picture's coordinates, keeping circles circular.
      transformForms(st, { x:0,y:0,w:CANVAS_W,h:CANVAS_H }, imageRect(st));
      st.legacyStretch = false;
      // V1 had no persisted undo states; do not reapply pre-migration coordinates.
      st.verlauf=[];
    }
    adaptPhotoViewport(st);
    standSpeichern(nr);
    invalidatePhoto(st);
    canvasNeuZeichnen(nr); syncEditorControls(nr); updateThumbnail(nr);
    setPhotoStatus(nr, 'Foto geladen');
  }).catch(error => {
    if (bildStatus[nr] === st && token === st.token) {
      setPhotoStatus(nr, error.message + ' Gespeicherte Datei wurde nicht gelöscht.', true);
    }
  }).finally(() => { if (bildStatus[nr] === st && token === st.token) { st.pending = null; syncEditorControls(nr);updateStepSummary(nr); } });
}

async function bildLaden(event, nr) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  const st = bildStatus[nr];
  if (!file || !st) return;
  if ((st.bildDataUrl || st.pending) && !confirm('Das vorhandene Foto und seine Markierungen durch das neue Foto ersetzen?')) return;
  const token = ++st.token;
  setPhotoStatus(nr, 'Foto wird vorbereitet …');
  st.pending = resizeUpload(file, PHOTO_MAX_PX).then(({ url, image }) => {
    if (bildStatus[nr] !== st || token !== st.token) return;
    st.bild = image; st.bildDataUrl = url;
    st.formen = []; st.view = { zoom:1,x:0,y:0 }; st.canvasSize=photoCanvasSize(image); st.legacyStretch = false;
    st.verlauf = []; st.ausgewaehltIndex = -1; st.aktion = null;
    werkzeugWaehlen(nr, 'kreis',false);
    standSpeichern(nr); invalidatePhoto(st);
    canvasNeuZeichnen(nr); syncEditorControls(nr); updateThumbnail(nr);
    // Keep the editor closed unless the user has deliberately opened it.
    setPhotoStatus(nr, 'Foto geladen · ' + image.naturalWidth + ' × ' + image.naturalHeight + ' px');
    scheduleSave(true);
  }).catch(error => {
    if (bildStatus[nr] === st && token === st.token) setPhotoStatus(nr, error.message, true);
  }).finally(() => { if (bildStatus[nr] === st && token === st.token) { st.pending = null; syncEditorControls(nr);updateStepSummary(nr); } });
  updateStepSummary(nr);
  await st.pending;
}

function removePhoto(nr) {
  const st = bildStatus[nr];
  if (!st || (!st.bildDataUrl && !st.pending)) return;
  if (!confirm('Foto und seine Markierungen entfernen?')) return;
  st.token++; st.pending = null; st.bild = null; st.bildDataUrl = null; st.formen = []; st.view = { zoom:1,x:0,y:0 };
  st.verlauf = []; st.ausgewaehltIndex = -1; st.aktion = null; st.legacyStretch = false; st.canvasSize={...CANVAS_SIZE};
  standSpeichern(nr); invalidatePhoto(st);
  canvasNeuZeichnen(nr); syncEditorControls(nr); updateThumbnail(nr);
  setPhotoStatus(nr, 'Foto entfernt.');
  scheduleSave();
}

function outputBounds(st) {
  const rect = imageRect(st);
  const size=st.canvasSize || CANVAS_SIZE;
  let l = Math.max(0, rect.x), t = Math.max(0, rect.y);
  let r = Math.min(size.w, rect.x + rect.w), b = Math.min(size.h, rect.y + rect.h);
  for (const f of st.formen) {
    const bounds = f.typ === 'kreis'||f.typ==='nummer'
      ? [f.cx-f.r-3,f.cy-f.r-3,f.cx+f.r+3,f.cy+f.r+3]
      : [Math.min(f.x1,f.x2)-16,Math.min(f.y1,f.y2)-16,Math.max(f.x1,f.x2)+16,Math.max(f.y1,f.y2)+16];
    if (bounds[2] < 0 || bounds[0] > size.w || bounds[3] < 0 || bounds[1] > size.h) continue;
    l = Math.min(l, Math.max(0,bounds[0])); t = Math.min(t, Math.max(0,bounds[1]));
    r = Math.max(r, Math.min(size.w,bounds[2])); b = Math.max(b, Math.min(size.h,bounds[3]));
  }
  return { x:l,y:t,w:Math.max(1,r-l),h:Math.max(1,b-t) };
}

function getRenderedImage(st) {
  if (!st || !st.bild) return null;
  if (st.rendered) return st.rendered;
  const bounds = outputBounds(st), rect = imageRect(st);
  // Render at high resolution without editor borders or blue grip points.
  const scale = Math.min(4, 1600 / Math.max(bounds.w,bounds.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bounds.w*scale));
  canvas.height = Math.max(1, Math.round(bounds.h*scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(canvas.width/bounds.w,0,0,canvas.height/bounds.h,-bounds.x*canvas.width/bounds.w,-bounds.y*canvas.height/bounds.h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(st.bild, rect.x, rect.y, rect.w, rect.h);
  for (const form of st.formen) formZeichnen(ctx, form, false);
  st.rendered = { dataUrl: canvas.toDataURL('image/jpeg', .94), width: canvas.width, height: canvas.height };
  return st.rendered;
}

function updateThumbnail(nr) {
  const st = bildStatus[nr], img = $('thumb-' + nr), placeholder = $('placeholder-' + nr);
  if (!st || !img || !placeholder) return;
  if (st.bild) {
    img.src = getRenderedImage(st).dataUrl;
    img.hidden = false; placeholder.hidden = true;
  } else {
    img.hidden = true; img.removeAttribute('src'); placeholder.hidden = false;
  }
  updateStepSummary(nr);
}

async function logoLaden(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const token = ++logoLoadToken;
  logoPending = resizeUpload(file, 900, true).then(result => {
    if (token !== logoLoadToken) return;
    logoDataUrl = result.url; updateLogoUI(); scheduleSave(true);
  }).catch(error => {
    if (token === logoLoadToken) setStatus(error.message, 'error');
  }).finally(() => { if (token === logoLoadToken) logoPending = null; });
  await logoPending;
}

