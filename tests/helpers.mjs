import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {inflateRawSync} from 'node:zlib';
import {root,applicationSource} from '../scripts/build.mjs';
export {applicationSource};

// Load the exact vendored browser writer, not a different Node package. The
// Blob, timers and encoders supplied here are Node's standard Web APIs.
export async function wordTestContext(){
  const c=vm.createContext({console,atob,btoa,Blob,Buffer,TextEncoder,TextDecoder,setTimeout,clearTimeout,setImmediate,clearImmediate,Uint8Array,ArrayBuffer});
  vm.runInContext(await fs.readFile(path.join(root,'vendor/docx.iife.js'),'utf8'),c);
  vm.runInContext(await applicationSource(),c);
  return c;
}

// Minimal read-only helper for generated DOCX archives in tests. No production
// ZIP parser is added. DOCX's central directory provides the compressed sizes.
export function readZipEntry(bytes,name){
  const b=Buffer.from(bytes);
  let end=b.length-22;
  while(end>=Math.max(0,b.length-65557)&&b.readUInt32LE(end)!==0x06054b50)end--;
  if(end<Math.max(0,b.length-65557))throw Error('ZIP central directory not found');
  const count=b.readUInt16LE(end+10);
  let p=b.readUInt32LE(end+16);
  for(let i=0;i<count;i++){
    if(b.readUInt32LE(p)!==0x02014b50)throw Error('Invalid ZIP central entry');
    const method=b.readUInt16LE(p+10), compressed=b.readUInt32LE(p+20);
    const nameLen=b.readUInt16LE(p+28), extraLen=b.readUInt16LE(p+30), commentLen=b.readUInt16LE(p+32);
    const offset=b.readUInt32LE(p+42);
    if(b.toString('utf8',p+46,p+46+nameLen)===name){
      if(b.readUInt32LE(offset)!==0x04034b50)throw Error('Invalid ZIP local entry');
      const dataStart=offset+30+b.readUInt16LE(offset+26)+b.readUInt16LE(offset+28);
      const data=b.subarray(dataStart,dataStart+compressed);
      if(method===0)return data;
      if(method===8)return inflateRawSync(data);
      throw Error('Unsupported ZIP compression: '+method);
    }
    p+=46+nameLen+extraLen+commentLen;
  }
  throw Error('Missing ZIP entry: '+name);
}
