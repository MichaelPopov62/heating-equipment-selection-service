import fs from 'node:fs';
import path from 'node:path';
const ROOT='/Users/dmytropopov/Documents/projects/heating-equipment-selection-service/backend';
function walk(d,acc=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,acc);else if(e.name.endsWith('.js'))acc.push(p);}return acc;}
const srcFiles=walk(path.join(ROOT,'src'));
const scriptFiles=fs.readdirSync(path.join(ROOT,'scripts')).filter(f=>/^verify.*\.(js|mjs)$/.test(f)).map(f=>path.join(ROOT,'scripts',f));
function imports(file){
  const src=fs.readFileSync(file,'utf8');
  const re=/from\s+['"]([^'"]+)['"]/g; const out=[];let m;
  while((m=re.exec(src))){const s=m[1]; if(s.startsWith('.')){out.push(path.resolve(path.dirname(file),s));}}
  return out;
}
// transitive closure over src
const memo=new Map();
function closure(f,seen=new Set()){
  if(seen.has(f))return seen; seen.add(f);
  if(!fs.existsSync(f))return seen;
  for(const d of imports(f)) if(d.startsWith(path.join(ROOT,'src'))) closure(d,seen);
  return seen;
}
const direct=new Map(); // srcfile -> [scripts]
const trans=new Map();
for(const sc of scriptFiles){
  const ds=imports(sc).filter(p=>p.startsWith(path.join(ROOT,'src')));
  for(const d of ds){
    if(!direct.has(d))direct.set(d,[]); direct.get(d).push(path.basename(sc));
    for(const t of closure(d)){ if(!trans.has(t))trans.set(t,new Set()); trans.get(t).add(path.basename(sc)); }
  }
}
const rel=f=>path.relative(ROOT,f);
const uncoveredDirect=[],uncoveredAll=[];
for(const f of srcFiles){
  if(!trans.has(f)) uncoveredAll.push(rel(f));
  else if(!direct.has(f)) uncoveredDirect.push(rel(f));
}
console.log('TOTAL src js:',srcFiles.length);
console.log('\n=== НЕ ДОСТИГАЕТСЯ ВООБЩЕ (ни прямо, ни транзитивно):',uncoveredAll.length);
uncoveredAll.forEach(f=>console.log(' ',f, fs.readFileSync(path.join(ROOT,f),'utf8').split('\n').length));
console.log('\n=== только транзитивно (нет собственного скрипта):',uncoveredDirect.length);
uncoveredDirect.forEach(f=>console.log(' ',f,'<-',[...trans.get(path.join(ROOT,f))].slice(0,3).join(',')));
