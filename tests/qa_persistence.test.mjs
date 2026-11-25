import assert from 'node:assert/strict';
import { applicationSource } from './helpers.mjs';
import vm from 'node:vm';

const source=await applicationSource();
const vals=new Map();
let quota=false, stateText='first draft', status='', timers=new Map(), nextTimer=0;
const localStorage={getItem:k=>vals.get(k)??null,setItem:(k,v)=>{if(quota)throw Error('Quota');vals.set(k,v);}};
const ctx=vm.createContext({console,localStorage,atob,setTimeout:(f)=>{timers.set(++nextTimer,f);return nextTimer;},clearTimeout:id=>timers.delete(id)});
vm.runInContext(source,ctx);
const run=expr=>vm.runInContext(expr,ctx);
ctx.getText=()=>stateText;
ctx.logStatus=v=>status=v;
ctx.document={body:{removeAttribute(){}}};
run("ready=true; storageMode='localStorage'; setStatus=logStatus; collectStand=()=>({version:3,updatedAt:++lastSnapshotAt,docNr:'AA-TEST',schritte:[{taetigkeit:getText()}]});");
const saved=()=>JSON.parse(vals.get('arbeitsanweisung_v3_entwurf'));
// Small drafts are immediately stored, without calling the save button or
// waiting for a timer / promise / browser unload callback.
run('scheduleSave()');
assert.equal(saved().schritte[0].taetigkeit,'first draft');
assert.equal(run('dirty'),false);
stateText='last keystroke';run('scheduleSave()');
assert.equal(saved().schritte[0].taetigkeit,'last keystroke');
assert.match(status,/Automatisch gespeichert/);

// Larger drafts are throttled rather than repeatedly debounced; a focus or
// pagehide flush saves the latest edit immediately.
run('lastSnapshotSize=900000');stateText='large draft first';run('scheduleSave()');
const timer=run('saveTimer');assert.ok(timer);
stateText='large draft last';run('scheduleSave()');
assert.equal(run('saveTimer'),timer);
assert.equal(saved().schritte[0].taetigkeit,'last keystroke');
run('flushPendingDraft()');assert.equal(saved().schritte[0].taetigkeit,'large draft last');
assert.equal(run('dirty'),false);assert.equal(timers.size,0);

// If the Web Storage quota has been exceeded, start the real IndexedDB
// write function before returning to the event loop, even on pagehide.
quota=true;let storedIDB, settle;
ctx.recordIDB=s=>{storedIDB=s;return new Promise(resolve=>{settle=resolve;});};
run('db={}; dbWrite=recordIDB; lastSnapshotSize=900000');
stateText='fallback latest';run('scheduleSave()');run('flushPendingDraft()');
assert.equal(storedIDB.schritte[0].taetigkeit,'fallback latest');
assert.equal(run('dirty'),true);
const before=storedIDB;run('flushPendingDraft()');assert.equal(storedIDB,before);
settle();await new Promise(resolve=>setImmediate(resolve));
assert.equal(run('dirty'),false);assert.equal(run('storageMode'),'indexedDB');
ctx.idb=storedIDB; ctx.local=saved();assert.equal(run('newestDraft(local,idb).schritte[0].taetigkeit'),'fallback latest');

// Starting a new AA is deliberately explicit, preserves the useful footer
// defaults, and rolls back the visible document if storage fails.
const old={docNr:'AA-ORIGINAL',docTitel:'Original',docFirma:'Muster',logoDataUrl:'',verteiler:'AV, QW',verteilerAlt:'',erstelltDurch:'Testperson',docBildgroesse:'kompakt',schritte:[{taetigkeit:'old text'}]};
const fields={kopfDetails:{},fussDetails:{}};let approved=false, adoption=[], restored, allowed=true;
ctx.confirm=()=>approved;ctx.captureOld=()=>old;ctx.adopt=async d=>{adoption.push(d);return allowed;};ctx.restore=d=>{restored=d;};
ctx.document.getElementById=id=>fields[id];
run("collectStand=captureOld; adoptDraft=adopt; applyStand=restore; setBusy=x=>{busy=x;}; showPanel=()=>{}; dirty=false;");
await run('entwurfZuruecksetzen()');assert.equal(adoption.length,0);
approved=true;await run('entwurfZuruecksetzen()');
assert.equal(adoption.length,1);assert.equal(adoption[0].docNr,'');assert.equal(adoption[0].docTitel,'');
assert.equal(adoption[0].docFirma,old.docFirma);assert.equal(adoption[0].verteiler,old.verteiler);assert.equal(adoption[0].erstelltDurch,old.erstelltDurch);
assert.equal(adoption[0].schritte[0].taetigkeit,'');assert.equal(fields.kopfDetails.open,true);assert.equal(fields.fussDetails.open,false);
allowed=false;await run('entwurfZuruecksetzen()');assert.equal(restored,old);assert.equal(run('dirty'),true);
assert.match(status,/bisherige Entwurf bleibt geöffnet/);
console.log('PASS: instant small-draft save, throttled large-draft exit flush, immediate IndexedDB fallback and newer snapshot, explicit New AA confirmation and rollback on storage failure.');
