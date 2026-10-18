import { UI } from "wuira/ui";
import { Cell, FlowLayout, Label } from "wuira/ui";
import type { FormState } from "./InspectorControls";
import type { PlayerAction, PlayerActionList } from "lumaui/core";
import type { SearchChoice } from "./SearchDropdown";
import { ArrayInput } from "./ArrayInput";
import { Core } from "../core";
export function allowedCharacterAction(item:PlayerAction):boolean {return item.category==="spell"||item.category==="consumable"||item.category==="item"&&item.equipped===true;}
function choice(item:PlayerAction):SearchChoice{return {value:item.key,label:item.name,detail:(item.category==="spell"?"Spell":item.category==="consumable"?"Consumable":"Equipped item")+(item.detail===undefined?"":" · "+item.detail),icon:item.icon};}
export function CharacterActionField({state,width}:{state:FormState;width:number}){
    let catalog:PlayerActionList|undefined,stop:(()=>void)|undefined,revision=0;
    const type=state.values["action.type"],raw=state.values["action."+type]??"",selected=raw===""?[]:[type+":"+raw];
    const items=()=>catalog?.Value.filter(allowedCharacterAction)??[];
    return <FlowLayout width={width} height={112} gap={3}>
        <Label width={width} height={20} text="Character action" fontSize={11}/>
        <Cell width={width} height={86} onMount={()=>{catalog=Core.Helpers.PlayerActions();stop=catalog.onChange(()=>{revision++;});return()=>{stop?.();catalog?.Dispose();catalog=undefined;};}}>
            <ArrayInput width={width} single values={selected} placeholder="Search learned spells, gear or consumables"
                describe={key=>{const item=items().find(item=>item.key===key);return item===undefined?{value:key,label:raw||"Existing action",detail:"Existing selection"}:choice(item);}}
                provider={()=>({Revision:()=>revision,Search:query=>{
                    const tokens=query.trim().toLowerCase().split(" ").filter(token=>token!=="");
                    return items().filter(item=>tokens.every(token=>(item.name+" "+(item.detail??"")+" "+item.category).toLowerCase().includes(token))).slice(0,48).map(choice);
                }})}
                onChange={next=>{state.Flush();const item=items().find(item=>item.key===next[0]);
                    if(item===undefined){state.Set("action."+type,"");return;}
                    const action=item.action,kind=action.spellId!==undefined?"spell":"item";
                    for(const key of ["spell","item","macro","slot"])state.values["action."+key]="";
                    state.values["action."+kind]=String(action.spellId??action.itemId);state.Set("action.type",kind);
                }}/>
        </Cell>
    </FlowLayout>;
}
