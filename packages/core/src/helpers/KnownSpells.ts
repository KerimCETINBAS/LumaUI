import { KnownSpells as NativeKnownSpells, UseSource } from "wuira/datasources";
import type { KnownSpell } from "wuira/datasources";
import type { KnownSpellList, SpellNameSelector } from "../core/builder";
import { compileNameSelector } from "./NameSelectors";
import { fail } from "../builder/validate";

/** Luma selection policy over wuira's cached native spellbook. No polling or global store. */
export class KnownSpellCollection implements KnownSpellList {
    private readonly native: NativeKnownSpells;
    private snapshot: readonly KnownSpell[] = [];
    private readonly listeners = new Set<(items: readonly KnownSpell[]) => void>();
    private readonly stop: () => void;
    private disposed = false;
    public constructor(selectors: readonly SpellNameSelector[], includePassive = true) {
        if (selectors.length > 32) fail("too many spell filters");
        const matchers = selectors.map(compileNameSelector);
        this.native = UseSource(NativeKnownSpells);
        const refresh = () => {
            const next = this.native.Entries.filter(entry => (includePassive || entry.isPassive === false)
                && (matchers.length === 0 || entry.name !== undefined && matchers.some(matcher => matcher.Test(entry.name!))));
            const signature = (items: readonly KnownSpell[]) => items.map(item => item.id + ":" + (item.name ?? "") + ":" + String(item.isPassive)).join("|");
            if (signature(next) === signature(this.snapshot)) return;
            // Inline Lua Symbol identities differ between modules. Numeric slots also
            // let another addon's for...of consume this collection through ipairs.
            const slots = this as unknown as KnownSpell[];
            for (let index = next.length; index < this.snapshot.length; index++) slots[index] = undefined!;
            for (let index = 0; index < next.length; index++) slots[index] = { ...next[index] };
            this.snapshot = next;
            for (const listener of this.listeners) listener(this.Value);
        };
        refresh(); this.stop = this.native.onChange(refresh);
    }
    public get Status() { return this.native.Status; }
    public get Value(): readonly KnownSpell[] { return this.snapshot.map(item => ({ ...item })); }
    public [Symbol.iterator](): Iterator<KnownSpell> {
        const items = this.Value; let index = 0;
        return { next: () => index < items.length ? { done: false, value: items[index++] } : { done: true, value: undefined } };
    }
    public onChange(listener: (items: readonly KnownSpell[]) => void): () => void {
        if (this.disposed) fail("known spell collection is disposed");
        this.listeners.add(listener); return () => { this.listeners.delete(listener); };
    }
    public Dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.stop(); this.native.Dispose(); this.listeners.clear();
        const slots = this as unknown as KnownSpell[]; for (let index = 0; index < this.snapshot.length; index++) slots[index] = undefined!;
        this.snapshot = [];
    }
}
export function KnownSpells(...selectors: SpellNameSelector[]): KnownSpellList { return new KnownSpellCollection(selectors); }
