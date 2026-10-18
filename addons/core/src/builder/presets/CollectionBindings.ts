import { Store } from "wuira/store";
import type { StoreRegistry } from "wuira/store";
import type { PresetDocument, PresetNode } from "../../core/builder";

export class CollectionBindingSettings extends Store {
    public static readonly Token = "lumaui.collection-bindings";
    public collections: Record<string, Record<string, string>> = {};
}
function visit(node: PresetNode, callback: (node: PresetNode) => void): void {
    callback(node);
    for (const child of node.children ?? []) visit(child, callback);
}
/** Bindings belong to the character, keyed by collection and stable node ID. */
export class CollectionBindings {
    public constructor(private readonly store: StoreRegistry) {}
    public Snapshot(): Readonly<Record<string, Readonly<Record<string, string>>>> {
        return this.store.get(CollectionBindingSettings).collections;
    }
    public Get(collection: string, node: string): string | undefined { return this.Snapshot()[collection]?.[node]; }
    /** Only already saved legacy documents can seed bindings, once per collection. */
    public Migrate(documents: PresetDocument[]): void {
        const current = this.store.get(CollectionBindingSettings).collections;
        if (!documents.some(document => current[document.id] === undefined)) return;
        this.store.set(CollectionBindingSettings, settings => {
            for (const document of documents) {
                if (settings.collections[document.id] !== undefined) continue;
                const bindings: Record<string, string> = {};
                visit(document.root, node => {
                    if (node.type === "secureButton" && typeof node.props.binding === "string" && !issecretvalue(node.props.binding))
                        bindings[node.id] = node.props.binding;
                });
                settings.collections[document.id] = bindings;
            }
            return settings;
        });
    }
    public Set(collection: string, node: string, key?: string): Set<string> {
        return this.SetMany([{ collection, node, key }]);
    }
    public SetMany(updates: readonly { collection: string; node: string; key?: string }[]): Set<string> {
        const changed = new Set<string>();
        if (updates.length === 0) return changed;
        this.store.set(CollectionBindingSettings, settings => {
            for (const { collection, node, key } of updates) {
                if (key !== undefined) for (const [owner, bindings] of Object.entries(settings.collections)) {
                    for (const [id, value] of Object.entries(bindings)) {
                        if (value === key && (owner !== collection || id !== node)) { delete bindings[id]; changed.add(owner); }
                    }
                }
                const bindings = settings.collections[collection] ??= {};
                if (bindings[node] !== key) {
                    if (key === undefined) delete bindings[node]; else bindings[node] = key;
                    changed.add(collection);
                }
            }
            return settings;
        });
        return changed;
    }
}
/** Legacy import props are accepted for compatibility but cannot dictate character keys. */
export function stripBindings(document: PresetDocument): boolean {
    let changed = false;
    visit(document.root, node => {
        if (node.type === "secureButton" && node.props.binding !== undefined) { delete node.props.binding; changed = true; }
    });
    for (const dependency of document.dependencies ?? []) changed = stripBindings(dependency) || changed;
    return changed;
}
