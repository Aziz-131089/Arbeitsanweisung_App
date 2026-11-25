import assert from 'node:assert/strict';
import { applicationSource } from './helpers.mjs';
import vm from 'node:vm';
const source=await applicationSource();
const values=new Map([
  ['aa_fw_014_rdm02_stand_v1','previous-v1'],
  ['arbeitsanweisung_v2_testentwurf','previous-v2']
]);
let full=false;
const localStorage={
  getItem:key=>values.get(key)??null,
  setItem:(key,val)=>{if(full)throw Error('Quota exceeded');values.set(key,val);}
};
const ctx=vm.createContext({console,localStorage,atob,setTimeout,clearTimeout});
vm.runInContext(source,ctx);
const v1={docNr:'AA-ALT',docRev:'Rev. 01',docTitel:'Prüftext',psaFeld:'Originaltext',schritte:[
  {taetigkeit:'Originaler Schritt',werkzeuge:'Originales Werkzeug',bildDataUrl:'data:image/jpeg;base64,AAAA',formen:[{typ:'kreis',cx:50,cy:70,r:24}]}
]};
ctx.input=v1;
let result=vm.runInContext('normalizeStand(input)',ctx);
assert.equal(result.docNr,'AA-ALT');
assert.equal(result.psaFeld,'Originaltext');
assert.equal(result.schritte[0].legacyStretch,true);
assert.equal(result.schritte[0].formen[0].r,24);
const v2={...v1,version:2,docStand:'23.11.2026',logoDataUrl:'',docArbeitsplatz:'Muster',schritte:[{
  ...v1.schritte[0],view:{zoom:2,x:12,y:-4},werkzeug:'pfeil',sicherheit:'Per-step text',
  verlauf:[{formen:[],view:{zoom:1,x:0,y:0}}]
}]};
ctx.input=v2;
result=vm.runInContext('normalizeStand(input)',ctx);
assert.equal(result.docStand,'2026-11-23');
assert.equal(result.schritte[0].view.zoom,2);
assert.equal(result.schritte[0].werkzeug,'pfeil');
assert.equal(result.schritte[0].sicherheit,'Per-step text');
assert.equal(result.schritte[0].verlauf.length,1);
assert.equal(result.schritte[0].legacyStretch,false);
assert.equal(result.logoDataUrl,'');
const fallbackWrites=[];
ctx.recordFallback=stand=>fallbackWrites.push(stand);
vm.runInContext("ready=true; db={}; setStatus=()=>{}; collectStand=()=>({version:3,updatedAt:(++lastSnapshotAt),docNr:'AA-QA',schritte:[]}); dbWrite=async stand=>recordFallback(stand);",ctx);
assert.equal(await vm.runInContext('speichernLokal(true)',ctx),true);
assert.ok(values.has('arbeitsanweisung_v3_entwurf'));
assert.equal(fallbackWrites.length,0);
assert.equal(values.get('aa_fw_014_rdm02_stand_v1'),'previous-v1');
assert.equal(values.get('arbeitsanweisung_v2_testentwurf'),'previous-v2');
full=true;
assert.equal(await vm.runInContext('speichernLokal(true)',ctx),true);
assert.equal(fallbackWrites.length,1);
assert.equal(vm.runInContext('storageMode',ctx),'indexedDB');
const snapshot=JSON.parse(values.get('arbeitsanweisung_v3_entwurf'));
ctx.oldState=snapshot;ctx.newState=fallbackWrites[0];
assert.equal(vm.runInContext('newestDraft(oldState,newState).updatedAt',ctx),fallbackWrites[0].updatedAt);
vm.runInContext('db=null',ctx);
assert.equal(await vm.runInContext('speichernLokal(true)',ctx),false);
assert.equal(vm.runInContext('dirty',ctx),true);
console.log('PASS: V1/V2 data migration, saved zoom/history, primary localStorage, quota fallback, failure handling, old keys unchanged.');
