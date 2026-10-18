import type { UnitSource } from "wuira/datasources";
import type { PresetDocument, PresetNode, SourceInstance } from "../../core/builder";

export function literalUnit(value: string): boolean {
    let token = value;
    while (token.endsWith("target") && token !== "target") token = token.slice(0, -6);
    if (["player", "target", "focus", "mouseover", "pet", "vehicle", "none"].includes(token)) return true;
    for (const prefix of ["party", "partypet", "raid", "raidpet", "arena", "arenapet", "boss", "nameplate"]) {
        if (token.startsWith(prefix)) { const suffix = token.slice(prefix.length); const number = Number(suffix); if (suffix !== "" && Number.isInteger(number) && number > 0 && String(number) === suffix) return true; }
    }
    return false;
}
export function typeNotPreset(node: Record<string, unknown>): boolean { return node.type !== "preset"; }
export function referenceDocument(document: PresetDocument, node: PresetNode): PresetDocument {
    const result = { ...document, ...node.activation } as PresetDocument;
    for (const field of ["class", "condition", "layout"] as const) if ((result as unknown as Record<string, unknown>)[field] === "") delete result[field];
    return result;
}
/** Old saved action components now use the core factories and need no addon owner. */
export function releaseRetiredOwner(document: { owner?: unknown }): boolean {
    if (document.owner !== "LumaUI_ActionBars") return false;
    delete document.owner;
    return true;
}
export interface UnitScope { unit: UnitSource; pet?: UnitSource; }
export interface ItemScope { value: object; bind?: () => SourceInstance; }
/** A Repeat owns this observable; consumers only own their subscriptions. */
export class RepeatItemValue {
    private readonly listeners = new Set<(value: object) => void>();
    public constructor(private readonly scope: ItemScope) {}
    public get Value(): object { return this.scope.value; }
    public IsSecret(): boolean { return issecretvalue(this.scope.value); }
    public onChange(listener: (value: object) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
    public Notify(): void { for (const listener of this.listeners) listener(this.scope.value); }
    public Dispose(): void { this.listeners.clear(); }
}
export function repeatReference(reference: string): { owner: string; field: "$item" | "$unit" | "$pet" } | undefined {
    for (const field of ["$item", "$unit", "$pet"] as const) if (reference.endsWith("." + field)) return { owner: reference.slice(0, -field.length - 1), field };
    return undefined;
}
