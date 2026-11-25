function element(tag, cls, textValue) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (textValue !== undefined) el.textContent = textValue;
  return el;
}

function labelledParagraph(label, value, cls = '') {
  const p = element('p', cls);
  p.append(element('strong', '', label), document.createTextNode(value));
  return p;
}

function htmlTable(cols, cls) {
  const tbl = element('table', cls);
  const colgroup = element('colgroup');
  for (const pct of cols) {
    const col = element('col');
    col.style.width = pct + '%';
    colgroup.append(col);
  }
  tbl.append(colgroup);
  return tbl;
}

function htmlImage(photo, cls, alt) {
  const img = element('img', cls);
  img.alt = alt;
  img.width = Math.round(mmToPx(photo.mm.width));
  img.height = Math.round(mmToPx(photo.mm.height));
  img.style.width = photo.mm.width + 'mm';
  img.style.height = photo.mm.height + 'mm';
  img.src = photo.dataUrl;
  return img;
}

function htmlHeader(model) {
  const container = element('header', 'doc-header');
  const tbl = htmlTable(LAYOUT.headerCols, 'header-table');
  const row = tbl.createTBody().insertRow();
  const meta = row.insertCell();
  meta.className = 'meta-cell';
  meta.append(
    labelledParagraph('Dok-Nr.: ', blank(model.docNr)),
    labelledParagraph('Revision: ', blank(revisionText(model.docRev))),
    labelledParagraph('Stand: ', blank(formatDate(model.docStand)))
  );
  const title = row.insertCell();
  title.className = 'title-cell';
  title.append(element('p','doc-main-title','ARBEITSANWEISUNG'), element('p','doc-subtitle',blank(model.docTitel)));
  const logo = row.insertCell();
  if (model.logo) logo.append(htmlImage(model.logo,'doc-logo','Unternehmenslogo'));
  else logo.append(element('p','doc-company-fallback',blank(model.docFirma)));
  container.append(tbl);
  return container;
}

function htmlFooter(model) {
  const container = element('footer','doc-footer');
  const tbl = htmlTable(LAYOUT.footerCols,'footer-table');
  const rows = tbl.createTBody();
  const distRow = rows.insertRow(), dist = distRow.insertCell();
  dist.colSpan = 3;
  dist.append(labelledParagraph('Verteiler: ', verteilerFusszeile(model.verteiler), 'f-distribution'));
  const row = rows.insertRow();
  const author = row.insertCell();
  author.append(element('p','f-label','ERSTELLT DURCH / DATUM'),
    element('p','f-value',approvalValue(model.erstelltDurch,model.erstelltDatum)));
  const approver = row.insertCell();
  approver.append(element('p','f-label','GEPRÜFT & FREIGEGEBEN DURCH / DATUM'),
    element('p','f-value',approvalValue(model.freigegebenDurch,model.freigegebenDatum)));
  const pageCell = row.insertCell();
  const pageNo = element('p','f-page-number','Seite 99 / 99');
  pageCell.append(pageNo);
  container.append(tbl);
  return { container, pageNo };
}

function htmlIntro(model) {
  const blocks=[];
  for(const s of layoutSections(model).intro){
    const section=element('section','intro-block');
    section.append(element('p','block-title',s.title));
    if(s.meta)section.append(element('p','scope-meta',s.meta));
    if(s.text)section.append(element('p','',s.text));
    blocks.push(section);
  }
  const safety = element('section','intro-block safety-block');
  safety.append(element('p','block-title','SICHERHEIT / PSA'),element('p','safety-text',blank(model.psaFeld)));
  blocks.push(safety);
  return blocks;
}

function htmlStepsTable(model) {
  const tbl = htmlTable(model.stepCols || documentStepColumns(model.rows,model.docBildgroesse),'doc-steps');
  const header = tbl.createTHead().insertRow();
  for (const h of ['NR.','BILD','BESCHREIBUNG, WERKZEUG & SICHERHEIT']) {
    const th = element('th','',h);
    th.scope = 'col';
    header.append(th);
  }
  const body = tbl.createTBody();
  return { table: tbl, body };
}

function htmlStepRow(rowData) {
  const row = element('tr');
  if (rowData.empty) {
    const cell = row.insertCell();
    cell.colSpan = 3; cell.className = 'doc-empty'; cell.textContent = 'Noch keine Arbeitsschritte erfasst.';
    return row;
  }
  const num = row.insertCell();
  num.className = 'step-no'; num.textContent = String(rowData.number);
  const photo = row.insertCell();
  photo.className = 'doc-photo';
  if (rowData.image) photo.append(htmlImage(rowData.image,'','Foto Arbeitsschritt '+rowData.number));
  else photo.append(element('p','no-photo','—'));
  const text = row.insertCell();
  if(rowData.title)text.append(element('p','doc-step-title',rowData.title));
  text.append(element('p','',blank(rowData.text)));
  if (rowData.tools) text.append(element('p','detail-label','WERKZEUGE / HILFSMITTEL'),element('p','detail-value',rowData.tools));
  if (rowData.safety) text.append(element('p','detail-label safety-text','SICHERHEIT / PSA'),element('p','detail-value safety-text',rowData.safety));
  return row;
}

function makePage(model, layout) {
  const sheet = element('article','aa-sheet');
  const header = htmlHeader(model);
  const body = element('div','doc-body');
  const footer = htmlFooter(model);
  if (layout) { body.style.top = layout.top+'mm'; body.style.bottom = layout.bottom+'mm'; }
  sheet.append(header,body,footer.container);
  return { sheet, body, header, footer:footer.container, pageNo:footer.pageNo };
}

function fitsPage(page) {
  const last = page.body.lastElementChild;
  if (!last) return true;
  const marginBottom = parseFloat(getComputedStyle(last).marginBottom) || 0;
  return last.getBoundingClientRect().bottom + marginBottom <= page.body.getBoundingClientRect().bottom - mmToPx(1.6);
}

function paginate(model) {
  const bin = $('measureBin');
  bin.replaceChildren();
  const first = makePage(model);
  bin.append(first.sheet);
  // Reserve enough space for the actual header and footer, including long names.
  const layout = {
    top: Math.ceil(Math.max(LAYOUT.minTop, LAYOUT.header + pxToMm(first.header.getBoundingClientRect().height) + LAYOUT.gap)),
    bottom: Math.ceil(Math.max(LAYOUT.minBottom, LAYOUT.footer + pxToMm(first.footer.getBoundingClientRect().height) + LAYOUT.gap))
  };
  if (LAYOUT.height-layout.top-layout.bottom < 120) {
    bin.replaceChildren();
    throw new Error('Kopf- oder Fußzeile ist für DIN A4 zu umfangreich. Bitte die Texte kürzen.');
  }
  const pages = [first];
  const applyMargins = page => {
    page.body.style.top = layout.top+'mm';
    page.body.style.bottom = layout.bottom+'mm';
  };
  applyMargins(first);
  let current = first, tableOnPage = null;
  function newPage() {
    const page = makePage(model,layout);
    bin.append(page.sheet); pages.push(page);
    current = page; tableOnPage = null;
  }
  try {
    for (const block of htmlIntro(model)) {
      current.body.append(block);
      if (!fitsPage(current)) {
        block.remove();
        if (!current.body.children.length) throw new Error('Ein Abschnitt vor der Arbeitsbeschreibung ist zu lang für eine DIN-A4-Seite. Bitte kürzen.');
        newPage(); current.body.append(block);
        if (!fitsPage(current)) throw new Error('Ein Abschnitt vor der Arbeitsbeschreibung ist zu lang für eine DIN-A4-Seite. Bitte kürzen.');
      }
    }
    const rows = model.rows.length ? model.rows : [{ empty:true }];
    let isFirstTable = true;
    for (const data of rows) {
      const row = htmlStepRow(data);
      if (tableOnPage) {
        tableOnPage.body.append(row);
        if (fitsPage(current)) continue;
        row.remove();
        newPage();
      }
      let heading = isFirstTable ? element('p','work-title',layoutSections(model).stepTitle) : null;
      let tbl = htmlStepsTable(model);
      tbl.body.append(row);
      if (heading) current.body.append(heading);
      current.body.append(tbl.table);
      if (!fitsPage(current)) {
        tbl.table.remove();
        if (heading) heading.remove();
        if (!current.body.children.length) {
          throw new Error('Arbeitsschritt ' + (data.number || '') + ' ist zu lang für eine DIN-A4-Seite. Bitte in zwei Schritte aufteilen.');
        }
        newPage();
        if (heading) current.body.append(heading);
        current.body.append(tbl.table);
        if (!fitsPage(current)) throw new Error('Arbeitsschritt ' + (data.number || '') + ' ist zu lang für eine DIN-A4-Seite. Bitte in zwei Schritte aufteilen.');
      }
      tableOnPage = tbl;
      isFirstTable = false;
    }
    pages.forEach((p, i) => {
      p.pageNo.textContent = 'Seite ' + (i+1) + ' / ' + pages.length;
      p.sheet.setAttribute('aria-label','Seite ' + (i+1) + ' von ' + pages.length);
    });
    return { pages, layout };
  } catch (error) {
    bin.replaceChildren();
    throw error;
  }
}

function mountPages(pagination, model) {
  const doc = $('previewSheets');
  doc.replaceChildren();
  for (const p of pagination.pages) {
    const frame = element('div','page-frame');
    frame.append(p.sheet); doc.append(frame);
  }
  $('measureBin').replaceChildren();
  $('previewTitle').textContent = 'DIN-A4-Vorschau · ' + pagination.pages.length + (pagination.pages.length === 1 ? ' Seite' : ' Seiten');
  const notes = [];
  if (!model.rows.length) notes.push('Erfasse mindestens einen Arbeitsschritt, um eine Arbeitsanweisung als Word-Datei auszugeben.');
  const missingPhotos=model.rows.filter(row=>!row.image).length, missingDescriptions=model.rows.filter(row=>!row.text).length;
  if(missingPhotos)notes.push(missingPhotos+' Arbeitsschritt(e) ohne Bild.');
  if(missingDescriptions)notes.push(missingDescriptions+' Arbeitsschritt(e) ohne Tätigkeitsbeschreibung.');
  if (!model.psaFeld.trim()) notes.push('Sicherheit / PSA ist noch nicht ausgefüllt.');
  if (!model.freigegebenDurch.trim() || !model.freigegebenDatum.trim()) notes.push('Freigabeangaben fehlen. Vor Verwendung fachlich prüfen und freigeben.');
  $('previewMessage').hidden = !notes.length;
  $('previewMessage').textContent = notes.join(' ');
  previewCurrent = true;
  document.body.setAttribute('data-print-ready','true');
  requestAnimationFrame(fitPreview);
}

function fitPreview() {
  const scroll = $('previewScroll');
  if (!scroll.clientWidth) return;
  const w = mmToPx(LAYOUT.width), h = mmToPx(LAYOUT.height);
  const safe = Math.max(1, scroll.clientWidth-8);
  const scale = previewZoom === 'fit' ? Math.min(1,safe/w) : 1;
  for (const frame of $('previewSheets').querySelectorAll('.page-frame')) {
    frame.style.width = w*scale + 'px'; frame.style.height = h*scale + 'px';
    frame.firstElementChild.style.transform = 'scale(' + scale + ')';
  }
}

