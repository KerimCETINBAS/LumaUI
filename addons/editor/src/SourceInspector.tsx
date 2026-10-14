import { UI } from "wuira";
import type { Cell as View } from "wuira";
import { FlowLayout, Label } from "wuira/ui";
import type { EditorDraft } from "./Draft";
import { Core } from "./core";
import { Dropdown } from "./Dropdown";
import { Action, Field, Toggle, Heading, Note, Input, ScrollForm, colors, friendly, sourceType } from "./InspectorControls";
export function SourceInspector({ draft, width, height }: { draft: EditorDraft; width: number; height: number }) {
    const state = draft.sourceEditor; const rules = Core.Presets.SourceProperties(state.type); const w = width - 8;
    const rows: View[] = [<Heading text="Source settings" width={w} />];
    rows.push(<Label height={18} text="Source name" fontSize={11} />);
    rows.push(state.original === undefined ? <Input state={state} name="$name" value={state.name} width={w} /> : <Label height={28} text={state.name} fontSize={12} color={colors.accent} />);
    rows.push(<Label height={18} text="Source type" fontSize={11} />);
    rows.push(state.original === undefined ? <Dropdown width={w} text={sourceType(state.type)} options={Core.Presets.SourceTypes().map(value => ({label:sourceType(value),value}))} onSelect={value => state.Type(value)} /> : <Label height={28} text={sourceType(state.type)} fontSize={12} />);
    rows.push(<Heading text="Read from the game" width={w} />);
    if (Object.keys(rules).length === 0) rows.push(<Note width={w} text="This source does not need configuration." />);
    for (const [key, rule] of Object.entries(rules)) {
        const title = key === "healPrediction" ? "Track incoming heals" : key === "absorbPrediction" ? "Track absorbs" : friendly(key);
        rows.push(rule.type === "boolean" ? <Toggle state={state} name={key} title={title} width={w} /> : <Field state={state} name={key} title={title} rule={rule} width={w} />);
        if (key === "unit") rows.push(<Note width={w} text="Default: player. Also target, focus, party1..." />);
        if (rule.type === "numbers") rows.push(<Note width={w} text="Separate spell IDs with commas." />);
    }
    return <FlowLayout width={width} height={height} gap={6}>
        <Label height={24} text="Collection sources" fontSize={12} color={colors.accent} />
        <Dropdown width={width} text={state.original ?? "New source"} options={[{label:"New source",value:""},...draft.sources.map(source=>({label:source.name,value:source.name}))]} onSelect={value => state.Open(value === "" ? undefined : value)} />
        <ScrollForm width={width} height={height - 96} rows={rows} offset={state.scroll} remember={offset => { state.scroll = offset; }} />
        <FlowLayout height={28} direction="horizontal" gap={6}>
            <Action width={width - 156} text="Save source" onClick={() => state.Save()} />
            <Action width={86} text="New source" onClick={() => state.Open()} />
            <Action width={58} text="Delete" onClick={() => state.Delete()} />
        </FlowLayout>
    </FlowLayout>;
}
