import { UI } from "wuira";
import { Cell, FlowLayout, Label, TextInput, Border, Background } from "wuira/ui";
import type { FormState } from "./InspectorControls";
import { ArrayInput } from "./ArrayInput";
import { iconChoice, searchIcons } from "./IconCatalog";
import { Core } from "./core";
export function IconField({state,name,title,width}:{state:FormState;name:string;title:string;width:number}){
    let raw=state.values[name]??"";const colors=Core.Theme.colors;
    return <FlowLayout width={width} height={150} gap={3}>
        <Label width={width} height={17} text={title} fontSize={10}/>
        <Cell width={width} height={86} onMount={()=>state.Capture(name,()=>raw)}>
            <ArrayInput width={width} single values={raw===""?[]:[raw]} describe={iconChoice} placeholder="Search spell or item icons"
                provider={selected=>({Search:query=>searchIcons(query,selected)})}
                onChange={next=>{raw=next[0]??"";state.Flush();state.values[name]=raw;}}/>
        </Cell>
        <Label width={width} height={13} text="Custom texture path (optional override)" fontSize={9} color={colors.muted}/>
        <Cell width={width} height={25} decorations={{background:new Background({color:colors.background}),border:new Border({color:colors.border,thickness:1})}} onMount={frame=>{
            const input=new TextInput(frame,{text:raw.trim() !== "" && Number.isInteger(Number(raw)) && Number(raw) > 0?"":raw,maxBytes:4096});
            const native=input.Frame as typeof input.Frame & {SetScript(script:"OnTextChanged",handler:(()=>void)|undefined):void};
            native.SetScript("OnTextChanged",()=>{raw=input.Value;state.Flush();state.values[name]=raw;});
            return()=>{native.SetScript("OnTextChanged",undefined);input.Dispose();};
        }}/>
    </FlowLayout>;
}
