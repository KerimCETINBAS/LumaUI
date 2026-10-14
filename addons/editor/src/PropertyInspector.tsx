import { UI } from "wuira";
import type { Cell as View } from "wuira";
import { FlowLayout, Button, Label } from "wuira/ui";
import type { PropertyRule } from "lumaui/core";
import type { EditorDraft } from "./Draft";
import type { BindingField } from "./SourceEditor";
import { Core } from "./core";
import { Dropdown } from "./Dropdown";
import { Action, Heading, Note, Field, Toggle, ColorFields, Input, ScrollForm, colors, friendly } from "./InspectorControls";

export function PropertyInspector({ draft, width, height }: { draft: EditorDraft; width: number; height: number }) {
    const state = draft.propertyEditor; state.Ensure();
    const rules = state.Rules;
    if (["hideUnitFrame", "fragment"].includes(draft.Selected.kind)) return <FlowLayout width={width} height={height} gap={10}>
        <Heading width={width} text={draft.Selected.kind === "fragment" ? "Headless group" : "Hide native unit frame"} />
        <Note width={width} text="This element does not occupy layout space. Native effects are disabled in the preview and restored when its owning preset is disabled." />
        {draft.Selected.kind === "hideUnitFrame" ? <Field state={state} name="unit" title="Native frame" rule={rules.unit} width={width} /> : <Note width={width} text="Add headless effects or reusable preset references to this group." />}
        <Action width={width} text="Save properties" onClick={() => state.Save()} />
        <Action width={width} text="Delete element" onClick={() => draft.Remove()} />
    </FlowLayout>;
    if (draft.Selected.kind === "preset" && !draft.IsVisual(draft.Selected)) return <FlowLayout width={width} height={height} gap={10}>
        <Heading width={width} text="Headless preset reference" />
        <Dropdown width={width} text={Core.Presets.Get(draft.Selected.preset!)?.name ?? draft.Selected.preset!}
            options={Core.Presets.List().filter(doc => doc.id !== draft.documentId).map(doc => ({label:doc.name,value:doc.id}))} onSelect={id => draft.ReplacePreset(id)} />
        <Note width={width} text="This is a shared library preset. It occupies no layout space. Edit it in UI Library; export includes it automatically." />
        <Action width={width} text="Delete reference" onClick={() => draft.Remove()} />
    </FlowLayout>;
    const tabs = ["Display", "Layout", ...(draft.Selected.kind === "preset" ? [] : ["Data"]), ...(draft.Selected.kind === "action" ? ["Actions"] : [])];
    if (!tabs.includes(state.panel)) state.panel = "Display";
    const w = width - 8; const half = (w - 8) / 2;
    const rows: View[] = [];
    const used = new Set<string>();
    const heading = (text: string) => rows.push(<Heading text={text} width={w} />);
    const note = (text: string) => rows.push(<Note text={text} width={w} />);
    const field = (key: string, title?: string, rule = rules[key], size = w) => <Field state={state} name={key} title={title} rule={rule} width={size} />;
    const pair = (a: string, b: string, ra = rules[a], rb = rules[b], ta?: string, tb?: string) => rows.push(<FlowLayout width={w} height={48} direction="horizontal" gap={8}>{field(a,ta,ra,half)}{field(b,tb,rb,half)}</FlowLayout>);
    const render = (name: string, rule: PropertyRule, title: string) => {
        if (rule.type === "color") { rows.push(<ColorFields state={state} name={name} title={title} width={w} />); return; }
        if (rule.type === "boolean") { rows.push(<Toggle state={state} name={name} title={title} width={w} defaultValue={name === "condition" || name === "clickThrough" || name === "showHotkey"} />); return; }
        if (rule.type === "spacing") {
            heading(title); rows.push(field(name, "All sides", { type: "number", min: 0 }));
            const nr: PropertyRule = { type: "number", min: 0 };
            pair(name + ".top", name + ".bottom",nr,nr,"Top","Bottom"); pair(name + ".left", name + ".right",nr,nr,"Left","Right"); return;
        }
        if (rule.type === "offset") { pair(name + ".x",name + ".y",{type:"number"},{type:"number"},"X offset","Y offset"); return; }
        if (["textureOptions","background","border"].includes(rule.type)) {
            heading(title);
            if (rule.type !== "textureOptions") rows.push(<Toggle state={state} name={name} title={"Enable " + title.toLowerCase()} width={w} defaultValue />);
            rows.push(field(name + ".texture", "Texture", { type: "string" }));
            rows.push(<ColorFields state={state} name={name + ".color"} title="Color" width={w} />);
            if (rule.type === "border") pair(name + ".thickness", name + ".radius", { type: "number", min: 0 }, { type: "number", min: 0 }, "Thickness", "Corner radius");
            else {
                rows.push(<Toggle state={state} name={name + ".tileX"} title="Repeat horizontally" width={w} />);
                rows.push(<Toggle state={state} name={name + ".tileY"} title="Repeat vertically" width={w} />);
                rows.push(field(name + ".blendMode", "Blend mode", { type: "string", values: ["BLEND","ADD","MOD","DISABLE","ALPHAKEY"] }));
                rows.push(field(name + ".texCoords", "Texture crop (left, right, top, bottom)", { type: "texCoords" }));
            }
            return;
        }
        if (rule.type === "action") {
            heading("Secure action"); rows.push(field("action.type","Action type",{ type:"string",values:["spell","item","macro","action","target"] }));
            const type = state.values["action.type"];
            const payload: Record<string,string> = { spell:"spell",item:"item",macro:"macro",action:"slot",target:"unit" };
            if (payload[type] !== undefined) rows.push(field("action." + payload[type], friendly(payload[type]), {type:type === "action" ? "number" : "string"}));
            if (type !== "target" && type !== "macro") rows.push(field("action.unit","Target unit (optional)",{type:"string"}));
            return;
        }
        rows.push(field(name,title,rule));
    };
    const add = (key: string) => { if (rules[key] !== undefined) { used.add(key); render(key,rules[key],friendly(key)); } };
    if (draft.Selected.kind === "preset") {
        heading("Shared preset reference");
        rows.push(<Dropdown width={w} text={Core.Presets.Get(draft.Selected.preset!)?.name ?? draft.Selected.preset ?? "None"}
            options={Core.Presets.List().filter(doc => doc.id !== draft.documentId).map(doc => ({label:doc.name,value:doc.id}))} onSelect={id => draft.ReplacePreset(id)} />);
        note("Edit the referenced preset in UI Library. Its sources remain separate; export includes all dependencies.");
    }
    if (state.panel === "Display") {
        heading("Size"); pair("width","height"); note('UI units; enter "inherit" to fill the parent.');
        heading("Visibility"); add("condition"); add("alpha"); add("clickThrough");
        heading(draft.Selected.kind === "progress" ? "Progress bar" : "Appearance");
        for (const key of ["orientation","reverse","color","texture","foreground","background","backdrop","backgroundColor","borderColor","borderWidth","text","font","fontSize","align","texCoords","healPrediction","absorbPrediction"]) add(key);
        if (draft.Selected.kind === "progress") { heading("Manual values"); note("A bound source normally supplies these values."); for (const key of ["min","max","current","value"]) add(key); }
    } else if (state.panel === "Layout") {
        heading("Size"); pair("width","height"); add("sizing");
        if (rules.direction !== undefined || rules.columns !== undefined) { heading("Arrange children"); for (const key of ["direction","justify","grow","columns","gap","lineGap","rowGap","columnGap","cellWidth","cellHeight"]) add(key); }
        heading("Position"); note("Screen position applies outside the preview.");
        for (const key of ["mode","anchor","relativeAnchor","relativeTo"]) add(key);
        if (state.values.mode === "absolute") pair("x","y"); else add("offset");
        add("padding"); add("margin");
    } else if (state.panel === "Actions") {
        note("Secure actions are applied outside combat."); for (const key of ["action","binding","button","showHotkey","finishGlow"]) add(key);
    } else {
        heading("Data binding"); note("Choose a saved source. Manage sources in Sources.");
        const binding = (key: BindingField, title: string) => {
            rows.push(<Label width={w} height={18} text={title} fontSize={11} />);
            rows.push(<Dropdown width={w} text={draft.Selected[key] ?? "None"} options={[{label:"None",value:""}, ...draft.sources.map(source => ({label:source.name,value:source.name}))]}
                onSelect={value => { state.Flush(); state.binding = key; state.Bind(value === "" ? undefined : value); }} />);
        };
        if (["progress","icon","action"].includes(draft.Selected.kind)) {
            binding("source",draft.Selected.kind === "progress" ? "Progress source" : draft.Selected.kind === "icon" ? "Icon source" : "Action source");
            rows.push(<Label width={w} height={18} text="Source path (optional)" fontSize={11} />);
            rows.push(<Input state={state} name="$path" width={w} value={state.bindingPath} />);
            note("Leave empty for the default; e.g. channels.regen.");
            rows.push(<Action width={w} text="Apply binding" onClick={() => { state.binding = "source"; state.Bind(draft.Selected.source); }} />);
        }
        heading("Visibility & text"); binding("visibleSource","Show while source is active");
        if (draft.Selected.kind === "label") binding("textSource","Text from source");
        binding("alphaSource","Opacity from source");
        rows.push(<Action width={w} text="Edit / create sources" onClick={() => draft.SetInspector("sources")} />);
    }
    if (state.panel === "Display") {
        const known = ["width","height","margin","padding","mode","anchor","relativeAnchor","relativeTo","x","y","offset","sizing","direction","gap","lineGap","grow","justify","columns","rowGap","columnGap","cellWidth","cellHeight","alpha","condition","clickThrough","backgroundColor","borderColor","borderWidth","foreground","background","backdrop","color","texture","min","max","current","value","orientation","reverse","healPrediction","absorbPrediction","text","font","fontSize","align","texCoords","action","binding","showHotkey","finishGlow","button"];
        const extras = Object.keys(rules).filter(key => !known.includes(key));
        if (extras.length > 0) { heading("Additional settings"); for (const key of extras) add(key); }
    }
    return <FlowLayout width={width} height={height} gap={6}>
        <Label height={24} text={draft.Selected.name} color={colors.accent} fontSize={12} />
        <FlowLayout height={28} direction="horizontal" gap={4}>
            {tabs.map(tab => <Button width={(width - (tabs.length - 1)*4)/tabs.length} onClick={() => state.Section(tab)}><Label text={tab} fontSize={11} align="CENTER" color={tab === state.panel ? colors.accent : colors.muted} /></Button>)}
        </FlowLayout>
        <ScrollForm width={width} height={height - 98} rows={rows} offset={state.scroll[state.panel] ?? 0} remember={offset => { state.scroll[state.panel] = offset; }} />
        <FlowLayout height={28} direction="horizontal" gap={6}>
            <Action width={width - 98} text="Save properties" onClick={() => state.Save()} />
            <Action width={92} text="Delete element" onClick={() => draft.Remove()} />
        </FlowLayout>
    </FlowLayout>;
}
