const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
test('Minimap ring launcher clicks, drags, persists and supports LibDBIcon',()=>{
 const root=path.resolve(__dirname,'../dist/LumaUI');
 const loads=fs.readFileSync(path.join(root,'LumaUI.toc'),'utf8').split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line!=='__start.lua')
  .map(file=>'dofile('+JSON.stringify(path.join(root,file.replaceAll('\\','/')).replaceAll('\\','/'))+')').join('\n');
 const script=fs.readFileSync(path.join(__dirname,'native-fixture.lua'),'utf8')+'\n'+loads+'\n'+fs.readFileSync(path.join(__dirname,'minimap-launcher.lua'),'utf8');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'luma-minimap-'));
 try{
  const file=path.join(temp,'check.lua');fs.writeFileSync(file,script);
  const result=cp.spawnSync(process.execPath,[require.resolve('fengari-node-cli/src/lua-cli.js'),file],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(result.stderr,'');assert.match(result.stdout,/Minimap ring launcher checks passed/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
