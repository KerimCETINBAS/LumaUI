import { UI } from "wuira";
import type { Cell } from "wuira";
import type { EditorDraft } from "./Draft";
import { Core } from "./core";
import { Dropdown } from "./Dropdown";
import { Action, Field, Heading, Note, ScrollForm } from "./InspectorControls";
export function ComponentReferenceInspector({ draft, width, height }: { draft: EditorDraft; width: number; height: number }) {
    const node = draft.Selected, document = draft.dependencies.find(doc => doc.id === node.preset) ?? Core.Presets.Get(node.preset!);
    const state = draft.propertyEditor, w = width - 12;
    const rows: Cell[] = [<Heading width={w} text="Component instance" />,
        <Dropdown width={w} text={document?.name ?? "Missing component: " + node.preset}
            options={Core.Presets.List().filter(doc => doc.id !== draft.documentId).map(doc => ({label:doc.name,value:doc.id}))} onSelect={id => draft.ReplacePreset(id)} />,
        <Note width={w} text="These settings affect this instance only. Defaults come from the shared library component." />];
    const settings = [
        { key: "enabled", title: "Activation mode", options: [{label:"Condition met",value:"condMet"},{label:"Always",value:"always"},{label:"Never",value:"never"}] },
        { key: "class", title: "Player class", options: [{label:"Any class",value:""}, ...["WARRIOR","PALADIN","HUNTER","ROGUE","PRIEST","SHAMAN","MAGE","WARLOCK","DRUID"].map(value=>({label:value,value}))] },
        { key: "condition", title: "Load condition", options: [{label:"Any time",value:""},{label:"In party",value:"inParty"},{label:"In raid",value:"inRaid"},{label:"In group",value:"inGroup"},{label:"Solo",value:"solo"}] },
        { key: "layout", title: "Native layout", options: [{label:"Any layout",value:""}, ...(Core.Presets.Layouts.Status === "ready" ? Core.Presets.Layouts.Layouts : []).map(layout=>({label:layout.name,value:layout.key}))] },
    ];
    for (const setting of settings) {
        const selected = (node.activation as Record<string,string> | undefined)?.[setting.key];
        rows.push(<Heading width={w} text={setting.title} />);
        rows.push(<Dropdown width={w} text={selected === undefined ? "Use component default" : setting.options.find(item=>item.value===selected)?.label ?? selected}
            options={[{label:"Use component default",value:"$inherit"},...setting.options]} onSelect={value=>draft.SetReferenceActivation(setting.key,value)} />);
    }
    rows.push(<Heading width={w} text="Data inputs" />);
    for (const input of document?.sources.filter(source=>source.isProp) ?? []) {
        rows.push(<Note width={w} text={input.name + " · " + input.type + (input.optional ? " · optional" : " · required")} />);
        rows.push(<Dropdown width={w} text={node.sourceProps?.[input.name] ?? "Not connected"}
            options={[{label:"Not connected",value:""},...draft.sources.filter(source=>source.type===input.type).map(source=>({label:source.name,value:source.name}))]}
            onSelect={value=>draft.SetReferenceSource(input.name,value)} />);
    }
    if (!document?.sources.some(source=>source.isProp)) rows.push(<Note width={w} text="This component exposes no source inputs. Mark a source as Expose as prop in its own Sources panel." />);
    if (document !== undefined && draft.IsVisual(node)) {
        rows.push(<Heading width={w} text="Layout" />);
        for (const name of ["width","height","x","y","alpha"]) if (state.Rules[name] !== undefined) rows.push(<Field state={state} name={name} title={name} rule={state.Rules[name]} width={w} />);
        rows.push(<Action width={w} text="Update layout" onClick={()=>state.Save()} />);
    }
    rows.push(<Action width={w} text="Delete reference" onClick={()=>draft.Remove()} />);
    return <ScrollForm width={width} height={height} rows={rows} offset={state.scroll.reference ?? 0} remember={value=>{state.scroll.reference=value;}} />;
}
