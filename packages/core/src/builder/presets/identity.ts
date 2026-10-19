import type { PresetDocument, PresetNode } from "../../core/builder";
import { copy, fail, identifier, text } from "../validate";
import { BuilderSettings } from "../library/Library";
import { CollectionBindingSettings, stripBindings } from "./CollectionBindings";
import { ActivationContext } from "./Activation";
import { migrateClassColors } from "./ClassColorMigration";
import { migrateNativeVisibility } from "./NativeVisibilityMigration";
import { releaseRetiredOwner } from "./presetModel";
import type { Presets } from "./Presets";
export function checkDependencies(host: Presets, data: PresetDocument): void  {
        const equal = (a: unknown, b: unknown): boolean => {
            if (a === b) return true;
            if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
            const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
            return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => equal(left[key], right[key]));
        };
        for (const dependency of data.dependencies ?? []) {
            const existing = host.Get(dependency.id);
            if (existing !== undefined && !equal(existing, dependency)) fail("dependency already exists with different settings: " + dependency.name + ". Edit it in the library first.");
        }

}

export function renameSource(host: Presets, input: PresetDocument, oldName: string, newName: string, updateReferences: boolean): PresetDocument  {
        const document = copy(input) as unknown as PresetDocument;
        identifier(newName);
        if (newName === "item") fail("reserved source name");
        const spec = document.sources.find(source => source.name === oldName); if (spec === undefined) fail("source to rename was not found");
        if (oldName !== newName && document.sources.some(source => source.name === newName)) fail("source name already exists: " + newName);
        spec.name = newName;
        if (updateReferences) {
            for (const source of document.sources) if (!source.isProp) for (const key of [...host.SourceReferences(source.type), "unit"]) if (source.props[key] === oldName) source.props[key] = newName;
            const visit = (node: PresetNode): void => {
                for (const key of ["source", "visibleSource", "glowSource", "textSource", "alphaSource"] as const) if (node[key] === oldName) node[key] = newName;
                for (const binding of Object.values(node.bindings ?? {})) if (binding.source === oldName) binding.source = newName;
                for (const key of Object.keys(node.sourceProps ?? {})) if (node.sourceProps![key] === oldName) node.sourceProps![key] = newName;
                if (node.type !== "hideUnitFrame" && node.props.unit === oldName) node.props.unit = newName;
                for (const section of node.sections ?? []) if (section.source === oldName) (section as { source: string }).source = newName;
                if (node.type === "blizzardElement" && node.props.filter === oldName) node.props.filter = newName;
                for (const child of node.children ?? []) visit(child);
            }; visit(document.root);
        }
        return host.Validate(document, true);

}

export function applySourceRenames(host: Presets, input: PresetDocument, renames: readonly { oldName: string; newName: string; updateReferences: boolean; input?: boolean }[]): void  {
        if (InCombatLockdown()) fail("rename sources after combat");
        const data = host.Validate(input, true);
        const documents = host.List().filter(doc => doc.id !== data.id && !(data.dependencies ?? []).some(dependency => dependency.id === doc.id));
        documents.push(...data.dependencies ?? [], data);
        for (const document of documents) {
            const rewrite = (node: PresetNode): void => {
                if (node.preset === data.id && node.sourceProps !== undefined) for (const rename of renames) {
                    if (rename.updateReferences && rename.input !== false && node.sourceProps[rename.oldName] !== undefined) {
                        if (node.sourceProps[rename.newName] !== undefined) fail("source input binding already exists: " + rename.newName);
                        node.sourceProps[rename.newName] = node.sourceProps[rename.oldName]; delete node.sourceProps[rename.oldName];
                    }
                }
                for (const child of node.children ?? []) rewrite(child);
            }; rewrite(document.root);
        }
        for (const document of documents) host.Validate(document, true, documents);
        // Stop before changing definitions; active trees keep no stale aliases.
        const active: string[] = [];
        host.active.forEach((_instance, id) => active.push(id));
        for (const id of active) host.ReleaseActive(id);
        host.store.set(BuilderSettings, settings => {
            settings.documents = [...settings.documents.filter(doc => doc.kind !== "preset"), ...documents.map(document => { const { dependencies, ...stored } = document; return stored; })];
            settings.enabled = settings.enabled.filter(key => key !== "preset:" + data.id);
            if (data.enabled !== "never") settings.enabled.push("preset:" + data.id);
            return settings;
        });
        host.Restore();

}

export function identifyPreset(host: Presets, input: string, excludeID?: string) {
        const original = text(input.trim(), "component name", 96);
        const slug = (value: string): string => {
            let result = "";
            for (let i = 0; i < value.length; i++) { const char = value[i].toLowerCase(); result += "abcdefghijklmnopqrstuvwxyz0123456789".includes(char) ? char : char === " " || char === "-" || char === "_" || char === "(" || char === ")" ? "-" : "u" + value.charCodeAt(i).toString(16); }
            const valueID = result.split("-").filter(part => part !== "").join("-").slice(0, 80); return valueID === "" ? "component" : valueID;
        };
        const documents = host.List().filter(doc => doc.id !== excludeID);
        let name = original, id = slug(name), index = 0;
        while (documents.some(doc => doc.id === id || doc.name.toLowerCase() === name.toLowerCase())) {
            index++; name = original.slice(0, 80) + " (" + index + ")"; id = slug(original) + "-" + index;
        }
        return { id, name, duplicate: index > 0 };

}

export function renamePreset(host: Presets, input: PresetDocument, oldID: string, updateReferences: boolean): void  {
        if (InCombatLockdown()) fail("rename after combat");
        const existing = host.Get(oldID); if (existing === undefined) fail("component to rename was not found");
        const identity = host.Identity(input.name, oldID);
        if (identity.name !== input.name || input.id !== oldID && host.Get(input.id) !== undefined) fail("component name changed or already exists; confirm its new name again");
        const data = host.Validate(input);
        host.CheckDependencies(data); stripBindings(data);
        const documents = host.List().filter(doc => doc.id !== oldID);
        for (const dependency of data.dependencies ?? []) if (!documents.some(doc => doc.id === dependency.id)) documents.push(dependency);
        const affected = host.UsedBy(oldID).map(doc => doc.id);
        const rewrite = (node: PresetNode): void => { if (node.preset === oldID) node.preset = data.id; for (const child of node.children ?? []) rewrite(child); };
        if (updateReferences) for (const doc of documents) rewrite(doc.root);
        documents.push(data);
        // Retire affected mounted trees before replacing the library in one store update.
        const queue = [...affected]; const stopped = new Set<string>();
        for (let i = 0; i < queue.length; i++) { const id = queue[i]; if (stopped.has(id)) continue; stopped.add(id); queue.push(...host.UsedBy(id).map(doc => doc.id)); }
        for (const doc of documents) if (doc.id === data.id || stopped.has(doc.id) || (data.dependencies ?? []).some(dependency => dependency.id === doc.id)) host.Validate(doc, true, documents);
        for (const id of stopped) host.ReleaseActive(id);
        host.ReleaseActive(oldID); host.paused.delete(oldID);
        host.store.set(BuilderSettings, settings => {
            settings.documents = [...settings.documents.filter(doc => doc.kind !== "preset"), ...documents.map(doc => { const { dependencies, ...stored } = doc; return stored; })];
            settings.enabled = settings.enabled.map(key => key === "preset:" + oldID ? "preset:" + data.id : key);
            return settings;
        });
        host.store.set(CollectionBindingSettings, settings => {
            if (oldID !== data.id && settings.collections[oldID] !== undefined) { settings.collections[data.id] = settings.collections[oldID]; delete settings.collections[oldID]; }
            return settings;
        });
        if (host.started) host.Restore();

}

export function savePreset(host: Presets, document: PresetDocument, enabled = false): void  {
        host.MigrateSavedComponents();
        const data = host.Validate(document, true);
        host.CheckDependencies(data); stripBindings(data);
        // A shared edit must remain structurally valid in every consumer before committing it.
        const override = new Map([...[...host.List(), ...data.dependencies ?? []].map(doc => [doc.id, doc] as [string, PresetDocument]), [data.id, data] as [string, PresetDocument]]);
        for (const consumer of host.List()) {
            if (consumer.id === data.id) continue;
            const graph = new Map<string, PresetDocument>();
            const visit = (node: PresetNode) => {
                if (node.preset !== undefined && !graph.has(node.preset)) {
                    const doc = override.get(node.preset); if (doc === undefined) return;
                    graph.set(doc.id, doc); visit(doc.root);
                }
                for (const child of node.children ?? []) visit(child);
            };
            visit(consumer.root);
            if (graph.has(data.id)) {
                const dependencies = Array.from(graph.values()).map(doc => { const { dependencies, ...item } = doc; return item; });
                host.Validate({ ...consumer, dependencies }, true);
            }
        }
        host.store.set(BuilderSettings, settings => {
            // Preserve enabled state of existing dependencies; newly imported ones remain disabled.
            for (const doc of [...data.dependencies ?? [], data]) {
                const { dependencies, ...stored } = doc;
                settings.documents = settings.documents.filter(item => item.kind !== "preset" || item.id !== doc.id);
                settings.documents.push(stored);
            }
            settings.enabled = settings.enabled.filter(key => key !== "preset:" + data.id);
            if (enabled) settings.enabled.push("preset:" + data.id);
            return settings;
        });
        // Existing consumers pick up an edited shared dependency without enabling it standalone.
        const queue = host.UsedBy(data.id); const refreshed = new Set<string>();
        for (let i = 0; i < queue.length; i++) {
            const parent = queue[i]; if (refreshed.has(parent.id)) continue; refreshed.add(parent.id);
            if (host.active.has(parent.id)) {
                if (new ActivationContext(host.Layouts).Matches(parent)) host.Mount(parent); else host.ReleaseActive(parent.id);
            }
            queue.push(...host.UsedBy(parent.id));
        }
        if (host.started) host.Restore();

}

export function migrateSavedComponents(host: Presets): void  {
        const documents = host.List();
        host.bindings.Migrate(documents);
        if (!documents.map(document => { const released = releaseRetiredOwner(document); const colors = migrateClassColors(document), native = migrateNativeVisibility(document), bindings = stripBindings(document); return colors || native || bindings || released; }).some(changed => changed)) return;
        host.store.set(BuilderSettings, settings => {
            for (const document of settings.documents) if (document.kind === "preset") { releaseRetiredOwner(document); migrateClassColors(document); migrateNativeVisibility(document); stripBindings(document); }
            return settings;
        });

}
