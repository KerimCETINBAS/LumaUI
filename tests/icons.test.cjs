const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");

test("SVG glyphs render as transparent native textures and are included in standalone addon output",async()=>{
 const {iconSources,iconManifest,renderIcon}=await import("../tools/build-icons.mjs");
 const sources=iconSources();
 assert.ok(sources.length>=40);
 const manifest=JSON.parse(iconManifest(sources).match(/export const IconTextures = ([\s\S]+) as const;/)[1]);
 for(const {name,svg} of sources){
  const tga=renderIcon(svg);
  assert.equal(tga.length,18+32*32*4,name);
  assert.equal(tga[2],2);assert.equal(tga.readUInt16LE(12),32);assert.equal(tga.readUInt16LE(14),32);
  assert.equal(tga[16],32);assert.equal(tga[17],8);
  let transparent=false,opaque=false,partial=false;
  for(let offset=18;offset<tga.length;offset+=4){
   assert.deepEqual([...tga.subarray(offset,offset+3)],[255,255,255],name+" white tint mask");
   const alpha=tga[offset+3];transparent ||=alpha===0;opaque ||=alpha===255;partial ||=alpha>0&&alpha<255;
  }
  assert.ok(transparent&&opaque&&partial,name+" has a nonempty antialiased glyph and a clear background");
  const expected=["Interface","AddOns","LumaUI","media","icons",name+".tga"].join(String.fromCharCode(92));
  assert.equal(manifest[name],expected,"single-separator native texture path");
  assert.deepEqual(fs.readFileSync(path.resolve(__dirname,"../dist/LumaUI/media/icons",name+".tga")),tga,"packaged "+name);
 }
 const generated=fs.readFileSync(path.resolve(__dirname,"../packages/core/src/theme/icons.ts"),"utf8").replaceAll("\r\n","\n");
 assert.equal(generated,iconManifest(sources),"theme catalog matches packaged textures");
 const top=renderIcon('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="6" fill="white"/></svg>');
 assert.equal(top[21],0,"bottom-origin TGA first row is the empty bottom");
 assert.equal(top[18+(31*32)*4+3],255,"top edge remains at the top");
 assert.throws(()=>renderIcon('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"/>'),/square/);
});
