import type { StoreRegistry } from "wuira/store";
import type { BlizzardElementProps, SkinAPI, SkinDocument, SkinInstance, SkinTargetDefinition } from "../core/builder";
import { BlizzardElement, registerBlizzardElement } from "./BlizzardElement";
import { Library, afterCombat, disposeAll } from "./Library";
import { array, copy, fail, identifier, keys, properties, record, text } from "./validate";

/** Fixed native adapters and explicitly registered dynamic visual rules. */
export class Skins extends Library<SkinDocument> implements SkinAPI {
    public readonly BlizzardElement = BlizzardElement;
    public RegisterElement(props: BlizzardElementProps): SkinInstance { return registerBlizzardElement(props); }
    private readonly paused = new Set<string>();
    private readonly targets = new Map<string, SkinTargetDefinition>();
    private readonly active = new Map<string, { document: SkinDocument; handle: SkinInstance }>();
    private readonly owners = new Map<string, string>();
    public constructor(store: StoreRegistry) {
        super(store, "skin"); const listener = CreateFrame("Frame", undefined, UIParent); listener.RegisterEvent("PLAYER_REGEN_ENABLED");
        listener.SetScript("OnEvent", () => { if (this.store.IsReady && !InCombatLockdown()) this.Restore(); });
    }
    public RegisterTarget(name: string, definition: SkinTargetDefinition): () => void {
        identifier(name); if (this.targets.has(name)) fail("skin target already registered: " + name);
        this.targets.set(name, definition);
        return () => { if (this.targets.get(name) === definition) this.targets.delete(name); };
    }
    public TargetTypes(): string[] { return Array.from(this.targets.keys()); }
    public Validate(input: unknown): SkinDocument {
        const data = record(copy(input)); keys(data, ["version", "kind", "id", "name", "targets"]);
        if (data.kind !== "skin" || data.version !== 1) fail("unsupported skin version or kind");
        identifier(data.id); text(data.name, "skin name");
        const names = new Set<string>();
        const targets = array(data.targets, 64); if (targets.length === 0) fail("skin needs a native target");
        for (const entry of targets) {
            const target = record(entry); keys(target, ["target", "props"]);
            const name = identifier(target.target);
            if (names.has(name)) fail("duplicate skin target: " + name); names.add(name);
            const definition = this.targets.get(name); if (definition === undefined) fail("native target addon is unavailable: " + name);
            properties(target.props, definition.properties);
        }
        return data as unknown as SkinDocument;
    }
    public Apply(document: SkinDocument): SkinInstance {
        if (InCombatLockdown()) fail("apply a native skin after combat");
        afterCombat(() => {});
        const data = this.Validate(document);
        for (const target of data.targets) {
            const owner = this.owners.get(target.target);
            if (owner !== undefined && owner !== data.id) fail("native target already skinned by " + owner);
        }
        const previous = this.active.get(data.id)?.document;
        this.Remove(data.id);
        const cleanups: (() => void)[] = [];
        try {
            for (const target of data.targets) cleanups.push(this.targets.get(target.target)!.Apply(target.props));
        } catch (failure) {
            disposeAll(cleanups);
            if (previous !== undefined) { try { this.Apply(previous); } catch (restoreFailure) { console.log(String(restoreFailure)); } }
            throw failure;
        }
        let disposed = false;
        const handle: SkinInstance = { Dispose: () => {
            if (disposed) return; disposed = true;
            afterCombat(() => {
                disposeAll(cleanups);
                for (const target of data.targets) if (this.active.get(data.id)?.handle === handle && this.owners.get(target.target) === data.id) this.owners.delete(target.target);
                if (this.active.get(data.id)?.handle === handle) this.active.delete(data.id);
            });
        } };
        for (const target of data.targets) this.owners.set(target.target, data.id);
        this.paused.delete(data.id);
        this.active.set(data.id, { document: data, handle });
        return handle;
    }
    public Remove(id: string): void { this.paused.add(id); this.active.get(id)?.handle.Dispose(); }
    protected Stop(id: string): void { this.Remove(id); }
    public Restore(): void {
        for (const document of this.Enabled()) {
            if (this.paused.has(document.id) || this.active.has(document.id)) continue;
            try { this.Apply(document); } catch (failure) { console.log(String(failure)); }
        }
    }
}
