const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),z=require('node:zlib');
const {decodeCBOR}=require('./cbor.cjs');
const load=id=>decodeCBOR(z.inflateRawSync(Buffer.from(fs.readFileSync(path.join(__dirname,'../presets',id+'.luma.txt'),'utf8').trim().slice(8),'base64')));
test('Player and target imports preserve the party cell with independent fixed-unit data',()=>{
 const party=load('paladin-party');
 for(const unit of ['player','target']){
  const payload=load(unit+'-unit-frame'),doc=payload.document;
  assert.equal(doc.id,unit+'-unit-frame');assert.equal(doc.condition,undefined);assert.equal(doc.class,party.document.class);
  assert.deepEqual(payload.clickCastPresets,party.clickCastPresets);assert.deepEqual(payload.bindings,[]);
  assert.equal(doc.root.props.unitWatch,true);assert.equal(doc.root.props.unit,unit);
  const normalized=structuredClone(doc.root);
  for(const key of ['mode','anchor','x','y'])delete normalized.props[key];
  const replace=v=>typeof v==='string'?v===unit?'$unit':v:Array.isArray(v)?v.map(replace):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,replace(x)])):v;
  assert.deepEqual(replace(normalized),party.document.root.children[0]);
  assert.deepEqual(replace(doc.sources),party.document.sources.filter(s=>s.type!=='groupMembers'&&s.name!=='petHealth'));
  assert.ok(!JSON.stringify(doc).includes('$unit')&&!JSON.stringify(doc).includes('$pet'));
 }
});
