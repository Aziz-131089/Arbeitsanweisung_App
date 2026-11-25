import assert from 'node:assert/strict';
import vm from 'node:vm';
import {wordTestContext,readZipEntry} from './helpers.mjs';

const ctx=await wordTestContext();
const run=expr=>vm.runInContext(expr,ctx);
assert.equal(run("verteilerText('IT, QW, GF, RF, GF, UNKNOWN')"),'GF, QW, RF, IT');
assert.equal(run("verteilerText('')"),'');
assert.equal(run("verteilerFusszeile('IT, QW, GF, RF, GF, UNKNOWN')"),'GF • QW • RF • IT');
assert.equal(run("verteilerText('GF, VERT, EK, AV, FFS, KB, QW, RF, BES, MON, LOG, IT')"),'GF, VERT, EK, AV, FFS, KB, QW, RF, BES, MON, LOG, IT');
ctx.raw={version:3,schritte:[],logoDataUrl:'',verteiler:'Fertigung, Arbeitsvorbereitung (AV), QS / QM / UM'};
const migrated=run('normalizeStand(raw)');
assert.equal(migrated.verteiler,'AV');
assert.equal(migrated.verteilerAlt,ctx.raw.verteiler);
ctx.raw={...migrated,verteiler:'GF, AV, QW',verteilerAlt:''};
assert.equal(run('normalizeStand(raw).verteiler'),'GF, AV, QW');
assert.equal(run('normalizeStand(raw).verteilerAlt'),'');
const model=run('defaultStand(false)');
Object.assign(model,{docNr:'AA-TEST',docTitel:'Testfall Verteiler',docFirma:'Muster',logo:null,erstelltDurch:'A. Muster',erstelltDatum:'2026-11-25',freigegebenDurch:'Nicht freigegeben',freigegebenDatum:'',rows:[{number:1,text:'Nur Layouttest',tools:'',safety:'',image:null}]});
ctx.model=model;
for(const text of ['IT, QW, GF, RF, GF, UNKNOWN','', 'GF, VERT, EK, AV, FFS, KB, QW, RF, BES, MON, LOG, IT']){
  model.verteiler=text;
  const blob=await run('docx.Packer.toBlob(buildWordDocument(model,{top:33,bottom:28,pageCount:2}))');
  const buffer=await blob.arrayBuffer();
  const xml=readZipEntry(buffer,'word/footer1.xml').toString('utf8');
  const body=readZipEntry(buffer,'word/document.xml').toString('utf8');
  const paragraphs=[...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(p=>[...p[0].matchAll(/<w:t(?:\s[^>]*)?>(.*?)<\/w:t>/g)].map(m=>m[1]).join(''));
  const actual=paragraphs.find(p=>p.startsWith('Verteiler:'));
  assert.equal(actual,'Verteiler: '+run('verteilerFusszeile(model.verteiler)'));
  assert.ok(paragraphs.includes('Seite 1 / 2'));
  for(const text of ['A. Muster / 25.11.2026','Nicht freigegeben / —']){
    const p=[...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].find(x=>x[0].includes(text));
    assert.ok(p,'Author/approval value');
    assert.ok(!/<w:b\s*\/>|<w:b w:val="(?:true|1)"\s*\/>/.test(p[0]),'Approval value not bold');
  }
  assert.match(xml,/NUMPAGES/);
  assert.match(xml,/\bPAGE\b/);
  assert.match(body,/<w:tblHeader[\s/>]/);
  assert.match(body,/<w:cantSplit[\s/>]/);
  assert.match(body,/Nur Layouttest/);
}
console.log('PASS: Browser-DOCX-Writer, Verteiler, Word-Felder, Seitennummern, Schrift, Tabellenkopf und ungeteilte Zeilen.');
