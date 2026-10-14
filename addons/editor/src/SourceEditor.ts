import type { DataValue, Properties, SourceSpec } from "lumaui/core";
import type { EditorDraft } from "./Draft";
import { Core } from "./core";

export type BindingField = "source" | "visibleSource" | "textSource" | "alphaSource";
/** A detached form: invalid or unfinished entries never replace a working source. */
export class SourceEditor {
    public scroll = 0;
    public Set(key: string, value: string): void {
        this.Flush(); if (key === "$name") this.name = value; else this.values[key] = value;
        this.inputs.clear(); Core.RefreshCustomization();
    }
    public original?: string;
    public name = "";
    public type = "hp";
    public values: Record<string, string> = {};
    private inputs = new Map<string, () => string>();
    public constructor(private readonly draft: EditorDraft) {}
    public Capture(key: string, read: () => string): () => void {
        this.inputs.set(key, read);
        return () => { if (this.inputs.get(key) === read) this.inputs.delete(key); };
    }
    public Flush(): void {
        for (const [key, read] of this.inputs) {
            if (key === "$name") this.name = read(); else this.values[key] = read();
        }
    }
    public Open(name?: string): void {
        this.Flush(); this.inputs.clear();
        const source = this.draft.sources.find(source => source.name === name);
        this.scroll = 0; this.original = source?.name; this.name = source?.name ?? this.NewName();
        this.type = source?.type ?? Core.Presets.SourceTypes()[0];
        this.values = {};
        for (const [key, value] of Object.entries(source?.props ?? {})) this.values[key] = this.Format(value);
        Core.RefreshCustomization();
    }
    private NewName(): string {
        let n = 1; while (this.draft.sources.some(source => source.name === "source-" + n)) n++;
        return "source-" + n;
    }
    public Type(type: string): void {
        if (this.original !== undefined || !Core.Presets.SourceTypes().includes(type)) return;
        this.Flush(); this.inputs.clear(); this.type = type; this.values = {}; Core.RefreshCustomization();
    }
    public Save(): void {
        this.Flush();
        try {
            const props: Properties = {};
            const rules = Core.Presets.SourceProperties(this.type);
            for (const [key, rule] of Object.entries(rules)) {
                const raw = (this.values[key] ?? "").trim();
                if (raw === "") continue;
                if (rule.type === "string") props[key] = raw;
                else if (rule.type === "number") props[key] = Number(raw);
                else if (rule.type === "boolean") {
                    if (raw !== "true" && raw !== "false") throw key + ": use true or false";
                    props[key] = raw === "true";
                } else if (rule.type === "numbers") props[key] = raw.split(",").map(value => Number(value.trim()));
                else throw "This property requires a structured editor: " + key;
            }
            const name = this.original ?? this.name.trim();
            if (this.original === undefined && this.draft.sources.some(source => source.name === name)) throw "Source name already exists";
            const source: SourceSpec = { name, type: this.type, props };
            const sources = this.original === undefined ? [...this.draft.sources, source]
                : this.draft.sources.map(existing => existing.name === this.original ? source : existing);
            this.draft.UpdateSources(sources);
            this.original = name; this.name = name;
        } catch (failure) { this.draft.Report(String(failure)); }
    }
    public Delete(): void {
        if (this.original === undefined) return;
        try {
            this.draft.UpdateSources(this.draft.sources.filter(source => source.name !== this.original));
            this.Open(this.draft.sources[0]?.name);
        } catch (failure) { this.draft.Report("Unbind dependent elements/sources first. " + String(failure)); }
    }
    private Format(value: DataValue): string {
        return Array.isArray(value) ? value.join(", ") : typeof value === "object" ? "[structured value]" : String(value);
    }
}
