import { CaseFields, OutputFields } from "./ConverterFields";
import { UI } from "wuira";
import type { Cell as View } from "wuira";
import { FlowLayout, Label, Cell, Background, Border } from "wuira/ui";
import type { EditorDraft } from "./Draft";
import type { SourceEditor } from "./SourceEditor";
import { Core } from "./core";
import { Dropdown } from "./Dropdown";
import { Action, Field, Toggle, Heading, Note, Input, ScrollForm, colors, friendly, sourceType } from "./InspectorControls";

function SourceCard({ draft, state, width: outerWidth }: { draft: EditorDraft; state: SourceEditor; width: number }) {
    const width = Math.max(80, outerWidth-20);
    const rules = Core.Presets.SourceProperties(state.type);
    const rows: View[] = [
        <Heading text={state.original ?? "New source"} width={width} />,
        <Label height={20} text={sourceType(state.type)} fontSize={11} color={colors.muted} />,
    ];
    if (state.original === undefined) {
        rows.push(<Label height={18} text="Source name" fontSize={10} />);
        rows.push(<Input state={state} name="$name" value={state.name} width={width} />);
        rows.push(<Dropdown width={width} text={sourceType(state.type)} options={Core.Presets.SourceTypes().map(value => ({ label: sourceType(value), value }))} onSelect={value => state.Type(value)} />);
    }
    if (Object.keys(rules).length === 0) rows.push(<Note width={width} text="This source does not need configuration." />);
    if (state.type === "unitToBool") rows.push(<Note width={width} text="Unit → boolean filter. Conditions combine with AND; NPC ID and class lists match any entry. Empty conditions match every public unit. Classes use comma-separated tokens. Secret or missing data never matches." />);
    rows.push(<Action width={width} text={(state.isProp ? "[x] " : "[ ] ") + "Expose as prop"} onClick={() => state.Expose(!state.isProp)} />);
    if (state.isProp) { rows.push(<Action width={width} text={(state.optional ? "[x] " : "[ ] ") + "Optional input"} onClick={() => state.SetOptional(!state.optional)} />); rows.push(<Note width={width} text="Empty source input. Bind an existing parent source from the component reference inspector. No datasource is constructed here." />); }
    for (const [key, rule] of Object.entries(state.isProp ? {} : rules)) {
        if (rule.type === "cases") { rows.push(<CaseFields state={state} width={width} />); continue; }
        if (rule.type === "value") { rows.push(<OutputFields state={state} prefix={key} title={key === "default" ? "Default output (no match)" : friendly(key)} width={width} optional />); continue; }
        if (key === "source") {
            rows.push(<Label width={width} height={17} text="Input source" fontSize={10} />);
            rows.push(<Dropdown width={width} text={state.values.source ?? "Choose source"} options={draft.sources.filter(source => source.name !== state.original).map(source => ({ label: source.name + " · " + sourceType(source.type), value: source.name }))} onSelect={value => state.Set("source", value)} />);
            continue;
        }
        const title = key === "healPrediction" ? "Track incoming heals" : key === "absorbPrediction" ? "Track absorbs" : friendly(key);
        rows.push(rule.type === "boolean" ? <Toggle state={state} name={key} title={title} width={width} /> : <Field state={state} name={key} title={title} rule={rule} width={width} />);
        if (key === "path") rows.push(<Note width={width} text="Optional field inside the input value, e.g. token for a Class source. Empty uses the whole value." />);
        if (key === "expression") rows.push(<Note width={width} text="Example: 2 * input. Operators: + - * / % ^ and parentheses." />);
        if (key === "selectors") rows.push(<Note width={width} text={'Filters, e.g. "Seal*", /^Blessing of .*/i. Empty means all known active spells.'} />);
        if (key === "unit") rows.push(<Note width={width} text="Default: player. In a repeated member template, use $unit or $pet." />);
    }
    rows.push(<FlowLayout width={width} height={28} direction="horizontal" gap={6}>
        <Action width={width - 82} text={state.original === undefined ? "Create source" : "Update source"} onClick={() => state.Save()} />
        <Action width={76} text="Delete" onClick={() => state.Delete()} />
    </FlowLayout>);
    return <FlowLayout width={outerWidth} height={0} sizing="content" gap={8} padding={10}
        decorations={{background:new Background({color:colors.background}),border:new Border({thickness:1,color:colors.border})}}>{rows}</FlowLayout>;
}
export function SourceInspector({ draft, width, height }: { draft: EditorDraft; width: number; height: number }) {
    const state = draft.sourceEditor, w = width - 12;
    if (draft.sources.length === 0 && state.name === "") state.Open(undefined, false);
    const forms = draft.sources.map(source => state.For(source.name));
    if (state.original === undefined && state.name !== "") forms.push(state);
    const rows = forms.map(form => <SourceCard draft={draft} state={form} width={w} />);
    return <FlowLayout width={width} height={height} gap={6}>
        <FlowLayout width={width} height={28} direction="horizontal" gap={8}>
            <Label width={width - 124} height={28} text="Component sources" fontSize={12} color={colors.accent} />
            <Action width={116} text="New source" onClick={() => state.BeginNew()} />
        </FlowLayout>
        <ScrollForm width={width} height={height - 68} rows={rows} offset={state.scroll} remember={offset => { state.scroll = offset; }} gap={12} />
        <Action width={width} text="Update all sources" onClick={() => state.SaveAll()} />
    </FlowLayout>;
}
