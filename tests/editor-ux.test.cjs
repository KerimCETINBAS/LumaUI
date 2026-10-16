const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
test('In-game editor workspace and native interactions preserve component editing',()=>{
 const loads=['LumaUI','LumaUI_Editor'].flatMap(name=>{
  const dir=path.resolve(__dirname,'../dist',name);
  return fs.readFileSync(path.join(dir,name+'.toc'),'utf8').split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line!=='__start.lua').map(file=>'dofile('+JSON.stringify(dir.replaceAll('\\','/')+'/'+file.replaceAll('\\','/'))+')');
 }).join('\n');
 const script=fs.readFileSync(path.join(__dirname,'native-fixture.lua'),'utf8')+'\nfunction IsShiftKeyDown() return false end\nfunction IsControlKeyDown() return false end\nfunction IsAltKeyDown() return false end\nSlashCmdList={}\n'+loads+'\n'+fs.readFileSync(path.join(__dirname,'editor-ux.lua'),'utf8');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'luma-editor-ux-'));
 try{
  const file=path.join(dir,'check.lua');fs.writeFileSync(file,script);
  const result=cp.spawnSync(process.execPath,[require.resolve('fengari-node-cli/src/lua-cli.js'),file],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(result.stderr,'');assert.match(result.stdout,/Editor usability:.*passed/);
 }finally{assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('luma-editor-ux-'));fs.rmSync(dir,{recursive:true,force:true});}
});
