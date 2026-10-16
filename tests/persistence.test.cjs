const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
test('Loading flags, actual SavedVariables, bindings and starter imports preserve user settings',()=>{
 const prefix=fs.readFileSync(path.join(__dirname,'collections.integration.lua'),'utf8').split('__LOAD_BUNDLES__')[0];
 const loads=['LumaUI','LumaUI_Editor'].flatMap(name=>{const dir=path.resolve(__dirname,'../dist',name);return fs.readFileSync(path.join(dir,name+'.toc'),'utf8').split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line!=='__start.lua').map(file=>'dofile('+JSON.stringify(dir.replaceAll('\\','/')+'/'+file.replaceAll('\\','/'))+')');}).join('\n');
 const script=fs.readFileSync(path.join(__dirname,'native-fixture.lua'),'utf8')+'\n'+prefix+'\n'+require('./builtin-fixture.cjs')()+'\n'+loads+'\n'+fs.readFileSync(path.join(__dirname,'persistence.lua'),'utf8');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'luma-persistence-'));
 try {const file=path.join(dir,'check.lua');fs.writeFileSync(file,script);const result=cp.spawnSync(process.execPath,[require.resolve('fengari-node-cli/src/lua-cli.js'),file],{encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(result.stderr,'');assert.match(result.stdout,/Persistence and optional starter imports passed/);}finally{assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('luma-persistence-'));fs.rmSync(dir,{recursive:true,force:true});}
});
