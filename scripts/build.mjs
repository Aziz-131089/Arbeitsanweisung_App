// A deterministic build with no installed npm dependencies or network access.
// A single classic script preserves the existing application's shared scope.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFile(path.join(root,name),'utf8');
export const sourceOrder=Object.freeze([
  'config.js','verteiler.js','state.js','form.js','storage.js','steps.js',
  'bildeditor.js','speech.js','document-model.js','preview.js','word.js','export.js','app.js'
]);
const scriptSafe=s=>s.replace(/<\/script/gi,'<\\/script');
const cssSafe=s=>s.replace(/<\/style/gi,'<\\/style');

async function displayVersion(){
  const {version}=JSON.parse(await read('package.json'));
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Ungültige Release-Version in package.json.');
  return version.split('.').slice(0,2).join('.');
}
function replaceOnce(text,marker,replacement){
  if(text.split(marker).length!==2)throw Error('Build-Marker fehlt oder ist doppelt: '+marker);
  return text.replace(marker,()=>replacement);
}
export async function applicationSource(){
  const [parts,logo,version]=await Promise.all([
    Promise.all(sourceOrder.map(f=>read('src/'+f))),
    fs.readFile(path.join(root,'assets/logo-esw.png')),
    displayVersion()
  ]);
  // Ensure all source sections end in a newline; this prevents token merging
  // if a developer later edits a boundary. V3.2 already has these newlines.
  if(parts.some(p=>!p.endsWith('\n')))throw Error('Alle JS-Quelldateien müssen mit einem Zeilenumbruch enden.');
  const combined=parts.join('').replaceAll('__APP_VERSION__',version);
  return replaceOnce(combined,'__ESW_LOGO_DATA__','data:image/png;base64,'+logo.toString('base64'));
}
export async function buildHtml(){
  const [template,css,docx,license,app,version]=await Promise.all([
    read('src/index.html'),read('src/styles.css'),read('vendor/docx.iife.js'),
    read('vendor/LICENSE-docx.txt'),applicationSource(),displayVersion()
  ]);
  let result=template.replaceAll('__APP_VERSION__',version);
  result=replaceOnce(result,'/*__STYLES__*/',cssSafe(css));
  result=replaceOnce(result,'/*__DOCX_LIBRARY__*/',scriptSafe('/* docx (MIT license)\n'+license+'\n*/\n'+docx));
  result=replaceOnce(result,'/*__APPLICATION_SCRIPT__*/',scriptSafe(app));
  if(/__(?:STYLES|DOCX_LIBRARY|APPLICATION_SCRIPT|APP_VERSION|ESW_LOGO_DATA)__/.test(result))throw Error('Nicht ersetzter Build-Marker.');
  return result;
}
async function main(){
  const check=process.argv.includes('--check');
  const html=await buildHtml();
  for(const name of ['index.html','vorschau.html']){
    if(check){
      if(await read(name)!==html)throw Error(`${name} weicht vom Quellcode ab. Bitte npm run build ausführen und generierte HTML-Dateien mitcommitten.`);
    }else{
      // Root HTML copies still support the current GitHub Pages paths and
      // the old Cloudflare copy command. Cloudflare serves only dist/.
      await fs.mkdir(path.join(root,'dist'),{recursive:true});
      await fs.writeFile(path.join(root,name),html);
      await fs.writeFile(path.join(root,'dist',name),html);
    }
  }
  console.log(check?'PASS: Generierte HTML-Dateien stimmen exakt mit dem Quellcode überein.':`Build erfolgreich: index.html und vorschau.html, jeweils ${Buffer.byteLength(html)} Bytes.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
