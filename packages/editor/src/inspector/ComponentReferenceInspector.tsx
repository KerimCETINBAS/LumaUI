import { UI } from "wuira/ui";
import type { Cell } from "wuira/ui";
import { FlowLayout } from "wuira/ui";
import type { EditorDraft } from "../draft/Draft";
import { Core } from "../core";
import { IconButton } from "../chrome/IconButton";
import { Dropdown } from "../fields/Dropdown";
import { InspectorSections, Action, Field, Heading, Note, ScrollForm, sourceType } from "../fields/InspectorControls";
export function ComponentReferenceInspector({ draft, width, height }: { draft: EditorDraft; width: number; height: number }) {
    const node = draft.Selected, document = draft.dependencies.find(doc => doc.id === node.preset) ?? Core.Presets.Get(node.preset!);
    const state = draft.propertyEditor, w = width - 36; state.Ensure();
    if (!["Display", "Data"].includes(state.panel)) state.panel = "Display";
    const rows: Cell[] = [<Heading width={w} text="Component instance" />,
        <Dropdown width={w} text={document?.name ?? "Missing component: " + node.preset}
            options={Core.Presets.List().filter(doc => doc.id !== draft.documentId).map(doc => ({label:doc.name,value:doc.id}))} onSelect={id => draft.ReplacePreset(id)} />,
        <Note width={w} text="These settings affect this instance only. Defaults come from the shared library component." />];
    if (draft.HasUnsavedChanges) rows.push(<Note width={w} text="Save parent edits before opening the child definition." />);
    rows.push(<Action width={w} text="Edit component definition" onClick={() => draft.OpenReference()} />);
    if (state.panel === "Display") {
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
    }
    if (state.panel === "Data") {
    if (draft.ReferenceUnitAvailable()) {
        const units = (document?.sources ?? []).filter(source => !source.isProp && typeof source.props.unit === "string").map(source => source.props.unit);
        const bound = Object.values(node.sourceProps ?? {});
        const row = units.includes("$unit") || bound.includes("parent.$unit") ? "$unit" : units.includes("$pet") || bound.includes("parent.$pet") ? "$pet" : "";
        rows.push(<Heading width={w} text="Row unit" />);
        rows.push(<Dropdown width={w} text={row === "$unit" ? "Current member" : row === "$pet" ? "Member pet" : "Not connected"}
            options={[{ label: "Not connected", value: "" }, { label: "Current member", value: "$unit" }, { label: "Member pet", value: "$pet" }]}
            onSelect={value => draft.UseRowUnit(value === "$pet" ? "$pet" : value === "$unit" ? "$unit" : "")} />);
        rows.push(<Note width={w} text="Feeds this component's health, power, and other unit fields from the repeated member. A class input cannot take that unit, so those fields are retargeted and the class input becomes optional. Save to apply." />);
    }
    rows.push(<Heading width={w} text="Data inputs" />);
    for (const input of document?.sources.filter(source=>source.isProp) ?? []) {
        rows.push(<Note width={w} text={input.name + " · " + sourceType(input.type) + (input.optional ? " · optional" : " · required")} />);
        const binding = node.sourceProps?.[input.name];
        const key = "$input." + input.name;
        const error = state.connectionErrors[input.name] ?? draft.ReferenceSourceError(input.name, state.values[key] ?? binding);
        if (error !== undefined) rows.push(<Note width={w} text={error} />);
        if (state.connectionErrors[input.name] !== undefined) rows.push(<Action width={w} text={"Dismiss error: " + input.name} onClick={()=>state.DismissConnectionError(input.name)} />);
        rows.push(<Dropdown width={w} text={binding ?? "Not connected"}
            options={[{label:"Not connected",value:""}, ...(draft.ReferenceContextCompatible("parent.$unit", input.type) ? [{ label: "Current member", value: "parent.$unit" }, { label: "Member pet", value: "parent.$pet" }] : []), ...(draft.ReferenceContextCompatible("parent.$item", input.type) ? [{ label: "List item", value: "parent.$item" }] : []), ...draft.sources.filter(source=>Core.Presets.SourcesCompatible(source.type,input.type)).map(source=>({label:source.name + " · " + source.type,value:source.name}))]}
            onSelect={value => draft.SetReferenceSource(input.name, value)} />);
        if (["hp", "mana", "power", "aura", "cast"].includes(input.type)) rows.push(<Note width={w} text="This input is derived. Inside the component, add a UnitSource on Current member, then a source of this type. The connection type stays unchanged." />);
    }
    if (!document?.sources.some(source=>source.isProp)) rows.push(<Note width={w} text="This component exposes no source inputs. Mark a source as Expose as prop in its own Sources panel." />);
    for (const name of Object.keys(node.sourceProps ?? {})) if (!document?.sources.some(source => source.isProp && source.name === name)) {
        rows.push(<Note width={w} text={"Missing input: " + name} />);
        rows.push(<Action width={w} text={"Remove obsolete binding: " + name} onClick={() => draft.SetReferenceSource(name, "")} />);
    }
    }
    if (state.panel === "Display" && document !== undefined && draft.IsVisual(node)) {
        rows.push(<Heading width={w} text="Layout" />);
        for (const name of ["width","height","x","y","alpha"]) if (state.Rules[name] !== undefined) rows.push(<Field state={state} name={name} title={name} rule={state.Rules[name]} width={w} />);
        rows.push(<Action width={w} text="Update layout" onClick={()=>state.Save()} />);
    }
    rows.push(<Action width={w} text="Delete reference" onClick={()=>draft.Remove()} />);
    return <FlowLayout width={width} height={height} gap={6}>
        <FlowLayout width={width} height={28} direction="horizontal" gap={4}>
            {["Display", "Data"].map(panel => <IconButton width={(width - 4) / 2} height={28} text={panel} icon={panel === "Data" ? "sources" : "visuals"} quiet active={state.panel === panel} onClick={() => state.Section(panel)} />)}
        </FlowLayout>
        <ScrollForm width={width} height={height - 34} rows={InspectorSections(rows,width-16)} gap={12} offset={state.scroll["reference" + state.panel] ?? 0} remember={value=>{state.scroll["reference" + state.panel]=value;}} />
    </FlowLayout>;
}
