const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
// Decode the portable bytes independently from the exporter's constructor/transport fixture.
const {decodeCBOR}=require('./cbor.cjs');

test('Starter files contain bounded CBOR, raw Deflate, dependencies and no character keys',()=>{
 for(const id of ['player','paladin-party','paladin-raid','blizzard']){
  const wire=fs.readFileSync(path.resolve(__dirname,'../presets',id+'.luma.txt'),'utf8').trim();
  assert.match(wire,/^!LUMA:[13]!/);const bytes=zlib.inflateRawSync(Buffer.from(wire.slice(8),'base64'));assert.ok(bytes.length<262144);
  const decoded=decodeCBOR(bytes),document=decoded.document??decoded;assert.equal(document.id,id==='blizzard'?'default-blizzard':id);
  if(id.startsWith('paladin')){assert.equal(decoded.bindings.length,0);assert.equal(decoded.clickCastPresets.length,3);assert.equal(document.root.type,'foreach');}
  if(id==='player')assert.equal(document.dependencies[0].id,'hide-player-frame');
 }
});

test('BuiltinPresets embeds only the canonical strings and is current',async()=>{
 const root=path.resolve(__dirname,'..');
 const source=fs.readFileSync(path.join(root,'addons/core/src/BuiltinPresets.ts'),'utf8');
 const values=JSON.parse(source.match(/export const BuiltinPresets = ([\s\S]*?) as const;/)[1]);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'presets/catalog.json'),'utf8'));
 assert.deepEqual(Object.keys(values),Object.keys(manifest));
 for(const [key,entry] of Object.entries(manifest)){
  assert.equal(typeof values[key],'string');
  assert.equal(values[key],fs.readFileSync(path.join(root,'presets',entry.file),'utf8').trim());
 }
 const {generateBuiltinPresets}=await import('../tools/generate-builtin-presets.mjs');
 assert.equal(generateBuiltinPresets(true),4);
});
