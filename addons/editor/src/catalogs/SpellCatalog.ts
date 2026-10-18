import { spellCatalogData } from "./data/SpellCatalog";
import type { SearchChoice } from "../fields/SearchDropdown";
interface Spell { id: number; name: string; rank: string; group: string; search: string; resolved?: boolean; native?: string; }
let entries: Spell[] | undefined, byId: Map<number, Spell> | undefined;
function catalog(): Spell[] {
    if (entries !== undefined) return entries;
    entries = []; byId = new Map();
    for (const chunk of spellCatalogData()) for (const row of chunk.split("\n")) {
        const [id, name, rank, group] = row.split("\t");
        const entry: Spell = { id: Number(id), name, rank, group, search: (name + " " + group + " " + id + " " + rank).toLowerCase() };
        entries.push(entry); byId.set(entry.id, entry);
    }
    return entries;
}
function resolve(entry: Spell): string {
    if (!entry.resolved) {
        const native = C_Spell?.GetSpellName?.(entry.id);
        if (native !== undefined && !issecretvalue(native) && typeof native === "string" && native !== "") entry.native = native;
        entry.resolved = true;
    }
    return entry.native ?? entry.name;
}
function matches(entry: Spell, tokens: string[]): boolean {
    const text = entry.search + (entry.native === undefined ? "" : " " + entry.native.toLowerCase());
    return tokens.every(token => text.includes(token));
}
export function spellChoice(value: string): SearchChoice {
    catalog();
    const id = Number(value), entry = byId!.get(id);
    let name: string;
    if (entry !== undefined) name = resolve(entry);
    else {
        const native = Number.isInteger(id) && id > 0 ? C_Spell?.GetSpellName?.(id) : undefined;
        name = native !== undefined && !issecretvalue(native) && typeof native === "string" ? native : "Unknown spell (" + value + ")";
    }
    const texture = Number.isInteger(id) && id > 0 ? C_Spell?.GetSpellTexture?.(id) : undefined;
    return { value, label: name, detail: entry === undefined ? "Existing selection" : (entry.rank !== "" ? entry.rank + " · " : "") + entry.group,
        icon: texture !== undefined && !issecretvalue(texture) ? texture : undefined, hint: name + " · Spell ID " + value };
}
export function searchSpells(query: string, excluded: readonly string[], limit = 48): SearchChoice[] {
    const search = query.trim().toLowerCase();
    if (search === "") return [];
    const tokens = search.split(" ").filter(token => token !== "");
    const selected = new Set(excluded), result: SearchChoice[] = [];
    for (const entry of catalog()) if (!selected.has(String(entry.id)) && matches(entry, tokens)) {
        result.push(spellChoice(String(entry.id)));
        if (result.length >= limit) break;
    }
    return result;
}
