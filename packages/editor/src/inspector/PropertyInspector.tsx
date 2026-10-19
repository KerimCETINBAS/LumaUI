import { ComponentReferenceInspector } from "./ComponentReferenceInspector";
import { Sections } from "./Sections";
import { ProgressLayers } from "./ProgressLayers";
import { PropertySourceField, VisualSourceField } from "../fields/PropertySourceFields";
import { CharacterActionField } from "../fields/CharacterActionField";
import { UI } from "wuira/ui";
import type { Cell as View } from "wuira/ui";
import { FlowLayout, Label } from "wuira/ui";
import type { PropertyRule } from "lumaui/core";
import type { EditorDraft } from "../draft/Draft";
import type { BindingField } from "../property/SourceEditor";
import { Core } from "../core";
import { describeNode } from "../chrome/NodePresentation";
import { SingleLine } from "../chrome/SingleLine";
import { ClickCastBindingField } from "../fields/ClickCastBindingField";
import { IconButton } from "../chrome/IconButton";
import { Dropdown } from "../fields/Dropdown";
import { TextureField } from "../fields/TextureField";
import { UnitChoice } from "../fields/UnitChoice";
import { InspectorSections, Action, Heading, Note, Field, Toggle, ColorFields, Input, ScrollForm, colors, friendly } from "../fields/InspectorControls";

export function PropertyInspector({ draft, width, height }: { draft: EditorDraft; width: number; height: number }) {
    const state = draft.propertyEditor; state.Ensure();
    const rules = state.Rules;
    if (draft.Selected.kind === "blizzardElement") {
        const replace = draft.Selected.props?.replace === true;
        return <FlowLayout width={width} height={height} gap={8}>
            <Heading width={width} text="Dynamic nameplate" />
            <Dropdown width={width} text={replace ? "Replace visuals" : "Apply native style"}
                options={[{ label: "Replace visuals", value: "replace" }, { label: "Apply native style", value: "apply" }]}
                onSelect={value => draft.SetBlizzardMode(value === "replace")} />
            <Note width={width} text="The first matching rule wins. Switching to Apply removes the replacement template; Undo restores it." />
            <Dropdown width={width} text={state.values.filter ?? "Choose unit filter"}
                options={draft.sources.filter(source => source.type === "unitToBool").map(source => ({ label: source.name, value: source.name }))}
                onSelect={name => state.Set("filter", name)} />
            <Action width={width} text="Edit / create unit filters" onClick={() => draft.SetInspector("sources")} />
            {replace ? <Note width={width} text="Edit the child template. Its sources can use $unit; preview never registers live rules. Secure controls are unavailable." />
                : <ScrollForm width={width} height={Math.max(80, height - 274)} offset={state.scroll.native ?? 0} remember={offset => { state.scroll.native = offset; }}
                    rows={["width", "height", "scale", "alpha", "healthColor", "castColor"].map(name => rules[name].type === "color"
                        ? <ColorFields state={state} name={name} title={friendly(name)} width={width - 12} />
                        : <Field state={state} name={name} title={friendly(name)} rule={rules[name]} width={width - 12} />)} />}
            <Action width={width} text="Update preview" onClick={() => state.Save()} />
            <Action width={width} text="Delete element" onClick={() => draft.Remove()} />
        </FlowLayout>;
    }
    if (["hideUnitFrame", "fragment"].includes(draft.Selected.kind)) return <FlowLayout width={width} height={height} gap={10}>
        <Heading width={width} text={draft.Selected.kind === "fragment" ? "Headless group" : "Hide native frame"} />
        <Note width={width} text="This element does not occupy layout space. Native effects are disabled in the preview and restored when its owning component is disabled." />
        {draft.Selected.kind === "hideUnitFrame" ? <Field state={state} name="unit" title="Native frame" rule={rules.unit} width={width} /> : <Note width={width} text={"Add effects or reusable component references to this group."} />}
        <Action width={width} text="Update preview" onClick={() => state.Save()} />
        <Action width={width} text={draft.Selected.kind === "fragment" && draft.Selected.id === draft.nodes[0].id ? "Remove group" : "Delete element"} onClick={() => draft.Remove()} />
    </FlowLayout>;
    if (draft.Selected.kind === "preset") return <ComponentReferenceInspector draft={draft} width={width} height={height} />;
    const tabs = ["Display", "Layout", ...(draft.Selected.kind === "preset" ? [] : ["Data"]), ...(draft.Selected.kind === "action" ? ["Actions"] : [])];
    if (!tabs.includes(state.panel)) state.panel = "Display";
    const w = width - 36; const half = (w - 8) / 2;
    const rows: View[] = [];
    const append = (items: View[]) => { for (const item of items) rows.push(item); };
    const used = new Set<string>();
    const heading = (text: string) => rows.push(<Heading text={text} width={w} />);
    const note = (text: string) => rows.push(<Note text={text} width={w} />);
    const field = (key: string, title?: string, rule = rules[key], size = w) => <Field state={state} name={key} title={title} rule={rule} width={size} />;
    const pair = (a: string, b: string, ra = rules[a], rb = rules[b], ta?: string, tb?: string) => rows.push(<FlowLayout width={w} height={48} direction="horizontal" gap={8}>{field(a,ta,ra,half)}{field(b,tb,rb,half)}</FlowLayout>);
    const renderStatic = (name: string, rule: PropertyRule, title: string) => {
        if (rule.type === "color") { rows.push(<ColorFields state={state} name={name} title={title} width={w} />); return; }
        if (rule.type === "boolean") { rows.push(<Toggle state={state} name={name} title={title} width={w} defaultValue={name === "condition" || name === "clickThrough" || name === "showHotkey" || name === "showTooltip"} />); return; }
        if (rule.type === "spacing") {
            heading(title); rows.push(field(name, "All sides", { type: "number", min: 0 }));
            const nr: PropertyRule = { type: "number", min: 0 };
            pair(name + ".top", name + ".bottom",nr,nr,"Top","Bottom"); pair(name + ".left", name + ".right",nr,nr,"Left","Right"); return;
        }
        if (rule.type === "offset") { pair(name + ".x",name + ".y",{type:"number"},{type:"number"},"X offset","Y offset"); return; }
        if (["textureOptions","background","border"].includes(rule.type)) {
            heading(title);
            if (rule.type !== "textureOptions") rows.push(<Toggle state={state} name={name} title={"Enable " + title.toLowerCase()} width={w} defaultValue />);
            rows.push(<TextureField state={state} name={name + ".texture"} title="Texture" width={w} kind={rule.type === "border" ? "border" : rule.type === "background" ? "background" : "progress"} />);
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
            if (type === "spell" || type === "item") rows.push(<CharacterActionField state={state} width={w} />);
            else if (payload[type] !== undefined) rows.push(field("action." + payload[type], friendly(payload[type]), {type:type === "action" ? "number" : "string"}));
            if (type !== "target" && type !== "macro") rows.push(field("action.unit","Target unit (optional)",{type:"string"}));
            return;
        }
        rows.push(field(name,title,rule));
    };
    const render = (name: string, rule: PropertyRule, title: string) => {
        if (["backgroundColor", "borderColor", "alpha", ...(draft.Selected.kind === "progress" ? ["color"] : [])].includes(name)) {
            rows.push(<PropertySourceField draft={draft} target={name} width={w}>
                {rule.type === "color" ? <ColorFields state={state} name={name} title="Value" width={w} /> : field(name, "Value", rule)}
            </PropertySourceField>);
            return;
        }
        if (name === "condition" || name === "text" || name === "texture" && draft.Selected.kind === "icon") {
            const inner: View[] = []; const offset = rows.length; renderStatic(name, rule, title); inner.push(...rows.splice(offset));
            rows.push(<VisualSourceField draft={draft} width={w} field={name === "condition" ? "visibleSource" : name === "text" ? "textSource" : "source"}
                title={title} path={name === "texture" || name === "text" || name === "condition"}>{inner}</VisualSourceField>); return;
        }
        if (name === "unit" && draft.Selected.kind !== "hideUnitFrame") {
            rows.push(<Label width={w} height={17} text={title} fontSize={10} />);
            rows.push(<UnitChoice draft={draft} width={w} value={state.values.unit ?? ""} onSelect={value => { state.Set("unit", value); state.Save(); }} />);
            return;
        }
        renderStatic(name, rule, title);
    };
    const dataKeys = ["unit", "unitWatch", "visibilityGroup", "spellId", "spellIds", "movementSpellIds", "filter", "key", "groupBy"];
    const add = (key: string) => { if (rules[key] !== undefined) { used.add(key); render(key,rules[key],friendly(key)); } };
    if (draft.Selected.kind === "preset") {
        heading("Shared component reference");
        rows.push(<Dropdown width={w} text={Core.Presets.Get(draft.Selected.preset!)?.name ?? draft.Selected.preset ?? "None"}
            options={Core.Presets.List().filter(doc => doc.id !== draft.documentId).map(doc => ({label:doc.name,value:doc.id}))} onSelect={id => draft.ReplacePreset(id)} />);
        note("Edit the referenced component in UI Library. Its sources remain separate; export includes all dependencies.");
    }
    if (state.panel === "Display") {
        heading("Size"); pair("width","height"); note('UI units. "inherit" takes the whole parent. "fill" takes the space siblings leave.');
        if (draft.Selected.kind === "unitPortrait") note("Left click selects the unit. Right click opens its native menu.");
        heading("Visibility"); add("condition"); add("alpha"); add("clickThrough");
        if (draft.Selected.kind === "progress") {
            heading("Direction"); add("orientation"); add("reverse");
            append(ProgressLayers({ draft, width: w }));
            const show = (key: string, title: string) => { if (rules[key] === undefined) return; used.add(key); render(key, rules[key], title); };
            show("background", "Track"); show("backdrop", "Border");
            const manual = ["min", "max", "current", "value"].filter(key => (state.values[key] ?? "") !== "");
            if (manual.length > 0) { heading("Manual range"); note("These numbers replace the source. Clear a field to follow the source again."); for (const key of manual) add(key); }
            for (const key of ["color", "texture", "foreground", "min", "max", "current", "value"]) used.add(key);
        } else {
            heading("Appearance");
            const appearance = ["orientation","reverse","color","texture","foreground","background","backdrop","backgroundColor","borderColor","borderWidth","text","font","fontSize","align","texCoords"];
            for (const key of appearance) if (!(draft.Selected.kind === "icon" && key === "color")) add(key);
            if (draft.Selected.kind === "icon") {
                heading("Glow");
                note("An accessory drawn on this icon. Pixel traces the edge, button overlay is the spell alert, autocast shine orbits, and proc plays the burst. Default leaves the icon plain. The glow is drawn on the icon and does not need another addon.");
                add("glowType");
                const glow = state.values.glowType ?? "";
                if (glow === "Pixel" || glow === "buttonOverlay" || glow === "ACShine" || glow === "Proc") {
                    rows.push(<VisualSourceField draft={draft} width={w} field="glowSource" title="Glow when" path />);
                    note("Leave the source empty to glow all the time. Bind an aura, a spell, or a boolean converter to turn it on and off.");
                    used.add("color");
                    rows.push(<ColorFields state={state} name="color" title="Glow color" width={w} />);
                    const keys = glow === "Pixel" ? ["lines", "frequency", "length", "thickness", "glowBorder", "glowX", "glowY"]
                        : glow === "buttonOverlay" ? ["frequency"]
                        : glow === "ACShine" ? ["lines", "frequency", "scale", "glowX", "glowY"]
                        : ["duration", "startAnim", "glowX", "glowY"];
                    for (const key of keys) add(key);
                }
            }
        }
    } else if (state.panel === "Layout") {
        heading("Size"); pair("width","height"); add("sizing");
        if (draft.Selected.kind === "foreach") {
            heading("Keyed list"); for (const key of ["direction", "wrapAfter", "gap", "lineGap", "groupBy", "key"]) add(key);
            note("Each result instantiates a referenced component. Connect its named Repeat item input to parent.$item, or a UnitSource input to parent.$unit, in Data. A second component slot can represent pets.");
        }
        if (rules.direction !== undefined || rules.columns !== undefined) {
            heading("Arrange children");
            for (const key of ["direction","alignX","alignY","grow","columns","gap","lineGap","rowGap","columnGap","cellWidth","cellHeight"]) add(key);
            if (rules.alignX !== undefined || rules.columnGap !== undefined) note("Arrange chooses the order. Horizontal and vertical position place that whole arrangement. Column spacing is the horizontal gap. Row spacing is the vertical gap. A child's anchor places it inside the space reserved for it.");
        }
        heading("Position"); note("Screen position applies outside the preview. Inside a flow or grid, Anchor point places this element in its reserved space.");
        for (const key of ["mode","anchor","relativeAnchor","relativeTo"]) add(key);
        if (state.values.mode === "absolute") pair("x","y"); else add("offset");
        add("padding"); add("margin");
    } else if (state.panel === "Actions") {
        heading("Unit target"); for (const key of ["unit", "unitWatch"]) add(key);
        note("Use the child component's named UnitSource input for the unit target. Bind that input on the parent reference in Data.");
        note("Secure actions are applied outside combat.");
        const actionFields: View[] = []; const offset = rows.length; add("action"); actionFields.push(...rows.splice(offset));
        rows.push(<VisualSourceField draft={draft} field="source" title="Button action" width={w} path>{actionFields}</VisualSourceField>);
        for (const key of ["button", "showHotkey", "showTooltip", "finishGlow"]) add(key);
        rows.push(<ClickCastBindingField draft={draft} width={w} />);
    } else {
        heading("Element data");
        const binding = (key: BindingField, title: string) => {
            rows.push(<Label width={w} height={18} text={title} fontSize={11} />);
            rows.push(<Dropdown width={w} text={draft.Selected[key] ?? "None"} options={[{label:"None",value:""}, ...(draft.InItemTemplate() ? [{label:"Current item",value:"item"}] : []), ...draft.sources.filter(source => draft.Selected.kind !== "foreach" || Core.Presets.SourcesCompatible(source.type,"list")).map(source => ({label:source.name,value:source.name}))]}
                onSelect={value => { state.Flush(); state.binding = key; state.Bind(value === "" ? undefined : value); }} />);
        };
        if (draft.Selected.kind === "foreach") {
            binding("source", "List source");
            if (draft.Selected.source === undefined && draft.Selected.items === undefined) note("No list selected. Repeat stays empty until you choose a list source or helper.");
            rows.push(<Label width={w} height={18} text="Path" fontSize={11} />);
            rows.push(<Input state={state} name="$path" width={w} value={state.bindingPath} />);
            note("Leave empty for the default; e.g. channels.regen.");
            rows.push(<Action width={w} text="Apply binding" onClick={() => { state.binding = "source"; state.Bind(draft.Selected.source); }} />);
        }
        if (draft.Selected.kind === "foreach") {
            heading("List helper");
            rows.push(<Input state={state} name="$items" value={state.itemsExpression} width={w} />);
            note('Example: KnownSpells("Seal*", /^Blessing of .*/i). This replaces the named list source.');
            rows.push(<Action width={w} text="Use helper expression" onClick={() => { state.Flush(); draft.BindItems(state.itemsExpression); state.Open(); }} />);
        }
        if (draft.InItemTemplate()) note("Current item reuses this result's compiled source. A spell item supplies its action, icon, cooldown and name.");
        if (draft.Selected.kind !== "action") for (const key of dataKeys) add(key);
        if (draft.Selected.kind === "progress") note("Overlay progresses, such as absorbs on a health bar, are added from Display.");
        else append(Sections({ draft, width: w }));
        note("Appearance values and their sources are edited together in Display.");
        rows.push(<Action width={w} text="Edit / create sources" onClick={() => draft.SetInspector("sources")} />);
    }
    if (state.panel === "Display") {
        const known = ["width","height","margin","padding","mode","anchor","relativeAnchor","relativeTo","x","y","offset","sizing","direction","gap","lineGap","grow","justify","alignX","alignY","columns","rowGap","columnGap","cellWidth","cellHeight","alpha","condition","clickThrough","backgroundColor","borderColor","borderWidth","foreground","background","backdrop","color","texture","min","max","current","value","orientation","reverse","healPrediction","absorbPrediction","powerColorUnit","field","category","text","font","fontSize","align","texCoords","action","binding","clickCastPreset","showHotkey","showTooltip","finishGlow","button","glowType","lines","frequency","length","thickness","scale","glowBorder","glowX","glowY","duration","startAnim"];
        const extras = Object.keys(rules).filter(key => !known.includes(key) && !dataKeys.includes(key));
        if (extras.length > 0) { heading("Additional settings"); for (const key of extras) add(key); }
    }
    return <FlowLayout width={width} height={height} gap={6}>
        <SingleLine width={width} height={24} text={describeNode(draft, draft.Selected).title} color={colors.accent} size={12} />
        <FlowLayout height={28} direction="horizontal" gap={4}>
            {tabs.map(tab => <IconButton width={(width - (tabs.length - 1)*4)/tabs.length} text={tab} icon={tab === "Display" ? "visuals" : tab === "Layout" ? "layout" : tab === "Data" ? "sources" : "button"} active={tab === state.panel} quiet onClick={() => state.Section(tab)} />)}
        </FlowLayout>
        <ScrollForm width={width} height={height - 98} rows={InspectorSections(rows,width-16)} gap={12} offset={state.scroll[state.panel] ?? 0} remember={offset => { state.scroll[state.panel] = offset; }} />
        <FlowLayout height={28} direction="horizontal" gap={6}>
            <Action width={width - 118} text="Update preview" onClick={() => state.Save()} />
            <Action width={112} text="Delete element" onClick={() => draft.Remove()} />
        </FlowLayout>
    </FlowLayout>;
}
