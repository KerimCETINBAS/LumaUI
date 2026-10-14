import { Encoding } from "wuira";
import { Store } from "wuira/store";
import type { StoreRegistry } from "wuira/store";
import type { BuilderDocument, DocumentLibrary } from "../core/builder";
import { copy, fail } from "./validate";
export class BuilderSettings extends Store {
    public static readonly Token = "lumaui.builder";
    public version = 1;
    public documents: BuilderDocument[] = [];
    public enabled: string[] = [];
}
export abstract class Library<T extends BuilderDocument> implements DocumentLibrary<T> {
    public constructor(protected readonly store: StoreRegistry, private readonly kind: T["kind"]) {}
    public abstract Validate(document: unknown): T;
    protected abstract Stop(id: string): void;
    public Import(text: string): T {
        const prefix = "!LUMA:1!";
        if (typeof text !== "string" || issecretvalue(text)) fail("expected an import string");
        const trimmed = text.trim();
        if (!trimmed.startsWith(prefix)) fail("unsupported import format");
        return this.Validate(Encoding.Decode(trimmed.slice(prefix.length)));
    }
    public Export(document: T): string { return "!LUMA:1!" + Encoding.Encode(this.Validate(document)); }
    public Save(document: T, enabled = false): void {
        const data = this.Validate(document);
        this.store.set(BuilderSettings, settings => {
            settings.documents = settings.documents.filter(item => item.kind !== this.kind || item.id !== data.id);
            settings.documents.push(data);
            const key = this.kind + ":" + data.id;
            settings.enabled = settings.enabled.filter(item => item !== key);
            if (enabled) settings.enabled.push(key);
            return settings;
        });
    }
    public Get(id: string): T | undefined { return this.List().find(document => document.id === id); }
    public List(): T[] {
        return this.store.get(BuilderSettings).documents.filter(document => document.kind === this.kind).map(document => copy(document) as unknown as T);
    }
    public Delete(id: string): void {
        if (InCombatLockdown()) fail("delete after combat");
        this.Stop(id);
        this.store.set(BuilderSettings, settings => {
            settings.documents = settings.documents.filter(item => item.kind !== this.kind || item.id !== id);
            settings.enabled = settings.enabled.filter(item => item !== this.kind + ":" + id);
            return settings;
        });
    }
    protected Enabled(): T[] {
        const settings = this.store.get(BuilderSettings);
        return this.List().filter(document => settings.enabled.includes(this.kind + ":" + document.id));
    }
}

/** Coalesce cleanup requests and perform native mutations only after combat. */
const pending = new Set<() => void>();
let listener: wuiraNativeFrame | undefined;
export function afterCombat(action: () => void): void {
    if (!InCombatLockdown()) {
        const waiting = Array.from(pending); pending.clear();
        for (const cleanup of waiting) { try { cleanup(); } catch (failure) { console.log(String(failure)); } }
        action(); return;
    }
    pending.add(action);
    if (listener === undefined) listener = CreateFrame("Frame", undefined, UIParent);
    listener.RegisterEvent("PLAYER_REGEN_ENABLED");
    listener.SetScript("OnEvent", () => {
        if (InCombatLockdown()) return;
        listener!.UnregisterAllEvents(); listener!.SetScript("OnEvent", undefined);
        const actions = Array.from(pending); pending.clear();
        for (const cleanup of actions) { try { cleanup(); } catch (failure) { console.log(String(failure)); } }
    });
}
export function disposeAll(cleanups: (() => void)[]): void {
    for (let i = cleanups.length - 1; i >= 0; i--) { try { cleanups[i](); } catch (failure) { console.log(String(failure)); } }
    cleanups.length = 0;
}
