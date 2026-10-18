(async () => {

const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {root,addons}=await import('../tools/config.mjs');
const projectDirs=addons.map(addon=>path.join(root,addon.directory));
const specs=await Promise.all(projectDirs.map(async dir=>{const config=(await import(require('node:url').pathToFileURL(path.join(dir,'wuira.config.mjs')).href)).default;return [path.resolve(dir,config.outDir??'dist'),config.name];}));
const loads=specs.flatMap(([dir,name])=>fs.readFileSync(path.join(dir,name+'.toc'),'utf8').split(/\r?\n/).filter(x=>x&&!x.startsWith('#')&&!x.includes('__start.lua')).map(x=>'dofile('+JSON.stringify(dir+'/'+x.replaceAll('\\','/'))+')')).join('\n');
const fixture=fs.readFileSync(path.join(__dirname,'native-fixture.lua'),'utf8');
const integration=fs.readFileSync(path.join(__dirname,'collections.integration.lua'),'utf8').replace('__LOAD_BUNDLES__',()=>require('./builtin-fixture.cjs')()+'\n__LOAD_BUNDLES__');
const minimal=integration.slice(0,integration.indexOf('__LOAD_BUNDLES__'))+loads+`
local master=__wuiraModules_LumaUI
local controls
local controlsClass=master.require('builder.collections.CollectionControls').CollectionControls
local constructControls=controlsClass.prototype.____constructor
controlsClass.prototype.____constructor=function(self,...) constructControls(self,...);controls=self end
LumaUISettings={}
master.require('index')
assert(#LumaUI.Presets:List()==0,'no automatic starters')
${fs.readFileSync(path.join(__dirname,'builtin-import.lua'),'utf8')}
for _,key in ipairs({'PlayerResources','PaladinParty','PaladinRaid'}) do LumaUI.Presets:Save(importBuiltin(LumaUI,master,key),true) end
LumaUI.Presets:Restore()
__KNOWN_SPELL_CHECKS__
__GROUP_CHECKS__
`;
const script=fixture+(process.argv.includes('--groups')?minimal:integration.replace('__ACTION_BUTTON_FIXTURE__',()=>fs.readFileSync(path.join(__dirname,'action-buttons-fixture.lua'),'utf8')).replaceAll('__LOAD_BUNDLES__',loads).replace('__BINDING_CHECKS__',fs.readFileSync(path.join(__dirname,'collection-bindings.lua'),'utf8')).replace('__TRANSFER_CHECKS__',fs.readFileSync(path.join(__dirname,'transfer.integration.lua'),'utf8')).replace('__ACTION_VISIBILITY_CHECKS__',fs.readFileSync(path.join(__dirname,'actionbars-visibility.lua'),'utf8')));
const groupChecks=fs.readFileSync(path.join(__dirname,'groups.integration.lua'),'utf8').replace('__EDITOR_AUTHORING_CHECKS__',()=>fs.readFileSync(path.join(__dirname,'editor-groups.integration.lua'),'utf8')).replace('__CLICK_CAST_CHECKS__',()=>fs.readFileSync(path.join(__dirname,'player-actions.integration.lua'),'utf8') + fs.readFileSync(path.join(__dirname,'clickcast.integration.lua'),'utf8'));
const groupScript=script.replace('__GROUP_CHECKS__',()=>groupChecks);
const tstl=require('typescript-to-lua');
const iterator=tstl.transpileString('export function consumeKnownSpellCollection(items: Iterable<{id:number}>): number[] { const ids:number[]=[]; for (const item of items) ids.push(item.id); return ids; }',{luaLibImport:'inline',luaTarget:'5.1'});
if (iterator.diagnostics.some(item=>item.category===1)) throw new Error('Iterator consumer did not compile');
const consumer='local function consumeModule()\n'+iterator.file.lua+'\nend\nlocal consumeKnownSpellValues=consumeModule().consumeKnownSpellCollection\nlocal function consumeKnownSpellCollection(items) return consumeKnownSpellValues(nil,items) end\n';
const helperChecks=consumer+fs.readFileSync(path.join(__dirname,'known-spells.integration.lua'),'utf8');
const checkedScript=groupScript.replace('__KNOWN_SPELL_CHECKS__',()=>helperChecks);
const file=path.join(os.tmpdir(),'lumaui-collection-integration-'+Date.now()+'.lua');
fs.writeFileSync(file,checkedScript);
try{const r=cp.spawnSync(process.execPath,[require.resolve('fengari-node-cli/src/lua-cli.js'),file],{encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);if(r.status!==0||r.stderr){const line=Number(r.stderr.match(/lua:(\d+):/)?.[1]);console.log(checkedScript.split('\n').slice(Math.max(0,line-4),line+3).map((s,i)=>(Math.max(0,line-4)+i+1)+': '+s).join('\n'));process.exitCode=1;}}finally{fs.unlinkSync(file);}

})().catch(error => { console.error(error); process.exitCode = 1; });
