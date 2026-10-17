const {test}=require("node:test");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),ts=require("typescript");
const directory=path.resolve(__dirname,"../addons/editor/src");
function moduleTree(){const cache=new Map();function load(name){const file=path.join(directory,name+".ts");if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const script=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(script,{exports,require:relative=>load(path.join(path.dirname(name),relative)),issecretvalue:()=>false,C_Spell:undefined,Set,Map,Number,String});return exports;}return load;}
test("Spell search preserves client names, ranks and numeric identities with a 48-result cap",async()=>{
 const generator=await import('../tools/generate-spell-catalog.mjs');assert.equal(generator.generateSpellCatalog(true),31863);
 const data=generator.readSpellCatalog();assert.equal(data.find(item=>item.id===635).name,'Holy Light');
 const load=moduleTree(),catalog=load('SpellCatalog');assert.equal(catalog.spellChoice('635').label,'Holy Light');assert.match(catalog.spellChoice('635').detail,/Rank 1/);
 assert.equal(catalog.searchSpells('',[]).length,0);assert.equal(catalog.searchSpells('a',[]).length,48);
 const matches=catalog.searchSpells('bLeSsInG',[]);assert.ok(matches.length>0&&matches.length<=48);const id=matches[0].value;assert.ok(!catalog.searchSpells('blessing',[id]).some(item=>item.value===id));
 assert.equal(catalog.spellChoice('9999999').value,'9999999');assert.match(catalog.spellChoice('9999999').label,/Unknown spell/);
});
test("Icon search uses texture IDs, aliases and custom paths independently of castable actions",()=>{
 const load=moduleTree(),catalog=load('IconCatalog');assert.equal(load('data/IconCatalog').IconCatalogCount,4404);
 assert.equal(catalog.iconChoice('135968').icon,135968);assert.equal(catalog.iconChoice('135968').value,'135968');
 const results=catalog.searchIcons('holy light',[]);assert.ok(results.length>0);assert.ok(results.every(item=>Number.isInteger(Number(item.value))));
 assert.equal(catalog.searchIcons('a',[]).length,48);assert.equal(catalog.searchIcons('',[]).length,0);
 assert.equal(catalog.iconChoice('Interface\\Icons\\INV_Misc_QuestionMark').icon,'Interface\\Icons\\INV_Misc_QuestionMark');
});
