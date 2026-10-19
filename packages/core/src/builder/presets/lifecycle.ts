import { wuira } from "wuira";
import type { ActivationMode, PresetDocument, PresetInstance, PresetNode } from "../../core/builder";
declare const C_AddOns: { IsAddOnLoaded?: (this: void, name: string) => boolean } | undefined;
import { fail } from "../validate";
import { BuilderSettings, afterCombat } from "../library/Library";
import { ActivationContext } from "./Activation";
import { referenceDocument } from "./presetModel";
import type { Presets } from "./Presets";
export function mountPreset(host: Presets, document: PresetDocument, parent?: wuiraNativeFrame): PresetInstance  {
        if (InCombatLockdown()) fail("mount a component after combat");
        afterCombat(() => {});
        const validated = host.Validate(document);
        if (!new ActivationContext(host.Layouts).Matches(validated)) fail("component activation requirements are not met");
        host.CheckDependencies(validated);
        host.MigrateSavedComponents();
        const handle = host.Create(document);
        try {
            const frame = wuira.Mount(handle.View, undefined, parent);
            (handle as { Frame?: wuiraNativeFrame }).Frame = frame;
            host.activators.get(handle)?.(); host.activators.delete(handle);
            host.active.get(document.id)?.Dispose();
            host.paused.delete(document.id);
            host.active.set(document.id, handle);
            host.liveDocuments.set(document.id, host.Validate(document));
            host.activationSignatures.set(document.id, host.ActivationSignature(document, new ActivationContext(host.Layouts), new Map(host.List().map(doc => [doc.id, doc]))));
            const observing: (() => void)[] = []; host.observerCleanups.set(handle, observing);
            host.observers.forEach(listener => { try { const cleanup = listener(host.liveDocuments.get(document.id)!, handle); if (cleanup !== undefined) observing.push(cleanup); } catch (failure) { console.log(String(failure)); } });
            return handle;
        } catch (failure) { handle.Dispose(); throw failure; }

}

export function releaseActive(host: Presets, id: string): void  {
        const handle = host.active.get(id);
        host.active.delete(id); host.liveDocuments.delete(id); host.activationSignatures.delete(id);
        handle?.Dispose();

}

export function unmountPreset(host: Presets, id: string): void  {
 host.paused.add(id); host.ReleaseActive(id); 
}

export function setActivation(host: Presets, id: string, mode: ActivationMode): void  {
        const document = host.Get(id); if (document === undefined) fail("component not found: " + id);
        host.Apply({ ...document, enabled: mode });

}

export function applyPreset(host: Presets, document: PresetDocument): void  {
        if (InCombatLockdown()) fail("apply component settings after combat");
        const active = host.active.get(document.id);
        host.paused.delete(document.id);
        host.Save(document, document.enabled !== "never");
        if (active !== undefined && host.active.get(document.id) === active && new ActivationContext(host.Layouts).Matches(document)) host.Mount(document);
        host.Restore();

}

export function missingReference(host: Presets, document: PresetDocument): string | undefined  {
        const seen = new Set<string>();
        const visit = (node: PresetNode): string | undefined => {
            if (node.preset !== undefined && !seen.has(node.preset)) {
                seen.add(node.preset); const child = host.Get(node.preset);
                if (child === undefined) return node.preset;
                const missing = visit(child.root); if (missing !== undefined) return missing;
            }
            for (const child of node.children ?? []) { const missing = visit(child); if (missing !== undefined) return missing; }
            return undefined;
        };
        return visit(document.root);

}

export function activationStatus(host: Presets, id: string): string  {
        const document = host.Get(id); if (document === undefined) return "Unavailable";
        if (document.enabled === "never" || !host.store.get(BuilderSettings).enabled.includes("preset:" + id)) return "Disabled";
        if (host.active.has(id)) return "Active";
        const missing = host.MissingReference(document); if (missing !== undefined) return "Missing component: " + missing;
        try { host.Validate(document); } catch (failure) { return String(failure); }
        if (document.sources.some(source => source.isProp && !source.optional)) return "Waiting for external source inputs";
        if (InCombatLockdown()) return "Waiting for combat to end";
        if (!new ActivationContext(host.Layouts).Matches(document)) return "Waiting for class, condition or native layout";
        if (document.owner !== undefined && C_AddOns?.IsAddOnLoaded?.(document.owner) !== true) return "Waiting for addon";
        return "Inactive";

}

export function activationSignature(host: Presets, document: PresetDocument, context: ActivationContext, documents: ReadonlyMap<string, PresetDocument>): string  {
        const stack = new Set<string>(), parts: string[] = [];
        const visitDocument = (doc: PresetDocument) => {
            if (stack.has(doc.id)) return; stack.add(doc.id);
            const matched = context.Matches(doc); parts.push(doc.id + (matched ? ":1" : ":0"));
            if (doc.layoutPositions !== undefined) parts.push("position:" + (context.LayoutKey ?? ""));
            if (!matched) { stack.delete(doc.id); return; }
            const visit = (node: PresetNode) => {
                if (node.preset !== undefined) { const child = documents.get(node.preset); if (child !== undefined) { const effective = referenceDocument(child, node); parts.push(node.id + ":" + context.Matches(effective)); visitDocument(effective); } }
                for (const child of node.children ?? []) visit(child);
            };
            visit(doc.root); stack.delete(doc.id);
        };
        visitDocument(document); return parts.join("|");

}

export function restorePresets(host: Presets): void  {
        host.started = true;
        if (!host.store.IsReady || InCombatLockdown() || host.evaluating) return;
        host.evaluating = true;
        try {
            host.MigrateSavedComponents();
            const documents = new Map(host.List().map(doc => [doc.id, doc]));
            const enabled = new Set(host.store.get(BuilderSettings).enabled);
            const context = new ActivationContext(host.Layouts);
            for (const [id, document] of documents) {
                // Manual disable short-circuits before reading any class/group data.
                const wanted = enabled.has("preset:" + id) && !host.paused.has(id)
                    && document.enabled !== "never"
                    && (document.owner === undefined || C_AddOns?.IsAddOnLoaded?.(document.owner) === true)
                    && context.Matches(document)
                    && host.MissingReference(document) === undefined
                    && !document.sources.some(source => source.isProp && !source.optional);
                if (!wanted) { if (host.active.has(id)) host.ReleaseActive(id); continue; }
                const signature = host.ActivationSignature(document, context, documents);
                if (host.active.has(id) && host.activationSignatures.get(id) === signature) continue;
                try { host.Mount(document); } catch (failure) { console.log(String(failure)); }
            }
        } finally { host.evaluating = false; }

}
