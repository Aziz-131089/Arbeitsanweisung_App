'use strict';

// Version __APP_VERSION__ of the supplied Vanilla-JS editor. The prior HTML files and browser
// drafts remain untouched; the generated index.html is a standalone candidate.
// All images, draft data, preview and DOCX generation stay in the browser.
const STORAGE_KEY_V1 = 'aa_fw_014_rdm02_stand_v1';
const STORAGE_KEY_V2 = 'arbeitsanweisung_v2_testentwurf';
const STORAGE_KEY = 'arbeitsanweisung_v3_entwurf';
const DB_NAME_V2 = 'arbeitsanweisung_v2_test';
const DB_NAME = 'arbeitsanweisung_v3';
const DATA_VERSION = 3;
const PHOTO_MAX_PX = 1000;
const PHOTO_JPEG_QUALITY = .82;
const ESW_LOGO_DATA_URL = '__ESW_LOGO_DATA__';
const CANVAS_W = 440, CANVAS_H = 330;
const CANVAS_SIZE = Object.freeze({w:CANVAS_W,h:CANVAS_H});
const HISTORY_LIMIT = 40;
const VERTEILER_CODES = Object.freeze(['GF','VERT','EK','AV','FFS','KB','QW','RF','BES','MON','LOG','IT']);
const META_IDS = [
  'docNr', 'docRev', 'docTitel', 'docFirma', 'docArbeitsplatz', 'docStand',
  'docZweck', 'docGeltung', 'psaFeld', 'verteiler', 'docBildgroesse',
  'erstelltDurch', 'erstelltDatum', 'freigegebenDurch', 'freigegebenDatum'
];
const LAYOUT = Object.freeze({
  width: 210, height: 297, side: 12.5, header: 8, footer: 8,
  minTop: 33, minBottom: 28, gap: 5,
  headerCols: [25, 57, 18], stepCols: [7, 40, 53], portraitStepCols: [7, 44, 49], compactStepCols: [7, 35, 58], compactPortraitCols: [7, 34, 59], footerCols: [36, 38, 26],
  maxPhotoWidth: 68, maxPhotoHeight: 60, portraitPhotoWidth: 78, portraitPhotoHeight: 100, logoWidth: 29, logoHeight: 16,
  font: 'Arial', line: 1.18, pageNumberPt: 10
});

const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const str = value => typeof value === 'string' ? value : '';
const mmToTwip = mm => Math.round(mm / 25.4 * 1440);
const mmToPx = mm => mm / 25.4 * 96;
const pxToMm = px => px / 96 * 25.4;
const blank = value => str(value).trim() || '—';

