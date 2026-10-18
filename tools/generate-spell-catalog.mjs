import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { root } from "./config.mjs";
const require = createRequire(import.meta.url);
export function readSpellCatalog(sdk = path.dirname(require.resolve("wuira/package.json"))) {
    const catalog = JSON.parse(fs.readFileSync(path.join(sdk, "data/spells/forever.json"), "utf8"));
    if (catalog.version !== 1 || catalog.product !== "wow_classic_beta") throw new Error("Unsupported spell catalog");
    return catalog.spells.map(([id,name,rank,category]) => ({ id, name, rank, group: category.replace(/Spells$/, "") }))
        .sort((a,b) => a.group.localeCompare(b.group,"en") || a.name.localeCompare(b.name,"en") || a.rank.localeCompare(b.rank,"en") || a.id-b.id);
}
export function spellCatalogSource(entries = readSpellCatalog()) {
    const chunks = [];
    for (let index=0;index<entries.length;index+=256) chunks.push(entries.slice(index,index+256).map(entry => [entry.id,entry.name,entry.rank,entry.group].map(value=>String(value).replace(/[\t\n\r]/g," ")).join("\t")).join("\n"));
    return "// Auto generated. Do not edit.\n// Source: packaged wuira/data/spells/forever.json\n\n"
        + "export const SpellCatalogCount = " + entries.length + ";\n"
        + "export function spellCatalogData(): readonly string[] {\n    return " + JSON.stringify(chunks,null,4) + ";\n}\n";
}
export function generateSpellCatalog(check = false, sdk) {
    const entries=readSpellCatalog(sdk), source=spellCatalogSource(entries), output=path.join(root,"addons/editor/src/catalogs/data/SpellCatalog.ts");
    if(check) { if(!fs.existsSync(output)||fs.readFileSync(output,"utf8").replaceAll("\r\n","\n")!==source)throw new Error("Spell catalog is stale; run npm run catalogs:generate"); }
    else {fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,source);}
    return entries.length;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log("Editor spell catalog: " + generateSpellCatalog(process.argv.includes("--check"), process.argv.includes("--package") ? path.resolve(process.argv[process.argv.indexOf("--package")+1]) : undefined));
