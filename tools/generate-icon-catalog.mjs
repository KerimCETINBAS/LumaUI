import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { root } from "./config.mjs";
const require = createRequire(import.meta.url);
export function readIconCatalog(sdk = path.dirname(require.resolve("wuira/package.json"))) {
    const file=path.join(sdk,"data/icons/forever.json");
    if(!fs.existsSync(file)) throw new Error("Installed wuira has no icon catalog; update the SDK or use --package <packed SDK directory> to validate an unreleased package.");
    const catalog=JSON.parse(fs.readFileSync(file,"utf8"));
    if(catalog.version!==1||catalog.product!=="wow_classic_beta")throw new Error("Unsupported icon catalog");
    return catalog.icons.map(([id,name,aliases,kinds])=>({id,name,aliases,kinds})).sort((a,b)=>a.name.localeCompare(b.name,"en")||a.id-b.id);
}
export function iconCatalogSource(entries=readIconCatalog()) {
    const chunks=[];
    for(let index=0;index<entries.length;index+=128)chunks.push(entries.slice(index,index+128).map(entry=>[entry.id,entry.name,entry.aliases.join(" | "),entry.kinds.join(" / ")].map(value=>String(value).replace(/[\t\n\r]/g," ")).join("\t")).join("\n"));
    return "// Auto generated. Do not edit.\n// Source: packaged wuira/data/icons/forever.json\n\nexport const IconCatalogCount = "+entries.length+";\nexport function iconCatalogData(): readonly string[] {\n    return "+JSON.stringify(chunks,null,4)+";\n}\n";
}
export function generateIconCatalog(check=false,sdk){
    const entries=readIconCatalog(sdk),source=iconCatalogSource(entries),output=path.join(root,"addons/editor/src/data/IconCatalog.ts");
    if(check){if(!fs.existsSync(output)||fs.readFileSync(output,"utf8").replaceAll("\r\n","\n")!==source)throw new Error("Icon catalog is stale; run npm run catalogs:generate");}
    else{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,source);}return entries.length;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log("Editor icon catalog: "+generateIconCatalog(process.argv.includes("--check"),process.argv.includes("--package")?path.resolve(process.argv[process.argv.indexOf("--package")+1]):undefined));
