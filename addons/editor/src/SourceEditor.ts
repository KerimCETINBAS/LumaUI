import type { DataValue, Properties, SourceSpec } from "lumaui/core";
import type { EditorDraft } from "./Draft";
import { formatCases, formatOutput, parseCases, parseOutput } from "./ConverterForm";
import { equalData } from "./EditHistory";
import { Core } from "./core";

export type BindingField = "source" | "visibleSource" | "textSource" | "alphaSource";
/** Each source owns a detached form; the coordinator stages all dirty forms atomically. */
export class SourceEditor {
    public scroll = 0;
    public original?: string;
    public name = "";
    public type = "hp";
    public isProp = false;
    public optional = false;
    private baselineProp = false;
    private baselineOptional = false;
    public values: Record<string, string> = {};
    private originalProps: Properties = {};
    private savedSpec?: SourceSpec;
    private inputs = new Map<string, () => string>();
    private baselineName = "";
    private baselineType = "hp";
    private baseline: Record<string, string> = {};
    private forms = new Map<string, SourceEditor>();
    public constructor(private readonly draft: EditorDraft) {}
    private Accept(): void { this.baselineProp = this.isProp; this.baselineOptional = this.optional; this.baselineName = this.name; this.baselineType = this.type; this.baseline = { ...this.values }; }
    private get OwnChanges(): boolean { this.FlushOwn(); return this.isProp !== this.baselineProp || this.optional !== this.baselineOptional || this.name !== this.baselineName || this.type !== this.baselineType || [...Object.keys(this.values), ...Object.keys(this.baseline)].some(key => this.values[key] !== this.baseline[key]); }
    public get HasChanges(): boolean { return this.AllForms().some(form => form.OwnChanges); }
    private AllForms(): SourceEditor[] {
        for (const [name] of this.forms) if (!this.draft.sources.some(source => source.name === name)) this.forms.delete(name);
        return [this, ...Array.from(this.forms.values()).filter(form => form.original !== this.original)];
    }
    public For(name: string): SourceEditor {
        if (this.original === name) { const source = this.draft.sources.find(source => source.name === name); if (!this.OwnChanges && !equalData(source, this.savedSpec)) this.Open(name, false); return this; }
        let form = this.forms.get(name);
        if (form === undefined) { form = new SourceEditor(this.draft); form.Open(name, false); this.forms.set(name, form); }
        const source = this.draft.sources.find(source => source.name === name);
        if (!form.OwnChanges && !equalData(source, form.savedSpec)) form.Open(name, false);
        return form;
    }
    public BeginNew(): void { if (this.SaveAll()) { this.Open(); this.scroll = 1000000; } }
    public Set(key: string, value: string): void {
        this.Flush(); if (key === "$name") this.name = value; else this.values[key] = value;
        this.inputs.clear(); Core.RefreshCustomization();
    }
    public Reset(): void {
        this.inputs.clear(); this.forms.clear(); this.original = undefined; this.name = ""; this.type = "hp"; this.isProp = false; this.optional = false; this.values = {}; this.originalProps = {}; this.savedSpec = undefined; this.scroll = 0; this.Accept();
    }
    public Capture(key: string, read: () => string): () => void {
        this.inputs.set(key, read);
        return () => { if (this.inputs.get(key) === read) { if (key === "$name") this.name = read(); else this.values[key] = read(); this.inputs.delete(key); } };
    }
    private FlushOwn(): void {
        for (const [key, read] of this.inputs) { if (key === "$name") this.name = read(); else this.values[key] = read(); }
    }
    public Flush(): void { for (const form of this.AllForms()) form.FlushOwn(); }
    public Open(name?: string, refresh = true): void {
        this.Flush(); this.inputs.clear();
        const source = this.draft.sources.find(source => source.name === name);
        this.original = source?.name; this.name = source?.name ?? this.NewName();
        this.type = source?.type ?? (Core.Presets.SourceTypes().includes("hp") ? "hp" : Core.Presets.SourceTypes()[0]);
        this.isProp = source?.isProp === true; this.optional = source?.optional === true; this.savedSpec = source; this.ReadValues(source?.props ?? {}); this.Accept();
        if (refresh) Core.RefreshCustomization();
    }
    private NewName(): string {
        let n = 1; while (this.draft.sources.some(source => source.name === "source-" + n)) n++;
        return "source-" + n;
    }
    public Type(type: string): void {
        if (this.original !== undefined || !Core.Presets.SourceTypes().includes(type)) return;
        this.Flush(); this.inputs.clear(); this.type = type; this.ReadValues({});
        if (type === "mathConverter") this.values.expression = "2 * input";
        Core.RefreshCustomization();
    }
    public Expose(value: boolean): void { this.Flush(); this.isProp = value; if (!value) this.optional = false; Core.RefreshCustomization(); }
    public SetOptional(value: boolean): void { this.optional = value; Core.RefreshCustomization(); }
    private Spec(): SourceSpec {
        this.FlushOwn();
        if (this.isProp) return { name: this.original ?? this.name.trim(), type: this.type, props: {}, isProp: true, optional: this.optional };
        const props: Properties = {}, rules = Core.Presets.SourceProperties(this.type);
        for (const [key, rule] of Object.entries(rules)) {
            if (rule.type === "cases") { props[key] = parseCases(this.values, this.originalProps[key]); continue; }
            if (rule.type === "value") { const value = parseOutput(this.values, key, this.originalProps[key]); if (value !== undefined) props[key] = value; continue; }
            const raw = (this.values[key] ?? "").trim(); if (raw === "") continue;
            if (rule.type === "string") props[key] = raw;
            else if (rule.type === "number") props[key] = Number(raw);
            else if (rule.type === "boolean") {
                if (raw !== "true" && raw !== "false") throw key + ": use true or false";
                props[key] = raw === "true";
            } else if (rule.type === "numbers") props[key] = raw === "[]" ? [] : raw.split(",").map(value => Number(value.trim()));
            else throw "This property requires a structured editor: " + key;
        }
        return { name: this.original ?? this.name.trim(), type: this.type, props };
    }
    private CommitForms(forms: SourceEditor[]): boolean {
        try {
            const staged = forms.map(form => ({ form, spec: form.Spec() }));
            let sources = this.draft.sources.slice();
            for (const { form, spec } of staged) {
                if (form.original === undefined) {
                    if (sources.some(source => source.name === spec.name)) throw "Source name already exists";
                    sources.push(spec);
                } else sources = sources.map(source => source.name === form.original ? spec : source);
            }
            this.draft.UpdateSources(sources);
            for (const { form, spec } of staged) {
                form.original = spec.name; form.name = spec.name; form.savedSpec = spec;
                form.inputs.clear(); form.ReadValues(spec.props); form.Accept();
            }
            return true;
        } catch (failure) { this.draft.Report(String(failure)); return false; }
    }
    public Save(): boolean { return this.CommitForms([this]); }
    public SaveAll(): boolean {
        this.Flush(); const changed = this.AllForms().filter(form => form.OwnChanges);
        return changed.length === 0 || this.CommitForms(changed);
    }
    public Delete(): void {
        if (this.original === undefined) { this.inputs.clear(); this.name = ""; this.type = "hp"; this.values = {}; this.originalProps = {}; this.savedSpec = undefined; this.Accept(); Core.RefreshCustomization(); return; }
        try {
            this.draft.UpdateSources(this.draft.sources.filter(source => source.name !== this.original));
            this.Open(this.draft.sources[0]?.name);
        } catch (failure) { this.draft.Report("Unbind dependent elements/sources first. " + String(failure)); }
    }
    private ReadValues(props: Properties): void {
        this.values = {}; this.originalProps = props;
        const rules = Core.Presets.SourceProperties(this.type);
        for (const [key, rule] of Object.entries(rules)) {
            const value = props[key];
            if (rule.type === "cases") formatCases(this.values, value);
            else if (rule.type === "value") formatOutput(this.values, key, value);
            else if (value !== undefined) this.values[key] = this.Format(value);
        }
    }
    public AddCase(): void {
        this.Flush(); const count = Number(this.values["cases.count"] ?? "0"); if (count >= 64) return;
        const prefix = "cases." + count; this.values[prefix + ".matchType"] = "string"; this.values[prefix + ".equals"] = "";
        formatOutput(this.values, prefix + ".output", { r: 1, g: 1, b: 1, a: 1 }); this.Set("cases.count", String(count + 1));
    }
    public RemoveCase(index: number): void {
        this.Flush(); const count = Number(this.values["cases.count"] ?? "0"), old = { ...this.values };
        for (const key of Object.keys(this.values)) if (key.startsWith("cases.")) delete this.values[key];
        for (let row = 0, next = 0; row < count; row++) {
            if (row === index) continue;
            const prefix = "cases." + row + ".";
            for (const [key, value] of Object.entries(old)) if (key.startsWith(prefix)) this.values["cases." + next + "." + key.slice(prefix.length)] = value;
            next++;
        }
        this.inputs.clear(); this.Set("cases.count", String(Math.max(0, count - 1)));
    }
    private Format(value: DataValue): string {
        return Array.isArray(value) ? value.length === 0 ? "[]" : value.join(", ") : typeof value === "object" ? "[structured value]" : String(value);
    }
}
