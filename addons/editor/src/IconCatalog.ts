import { iconCatalogData } from "./data/IconCatalog";
import type { SearchChoice } from "./SearchDropdown";
interface CatalogIcon { id: number; name: string; kinds: string; search: string; }
let entries: CatalogIcon[] | undefined, byId: Map<number,CatalogIcon> | undefined;
function catalog(): CatalogIcon[] {
    if(entries!==undefined)return entries;
    entries=[];byId=new Map();
    for(const chunk of iconCatalogData())for(const row of chunk.split("\n")){
        const [value,name,aliases,kinds]=row.split("\t"),id=Number(value);
        const item={id,name,kinds,search:(name+" "+aliases+" "+kinds+" "+id).toLowerCase()};entries.push(item);byId.set(id,item);
    }return entries;
}
export function iconChoice(value: string): SearchChoice {
    catalog();const id=Number(value),entry=byId!.get(id);
    const numeric=Number.isInteger(id)&&id>0;
    return {value,label:entry?.name??(numeric?"Icon #"+value:value),detail:entry?.kinds??"Custom texture",icon:numeric?id:value,hint:(entry?.name??value)+(numeric?" · Texture FileDataID "+id:"")};
}
export function searchIcons(query:string,excluded:readonly string[],limit=48):SearchChoice[]{
    const tokens=query.trim().toLowerCase().split(" ").filter(value=>value!=="");if(tokens.length===0)return [];
    const selected=new Set(excluded),result:SearchChoice[]=[];
    for(const item of catalog())if(!selected.has(String(item.id))&&tokens.every(token=>item.search.includes(token))){result.push(iconChoice(String(item.id)));if(result.length>=limit)break;}return result;
}
