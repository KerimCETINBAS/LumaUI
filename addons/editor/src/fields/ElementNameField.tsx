import { UI } from "wuira/ui";
import { Cell, FlowLayout, TextInput } from "wuira/ui";
import type { EditorDraft } from "../draft/Draft";
import { describeNode } from "../chrome/NodePresentation";
import { Action, Note } from "./InspectorControls";
type RenameInput = TextInput["Frame"] & { SetScript(script: "OnEnterPressed", handler: ((this:void)=>void) | undefined): void };
export function ElementNameField({draft,width}:{draft:EditorDraft;width:number}) {
    if (draft.nodeRenameID === undefined) return <Action width={width} text="Rename element" onClick={()=>draft.StartNodeRename(draft.selected,describeNode(draft,draft.Selected).title)} />;
    return <FlowLayout width={width} height={94} gap={4}>
        <Note width={width} text="Element name · its ID and bindings stay unchanged" />
        <Cell width={width} height={28} onMount={frame=>{
            const input=new TextInput(frame,{text:draft.nodeRenameValue,maxBytes:384,onEscape:()=>draft.CancelNodeRename()});
            const detach=draft.CaptureNodeRename(()=>input.Value),native=input.Frame as RenameInput;
            native.SetScript("OnEnterPressed",()=>draft.FinishNodeRename());input.Focus(true);
            return ()=>{detach();native.SetScript("OnEnterPressed",undefined);input.Dispose();};
        }} />
        <FlowLayout width={width} height={28} direction="horizontal" gap={6}>
            <Action width={(width-6)/2} text="Apply name" onClick={()=>draft.FinishNodeRename()} />
            <Action width={(width-6)/2} text="Cancel" onClick={()=>draft.CancelNodeRename()} />
        </FlowLayout>
    </FlowLayout>;
}
