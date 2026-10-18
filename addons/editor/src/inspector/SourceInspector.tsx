import { CaseFields, OutputFields } from "../fields/ConverterFields";
import { UI } from "wuira/ui";
import type { Cell as View } from "wuira/ui";
import { FlowLayout, Label, Cell, Background, Border } from "wuira/ui";
import type { EditorDraft } from "../draft/Draft";
import type { SourceEditor } from "../property/SourceEditor";
import { Core } from "../core";
import { Dropdown } from "../fields/Dropdown";
import { UnitChoice } from "../fields/UnitChoice";
import { Action, Field, Toggle, Heading, Note, Input, ScrollForm, colors, friendly, sourceType } from "../fields/InspectorControls";

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
    if (state.original !== undefined) {
        if (state.isProp) {
            rows.push(<Dropdown width={width} text={sourceType(state.type)} options={Core.Presets.SourceTypes().map(value => ({ label: sourceType(value), value }))} onSelect={value => state.Type(value)} />);
            rows.push(<Note width={width} text="Input type is part of this component's public contract. Parent connections must provide compatible sources." />);
        }
        rows.push(<Action width={width} text="Rename source" onClick={() => { state.Flush(); state.renameName = state.original!; state.renaming = !state.renaming; Core.RefreshCustomization(); }} />);
        if (state.renaming) {
            rows.push(<Input state={state} name="$rename" value={state.renameName} width={width} />);
            rows.push(<Note width={width} text="Update references too? Input renames also update callers when the component is saved." />);
            rows.push(<Action width={width} text="Yes · update references" onClick={() => state.Rename(true)} />);
            rows.push(<Action width={width} text="No · keep old references" onClick={() => state.Rename(false)} />);
        }
    }
    if (Object.keys(rules).length === 0) rows.push(<Note width={width} text="This source does not need configuration." />);
    if (state.type === "repeatItem") rows.push(<Note width={width} text="Receives the current Repeat item. In the parent reference Data tab, choose or type parent.$item (or the visible Repeat name followed by .$item)." />);
    if (state.type === "unitToBool") rows.push(<Note width={width} text="Unit → boolean filter. Conditions combine with AND; NPC ID and class lists match any entry. Empty conditions match every public unit. Classes use comma-separated tokens. Secret or missing data never matches." />);
    rows.push(<Action width={width} text={(state.isProp ? "[x] " : "[ ] ") + "Expose as prop"} onClick={() => state.Expose(!state.isProp)} />);
    if (state.isProp) { rows.push(<Action width={width} text={(state.optional ? "[x] " : "[ ] ") + "Optional input"} onClick={() => state.SetOptional(!state.optional)} />); rows.push(<Note width={width} text="Empty source input. Bind an existing parent source from the component reference inspector. No datasource is constructed here." />); }
    const editable = state.isProp ? Core.Presets.InputProperties(state.type) : rules;
    let pathBesideSource = false;
    for (const [key, rule] of Object.entries(editable)) {
        if (key === "path" && pathBesideSource) continue;
        if (rule.type === "cases") { rows.push(<CaseFields state={state} width={width} />); continue; }
        if (rule.type === "value") { rows.push(<OutputFields state={state} prefix={key} title={key === "default" ? "Default output (no match)" : friendly(key)} width={width} optional />); continue; }
        if (key === "source") {
            const choices = draft.sources.filter(source => source.name !== state.original).map(source => ({ label: source.name + " · " + sourceType(source.type), value: source.name }));
            if (editable.path !== undefined && (state.values.source ?? "") !== "") {
                pathBesideSource = true;
                const pathWidth = 120, sourceWidth = Math.max(80, width - pathWidth - 6);
                rows.push(<FlowLayout width={width} height={48} direction="horizontal" gap={6}>
                    <FlowLayout width={sourceWidth} height={48} gap={3}>
                        <Label height={17} text="Source" fontSize={10} />
                        <Dropdown width={sourceWidth} text={state.values.source ?? "Choose source"} options={choices} onSelect={value => state.Set("source", value)} />
                    </FlowLayout>
                    <FlowLayout width={pathWidth} height={48} gap={3}>
                        <Label height={17} text="Path" fontSize={10} />
                        <Input state={state} name="path" width={pathWidth} />
                    </FlowLayout>
                </FlowLayout>);
                rows.push(<Note width={width} text="Optional. .ResourceColor reads a resource color. token reads a class." />);
                continue;
            }
            rows.push(<Label width={width} height={17} text="Input source" fontSize={10} />);
            rows.push(<Dropdown width={width} text={state.values.source ?? "Choose source"} options={choices} onSelect={value => state.Set("source", value)} />);
            continue;
        }
        if (key === "unit") {
            rows.push(<Label width={width} height={17} text="Unit" fontSize={10} />);
            rows.push(<UnitChoice draft={draft} width={width} value={state.values.unit ?? ""} onSelect={value => { state.Set("unit", value); state.Save(); }} />);
            rows.push(<Action width={width} text="Use current member for every unit field" onClick={() => draft.UseMemberUnit("$unit")} />);
            rows.push(<Note width={width} text="Current member is the unit from a group Repeat. Member pet is that unit's pet. Required inputs that are not unit sources become optional so the row can render." />);
            continue;
        }
        const title = key === "healPrediction" ? "Track incoming heals" : key === "absorbPrediction" ? "Track absorbs" : friendly(key);
        rows.push(rule.type === "boolean" ? <Toggle state={state} name={key} title={title} width={width} /> : <Field state={state} name={key} title={title} rule={rule} width={width} />);
        if (key === "initial") rows.push(<Note width={width} text="The preview draws this resting value. Leave the suggested number to keep the built-in default. Live play still reads the real unit, aura, or spell." />);
        if (key === "path") rows.push(<Note width={width} text="Optional field inside the input value, e.g. token for a Class source. Empty uses the whole value." />);
        if (key === "expression") rows.push(<Note width={width} text="Example: 2 * input. Operators: + - * / % ^ and parentheses." />);
        if (key === "selectors") rows.push(<Note width={width} text={'Filters, e.g. "Seal*", /^Blessing of .*/i. Empty means all known active spells.'} />);
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
    try { Core.Presets.Validate(draft.Document()); }
    catch (failure) { rows.unshift(<Note width={w} text={String(failure)} />); }
    return <FlowLayout width={width} height={height} gap={6}>
        <FlowLayout width={width} height={28} direction="horizontal" gap={8}>
            <Label width={width - 124} height={28} text="Component sources" fontSize={12} color={colors.accent} />
            <Action width={116} text="New source" onClick={() => state.BeginNew()} />
        </FlowLayout>
        <ScrollForm width={width} height={height - 68} rows={rows} offset={state.scroll} remember={offset => { state.scroll = offset; }} gap={12} />
        <Action width={width} text="Update all sources" onClick={() => state.SaveAll()} />
    </FlowLayout>;
}
