// Shared document model. Empty input cards are not exported; existing content is
// never generated or rewritten by the app.
function fitDimensions(width, height, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}

// A single table grid per document keeps every page and the DOCX aligned.
// Portrait-dominated instructions allocate enough width for large, readable
// portrait photos (typically 75 x 100 mm for a 3:4 smartphone picture).
function documentStepColumns(rows, mode='gross') {
  const photos=rows.filter(row=>row.image).map(row=>row.image);
  const portrait=photos.filter(photo=>photo.height>photo.width).length;
  if(mode==='kompakt')return portrait&&portrait*2>=photos.length?LAYOUT.compactPortraitCols:LAYOUT.compactStepCols;
  return portrait && portrait*2>=photos.length ? LAYOUT.portraitStepCols : LAYOUT.stepCols;
}

function photoPrintDimensions(photo,cols, mode='gross') {
  const portrait=photo.height>photo.width;
  const maxWidth=Math.min(portrait?LAYOUT.portraitPhotoWidth:LAYOUT.maxPhotoWidth,(LAYOUT.width-2*LAYOUT.side)*cols[1]/100-5);
  const maxHeight=mode==='kompakt'?(portrait?65:46):portrait?LAYOUT.portraitPhotoHeight:LAYOUT.maxPhotoHeight;
  return fitDimensions(photo.width,photo.height,maxWidth,maxHeight);
}

async function collectDocument() {
  await waitForImages();
  const model = collectStand();
  model.rows = [];
  for (const card of $('schritteListe').querySelectorAll('.step-card')) {
    const nr = Number(card.dataset.stepId), st = bildStatus[nr];
    const title=$('kurztitel-'+nr).value.trim();
    const text = $('taetigkeit-' + nr).value.trim();
    const tools = $('werkzeuge-' + nr).value.trim();
    const safety = $('sicherheit-' + nr).value.trim();
    const photo = getRenderedImage(st);
    if (!(title || text || tools || safety || photo)) continue;
    model.rows.push({ number: model.rows.length+1, title, text, tools, safety,
      image: photo ? { ...photo } : null });
  }
  model.stepCols=documentStepColumns(model.rows,model.docBildgroesse);
  for(const row of model.rows) if(row.image) row.image.mm=photoPrintDimensions(row.image,model.stepCols,model.docBildgroesse);
  model.logo = null;
  if (logoDataUrl) {
    const image = await loadImage(logoDataUrl);
    // Normalize the logo to PNG for the native Word writer.
    const logoCanvas = document.createElement('canvas');
    const factor = Math.min(1, 900 / Math.max(image.naturalWidth,image.naturalHeight));
    logoCanvas.width = Math.max(1,Math.round(image.naturalWidth*factor));
    logoCanvas.height = Math.max(1,Math.round(image.naturalHeight*factor));
    logoCanvas.getContext('2d').drawImage(image,0,0,logoCanvas.width,logoCanvas.height);
    model.logo = {
      dataUrl: logoCanvas.toDataURL('image/png'), width: logoCanvas.width, height: logoCanvas.height,
      mm: fitDimensions(logoCanvas.width,logoCanvas.height,LAYOUT.logoWidth,LAYOUT.logoHeight)
    };
  }
  return model;
}

function scopeMeta(model) {
  return [model.docFirma.trim() && 'Unternehmen: ' + model.docFirma.trim(),
    model.docArbeitsplatz.trim() && 'Arbeitsplatz: ' + model.docArbeitsplatz.trim()].filter(Boolean).join(' · ');
}

// Purpose and scope are retained from the previously agreed ESW document
// layout. They are optional, so the simple "header / PSA / steps" workflow
// does not have empty compulsory sections.
function layoutSections(model) {
  const sections=[];
  if(model.docZweck.trim()) sections.push({
    title:'ZWECK UND ZIEL',text:model.docZweck.trim(),meta:''
  });
  if(model.docGeltung.trim() || scopeMeta(model)) sections.push({
    title:'GELTUNGSBEREICH',text:model.docGeltung.trim(),meta:scopeMeta(model)
  });
  const numbered=sections.map((s,i)=>({...s,title:(i+1)+' '+s.title}));
  return {
    intro:numbered,
    stepTitle:(numbered.length+1)+' ARBEITSBESCHREIBUNG'
  };
}

function approvalValue(name, date) {
  return [blank(name), blank(formatDate(date))].join(' / ');
}

