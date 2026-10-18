import type { CollectionKeybinding, PresetDocument, PresetNode } from "../../core/builder";
import { fail } from "../validate";
import { validateAssignments } from "../transfer/BindingTransfer";
import type { Presets } from "./Presets";
export function getBinding(host: Presets, collection: string, node: string): string | undefined  {
 return host.bindings.Get(collection, node); 
}

export function setBinding(host: Presets, collection: string, node: string, key?: string): void  {
        if (InCombatLockdown()) fail("change keybindings after combat");
        if (key !== undefined && (issecretvalue(key) || typeof key !== "string" || key.trim().length === 0)) fail("invalid keybinding");
        host.MigrateSavedComponents();
        const document = host.Get(collection); if (document === undefined) fail("component not found: " + collection);
        const contains = (item: PresetNode): boolean => (item.id === node && item.type === "secureButton") || (item.children ?? []).some(contains);
        if (!contains(document.root)) fail("secure button not found: " + node);
        host.RefreshBindings(host.bindings.Set(collection, node, key));

}

export function listBindings(host: Presets): CollectionKeybinding[]  {
        return Object.entries(host.bindings.Snapshot()).flatMap(([collection, nodes]) =>
            Object.entries(nodes).map(([node, key]) => ({ collection, node, key })));

}

export function setBindings(host: Presets, document: PresetDocument, bindings: readonly CollectionKeybinding[]): void  {
        if (InCombatLockdown()) fail("import keybindings after combat");
        const validated = validateAssignments(host.Validate(document, true), bindings);
        host.MigrateSavedComponents();
        host.RefreshBindings(host.bindings.SetMany(validated));

}

export function clickCastPresetInUse(host: Presets, bindingId: string): boolean  {
        const uses = (document: PresetDocument): boolean => {
            let found = false;
            const visit = (node: PresetNode) => {
                if (node.type === "secureButton" && node.props.clickCastPreset === bindingId) found = true;
                for (const child of node.children ?? []) visit(child);
            };
            visit(document.root);
            for (const dependency of document.dependencies ?? []) if (uses(dependency)) found = true;
            return found;
        };
        return host.List().some(uses);

}

export function resolveClickCast(host: Presets, id: string) {
 return host.clickCast.Get(id); 
}

export function refreshClickCastPreset(host: Presets, bindingId: string): void  {
        if (InCombatLockdown()) return;
        const uses = (document: PresetDocument): boolean => {
            let found = false;
            const visit = (node: PresetNode) => {
                if (node.type === "secureButton" && node.props.clickCastPreset === bindingId) found = true;
                for (const child of node.children ?? []) visit(child);
            };
            visit(document.root);
            for (const dependency of document.dependencies ?? []) if (uses(dependency)) found = true;
            return found;
        };
        const refresh: string[] = [];
        host.liveDocuments.forEach((document, id) => { if (uses(document) && host.Get(id) !== undefined) refresh.push(id); });
        for (const id of refresh) host.Mount(host.Get(id)!);

}

export function refreshBindings(host: Presets, changed: ReadonlySet<string>): void  {
        const refresh: string[] = [];
        host.liveDocuments.forEach((live, id) => {
            if (changed.has(id) || (live.dependencies ?? []).some(dependency => changed.has(dependency.id))) refresh.push(id);
        });
        for (const id of refresh) host.Mount(host.Get(id)!);

}
