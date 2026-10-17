const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const root=path.resolve(__dirname,"../addons/core");
test("Preset factories, native skins, import validation and lifecycle work in emitted Lua",()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"lumaui-builder-"));
 try {
  const out=path.join(temp,"addon");
  const compile=cp.spawnSync(process.execPath,[require.resolve("typescript-to-lua/dist/tstl.js"),"-p","tsconfig.json","--outDir",out],{cwd:root,encoding:"utf8",env:{...process.env,WUIRA_STANDALONE:"1",WUIRA_ADDON_NAME:"LumaUI"}});
  assert.equal(compile.status,0,compile.stdout+compile.stderr);
  const loads=fs.readFileSync(path.join(out,"LumaUI.toc"),"utf8").split(/\r?\n/).filter(line=>line&&!line.startsWith("#")&&!line.includes("__start.lua")).map(file=>"dofile("+JSON.stringify(path.join(out,file.replaceAll("\\","/")).replaceAll("\\","/"))+")").join("\n");
  const script=fs.readFileSync(path.join(__dirname,"native-fixture.lua"),"utf8")+"\n"+require("./builtin-fixture.cjs")()+"\n"+loads+"\n"+fs.readFileSync(path.join(__dirname,"builder.lua"),"utf8")+"\n"+fs.readFileSync(path.join(__dirname,"component-reuse.lua"),"utf8")+"\n"+fs.readFileSync(path.join(__dirname,"activation.lua"),"utf8")+"\n"+fs.readFileSync(path.join(__dirname,"transfer.lua"),"utf8")+"\n"+fs.readFileSync(path.join(__dirname,"nameplates.lua"),"utf8");
  const file=path.join(temp,"check.lua");fs.writeFileSync(file,script);
  const result=cp.spawnSync(process.execPath,[require.resolve("fengari-node-cli/src/lua-cli.js"),file],{encoding:"utf8"});
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(result.stderr,"",result.stderr);
  assert.match(result.stdout,/Builder runtime checks passed/);
  assert.match(result.stdout,/Collection activation checks passed/);
  assert.match(result.stdout,/Optional keybinding transfer policy checks passed/);
  assert.match(result.stdout,/Luma nameplate factories and unit conversion checks passed/);
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
