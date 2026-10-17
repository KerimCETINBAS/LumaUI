import { UI } from "wuira";
import type { Cell as View } from "wuira";
import { FlowLayout, Label } from "wuira/ui";
import type { EditorDraft } from "./Draft";
import type { BindingField } from "./SourceEditor";
import { Dropdown } from "./Dropdown";
import { Input, Note, friendly } from "./InspectorControls";

/** Static input and source binding share a single property row. */
export function PropertySourceField({ draft, target, width, child }: { draft: EditorDraft; target: string; width: number; child: View }) {
    const state = draft.propertyEditor, binding = draft.Selected.bindings?.[target];
    const legacy = target === "alpha" ? draft.Selected.alphaSource : undefined;
    const path = "$property." + target + ".path";
    return <FlowLayout width={width} height={0} sizing="content" gap={4}>
        <Label width={width} height={17} text={friendly(target)} fontSize={10} />
        <Dropdown width={width} text={binding !== undefined ? "Source: " + binding.source : legacy !== undefined ? "Source: " + legacy : "Static value"}
            options={[{ label: "Static value", value: "" }, ...(legacy === undefined ? [] : [{ label: legacy + " · activity opacity", value: "$legacy" }]), ...draft.sources.map(source => ({ label: source.name, value: source.name }))]}
            onSelect={value => {
                if (value === "$legacy") return;
                state.Flush();
                draft.BindProperty(target, value === "" ? undefined : value, binding?.source === value ? state.values[path] : undefined);
                if ((draft.Selected.bindings?.[target]?.source ?? "") === value) state.values[path] = binding?.source === value ? state.values[path] : "";
            }} />
        {binding !== undefined ? <FlowLayout width={width} height={48} gap={3}>
            <Label height={17} text="Output path (optional)" fontSize={10} />
            <Input width={width} name={path} state={state} />
        </FlowLayout> : legacy !== undefined ? <Note width={width} text="Uses the source's activity opacity. Choose Static value or another source to replace it." /> : child}
    </FlowLayout>;
}

/** Existing native texture/progress/text/activity capabilities are selected beside their displayed value. */
export function VisualSourceField({ draft, field, title, width, child = [], path = false }: { draft: EditorDraft; field: BindingField; title: string; width: number; child?: View | View[]; path?: boolean }) {
    const state = draft.propertyEditor, source = draft.Selected[field];
    return <FlowLayout width={width} height={0} sizing="content" gap={4}>
        <Label width={width} height={17} text={title} fontSize={10} />
        <Dropdown width={width} text={source === undefined ? "Static value" : "Source: " + source}
            options={[{ label: "Static value", value: "" }, ...(draft.InItemTemplate() ? [{ label: "Current item", value: "item" }] : []), ...draft.sources.map(source => ({ label: source.name, value: source.name }))]}
            onSelect={value => { state.Flush(); state.binding = field; if (path && value !== source) state.bindingPath = ""; state.Bind(value === "" ? undefined : value); }} />
        {source === undefined ? child : path ? <FlowLayout width={width} height={48} gap={3}>
            <Label height={17} text="Source path (optional)" fontSize={10} />
            <Input state={state} name="$path" width={width} value={state.bindingPath} />
        </FlowLayout> : []}
    </FlowLayout>;
}
