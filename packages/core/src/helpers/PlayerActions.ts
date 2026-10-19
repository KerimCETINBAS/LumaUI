import { KnownSpells, UseSource } from "wuira/datasources";
import type { ClickCastAction, PlayerAction, PlayerActionList } from "../core/builder";

declare const GetInventoryItemID: ((this: void, unit: string, slot: number) => number | undefined) | undefined;
declare const GetNumMacros: ((this: void) => wuiraNativeReturns<[number, number]>) | undefined;
declare const GetMacroInfo: ((this: void, index: number | string) => wuiraNativeReturns<[string | undefined, number | undefined, string | undefined]>) | undefined;
declare const MAX_ACCOUNT_MACROS: number | undefined;
declare const Constants: { MacroConsts?: { MAX_ACCOUNT_MACROS?: number } } | undefined;
declare const NUM_BAG_SLOTS: number | undefined;
declare const C_Item: {
    GetItemSpell?: (this: void, id: number) => wuiraNativeReturns<[string | undefined, number | undefined]>;
    GetItemNameByID?: (this: void, id: number) => string | undefined;
    GetItemIconByID?: (this: void, id: number) => number | undefined;
    GetItemInfoInstant?: (this: void, id: number) => wuiraNativeReturns<[number, string, string, string, number, number, number]>;
    RequestLoadItemDataByID?: (this: void, id: number) => void;
} | undefined;
declare const C_Container: {
    GetContainerNumSlots?: (this: void, bag: number) => number;
    GetContainerItemID?: (this: void, bag: number, slot: number) => number | undefined;
} | undefined;
function readableId(id: unknown): id is number { return !issecretvalue(id) && typeof id === "number" && Number.isInteger(id) && id > 0; }
function publicName(name: unknown): name is string { return !issecretvalue(name) && typeof name === "string" && name.trim() !== ""; }
export function actionLabel(action: ClickCastAction): string {
    if (action.macro !== undefined) return "Macro · " + action.macro;
    const name = action.spellId !== undefined ? C_Spell?.GetSpellName?.(action.spellId) : C_Item?.GetItemNameByID?.(action.itemId!);
    return publicName(name) ? name : (action.spellId !== undefined ? "Spell #" + action.spellId : "Item #" + action.itemId);
}
/** Character-owned choices only. Reads are cached; native events refresh the list. */
export class PlayerActionCollection implements PlayerActionList {
    private readonly spells = UseSource(KnownSpells);
    private readonly frame = CreateFrame("Frame", undefined, UIParent);
    private readonly listeners = new Set<(items: readonly PlayerAction[]) => void>();
    private readonly requested = new Set<number>();
    private readonly stopSpells: () => void;
    private snapshot: readonly PlayerAction[] = [];
    private disposed = false;
    private refreshing = false;
    private pending = false;
    public constructor() {
        this.stopSpells = this.spells.onChange(() => this.Refresh());
        for (const event of ["PLAYER_ENTERING_WORLD", "PLAYER_EQUIPMENT_CHANGED", "BAG_UPDATE_DELAYED", "GET_ITEM_INFO_RECEIVED", "ITEM_DATA_LOAD_RESULT", "UPDATE_MACROS"]) this.frame.RegisterEvent(event);
        this.frame.SetScript("OnEvent", (_host, event, id) => { if (!["GET_ITEM_INFO_RECEIVED", "ITEM_DATA_LOAD_RESULT"].includes(event) || !issecretvalue(id) && this.requested.has(id as unknown as number)) this.Refresh(); });
        this.Refresh();
    }
    public get Status() { return this.spells.Status; }
    public get Value(): readonly PlayerAction[] { return this.snapshot.map(item => ({ ...item, action: { ...item.action } })); }
    private Refresh(): void {
        if (this.disposed) return;
        // Item cache notifications may be synchronous. Coalesce them without recursive scans.
        if (this.refreshing) { this.pending = true; return; }
        this.refreshing = true;
        try { do { this.pending = false; this.ReadActions(); } while (this.pending && !this.disposed); }
        finally { this.refreshing = false; }
    }
    private ReadActions(): void {
        const next: PlayerAction[] = [];
        for (const spell of this.spells.Entries) {
            if (spell.isPassive !== false || !publicName(spell.name)) continue;
            const icon = C_Spell?.GetSpellTexture?.(spell.id);
            next.push({ key: "spell:" + spell.id, category: "spell", name: spell.name, icon: readableId(icon) ? icon : undefined, action: { spellId: spell.id } });
        }
        const items = new Set<number>();
        const addItem = (id: unknown, equipped: boolean) => {
            if (!readableId(id) || items.has(id)) return;
            items.add(id);
            if (!this.requested.has(id)) { this.requested.add(id); C_Item?.RequestLoadItemDataByID?.(id); }
            if (C_Item?.GetItemSpell === undefined) return;
            const [effect, spellId] = C_Item.GetItemSpell(id);
            if (!publicName(effect) || !readableId(spellId)) return;
            const name = C_Item.GetItemNameByID?.(id);
            if (!publicName(name)) return;
            let consumable = false;
            if (!equipped && C_Item.GetItemInfoInstant !== undefined) { const [, , , , , classId] = C_Item.GetItemInfoInstant(id); consumable = !issecretvalue(classId) && classId === 0; }
            const icon = C_Item.GetItemIconByID?.(id);
            next.push({ key: "item:" + id, category: consumable ? "consumable" : "item", name, detail: effect, equipped, icon: readableId(icon) ? icon : undefined, action: { itemId: id } });
        };
        try { if (GetInventoryItemID !== undefined) for (let slot = 1; slot <= 19; slot++) addItem(GetInventoryItemID("player", slot), true); } catch { /* A restricted native section does not discard readable spells. */ }
        try {
            if (C_Container?.GetContainerNumSlots !== undefined && C_Container.GetContainerItemID !== undefined) {
                const bags = readableId(NUM_BAG_SLOTS) ? Math.min(NUM_BAG_SLOTS, 8) : 4;
                for (let bag = 0; bag <= bags; bag++) {
                    const slots = C_Container.GetContainerNumSlots(bag);
                    if (issecretvalue(slots) || !Number.isInteger(slots) || slots < 0 || slots > 128) continue;
                    for (let slot = 1; slot <= slots; slot++) addItem(C_Container.GetContainerItemID(bag, slot), false);
                }
            }
        } catch { /* Restricted bag data is omitted. */ }
        try {
            if (GetNumMacros !== undefined && GetMacroInfo !== undefined) {
                const [account, character] = GetNumMacros();
                if (!issecretvalue(account) && !issecretvalue(character) && Number.isInteger(account) && Number.isInteger(character)) {
                    const macros: PlayerAction[] = [], counts = new Map<string, number>();
                    const nativeLimit = Constants?.MacroConsts?.MAX_ACCOUNT_MACROS ?? MAX_ACCOUNT_MACROS;
                    const start = readableId(nativeLimit) ? nativeLimit : 120;
                    for (const [offset, count] of [[0, account], [start, character]]) for (let index = 1; index <= Math.min(Math.max(0, count), 200); index++) {
                        const [name, icon] = GetMacroInfo(offset + index);
                        if (!publicName(name)) continue;
                        counts.set(name, (counts.get(name) ?? 0) + 1);
                        macros.push({ key: "macro:" + name, category: "macro", name, icon: readableId(icon) ? icon : undefined, action: { macro: name } });
                    }
                    // Names remain stable when macro indices shift. Ambiguous duplicate names cannot be selected.
                    next.push(...macros.filter(macro => counts.get(macro.name) === 1));
                }
            }
        } catch { /* A missing macro API leaves the other categories usable. */ }
        next.sort((a, b) => a.category < b.category ? -1 : a.category > b.category ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
        const same = next.length === this.snapshot.length && next.every((item, index) => { const old = this.snapshot[index]; return item.key === old.key && item.name === old.name && item.detail === old.detail && item.icon === old.icon && item.category === old.category && item.equipped === old.equipped; });
        if (same) return;
        const slots = this as unknown as PlayerAction[];
        for (let index = next.length; index < this.snapshot.length; index++) slots[index] = undefined!;
        for (let index = 0; index < next.length; index++) slots[index] = { ...next[index], action: { ...next[index].action } };
        this.snapshot = next;
        for (const listener of this.listeners) listener(this.Value);
    }
    public [Symbol.iterator](): Iterator<PlayerAction> { const values = this.Value; let index = 0; return { next: () => index < values.length ? { done: false, value: values[index++] } : { done: true, value: undefined } }; }
    public onChange(listener: (items: readonly PlayerAction[]) => void): () => void { if (this.disposed) throw "PlayerActions is disposed"; this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
    public Dispose(): void {
        if (this.disposed) return; this.disposed = true; this.stopSpells(); this.spells.Dispose(); this.frame.UnregisterAllEvents(); this.frame.SetScript("OnEvent", undefined); this.frame.Hide(); this.listeners.clear();
        const slots = this as unknown as PlayerAction[]; for (let index = 0; index < this.snapshot.length; index++) slots[index] = undefined!; this.snapshot = [];
    }
}
export function PlayerActions(): PlayerActionList { return new PlayerActionCollection(); }
