import { UI } from "wuira/ui";
import type { Cell as View } from "wuira/ui";
import { FlowLayout, Label } from "wuira/ui";
import type { EditorDraft } from "../draft/Draft";
import type { BindingField } from "../property/SourceEditor";
import { Dropdown } from "./Dropdown";
import { Input, Note, friendly } from "./InspectorControls";

/** Static input and source binding share a single property row. A chosen source also takes an optional path. */
export function PropertySourceField({ draft, target, width, child }: { draft: EditorDraft; target: string; width: number; child: View }) {
    const state = draft.propertyEditor, binding = draft.Selected.bindings?.[target];
    const legacy = target === "alpha" ? draft.Selected.alphaSource : undefined;
    const pathName = "$property." + target + ".path";
    const pending = state.pendingBinding?.target === target ? state.pendingBinding : undefined;
    const selected = pending?.source ?? binding?.source;
    const pathText = pending?.path ?? binding?.path ?? "";
    const shown = selected ?? legacy;
    const pathWidth = 120, sourceWidth = selected !== undefined ? Math.max(80, width - pathWidth - 6) : width;
    const commit = (source: string, path: string) => {
        state.pendingBinding = { target, source, path };
        draft.BindProperty(target, source, path);
        const saved = draft.Selected.bindings?.[target];
        if (saved?.source === source && (saved.path ?? "") === path.trim()) state.pendingBinding = undefined;
    };
    return <FlowLayout width={width} height={0} sizing="content" gap={4}>
        <Label width={width} height={17} text={friendly(target)} fontSize={10} />
        <FlowLayout width={width} height={selected !== undefined ? 48 : 28} direction="horizontal" gap={6}>
            <FlowLayout width={sourceWidth} height={selected !== undefined ? 48 : 28} gap={3}>
                {selected !== undefined ? <Label height={17} text="Source" fontSize={10} /> : []}
                <Dropdown width={sourceWidth} text={shown !== undefined ? "Source: " + shown : "Static value"}
                    options={[{ label: "Static value", value: "" }, ...(legacy === undefined ? [] : [{ label: legacy + " · activity opacity", value: "$legacy" }]), ...draft.sources.map(source => ({ label: source.name, value: source.name }))]}
                    onSelect={value => {
                        if (value === "$legacy") return;
                        state.Flush();
                        if (value === "") { state.pendingBinding = undefined; draft.BindProperty(target, undefined); return; }
                        commit(value, binding?.source === value ? (state.values[pathName] ?? binding.path ?? "") : "");
                    }} />
            </FlowLayout>
            {selected !== undefined ? <FlowLayout width={pathWidth} height={48} gap={3}>
                <Label height={17} text="Path" fontSize={10} />
                <Input width={pathWidth} name={pathName} state={state} value={pathText} onCommit={text => { if (selected !== undefined) commit(selected, text); }} />
            </FlowLayout> : []}
        </FlowLayout>
        {shown !== undefined && !draft.sources.some(source => source.name === shown) ? <Note width={width} text={"Missing source: " + shown} /> : []}
        {selected !== undefined ? [] : legacy !== undefined ? <Note width={width} text="Uses the source's activity opacity. Choose Static value or another source to replace it." /> : child}
    </FlowLayout>;
}

/** Existing native texture/progress/text/activity capabilities are selected beside their displayed value. */
export function VisualSourceField({ draft, field, title, width, child = [], path = false }: { draft: EditorDraft; field: BindingField; title: string; width: number; child?: View | View[]; path?: boolean }) {
    const state = draft.propertyEditor, source = draft.Selected[field];
    const polarity = field === "visibleSource" && source !== undefined;
    const showPath = (path || polarity) && source !== undefined;
    const whenWidth = polarity ? 96 : 0, pathWidth = showPath ? 100 : 0;
    const sourceWidth = showPath ? Math.max(72, width - pathWidth - whenWidth - (polarity ? 12 : 6)) : width;
    const pathValue = polarity ? state.visiblePath : state.bindingPath;
    const pathName = polarity ? "$visiblePath" : "$path";
    return <FlowLayout width={width} height={0} sizing="content" gap={4}>
        <Label width={width} height={17} text={title} fontSize={10} />
        <FlowLayout width={width} height={showPath ? 48 : 28} direction="horizontal" gap={6}>
            <FlowLayout width={sourceWidth} height={showPath ? 48 : 28} gap={3}>
                {showPath ? <Label height={17} text="Source" fontSize={10} /> : []}
                <Dropdown width={sourceWidth} text={source === undefined ? "Static value" : "Source: " + source}
                    options={[{ label: "Static value", value: "" }, ...(draft.InItemTemplate() ? [{ label: "Current item", value: "item" }] : []), ...draft.sources.map(source => ({ label: source.name, value: source.name }))]}
                    onSelect={value => {
                        state.Flush(); state.binding = field;
                        if (value !== source && field === "visibleSource") { state.visiblePath = ""; state.visibleWhen = "true"; }
                        else if (path && value !== source) state.bindingPath = "";
                        state.Bind(value === "" ? undefined : value);
                    }} />
            </FlowLayout>
            {showPath ? <FlowLayout width={pathWidth} height={48} gap={3}>
                <Label height={17} text="Path" fontSize={10} />
                <Input state={state} name={pathName} width={pathWidth} value={pathValue} />
            </FlowLayout> : []}
            {polarity ? <FlowLayout width={whenWidth} height={48} gap={3}>
                <Label height={17} text="When" fontSize={10} />
                <Dropdown width={whenWidth} text={state.visibleWhen === "false" ? "False" : "True"}
                    options={[{ label: "True", value: "true" }, { label: "False", value: "false" }]}
                    onSelect={value => { state.Flush(); state.visibleWhen = value === "false" ? "false" : "true"; state.binding = "visibleSource"; state.Bind(source); }} />
            </FlowLayout> : []}
        </FlowLayout>
        {source !== undefined && !draft.sources.some(spec => spec.name === source) && !(source === "item" && draft.InItemTemplate()) ? <Note width={width} text={"Missing source: " + source} /> : []}
        {field === "textSource" && source !== undefined ? <Note width={width} text="Path is optional. .Name is the unit name. .Surname is the surname. .FullName joins the two and stays empty when either part is missing. An NPC leaves surname and full name empty." /> : []}
        {polarity ? <Note width={width} text="The source or its path must be boolean, such as .IsLeader. True shows the element while that value is true. False shows it while the value is false." /> : []}
        {source === undefined ? child : []}
    </FlowLayout>;
}
