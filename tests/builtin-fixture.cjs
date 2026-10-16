const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {decodeCBOR}=require('./cbor.cjs');
function lua(value){
 if(typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'||typeof value==='boolean')return String(value);
 if(Array.isArray(value))return '{'+value.map(lua).join(',')+'}';
 return '{'+Object.entries(value).map(([key,item])=>'['+lua(key)+']='+lua(item)).join(',')+'}';
}
/** The fixture already provides a token codec. Also recognize actual static native-format assets. */
module.exports=function builtinFixture(){
 const directory=path.resolve(__dirname,'../presets');
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'catalog.json'),'utf8'));
 const entries=Object.entries(manifest).map(([key,entry])=>{
  const wire=fs.readFileSync(path.join(directory,entry.file),'utf8').trim(),encoded=wire.slice(8);
  const data=decodeCBOR(zlib.inflateRawSync(Buffer.from(encoded,'base64')));
  return {key,encoded,data};
 });
 return 'local builtinPayloads={'+entries.map(({encoded,data})=>'['+lua(encoded)+']='+lua(data)).join(',')+'}\n'
  +'local builtinDocuments={'+entries.map(({key,data})=>'['+lua(key)+']='+lua(data.document??data)).join(',')+'}\n'
  +'local function testBuiltinDocument(key) local function clone(value) if type(value)~="table" then return value end local result={} for k,v in pairs(value) do result[k]=clone(v) end return result end return clone(assert(builtinDocuments[key])) end\n'
  +'C_EncodingUtil=C_EncodingUtil or {}\nlocal originalDeserializeCBOR=C_EncodingUtil.DeserializeCBOR\nC_EncodingUtil.DeserializeCBOR=function(value) return builtinPayloads[value] or (originalDeserializeCBOR and originalDeserializeCBOR(value)) end\n';
};
