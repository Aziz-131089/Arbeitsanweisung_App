let schrittZaehler = 0;
let activeStepId = null;
let activeStepOpen = true;
const bildStatus = Object.create(null);
let logoDataUrl = '';
let logoPending = null;
let logoLoadToken = 0;
let ready = false, applyingData = false, busy = false, dirty = false;
let saveTimer = null, saveSeq = 0, savingSeq = 0;
let db = null, storageMode = 'none';
let localWritable = true, storageProtected = false, lastSnapshotAt = 0, lastSnapshotSize = 0;
let persistentStorageRequested = false;
let previousDrafts = { v1:null, v2:null };
let previewZoom = 'fit', activePanel = 'edit', previewCurrent = false;
let recognition = null;

function todayISO() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function formatDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(date));
  return match ? match[3] + '.' + match[2] + '.' + match[1] : str(date).trim();
}

function revisionText(value) {
  return str(value).replace(/^\s*(?:revision|rev\.?)\s*/i, '').trim();
}

function isImageData(value) {
  return typeof value === 'string' && /^data:image\/(?:png|jpe?g|webp|gif|bmp|avif|x-png|heic|heif);base64,/i.test(value);
}

function emptyStep() {
  return { kurztitel:'', taetigkeit: '', werkzeuge: '', sicherheit: '', bildDataUrl: null, formen: [], view: { zoom: 1, x: 0, y: 0 }, canvasSize: {...CANVAS_SIZE}, werkzeug:'kreis', verlauf:[], legacyStretch: false };
}

function defaultStand(initial = true) {
  return {
    version: DATA_VERSION, updatedAt: 0,
    docNr: initial ? 'AA-FW-014' : '',
    docRev: '01',
    docTitel: initial ? 'Rüsten und Bedienen der Rohrdrehmaschine RDM-02' : '',
    docFirma: 'Ergonomic Solutions Weilheim GmbH',
    docArbeitsplatz: initial ? 'Rohrdrehmaschine RDM-02' : '',
    docStand: todayISO(), docZweck: '', docGeltung: '', psaFeld: '', docBildgroesse:'gross',
    verteiler: '', verteilerAlt: '',
    erstelltDurch: '', erstelltDatum: '', freigegebenDurch: '', freigegebenDatum: '',
    logoDataUrl: ESW_LOGO_DATA_URL, schritte: [emptyStep()]
  };
}

function sanitizeView(view) {
  const v = view || {};
  return {
    zoom: finite(v.zoom) ? clamp(v.zoom, 1, 3) : 1,
    x: finite(v.x) ? clamp(v.x, -CANVAS_W * 3, CANVAS_W * 3) : 0,
    y: finite(v.y) ? clamp(v.y, -CANVAS_W * 3, CANVAS_W * 3) : 0
  };
}

function sanitizeCanvasSize(size) {
  if(size && Number.isInteger(size.w) && Number.isInteger(size.h) && size.w>=96 && size.h>=96 && size.w<=CANVAS_W && size.h<=CANVAS_W) return {w:size.w,h:size.h};
  return {...CANVAS_SIZE};
}

function photoCanvasSize(image) {
  if(!image) return {...CANVAS_SIZE};
  const w=image.naturalWidth||image.width, h=image.naturalHeight||image.height;
  const factor=CANVAS_W/Math.max(w,h);
  return {w:Math.max(96,Math.round(w*factor)),h:Math.max(96,Math.round(h*factor))};
}

function sanitizeForms(forms) {
  if (!Array.isArray(forms)) return [];
  return forms.slice(0, 500).filter(f => f && (
    ((f.typ === 'kreis' || f.typ === 'nummer' && Number.isInteger(f.nummer) && f.nummer>=1 && f.nummer<=999) && [f.cx, f.cy, f.r].every(finite) && f.r > 0) ||
    (f.typ === 'pfeil' && [f.x1, f.y1, f.x2, f.y2].every(finite))
  )).map(f => f.typ === 'kreis' || f.typ === 'nummer'
    ? { typ: f.typ, cx: clamp(f.cx, -6000, 6000), cy: clamp(f.cy, -6000, 6000), r: clamp(f.r, 1, 6000), ...(f.typ==='nummer'?{nummer:f.nummer}:{}) }
    : { typ: 'pfeil', x1: clamp(f.x1, -6000, 6000), y1: clamp(f.y1, -6000, 6000), x2: clamp(f.x2, -6000, 6000), y2: clamp(f.y2, -6000, 6000) });
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-HISTORY_LIMIT).filter(h=>h && Array.isArray(h.formen)).map(h=>({
    formen:sanitizeForms(h.formen), view:sanitizeView(h.view)
  }));
}

function normalizeDateInput(value) {
  const text=str(value).trim();
  const de=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  return de ? de[3]+'-'+de[2].padStart(2,'0')+'-'+de[1].padStart(2,'0') : text;
}

function normalizeStand(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.schritte)) {
    throw new Error('Die Datei enthält keinen gültigen Arbeitsanweisungs-Entwurf.');
  }
  if (raw.schritte.length > 250) throw new Error('Der Entwurf enthält mehr als 250 Arbeitsschritte.');
  if (Number(raw.version || 1) > DATA_VERSION) throw new Error('Der Entwurf stammt aus einer neueren App-Version.');
  const legacy = Number(raw.version || 1) < 2;
  const normalized = defaultStand(legacy);
  for (const id of META_IDS) if (typeof raw[id] === 'string') normalized[id] = raw[id];
  normalized.docBildgroesse=normalized.docBildgroesse==='kompakt'?'kompakt':'gross';
  const oldDistribution = str(normalized.verteiler).trim();
  normalized.verteiler = verteilerText(oldDistribution);
  // Retain legacy free text for review, never include it in the new footer.
  const hasUnknown = oldDistribution.split(/[\s,;/|]+/).filter(Boolean).some(token => !VERTEILER_CODES.includes(token));
  normalized.verteilerAlt = str(raw.verteilerAlt) || (hasUnknown ? oldDistribution : '');
  for(const id of ['docStand','erstelltDatum','freigegebenDatum']) normalized[id]=normalizeDateInput(normalized[id]);
  if (legacy && raw.docTitel && !('docArbeitsplatz' in raw) && !/RDM-02/.test(raw.docTitel)) normalized.docArbeitsplatz = '';
  if (raw.logoDataUrl === '' || raw.logoDataUrl === null) normalized.logoDataUrl = '';
  else if (raw.logoDataUrl !== undefined) {
    if (!isImageData(raw.logoDataUrl)) throw new Error('Das gespeicherte Unternehmenslogo ist ungültig.');
    normalized.logoDataUrl = raw.logoDataUrl;
  }
  normalized.updatedAt = finite(raw.updatedAt) ? raw.updatedAt : 0;
  normalized.schritte = raw.schritte.map(s => {
    if (!s || typeof s !== 'object') throw new Error('Ungültiger Arbeitsschritt im Entwurf.');
    if (s.bildDataUrl && !isImageData(s.bildDataUrl)) throw new Error('Der Entwurf enthält ein nicht unterstütztes Bildformat.');
    return {
      kurztitel:str(s.kurztitel).slice(0,120), taetigkeit: str(s.taetigkeit), werkzeuge: str(s.werkzeuge), sicherheit: str(s.sicherheit),
      bildDataUrl: s.bildDataUrl || null, formen: sanitizeForms(s.formen), view: sanitizeView(s.view),
      canvasSize: sanitizeCanvasSize(s.canvasSize),
      werkzeug:['kreis','pfeil','nummer','pan'].includes(s.werkzeug)?s.werkzeug:'kreis',
      verlauf:sanitizeHistory(s.verlauf),
      legacyStretch: Boolean(s.legacyStretch || (legacy && s.bildDataUrl))
    };
  });
  if (!normalized.schritte.length) normalized.schritte.push(emptyStep());
  return normalized;
}

