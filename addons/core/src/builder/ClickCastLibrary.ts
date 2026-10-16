import { Store } from "wuira/store";
import type { StoreRegistry } from "wuira/store";
import type { ClickCastBinding, ClickCastPresetDocument, StandardClickPreset } from "../core/builder";
import { array, fail, identifier, keys, record, text } from "./validate";
import { clickCombination } from "./UnitButton";
export type { ClickCastBinding, ClickCastPresetDocument, StandardClickPreset } from "../core/builder";

/** Built-in unit interaction. Portraits use this mapping and it cannot be edited or removed. */
export const STANDARD_CLICK_PRESET: StandardClickPreset = {
    id: "standard", name: "Standard", immutable: true,
    actions: [
        { combination: "Left click", action: "target" },
        { combination: "Right click", action: "togglemenu" },
    ],
};
interface LegacyClickCastPreset {
    version: 1; kind: "clickCast"; id: string; name: string; key: string; spellId: number;
}
class ClickCastSettings extends Store {
    public static readonly Token = "lumaui.click-cast-library";
    public nextId = 1;
    public presets: (ClickCastPresetDocument | LegacyClickCastPreset)[] = [];
}
/** A mouse button has eight possible modifier combinations, yielding at most forty bindings. */
function validateBindings(value: unknown): ClickCastBinding[] {
    const bindings = array(value, 40);
    if (bindings.length === 0) fail("add at least one Click Cast binding");
    const combinations = new Set<string>();
    return bindings.map(value => {
        const binding = record(value); keys(binding, ["key", "spellId", "itemId", "macro"]);
        const combination = clickCombination(text(binding.key, "mouse combination", 128));
        const key = combination.prefix.toUpperCase() + "BUTTON" + combination.button;
        if (combinations.has(key)) fail("duplicate mouse combination: " + key);
        combinations.add(key);
        const fields = ["spellId", "itemId", "macro"].filter(field => binding[field] !== undefined);
        if (fields.length !== 1) fail("choose exactly one action for " + key);
        if (binding.macro !== undefined) {
            const macro = text(binding.macro, "macro name", 128);
            if (macro.trim() === "" || macro.includes("\n") || macro.includes("\r")) fail("choose a named macro");
            return { key, macro };
        }
        const field = fields[0], id = binding[field];
        if (issecretvalue(id) || typeof id !== "number" || !Number.isInteger(id) || id < 1 || id > 10000000) fail("invalid action ID for " + key);
        return field === "spellId" ? { key, spellId: id } : { key, itemId: id };
    });
}
function readPreset(value: unknown): ClickCastPresetDocument {
    const preset = record(value);
    if (preset.kind !== "clickCast" || ![1, 2].includes(preset.version as number)) fail("unsupported Click Cast preset");
    const id = identifier(preset.id); if (id === "standard") fail("Standard Click Cast actions are locked");
    const name = text(preset.name, "Click Cast preset name", 96).trim(); text(name, "Click Cast preset name", 96);
    const bindings = validateBindings(preset.version === 1 ? [{ key: preset.key, spellId: preset.spellId }] : preset.bindings);
    return { version: 2, kind: "clickCast", id, name, bindings };
}
function inputBindings(bindings: readonly ClickCastBinding[] | string, spellId?: number): ClickCastBinding[] {
    return validateBindings(typeof bindings === "string" ? [{ key: bindings, spellId }] : bindings);
}
/** One named preset holds every mouse/spell mapping shared by its attached buttons. */
export class ClickCastLibrary {
    public constructor(private readonly store: StoreRegistry, private readonly changed: (id: string) => void, private readonly inUse: (id: string) => boolean) {
        store.onReady(() => {
            const saved = store.get(ClickCastSettings);
            if (saved.presets.some(preset => preset.version === 1)) {
                const presets = saved.presets.map(readPreset);
                store.set(ClickCastSettings, state => { state.presets = presets; return state; });
            }
        });
    }
    public Validate(value: unknown): ClickCastPresetDocument { return readPreset(value); }
    public List(): ClickCastPresetDocument[] {
        return this.store.get(ClickCastSettings).presets.map(readPreset);
    }
    public Get(id: string): ClickCastPresetDocument | undefined { return this.List().find(preset => preset.id === id); }
    public Create(name: string, bindings: readonly ClickCastBinding[]): ClickCastPresetDocument;
    /** Compatibility shorthand for one binding. */
    public Create(name: string, key: string, spellId: number): ClickCastPresetDocument;
    public Create(name: string, bindings: readonly ClickCastBinding[] | string, spellId?: number): ClickCastPresetDocument {
        if (InCombatLockdown()) fail("create a Click Cast preset after combat");
        name = text(name, "Click Cast preset name", 96).trim(); text(name, "Click Cast preset name", 96);
        const values = inputBindings(bindings, spellId);
        let created: ClickCastPresetDocument | undefined;
        this.store.set(ClickCastSettings, state => {
            const id = "click-cast-" + state.nextId++;
            created = { version: 2, kind: "clickCast", id, name, bindings: values };
            state.presets.push(created);
            return state;
        });
        this.changed(created!.id);
        return readPreset(created!);
    }
    public Update(id: string, name: string, bindings: readonly ClickCastBinding[]): void;
    /** Compatibility shorthand for one binding. */
    public Update(id: string, name: string, key: string, spellId: number): void;
    public Update(id: string, name: string, bindings: readonly ClickCastBinding[] | string, spellId?: number): void {
        if (InCombatLockdown()) fail("update a Click Cast preset after combat");
        name = text(name, "Click Cast preset name", 96).trim(); text(name, "Click Cast preset name", 96);
        const values = inputBindings(bindings, spellId);
        if (this.Get(id) === undefined) fail("Click Cast preset not found: " + id);
        this.store.set(ClickCastSettings, state => {
            state.presets = state.presets.map(preset => preset.id === id ? { version: 2, kind: "clickCast", id, name, bindings: values } : preset);
            return state;
        });
        this.changed(id);
    }
    public Delete(id: string): void {
        if (InCombatLockdown()) fail("delete a Click Cast preset after combat");
        if (this.Get(id) === undefined) return;
        if (this.inUse(id)) fail("detach this Click Cast preset from every secure button before deleting it");
        this.store.set(ClickCastSettings, state => { state.presets = state.presets.filter(preset => preset.id !== id); return state; });
        this.changed(id);
    }
}
