import { SpellField } from "./SpellField";
import { IconField } from "./IconField";
import { UI, wuira } from "wuira";
import type { Cell as View } from "wuira";
import type { PropertyRule } from "lumaui/core";
import { Cell, FlowLayout, Button, Label, TextInput, Background, Border, ScrollHost } from "wuira/ui";
import { Dropdown } from "./Dropdown";
import { Core } from "./core";
import { IconButton, actionIcon } from "./IconButton";
export const colors = Core.Theme.colors;
export const labels: Record<string, string> = {
    width: "Width", height: "Height", margin: "Outer spacing", padding: "Inner spacing", mode: "Positioning",
    anchor: "Anchor point", relativeAnchor: "Relative anchor", relativeTo: "Relative element", x: "X offset", y: "Y offset",
    sizing: "Size calculation", direction: "Direction", gap: "Item spacing", lineGap: "Row spacing", grow: "Wrap to next line",
    justify: "Alignment", columns: "Columns", rowGap: "Row spacing", columnGap: "Column spacing", cellWidth: "Column width", cellHeight: "Row height",
    alpha: "Opacity", condition: "Visible", clickThrough: "Allow clicks through", backgroundColor: "Background color",
    borderColor: "Border color", borderWidth: "Border thickness", color: "Color", texture: "Texture", foreground: "Bar fill",
    background: "Bar background", backdrop: "Bar border", min: "Minimum", max: "Maximum", current: "Current value", value: "Value (alias)",
    orientation: "Orientation", reverse: "Reverse fill", healPrediction: "Incoming heals", absorbPrediction: "Absorbs",
    text: "Text", font: "Font path", fontSize: "Font size", align: "Text alignment", texCoords: "Texture crop (left, right, top, bottom)",
    action: "Action", binding: "Key binding", showHotkey: "Show key binding", showTooltip: "Show action tooltip", finishGlow: "Flash when cooldown ends", button: "Mouse button",
    unit: "Unit", spellId: "Spell", spellIds: "Spells", movementSpellIds: "Movement effects", filter: "Aura filter", regenTimer: "Track mana regeneration",
    healPredictionSource: "Track incoming heals", healPredictionResource: "Track incoming heals", absorbPredictionResource: "Track absorbs",
    activeAlpha: "Opacity while active", inactiveAlpha: "Opacity while inactive", source: "Parent source", channel: "Channel name",
    tileX: "Repeat horizontally", tileY: "Repeat vertically", blendMode: "Blend mode", thickness: "Thickness", radius: "Corner radius",
    selectors: "Spell filters", includePassive: "Include passive spells",
    scope: "Group scope", pets: "Include pets", key: "Stable member key", groupBy: "Group columns by", wrapAfter: "Members per column",
    unitWatch: "Hide absent units", field: "Displayed field", category: "Aura category", maxIcons: "Maximum icons", iconSize: "Icon size", compartmentBorder: "Active compartment border", hoverBackground: "Hover background",
    top: "Top", right: "Right", bottom: "Bottom", left: "Left", r: "Red", g: "Green", b: "Blue", a: "Opacity",
    path: "Input value path", expression: "Formula", default: "Default output", cases: "Cases",
    type: "Action type", spell: "Spell name or ID", item: "Item name or ID", macro: "Macro name or number", slot: "Action slot",
};
const choices: Record<string, string> = {
    player: "Player", target: "Target", focus: "Focus", actionBars: "Action bars", auto: "Party or raid", party: "Party", raid: "Raid", group: "Raid subgroup", key: "Member identity",
    buffs: "Buffs", dispellable: "Dispellable debuffs", movement: "Movement effects", other: "Other debuffs",
    name: "Name", health: "Health", percent: "Health percent", role: "Role", leader: "Group leader",
    horizontal: "Horizontal", vertical: "Vertical", fixed: "Fixed size", content: "Fit to contents", absolute: "Screen", relative: "Relative to parent",
    start: "Start", center: "Center", end: "End", TOPLEFT: "Top left", TOP: "Top", TOPRIGHT: "Top right", LEFT: "Left", CENTER: "Center",
    RIGHT: "Right", BOTTOMLEFT: "Bottom left", BOTTOM: "Bottom", BOTTOMRIGHT: "Bottom right", HELPFUL: "Buffs", HARMFUL: "Debuffs",
    "HELPFUL|PLAYER": "My buffs", "HARMFUL|PLAYER": "My debuffs", spell: "Cast spell", item: "Use item", macro: "Run macro", action: "Action slot",
};
export function friendly(value: string): string { return choices[value] ?? labels[value] ?? value; }
export function sourceType(value: string): string {
    if (value === "unitToBool") return "Unit → boolean";
    const names: Record<string, string> = { list: "Static list", unitConnection: "Unit connection", class: "Unit class", caseConverter: "Case converter", mathConverter: "Math converter", knownSpells: "Known spells", hp: "Health", mana: "Mana", power: "Primary resource", groupMembers: "Party / raid members", aura: "Buff / debuff", spell: "Spell", gcd: "Global cooldown", cooldown: "Spell cooldown", cast: "Cast timer", swing: "Swing timer", totem: "Totem timer", channel: "Source channel" };
    return names[value] ?? value;
}
export function Action({ text, onClick, width }: { text: string; onClick(): void; width: number }) {
    if (width < 76) return <Button width={width} height={28} onClick={onClick}
        decorations={{ background: new Background({ color: colors.border }) }}><Label text={text} align="CENTER" fontSize={11} /></Button>;
    return <IconButton width={width} text={text} icon={actionIcon(text)} onClick={onClick} />;
}
export function Heading({ text, width }: { text: string; width: number }) {
    const view = <Label width={width} height={28} text={text} fontSize={12} color={colors.accent} />;
    (view.props as Record<string, unknown>).inspectorSection = true; return view;
}
export function Note({ text, width }: { text: string; width: number }) { return <Label width={width} height={Math.max(28, Math.ceil(text.length / Math.max(1, Math.floor(width / 5.5))) * 14)} text={text} fontSize={10} color={colors.muted} />; }
export interface FormState {
    values: Record<string, string>;
    Flush(): void;
    Capture(key: string, read: () => string): () => void;
    Set(key: string, value: string): void;
}
export function Input({ state, name, width, value }: { state: FormState; name: string; width: number; value?: string }) {
    return <Cell width={width} height={28} clickThrough={false}
        decorations={{ background: new Background({ color: colors.background }), border: new Border({ thickness: 1, color: colors.border }) }}
        onMount={frame => { const input = new TextInput(frame, { text: value ?? state.values[name] ?? "", maxBytes: 4096 }); const remove = state.Capture(name, () => input.Value); return () => { remove(); input.Dispose(); }; }} />;
}
export function Field({ state, name, title, rule = { type: "string" }, width, compact = false }: { state: FormState; name: string; title?: string; rule?: PropertyRule; width: number; compact?: boolean }) {
    if (rule.editor === "spell") return <SpellField state={state} name={name} title={title ?? friendly(name)} rule={rule} width={width} />;
    if (rule.editor === "icon") return <IconField state={state} name={name} title={title ?? friendly(name)} width={width} />;
    const value = state.values[name] ?? "";
    const options = rule.values?.map(value => ({ label: friendly(String(value)), value: String(value) }));
    const step = rule.max === 1 ? .05 : 1;
    const change = (amount: number) => { state.Flush(); const n = Number(state.values[name] ?? ""); state.Set(name, String(Math.max(rule.min ?? -100000, Math.min(rule.max ?? 100000, (Number.isFinite(n) ? n : 0) + amount)))); };
    return <FlowLayout width={width} height={48} gap={3}>
        <Label height={17} text={(title ?? friendly(name.split(".").slice(-1)[0])) + (rule.required ? " *" : "")} fontSize={10} color={colors.text} />
        {options !== undefined ? <Dropdown width={width} text={value === "" ? "Default" : friendly(value)} options={[{ label: "Default", value: "" }, ...options]} onSelect={value => state.Set(name, value)} />
            : (rule.type === "number" || rule.type === "size") && !compact ? <FlowLayout height={28} direction="horizontal" gap={3}>
                <Action text="-" width={22} onClick={() => change(-step)} />
                <Input state={state} name={name} width={width - 50} />
                <Action text="+" width={22} onClick={() => change(step)} />
            </FlowLayout> : <Input state={state} name={name} width={width} />}
    </FlowLayout>;
}
export function Toggle({ state, name, title, width, defaultValue = false }: { state: FormState; name: string; title?: string; width: number; defaultValue?: boolean }) {
    const raw = state.values[name] ?? "";
    const checked = raw === "" ? defaultValue : raw === "true";
    return <FlowLayout width={width} height={28} direction="horizontal" gap={4}>
        <Button width={width - 52} onClick={() => state.Set(name, checked ? "false" : "true")}>
            <FlowLayout direction="horizontal" gap={6}>
                <Label width={24} text={checked ? "[x]" : "[ ]"} color={colors.accent} fontSize={12} />
                <Label text={(title ?? friendly(name)) + (raw === "" ? " (default)" : "")} fontSize={10} />
            </FlowLayout>
        </Button>
        <Action text="Reset" width={48} onClick={() => state.Set(name, "")} />
    </FlowLayout>;
}
export function Pair({ children, width }: { children: View[]; width: number }) {
    return <FlowLayout width={width} height={48} direction="horizontal" gap={8}>{children}</FlowLayout>;
}
export function ColorFields({ state, name, title, width }: { state: FormState; name: string; title: string; width: number }) {
    const component = (key: string, fallback: number) => { const value = state.values[name + "." + key]; const n = value === "" || value === undefined ? fallback : Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback; };
    const color = { r: component("r",1), g: component("g",1), b: component("b",1), a: component("a",1) };
    const size = (width - 48) / 4;
    return <FlowLayout width={width} height={74} gap={3}>
        <Label height={17} text={title + " (0-1)"} fontSize={10} />
        <FlowLayout height={48} direction="horizontal" gap={6}>
            <Cell width={24} height={28} margin={{ top: 20 }} decorations={{ background: new Background({ color }), border: new Border({ color: colors.border, thickness: 1 }) }} />
            {["r","g","b","a"].map(key => <Field state={state} name={name + "." + key} title={friendly(key)} width={size} rule={{ type: "number", min: 0, max: 1 }} compact />)}
        </FlowLayout>
    </FlowLayout>;
}
export function ScrollForm({ width, height, rows, offset, remember, onViewport, gap = 8 }: { width: number; height: number; rows: View[]; offset: number; remember(offset: number): void; onViewport?(scroll: ScrollHost): void | (() => void); hint?: string; gap?: number }) {
    return <Cell width={width} height={Math.max(40, height)} onMount={host => {
        const thumb = host.CreateTexture(undefined, "OVERLAY");
        thumb.SetColorTexture(colors.accent.r, colors.accent.g, colors.accent.b, .55);
        let viewport: ScrollHost;
        const update = (value: number) => {
            remember(value);
            const range = viewport.Frame.GetVerticalScrollRange(), available = host.GetHeight();
            if (range <= 0) { thumb.Hide(); return; }
            const size = Math.max(18, available * available / (available + range));
            thumb.SetSize(3, size); thumb.ClearAllPoints();
            thumb.SetPoint("TOPRIGHT", host, "TOPRIGHT", -1, -(available - size) * value / range); thumb.Show();
        };
        viewport = new ScrollHost(host, update);
        let content: wuiraNativeFrame | undefined; let cleanup: void | (() => void);
        try {
            content = wuira.Mount(<FlowLayout width={width - 12} height={0} sizing="content" gap={gap}>{rows}</FlowLayout>, undefined, viewport.Frame);
            viewport.SetContent(content!, offset); cleanup = onViewport?.(viewport);
        } catch (failure) { viewport.Dispose(); thumb.Hide(); if (content !== undefined) wuira.Unmount(content); throw failure; }
        return () => { cleanup?.(); if (content !== undefined) wuira.Unmount(content); viewport.Dispose(); thumb.Hide(); };
    }} />;
}

/** Group section headings and their fields into bounded cards. */
export function InspectorSections(rows: View[], width: number): View[] {
    const sections: View[][] = [];
    for (const row of rows) {
        if (sections.length === 0 || (row.props as Record<string,unknown>).inspectorSection === true) sections.push([]);
        sections[sections.length-1].push(row);
    }
    return sections.map(children => <FlowLayout width={width} height={0} sizing="content" padding={10} gap={8}
        decorations={{background:new Background({color:colors.background}),border:new Border({thickness:1,color:colors.border})}}>{children}</FlowLayout>);
}
