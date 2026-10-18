import type { DataValue, Properties, PropertyRule, PropertyRules, PresetNode } from "lumaui/core";
import type { BindingField } from "./SourceEditor";
import type { EditorDraft } from "../draft/Draft";
import { isOverlayKey, overlayColors } from "../inspector/progressOverlays";
import { Core } from "../core";
export interface PropertyField { path: string[]; rule: PropertyRule; }
const categoryKeys: Record<string, string[]> = {
    "Size & spacing": ["width", "height", "margin", "padding"],
    "Position": ["mode", "anchor", "relativeAnchor", "relativeTo", "x", "y", "offset"],
    "Layout": ["sizing", "direction", "gap", "lineGap", "grow", "justify", "columns", "rowGap", "columnGap", "cellWidth", "cellHeight"],
    "Appearance": ["alpha", "condition", "clickThrough", "backgroundColor", "borderColor", "borderWidth", "foreground", "background", "backdrop", "color", "texture"],
    "Progress": ["min", "max", "current", "value", "orientation", "reverse"],
    "Icon & text": ["text", "font", "fontSize", "align", "texCoords"],
    "Actions": ["action", "binding", "showHotkey", "finishGlow", "button"],
};
const unitNumber: PropertyRule = { type: "number", min: 0, max: 1 };
function nested(rule: PropertyRule): PropertyRules | undefined {
    if (rule.type === "color") return { r: unitNumber, g: unitNumber, b: unitNumber, a: unitNumber };
    if (rule.type === "offset") return { x: { type: "number" }, y: { type: "number" } };
    if (rule.type === "spacing") return { top: { type: "number" }, right: { type: "number" }, bottom: { type: "number" }, left: { type: "number" } };
    if (rule.type === "border") return { color: { type: "color" }, thickness: { type: "number" }, radius: { type: "number" }, texture: { type: "string" } };
    if (rule.type === "textureOptions" || rule.type === "background") return {
        texture: { type: "string" }, color: { type: "color" }, tileX: { type: "boolean" }, tileY: { type: "boolean" },
        texCoords: { type: "texCoords" }, blendMode: { type: "string", values: ["BLEND", "ADD", "MOD", "DISABLE", "ALPHAKEY"] },
    };
    if (rule.type === "action") return { type: { type: "string", values: ["spell", "item", "macro", "action", "target"] },
        spell: { type: "string" }, item: { type: "string" }, macro: { type: "string" }, slot: { type: "number" }, unit: { type: "string" } };
    return undefined;
}
function clone(value: DataValue): DataValue {
    if (Array.isArray(value)) return value.map(clone);
    if (typeof value !== "object") return value;
    const output: Properties = {}; for (const [key, child] of Object.entries(value)) output[key] = clone(child); return output;
}
function read(props: Properties, path: string[]): DataValue | undefined {
    let value: DataValue | undefined = props;
    for (const key of path) {
        if (value === undefined) return undefined;
        if (typeof value === "number" && ["top", "right", "bottom", "left"].includes(key)) return value;
        if (typeof value !== "object" || Array.isArray(value)) return undefined;
        value = value[key];
    }
    return value;
}
function write(props: Properties, path: string[], value: DataValue | undefined): void {
    let parent = props;
    for (const part of path.slice(0, -1)) {
        const old = parent[part];
        if (typeof old !== "object" || Array.isArray(old)) parent[part] = typeof old === "number"
            ? { top: old, right: old, bottom: old, left: old } : {};
        parent = parent[part] as Properties;
    }
    const last = path[path.length - 1]; if (value === undefined) delete parent[last]; else parent[last] = value;
}
/** Stages all property edits so compound values can be validated atomically. */
export class PropertyEditor {
    public nodeId = "";
    public connectionErrors: Record<string, string> = {};
    public RejectedConnection = false;
    public DismissConnectionError(name: string): void {
        delete this.connectionErrors[name]; this.draft.Report("Connection unchanged. You can edit it again or select another element.");
    }
    public panel = "Display";
    public scroll: Record<string, number> = {};
    public RewriteReferences(oldName: string, newName: string): void {
        this.Flush();
        const node = this.draft.nodes.find(node => node.id === this.nodeId);
        const fields = [...(node?.kind !== "hideUnitFrame" ? ["unit"] : []), ...(node?.kind === "blizzardElement" ? ["filter"] : [])];
        for (const key of fields) {
            if (this.values[key] === oldName) this.values[key] = newName;
            if (this.baseline[key] === oldName) this.baseline[key] = newName;
            if (this.props[key] === oldName) this.props[key] = newName;
        }
        for (const key of Object.keys(this.values).filter(key => key.startsWith("$input."))) {
            if (this.values[key] === oldName) this.values[key] = newName;
            if (this.baseline[key] === oldName) this.baseline[key] = newName;
        }
        this.inputs.clear();
    }
    public Section(panel: string): void { this.Flush(); this.panel = panel; Core.RefreshCustomization(); }
    public Set(key: string, value: string): void {
        this.Flush();
        if ((this.Rules[key]?.type === "background" || this.Rules[key]?.type === "border") && value === "true") value = "";
        this.values[key] = value; if (key.startsWith("$input.")) delete this.connectionErrors[key.slice(7)]; this.inputs.clear(); Core.RefreshCustomization();
    }
    public category = "Size & spacing";
    public bindingPath = "";
    public visiblePath = "";
    public visibleWhen: "true" | "false" = "true";
    public pendingBinding?: { target: string; source: string; path: string };
    public itemsExpression = "";
    public binding: BindingField = "source";
    public values: Record<string, string> = {};
    private baseline: Record<string, string> = {};
    private baselineItems = "";
    private props: Properties = {};
    private inputs = new Map<string, () => string>();
    public constructor(private readonly draft: EditorDraft) {}
    public get Rules(): PropertyRules { if (this.draft.nodes.length === 0) return {}; return Core.Presets.ComponentProperties(this.draft.Selected.kind === "action" ? "secureButton" : this.draft.Selected.kind); }
    public get Categories(): string[] {
        const rules = this.Rules;
        const categories = Object.keys(categoryKeys).filter(category => categoryKeys[category].some(key => rules[key] !== undefined));
        if (Object.keys(rules).some(key => !Object.values(categoryKeys).some(keys => keys.includes(key)))) categories.push("Other");
        return categories;
    }
    public Fields(all = false): PropertyField[] {
        const result: PropertyField[] = []; const rules = this.Rules;
        const expand = (path: string[], rule: PropertyRule) => {
            result.push({ path, rule }); const children = nested(rule);
            for (const [key, child] of Object.entries(children ?? {})) expand([...path, key], child);
        };
        for (const [key, rule] of Object.entries(rules)) {
            const category = Object.keys(categoryKeys).find(category => categoryKeys[category].includes(key)) ?? "Other";
            if (all || category === this.category) expand([key], rule);
        }
        return result;
    }
    public Ensure(): void { if (this.nodeId !== this.draft.selected) this.Open(); }
    public Open(): void {
        this.connectionErrors = {}; this.RejectedConnection = false; this.pendingBinding = undefined;
        this.inputs.clear(); if (this.nodeId !== this.draft.selected) this.scroll = {}; this.nodeId = this.draft.selected; this.values = {}; this.baseline = {};
        if (this.draft.nodes.length === 0) { this.props = {}; this.bindingPath = ""; this.visiblePath = ""; this.visibleWhen = "true"; this.itemsExpression = ""; this.baselineItems = ""; return; }
        const find = (node: PresetNode): PresetNode | undefined => {
            if (node.id === this.nodeId) return node;
            for (const child of node.children ?? []) { const match = find(child); if (match !== undefined) return match; }
            return undefined;
        };
        this.props = clone(find(this.draft.Document().root)!.props) as Properties;
        if (!this.Categories.includes(this.category)) this.category = this.Categories[0];
        for (const field of this.Fields(true)) {
            const value = read(this.props, field.path);
            const text = value === undefined || (typeof value === "object" && !Array.isArray(value)) ? "" : Array.isArray(value) ? value.length === 0 ? "[]" : value.join(", ") : String(value);
            this.values[field.path.join(".")] = text; this.baseline[field.path.join(".")] = text;
        }
        for (const target of ["backgroundColor", "borderColor", "alpha", "color"]) {
            const key = "$property." + target + ".path", value = this.draft.Selected.bindings?.[target]?.path ?? "";
            this.values[key] = value; this.baseline[key] = value;
        }
        if (this.draft.Selected.kind === "preset") {
            const document = this.draft.dependencies.find(doc => doc.id === this.draft.Selected.preset) ?? Core.Presets.Get(this.draft.Selected.preset!);
            for (const input of document?.sources.filter(source => source.isProp) ?? []) {
                const key = "$input." + input.name, value = this.draft.Selected.sourceProps?.[input.name] ?? "";
                this.values[key] = value; this.baseline[key] = value;
            }
        }
        this.bindingPath = this.draft.Selected.sourcePath ?? "";
        this.visiblePath = this.draft.Selected.visiblePath ?? "";
        this.visibleWhen = this.draft.Selected.visibleWhen === "false" ? "false" : "true";
        this.itemsExpression = this.draft.Selected.items ?? ""; this.baselineItems = this.itemsExpression;
        this.SyncOverlays();
    }
    public SyncOverlays(): void {
        for (const key of Object.keys(this.values)) if (key.startsWith("$overlay.")) { delete this.values[key]; delete this.baseline[key]; }
        if (this.draft.nodes.length === 0) return;
        for (const [index, section] of (this.draft.Selected.sections ?? []).entries()) {
            if (!isOverlayKey(section.key)) continue;
            const texture = "$overlay." + index + ".texture";
            this.values[texture] = section.texture ?? ""; this.baseline[texture] = this.values[texture];
            const color = section.color ?? overlayColors[section.key] ?? overlayColors.progress;
            for (const channel of ["r", "g", "b", "a"] as const) {
                const key = "$overlay." + index + ".color." + channel;
                const value = color[channel];
                this.values[key] = value === undefined ? "" : String(value); this.baseline[key] = this.values[key];
            }
        }
    }
    public CommitOverlays(): void {
        if (this.draft.nodes.length === 0 || this.draft.Selected.kind !== "progress") return;
        this.Flush();
        const node = this.draft.Selected;
        const sections = [...(node.sections ?? [])];
        let changed = false;
        for (let index = 0; index < sections.length; index++) {
            const section = sections[index];
            if (!isOverlayKey(section.key)) continue;
            const textureKey = "$overlay." + index + ".texture";
            const colorKey = "$overlay." + index + ".color.r";
            if (this.values[textureKey] === undefined && this.values[colorKey] === undefined) continue;
            const texture = (this.values[textureKey] ?? section.texture ?? "").trim();
            const previous = section.color ?? overlayColors[section.key] ?? overlayColors.progress;
            const read = (channel: string, fallback: number) => {
                const raw = this.values["$overlay." + index + ".color." + channel];
                if (raw === undefined || raw === "") return fallback;
                const value = Number(raw);
                return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
            };
            const color = { r: read("r", previous.r), g: read("g", previous.g), b: read("b", previous.b), a: read("a", previous.a ?? 1) };
            const next = { ...section, color, ...(texture === "" ? {} : { texture }) };
            if (texture === "") delete next.texture;
            sections[index] = next; changed = true;
        }
        if (changed) node.sections = sections;
    }
    public Capture(key: string, read: () => string): () => void {
        this.inputs.set(key, read); return () => { if (this.inputs.get(key) === read) { if (key === "$path") this.bindingPath = read(); else if (key === "$visiblePath") this.visiblePath = read(); else if (key === "$items") this.itemsExpression = read(); else this.values[key] = read(); this.inputs.delete(key); } };
    }
    public Flush(): void { for (const [key, read] of this.inputs) { if (key === "$path") this.bindingPath = read(); else if (key === "$visiblePath") this.visiblePath = read(); else if (key === "$items") this.itemsExpression = read(); else this.values[key] = read(); } }
    public Bind(name?: string): void {
        this.Flush();
        const pending = Object.entries(this.values).filter(([key, value]) => value !== this.baseline[key]);
        const previousPath = this.bindingPath, pendingItems = this.itemsExpression !== this.baselineItems ? this.itemsExpression : undefined;
        const visibility = this.binding === "visibleSource";
        this.draft.BindSource(name, this.binding, visibility ? this.visiblePath : this.binding === "source" || this.binding === "textSource" ? this.bindingPath : undefined, visibility ? this.visibleWhen : undefined);
        const replacedProgress = this.binding === "source" && name !== undefined && this.draft.Selected.source === name && this.draft.Selected.kind === "progress";
        this.Open();
        for (const [key, value] of pending) if (!replacedProgress || !["min", "max", "current", "value"].includes(key)) this.values[key] = value;
        if (this.binding !== "source") { this.bindingPath = previousPath; if (pendingItems !== undefined) this.itemsExpression = pendingItems; }
    }
    public get HasChanges(): boolean { this.Flush(); if (this.draft.nodes.length === 0) return false; const node = this.draft.Selected; return this.nodeId === this.draft.selected && (this.pendingBinding !== undefined || Object.keys(this.values).some(key => this.values[key] !== this.baseline[key]) || this.bindingPath !== (node.sourcePath ?? "") || this.visiblePath !== (node.visiblePath ?? "") || this.visibleWhen !== (node.visibleWhen === "false" ? "false" : "true") || this.itemsExpression !== this.baselineItems); }
    public Save(): boolean {
        this.Flush();
        if (this.draft.nodes.length === 0) return true;
        const oldInputs = this.draft.Selected.sourceProps;
        const oldSections = this.draft.Selected.sections;
        const errors: Record<string, string> = {}; this.RejectedConnection = false;
        try {
            if (this.draft.Selected.kind === "preset") {
                const inputs = { ...oldInputs };
                for (const [key, value] of Object.entries(this.values)) if (key.startsWith("$input.") && value !== this.baseline[key]) {
                    const name = key.slice(7), reference = value.trim();
                    if (reference === "") delete inputs[name];
                    else { const error = this.draft.ReferenceSourceError(name, reference); if (error !== undefined) errors[name] = error; else inputs[name] = reference; }
                }
                if (Object.keys(errors).length > 0) throw Object.values(errors).join(" ");
                this.draft.Selected.sourceProps = inputs;
            }
            const props = clone(this.props) as Properties;
            for (const field of this.Fields(true)) {
                const key = field.path.join("."); const raw = (this.values[key] ?? "").trim();
                if (raw === this.baseline[key]) continue;
                const type = field.rule.type;
                let value: DataValue | undefined;
                if (raw === "") value = undefined;
                else if (type === "texture") value = raw.trim() !== "" && Number.isInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : raw;
                else if (type === "number" || type === "spacing" || type === "size") value = raw === "inherit" && type === "size" ? raw : Number(raw);
                else if (type === "boolean" || type === "background" || type === "border") {
                    if (raw !== "true" && raw !== "false") throw "Use true, false or leave empty";
                    value = raw === "true";
                } else if (type === "texCoords" || type === "numbers") value = raw === "[]" && type === "numbers" ? [] : raw.split(",").map(value => Number(value.trim()));
                else if (nested(field.rule) !== undefined) throw "Edit the fields inside " + key;
                else value = raw;
                write(props, field.path, value);
            }
            // Editing one channel of a new color still produces a complete RGB value.
            for (const field of this.Fields(true)) if (field.rule.type === "color") {
                const value = read(props,field.path);
                if (value !== undefined && typeof value === "object" && !Array.isArray(value)) {
                    for (const key of ["r","g","b"]) if (value[key] === undefined) value[key] = 1;
                }
            }
            const action = props.action;
            if (action !== undefined && typeof action === "object" && !Array.isArray(action)) {
                const payload: Record<string, string> = { spell: "spell", item: "item", macro: "macro", action: "slot", target: "unit" };
                for (const key of ["spell", "item", "macro", "slot"]) if (key !== payload[String(action.type)]) delete action[key];
                if (action.type === "macro") delete action.unit;
            }
            const bindings = { ...this.draft.Selected.bindings };
            for (const [target, binding] of Object.entries(bindings)) {
                const path = (this.values["$property." + target + ".path"] ?? binding.path ?? "").trim();
                bindings[target] = { source: binding.source, ...(path === "" ? {} : { path }) };
            }
            if (this.pendingBinding !== undefined) {
                const pending = this.pendingBinding;
                const path = (this.values["$property." + pending.target + ".path"] ?? pending.path).trim();
                bindings[pending.target] = { source: pending.source, ...(path === "" ? {} : { path }) };
            }
            this.CommitOverlays();
            this.draft.UpdateProperties(props, this.bindingPath, this.itemsExpression === this.baselineItems ? undefined : this.itemsExpression, bindings, { path: this.visiblePath, when: this.visibleWhen }); this.Open(); return true;
        } catch (failure) {
            this.draft.Selected.sourceProps = oldInputs;
            this.draft.Selected.sections = oldSections;
            if (Object.keys(errors).length > 0) {
                // Flush all other fields first, then detach native reads so unmount cannot
                // put the rejected text back. Preserve unrelated pending edits.
                this.Flush(); this.inputs.clear(); this.RejectedConnection = true;
                for (const [name, error] of Object.entries(errors)) {
                    const key = "$input." + name, accepted = oldInputs?.[name] ?? "";
                    this.values[key] = accepted; this.baseline[key] = accepted; this.connectionErrors[name] = error;
                }
            }
            this.draft.Report(String(failure)); return false;
        }
    }
}
