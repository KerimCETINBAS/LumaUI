(async () => {

const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {root,addons}=await import('../tools/config.mjs');
const projectDirs=addons.map(addon=>path.join(root,addon.directory));
const specs=await Promise.all(projectDirs.map(async dir=>{const config=(await import(require('node:url').pathToFileURL(path.join(dir,'wuira.config.mjs')).href)).default;return [path.resolve(dir,config.outDir??'dist'),config.name];}));
const loads=specs.flatMap(([dir,name])=>fs.readFileSync(path.join(dir,name+'.toc'),'utf8').split(/\r?\n/).filter(x=>x&&!x.startsWith('#')&&!x.includes('__start.lua')).map(x=>'dofile('+JSON.stringify(dir+'/'+x.replaceAll('\\','/'))+')')).join('\n');
const fixture=fs.readFileSync(path.join(__dirname,'native-fixture.lua'),'utf8');
const script=fixture+fs.readFileSync(path.join(__dirname,'collections.integration.lua'),'utf8').replaceAll('__LOAD_BUNDLES__',loads);
const file=path.join(os.tmpdir(),'lumaui-collection-integration-'+Date.now()+'.lua');
fs.writeFileSync(file,script);
try{const r=cp.spawnSync(process.execPath,[require.resolve('fengari-node-cli/src/lua-cli.js'),file],{encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);if(r.status!==0||r.stderr){const line=Number(r.stderr.match(/lua:(\d+):/)?.[1]);console.log(script.split('\n').slice(Math.max(0,line-4),line+3).map((s,i)=>(Math.max(0,line-4)+i+1)+': '+s).join('\n'));process.exitCode=1;}}finally{fs.unlinkSync(file);}

})().catch(error => { console.error(error); process.exitCode = 1; });
