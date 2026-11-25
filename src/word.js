// Native Word generation. The docx library is bundled in the same HTML file.
// The document is not a screenshot: text, rows, pictures, header and footer are
// individual Word elements. Word itself calculates its final page breaks.
function buildWordDocument(model, layout) {
  if (typeof docx === 'undefined') throw new Error('Der Word-Exporter konnte nicht geladen werden.');
  const D = docx;
  const totalWidth = mmToTwip(LAYOUT.width) - 2*mmToTwip(LAYOUT.side);
  function cols(percents) {
    const widths = percents.map(p => Math.round(totalWidth*p/100));
    widths[widths.length-1] += totalWidth-widths.reduce((a,b)=>a+b,0);
    return widths;
  }
  const headerCols = cols(LAYOUT.headerCols), stepCols = cols(model.stepCols || documentStepColumns(model.rows,model.docBildgroesse)), footerCols = cols(LAYOUT.footerCols);
  const edge = (color='222222',size=4) => ({ style:D.BorderStyle.SINGLE, size, color });
  const borders = color => ({
    top:edge(color,6), bottom:edge(color,6), left:edge(color,6), right:edge(color,6),
    insideHorizontal:edge(color,4), insideVertical:edge(color,4)
  });
  const runOpts = options => ({
    font:LAYOUT.font, size:Math.round((options.size || 10)*2), color: options.color || '000000',
    bold:Boolean(options.bold), boldComplexScript:Boolean(options.bold),
    sizeComplexScript:Math.round((options.size || 10)*2)
  });
  function runs(text, options={}) {
    return String(text === undefined ? '' : text).replace(/\r\n?/g,'\n').split('\n').map((line,i)=>
      new D.TextRun({ ...runOpts(options), text:line, break:i ? 1 : undefined }));
  }
  function paragraph(text='', options={}) {
    return new D.Paragraph({
      style:options.style,
      alignment: options.align || D.AlignmentType.LEFT,
      children: Array.isArray(text) ? text : runs(text,options),
      spacing: { before:options.before || 0, after:options.after || 0, line:options.line || 283, lineRule:D.LineRuleType.AUTO },
      run: options.defaultRun ? runOpts(options.defaultRun) : undefined,
      keepLines: true, keepNext:Boolean(options.keepNext), widowControl:false
    });
  }
  function labelPara(label, value, options={}) {
    return paragraph([...runs(label,{...options,bold:true}),...runs(value,options)],options);
  }
  function cell(width, children, options={}) {
    return new D.TableCell({
      width:{size:width,type:D.WidthType.DXA},
      margins:{top:mmToTwip(options.py === undefined ? 1.4 : options.py),
        bottom:mmToTwip(options.py === undefined ? 1.4 : options.py),
        left:mmToTwip(options.px === undefined ? 1.8 : options.px),
        right:mmToTwip(options.px === undefined ? 1.8 : options.px)},
      verticalAlign:options.valign || D.VerticalAlignTable.TOP,
      columnSpan:options.span,
      shading:options.fill ? { fill:options.fill, type:D.ShadingType.CLEAR, color:'auto' } : undefined,
      children
    });
  }
  function row(cells, options={}) {
    return new D.TableRow({ children:cells, cantSplit:true, tableHeader:options.header === true,
      height: options.minHeight ? {value:mmToTwip(options.minHeight),rule:D.HeightRule.ATLEAST} : undefined });
  }
  function table(widths, rows, color='222222') {
    return new D.Table({
      width:{size:totalWidth,type:D.WidthType.DXA}, columnWidths:widths,
      layout:D.TableLayoutType.FIXED, alignment:D.AlignmentType.CENTER,
      borders:borders(color), rows
    });
  }
  function imageRun(photo, name) {
    const raw = atob(photo.dataUrl.slice(photo.dataUrl.indexOf(',')+1));
    const bytes = new Uint8Array(raw.length);
    for (let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
    return new D.ImageRun({
      type:photo.dataUrl.startsWith('data:image/png') ? 'png' : 'jpg',
      data:bytes,
      transformation:{width:Math.max(1,Math.round(mmToPx(photo.mm.width))),height:Math.max(1,Math.round(mmToPx(photo.mm.height)))},
      altText:{title:name,description:name,name}
    });
  }
  function imagePara(photo, name) {
    return paragraph([imageRun(photo,name)],{align:D.AlignmentType.CENTER,line:240});
  }
  // A tiny spacer between body tables; its height does not affect the header/footer.
  function gap(mm=1.7) {
    return new D.Paragraph({
      children:[new D.TextRun({text:' ',font:LAYOUT.font,size:2})],
      spacing:{before:0,after:0,line:mmToTwip(mm),lineRule:D.LineRuleType.EXACT},
      widowControl:false
    });
  }
  const middle = D.VerticalAlignTable.CENTER;
  const header = new D.Header({children:[table(headerCols,[row([
    cell(headerCols[0],[
      labelPara('Dok-Nr.: ',blank(model.docNr),{size:8.5,line:254,after:20}),
      labelPara('Revision: ',blank(revisionText(model.docRev)),{size:8.5,line:254,after:20}),
      labelPara('Stand: ',blank(formatDate(model.docStand)),{size:8.5,line:254})
    ],{fill:'F8FAFC',valign:middle,px:1.6}),
    cell(headerCols[1],[
      paragraph('ARBEITSANWEISUNG',{size:15,bold:true,align:D.AlignmentType.CENTER,line:273,after:mmToTwip(1)}),
      paragraph(blank(model.docTitel),{size:11,bold:true,align:D.AlignmentType.CENTER,line:278})
    ],{valign:middle,px:1.6}),
    cell(headerCols[2],[
      model.logo ? imagePara(model.logo,'Unternehmenslogo') : paragraph(blank(model.docFirma),{size:8.5,bold:true,align:D.AlignmentType.CENTER})
    ],{valign:middle,px:1.6})
  ])])]});

  // Use separate native complex-field runs, including the styled result
  // run, plus a named paragraph style. This preserves the number's font
  // when a Word-compatible application recalculates PAGE and NUMPAGES.
  function pageField(instruction, cached) {
    const opts=runOpts({size:LAYOUT.pageNumberPt,bold:true});
    const char=type=>new D.TextRun({...opts,children:[new D.ImportedXmlComponent('w:fldChar',{'w:fldCharType':type})]});
    const code=new D.ImportedXmlComponent('w:instrText',{'xml:space':'preserve'});
    code.push(' ' + instruction + ' \\* CHARFORMAT ');
    return [char('begin'),new D.TextRun({...opts,children:[code]}),char('separate'),
      new D.TextRun({...opts,text:String(cached)}),char('end')];
  }
  const pageRuns = [
    ...runs('Seite ',{size:LAYOUT.pageNumberPt,bold:true}),
    ...pageField('PAGE',1),
    ...runs(' / ',{size:LAYOUT.pageNumberPt,bold:true}),
    ...pageField('NUMPAGES',layout.pageCount || 1)
  ];
  const footer = new D.Footer({children:[table(footerCols,[
    row([cell(totalWidth,[labelPara('Verteiler: ',verteilerFusszeile(model.verteiler),{size:8.5,line:276})],
      {span:3,valign:middle,px:1.7,py:1.3})]),
    row([
      cell(footerCols[0],[
        paragraph('ERSTELLT DURCH / DATUM',{size:8,bold:true,line:276,after:mmToTwip(1)}),
        paragraph(approvalValue(model.erstelltDurch,model.erstelltDatum),{size:9,bold:false,line:276})
      ],{valign:middle,px:1.7,py:1.3}),
      cell(footerCols[1],[
        paragraph('GEPRÜFT & FREIGEGEBEN DURCH / DATUM',{size:8,bold:true,line:276,after:mmToTwip(1)}),
        paragraph(approvalValue(model.freigegebenDurch,model.freigegebenDatum),{size:9,bold:false,line:276})
      ],{valign:middle,px:1.7,py:1.3}),
      cell(footerCols[2],[paragraph(pageRuns,{style:'AAPageNumber',align:D.AlignmentType.RIGHT,line:264,defaultRun:{size:LAYOUT.pageNumberPt,bold:true}})],{valign:middle,px:1.7,py:1.3})
    ])
  ])]});

  function introTable(title, texts, safety=false) {
    return table([totalWidth],[row([cell(totalWidth,[
      paragraph(title,{size:10.5,bold:true,color:safety?'B91C1C':'000000',after:mmToTwip(.7),line:276}),
      ...texts
    ],{py:1.1,fill:safety?'FFF7F7':undefined})])],safety?'B91C1C':'222222');
  }
  const plan=layoutSections(model);
  const body=[];
  for(const s of plan.intro){
    const texts=[];
    if(s.meta)texts.push(paragraph(s.meta,{bold:true,after:s.text?mmToTwip(.7):0}));
    if(s.text)texts.push(paragraph(s.text));
    body.push(introTable(s.title,texts),gap());
  }
  body.push(introTable('SICHERHEIT / PSA',[paragraph(blank(model.psaFeld),{color:'B91C1C'})],true),gap());
  body.push(paragraph(plan.stepTitle,{size:11,bold:true,before:mmToTwip(.6),after:mmToTwip(1.7),keepNext:true}));
  const stepHead = row(['NR.','BILD','BESCHREIBUNG, WERKZEUG & SICHERHEIT'].map((label,i)=>cell(stepCols[i],[
    paragraph(label,{size:9,bold:true,align:i < 2 ? D.AlignmentType.CENTER : D.AlignmentType.LEFT,line:280,keepNext:true})
  ],{fill:'E9EEF2',valign:middle,px:1.5,py:1.5})),{header:true});
  const stepRows = model.rows.map(data => {
    const paragraphs = [...(data.title?[paragraph(data.title,{size:11,bold:true,after:mmToTwip(1)})]:[]),paragraph(blank(data.text))];
    if (data.tools) paragraphs.push(paragraph('WERKZEUGE / HILFSMITTEL',{size:9,bold:true,before:mmToTwip(2),after:mmToTwip(.5)}),paragraph(data.tools));
    if (data.safety) paragraphs.push(paragraph('SICHERHEIT / PSA',{size:9,bold:true,color:'B91C1C',before:mmToTwip(2),after:mmToTwip(.5)}),paragraph(data.safety,{color:'B91C1C'}));
    return row([
      cell(stepCols[0],[paragraph(String(data.number),{bold:true,align:D.AlignmentType.CENTER})],{valign:middle}),
      cell(stepCols[1],[data.image?imagePara(data.image,'Foto Arbeitsschritt '+data.number):paragraph('—',{align:D.AlignmentType.CENTER,color:'64748B',size:9})],{valign:middle,px:1.5,py:1.5}),
      cell(stepCols[2],paragraphs)
    ]);
  });
  if (!stepRows.length) stepRows.push(row([cell(totalWidth,[paragraph('Noch keine Arbeitsschritte erfasst.',{align:D.AlignmentType.CENTER})],{span:3})]));
  body.push(table(stepCols,[stepHead,...stepRows]));
  return new D.Document({
    title:model.docTitel || 'Arbeitsanweisung', subject:model.docNr || '',
    creator:model.erstelltDurch || '', description:'Arbeitsanweisung',
    features:{updateFields:true}, compatabilityModeVersion:15,
    styles:{
      default:{document:{run:{font:LAYOUT.font,size:20,color:'000000'},paragraph:{spacing:{after:0,line:283}}}},
      paragraphStyles:[{id:'AAPageNumber',name:'AA Seitenzahl',basedOn:'Normal',
        run:{font:LAYOUT.font,size:LAYOUT.pageNumberPt*2,bold:true,color:'000000'},
        paragraph:{alignment:D.AlignmentType.RIGHT,spacing:{before:0,after:0,line:264}}}]
    },
    sections:[{
      headers:{default:header}, footers:{default:footer},
      properties:{page:{size:{width:mmToTwip(LAYOUT.width),height:mmToTwip(LAYOUT.height),orientation:D.PageOrientation.PORTRAIT},
        margin:{top:mmToTwip(layout.top),bottom:mmToTwip(layout.bottom),left:mmToTwip(LAYOUT.side),right:mmToTwip(LAYOUT.side),
          header:mmToTwip(LAYOUT.header),footer:mmToTwip(LAYOUT.footer)}}},
      children:body
    }]
  });
}

