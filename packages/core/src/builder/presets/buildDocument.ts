import { UI, ForEach } from "wuira/ui";
import type { Cell } from "wuira/ui";
import { wuira } from "wuira";
import { TimerSource, UnitSource, UseSource } from "wuira/datasources";
import type { PresetDocument, PresetInstance, PresetNode, SourceInstance, SourceSpec } from "../../core/builder";
import type { UnitInput } from "wuira/datasources";
declare const C_AddOns: { IsAddOnLoaded?: (this: void, name: string) => boolean } | undefined;
import { fail } from "../validate";
import { afterCombat, disposeAll } from "../library/Library";
import { ActivationContext } from "./Activation";
import { applyLayoutPosition } from "./LayoutPosition";
import { ObservableItems } from "./ObservableItems";
import { preparePropertyBindings } from "../converters/PropertyBindings";
import { petUnit } from "../units/GroupRoster";
import { unitTextChannels } from "../units/UnitWidgets";
import { literalUnit, referenceDocument, repeatReference, RepeatItemValue } from "./presetModel";
import { applySectionProps, mountSections } from "./elementSections";
import type { ItemScope, UnitScope } from "./presetModel";
import type { Presets } from "./Presets";
import { previewInput } from "./previewFixtures";

function textChannel(bound: SourceInstance, key: string): (() => string) | undefined {
    const alias = key === "Name" ? "name" : key === "Surname" ? "surname" : key === "FullName" || key === "Fullname" || key === "fullname" ? "fullName" : key;
    return bound.channels?.[alias]?.Text ?? bound.channels?.[key]?.Text;
}

/** A boolean activity, or a boolean value. Other types are not a visibility source. */
function booleanFunction(read: () => unknown): (() => boolean) | undefined {
    try {
        const sample = read();
        if (issecretvalue(sample) || typeof sample !== "boolean") return undefined;
    } catch { return undefined; }
    return () => { const value = read(); return !issecretvalue(value) && value === true; };
}

function booleanOf(bound: SourceInstance, path = ""): (() => boolean) | undefined {
    let normalized = path.trim();
    while (normalized.startsWith(".")) normalized = normalized.slice(1);
    const target = normalized === "" ? bound : normalized.includes(".") ? undefined : bound.channels?.[normalized === "IsLeader" ? "isLeader" : normalized] ?? bound.channels?.[normalized];
    if (target === undefined) return undefined;
    if (target.IsActive !== undefined) return booleanFunction(() => target.IsActive!());
    if (target.value !== undefined) return booleanFunction(() => target.value!.Value);
    return undefined;
}

/** Empty path uses the source text, or a unit's Name. .Surname and .FullName read the other name parts. */
function textOf(bound: SourceInstance, path = ""): (() => string) | undefined {
    let normalized = path.trim();
    while (normalized.startsWith(".")) normalized = normalized.slice(1);
    if (normalized === "") {
        if (bound.Text !== undefined) return () => bound.Text!();
        const name = bound.channels?.name?.Text ?? bound.channels?.text?.Text;
        return name === undefined ? undefined : () => name();
    }
    if (normalized.includes(".")) return undefined;
    const read = textChannel(bound, normalized);
    return read === undefined ? undefined : () => read();
}

function referencesMember(document: PresetDocument): boolean {
    if (document.sources.some(spec => spec.props.unit === "$unit" || spec.props.unit === "$pet")) return true;
    const walk = (node: PresetNode, scoped: boolean): boolean => {
        if (!scoped && (node.props.unit === "$unit" || node.props.unit === "$pet" || node.props.powerColorUnit === "$unit" || node.props.powerColorUnit === "$pet")) return true;
        const next = scoped || node.type === "foreach" || node.type === "blizzardElement";
        return (node.children ?? []).some(child => walk(child, next));
    };
    return walk(document.root, false);
}

export function buildPreset(host: Presets, document: PresetDocument, preview: boolean): PresetInstance  {
        if (InCombatLockdown()) fail("create a component after combat");
        const data = host.Validate(document, preview);
        const activation = new ActivationContext(host.Layouts);
        const keybindings = host.bindings.Snapshot();
        const activatedDocuments = new Set<PresetDocument>();
        const cleanups: (() => void)[] = [];
        const nodes = new Map<string, wuiraNativeFrame>();
        const effects: (() => () => void)[] = [];
        const documents = new Map((data.dependencies ?? []).map(doc => [doc.id, doc]));
        const disableInput = (cell: Cell) => {
            if (cell.kind === "secureButton" || cell.kind === "button") cell.kind = "cell";
            (cell.props as Record<string, unknown>).clickThrough = true;
            if (cell.child !== undefined) disableInput(cell.child);
            for (const child of cell.children ?? []) disableInput(child);
        };
        const buildDocument = (document: PresetDocument, prefix: string, units?: UnitScope, ownedCleanups = cleanups, itemScope?: ItemScope, borrowed?: (name: string) => SourceInstance | undefined, inputAvailable?: (name: string) => boolean): Cell[] => {
            if (!preview && !activation.Matches(document)) return [];
            const simulating = preview && borrowed === undefined && inputAvailable === undefined;
            let fallbackUnit: UnitSource | undefined;
            const sampleUnit = () => fallbackUnit ?? (fallbackUnit = units?.unit ?? UseSource(UnitSource, "player"));
            if (document.sources.some(spec => spec.isProp && !spec.optional && !(simulating || (inputAvailable?.(spec.name) ?? borrowed?.(spec.name) !== undefined)))) return [];
            activatedDocuments.add(document);
            if (!preview && prefix === "") applyLayoutPosition(document, activation.LayoutKey);
            const instances = new Map<string, SourceInstance>();
            const specs = new Map<string, SourceSpec>(document.sources.map(spec => [spec.name, spec]));
            const creating = new Set<string>(); const views = new Map<string, Cell>();
            const unit = (token: string): UnitInput => {
                if (token === "$unit") { if (units === undefined) fail("$unit requires a repeated unit or nameplate scope"); return units.unit; }
                if (token === "$pet") { if (units?.pet === undefined) fail("$pet requires a ForEach pet scope"); return units.pet; }
                const spec = specs.get(token);
                if (spec !== undefined) { const bound = source(token).unit; if (bound !== undefined) return bound; if (simulating) return sampleUnit(); fail("unit input requires UnitSource: " + token); }
                if (!literalUnit(token)) fail("missing named UnitSource or unsupported unit context: " + token);
                return token;
            };
            const source = (name: string): SourceInstance => {
                const existing = instances.get(name); if (existing !== undefined) return existing;
                if (name === "item" && !specs.has(name)) {
                    if (itemScope?.bind === undefined) fail("this ForEach item does not provide a default source");
                    const bound = itemScope.bind(); instances.set(name, bound); return bound;
                }
                const spec = specs.get(name); if (spec === undefined) fail("missing source: " + name);
                if (spec.isProp) {
                    const supplied = borrowed?.(name);
                    if (supplied !== undefined) { instances.set(name, supplied); return supplied; }
                    if (simulating) { const sample = previewInput(spec.type, spec.props); instances.set(name, sample); return sample; }
                    fail("unbound source input: " + name);
                }
                if (creating.has(name)) fail("cyclic source dependency"); creating.add(name);
                let created: SourceInstance;
                try { created = host.sources.get(spec.type)!.Create(spec.props, { Preview: preview, Manual: document.enabled === "always", Item: () => itemScope?.value, Unit: unit, Source: source }); } finally { creating.delete(name); }
                instances.set(name, created);
                if (created.Dispose !== undefined) ownedCleanups.push(() => created.Dispose!());
                return created;
            };
            const unavailable = (name: string): boolean => {
                const spec = specs.get(name); if (spec === undefined) return name !== "item" || itemScope?.bind === undefined;
                if (spec.isProp) return !(simulating || (inputAvailable?.(name) ?? borrowed?.(name) !== undefined));
                if (typeof spec.props.unit === "string" && !specs.has(spec.props.unit) && !literalUnit(spec.props.unit) && !(spec.props.unit === "$unit" && units !== undefined || spec.props.unit === "$pet" && units?.pet !== undefined)) return true;
                return [...host.sources.get(spec.type)!.references ?? [], ...(typeof spec.props.unit === "string" && specs.has(spec.props.unit) ? ["unit"] : [])].some(key => unavailable(spec.props[key] as string));
            };
            const build = (node: PresetNode, repeat?: { units?: UnitScope; item: ItemScope; cleanups: (() => void)[]; prefix: string; name?: string }): Cell[] => {
                const consumed: string[] = [];
                for (const key of ["source", "visibleSource", "glowSource", "textSource", "alphaSource"] as const) if (node[key] !== undefined) consumed.push(node[key]!);
                consumed.push(...Object.values(node.bindings ?? {}).map(binding => binding.source));
                for (const key of ["unit", "powerColorUnit"]) { if (node.type === "hideUnitFrame" && key === "unit") continue; const value = node.props[key]; if (typeof value === "string" && (specs.has(value) || !literalUnit(value) && value !== "$unit" && value !== "$pet")) consumed.push(value); }
                if (node.type === "blizzardElement" && typeof node.props.filter === "string") consumed.push(node.props.filter);
                if (consumed.some(name => unavailable(name))) return [];

                if (node.type === "fragment") {
                    const result: Cell[] = []; for (const child of node.children ?? []) result.push(...build(child)); return result;
                }
                if (node.type === "preset") {
                    const contextSources = new Map<string, SourceInstance>();
                    const resolveInput = (name: string): SourceInstance | undefined => {
                        const binding = node.sourceProps?.[name]; if (binding === undefined) return undefined;
                        const contextual = repeatReference(binding);
                        if (contextual !== undefined && (repeat === undefined || contextual.owner !== "parent" && contextual.owner !== repeat.name)) fail("missing named Repeat context: " + binding);
                        if (contextual?.field === "$unit" || contextual?.field === "$pet") {
                            const value = contextual.field === "$unit" ? repeat?.units?.unit : repeat?.units?.pet;
                            if (value === undefined) fail("missing Repeat unit context: " + binding);
                            let instance = contextSources.get(binding); if (instance === undefined) { instance = { unit: value, channels: unitTextChannels(value.Token, preview) }; contextSources.set(binding, instance); } return instance;
                        }
                        if (contextual?.field === "$item") {
                            let instance = contextSources.get(binding); if (instance !== undefined) return instance;
                            if (repeat?.item.bind === undefined) fail("Repeat collection does not provide an item source");
                            instance = repeat.item.bind(); contextSources.set(binding, instance); return instance;
                        }
                        return unavailable(binding) ? undefined : source(binding);
                    };
                    const hasInput = (name: string): boolean => {
                        const binding = node.sourceProps?.[name]; if (binding === undefined) return false;
                        const contextual = repeatReference(binding);
                        if (contextual !== undefined) {
                            if (repeat === undefined || contextual.owner !== "parent" && contextual.owner !== repeat.name) return false;
                            if (contextual.field === "$unit") return repeat.units !== undefined;
                            if (contextual.field === "$pet") return repeat.units?.pet !== undefined;
                            return repeat.item.bind !== undefined;
                        }
                        return !unavailable(binding);
                    };
                    const result = buildDocument(referenceDocument(documents.get(node.preset!)!, node), repeat?.prefix ?? prefix + node.id + "/", repeat?.units, repeat?.cleanups ?? ownedCleanups, repeat?.item, resolveInput, hasInput);
                    const referenceKey = (repeat?.prefix ?? prefix) + node.id;
                    const view = result[0];
                    if (view !== undefined) {
                        const props = view.props as Record<string, unknown>;
                        // A reused preset is placed by its containing tree, not its old screen anchor.
                        props.mode = "relative"; props.anchor = "CENTER"; props.relativeAnchor = "CENTER";
                        props.offset = { x: 0, y: 0 }; delete props.relativeTo; delete props.x; delete props.y;
                        for (const [key, value] of Object.entries(node.props)) props[key] = value;
                        views.set(node.id, view);
                        const mount = props.onMount as ((frame: wuiraNativeFrame) => void | (() => void)) | undefined;
                        props.onMount = (frame: wuiraNativeFrame) => { nodes.set(referenceKey, frame); const stop = mount?.(frame); return () => { nodes.delete(referenceKey); stop?.(); }; };
                    }
                    return result;
                }
                const definition = host.components.get(node.type)!;
                const context = { Preview: preview, Item: () => itemScope?.value, Unit: unit, ResolveSource: source, Source: (): SourceInstance | undefined => {
                    if (node.items !== undefined) {
                        const name = "inline:" + node.id;
                        if (!specs.has(name)) specs.set(name, host.ParseItems(node.items));
                        return source(name);
                    }
                    if (node.source === undefined) return undefined;
                    const instance = source(node.source);
                    if (node.sourcePath === undefined) return instance;
                    let value: unknown = instance;
                    const parts = node.sourcePath.split(".");
                    for (const part of parts) {
                        if (typeof value !== "object" || value === null || issecretvalue(value)) fail("invalid source path: " + node.sourcePath);
                        value = (value as Record<string, unknown>)[part];
                        if (value === undefined || issecretvalue(value)) fail("missing or restricted source path: " + node.sourcePath);
                    }
                    const capability = definition.source;
                    if (capability === undefined || typeof value !== "object" || value === null) fail("path must resolve to a bindable source");
                    const resolved = value as SourceInstance;
                    if (resolved[capability] !== undefined) return resolved;
                    const last = parts[parts.length - 1];
                    if (last !== capability && !(last === "cooldown" && capability === "progress")) fail("path has an incompatible source type");
                    return { [capability]: value } as SourceInstance;
                } };
                if (definition.headless === true && definition.deferred === true) {
                    const template = node.children?.[0];
                    const createTemplate = (token: string, sample = false) => {
                        if (template === undefined) fail("missing dynamic replacement template");
                        const disposers: (() => void)[] = [];
                        const scopePrefix = prefix + node.id + "/" + token + "/";
                        const dispose = () => {
                            disposeAll(disposers);
                            // An onMount failure can occur before a node's own disposer is installed.
                            for (const [id] of nodes) if (id.startsWith(scopePrefix)) nodes.delete(id);
                        };
                        try {
                            const result = buildDocument({ ...document, root: template }, scopePrefix,
                                { unit: UseSource(UnitSource, token) }, disposers, undefined, borrowed, inputAvailable)[0];
                            if (result === undefined) fail("replacement template must return a visual tree");
                            const props = result.props as Record<string, unknown>;
                            props.mode = "relative"; props.anchor = "CENTER"; props.relativeAnchor = "CENTER";
                            props.offset = { x: 0, y: 0 }; delete props.relativeTo; delete props.x; delete props.y;
                            if (sample) ownedCleanups.push(dispose);
                            return { View: result, Dispose: dispose };
                        } catch (failure) { dispose(); throw failure; }
                    };
                    if (preview) return template === undefined ? [] : [createTemplate("target", true).View];
                    effects.push(() => definition.Apply(node.props, { ...context, Template: createTemplate }));
                    return [];
                }
                if (node.type === "foreach") {
                    const collection = context.Source() ?? (node.source === undefined && node.items === undefined ? { items: { Value: [], onChange: () => () => {} } } as SourceInstance : undefined), list = collection?.items;
                    if (collection === undefined || list === undefined) fail("ForEach source must provide an observable list");
                    const key = (item: object) => collection.ItemsKey?.(item) ?? (item as { key: string | number }).key;
                    const scopes = new Map<Cell, { units?: UnitScope; item: ItemScope; notify(): void; dispose(): void }>();
                    // An iterable collection may also have Lua array slots. Keep the
                    // observable boundary explicit so wuira never treats it as a snapshot.
                    const observed = new ObservableItems(list);
                    const view = ForEach({ ...node.props, items: observed, key,
                        groupBy: node.props.groupBy === "group" ? item => collection.ItemsGroup?.(item) ?? "1" : undefined,
                        direction: node.props.direction as "horizontal" | "vertical" | undefined,
                        gap: node.props.gap as number | undefined, lineGap: node.props.lineGap as number | undefined, wrapAfter: node.props.wrapAfter as number | undefined,
                        child: value => {
                            const token = collection.ItemsUnit?.(value);
                            const unitScope = token === undefined ? undefined : { unit: UseSource(UnitSource, token), pet: UseSource(UnitSource, petUnit(token)) };
                            const scope: ItemScope = { value };
                            const itemValue = new RepeatItemValue(scope);
                            const disposers: (() => void)[] = [() => itemValue.Dispose()];
                            let itemInstance: SourceInstance | undefined;
                            scope.bind = () => {
                                if (itemInstance !== undefined) return itemInstance;
                                itemInstance = collection.BindItem?.(() => scope.value) ?? {};
                                if (unitScope !== undefined) itemInstance.unit = unitScope.unit;
                                itemInstance.value ??= itemValue;
                                if (itemInstance.Dispose !== undefined) disposers.push(() => itemInstance!.Dispose!());
                                return itemInstance;
                            };
                            try {
                                const templateIndex = Math.min(collection.ItemsTemplate?.(value) ?? 0, node.children!.length - 1);
                                const template = node.children![templateIndex];
                                const child = build(template, { units: unitScope, cleanups: disposers, item: scope, prefix: prefix + node.id + "/" + key(value) + "/", name: node.name ?? (node === document.root ? document.name : undefined) })[0];
                                if (child === undefined) { const empty = UI.createElement("cell", { width: 0, height: 0, condition: false }); scopes.set(empty, { units: unitScope, item: scope, notify: () => itemValue.Notify(), dispose: () => disposeAll(disposers) }); return empty; }
                                if (preview) disableInput(child);
                                scopes.set(child, { units: unitScope, item: scope, notify: () => itemValue.Notify(), dispose: () => disposeAll(disposers) }); return child;
                            } catch (failure) { disposeAll(disposers); throw failure; }
                        },
                        onUpdate: (child, value) => {
                            const scope = scopes.get(child)!; scope.item.value = value;
                            const token = collection.ItemsUnit?.(value);
                            if (scope.units !== undefined && token !== undefined) { scope.units.unit.Retarget(token); scope.units.pet?.Retarget(petUnit(token)); }
                            scope.notify();
                        },
                        onDispose: child => { scopes.get(child)?.dispose(); scopes.delete(child); },
                    });
                    views.set(node.id, view);
                    const props = view.props as Record<string, unknown>;
                    const mount = props.onMount as (frame: wuiraNativeFrame) => () => void;
                    props.onMount = (frame: wuiraNativeFrame) => { nodes.set(prefix + node.id, frame); const stop = mount(frame); return () => { stop(); nodes.delete(prefix + node.id); }; };
                    return [view];
                }
                const children: Cell[] = []; for (const child of node.children ?? []) children.push(...build(child));
                const instance = context.Source();
                if (instance !== undefined && definition.source !== undefined && instance[definition.source] === undefined) fail("incompatible source for " + node.type);
                if (definition.headless === true) { if (!preview) effects.push(() => definition.Apply(node.props, context)); return []; }
                const { relativeTo, ...inputProps } = node.props;
                applySectionProps(node, inputProps, source);
                if (node.type === "secureButton") {
                    delete inputProps.binding;
                    const presetId = typeof node.props.clickCastPreset === "string" ? node.props.clickCastPreset : undefined;
                    if (!preview && presetId === undefined && inputProps.unit === undefined) {
                        const binding = keybindings[document.id]?.[node.id];
                        if (binding !== undefined) inputProps.binding = binding;
                    }
                }
                if (!preview && node.type === "icon" && node.glowSource !== undefined) {
                    const read = booleanOf(source(node.glowSource), node.glowPath ?? "");
                    if (read === undefined) fail("glow requires a boolean");
                    const match = node.glowWhen !== "false";
                    (inputProps as { glowActive?: () => boolean }).glowActive = () => read() === match;
                }
                const bindProperties = preparePropertyBindings(node, inputProps, source, ownedCleanups);
                const view = definition.Create(inputProps, children, context);
                bindProperties(view);
                mountSections(view, node, preview, source, unit, name => { const token = specs.get(name)?.props.unit; return typeof token === "string" ? token : undefined; });
                views.set(node.id, view);
                if (typeof relativeTo === "string") (view.props as Record<string, unknown>).relativeTo = relativeTo;
                const props = view.props as Record<string, unknown>;
                const previousMount = props.onMount as ((frame: wuiraNativeFrame) => void | (() => void)) | undefined;
                props.onMount = (frame: wuiraNativeFrame) => {
                    if (preview && !nodes.has(node.id)) nodes.set(node.id, frame);
                    nodes.set(prefix + node.id, frame); const cleanup = previousMount?.(frame);
                    return () => { nodes.delete(prefix + node.id); if (nodes.get(node.id) === frame) nodes.delete(node.id); cleanup?.(); };
                };
                if (node.visibleSource !== undefined) {
                    const read = booleanOf(source(node.visibleSource), node.visiblePath ?? "");
                    if (read !== undefined) { const match = node.visibleWhen !== "false"; props.visible = () => read() === match; }
                    else if ((node.visiblePath ?? "").trim() !== "") fail("visibility requires a boolean");
                }
                if (node.textSource !== undefined) { const read = textOf(source(node.textSource), node.sourcePath ?? ""); if (read === undefined || node.type !== "label") fail("invalid text binding"); props.text = read; }
                if (node.alphaSource !== undefined) { const bound = source(node.alphaSource); if (bound.Alpha === undefined) fail("source has no alpha binding"); props.alpha = () => bound.Alpha!(); }
                if (preview) {
                    // Authoring must remain possible when a condition or a live unit is absent.
                    props.visible = undefined; props.condition = true; props.alpha = 1;
                    if (node.textSource !== undefined) {
                        const value = textOf(source(node.textSource), node.sourcePath ?? "")?.();
                        props.text = value === undefined || issecretvalue(value) || value === "" ? "Sample text" : value;
                    }
                    if (view.kind === "icon") {
                        let texture: string | number | undefined;
                        try { if (instance?.texture !== undefined && !instance.texture.IsSecret()) texture = instance.texture.Value; } catch {}
                        const spec = node.source === undefined ? undefined : specs.get(node.source);
                        const ids = spec?.props.spellIds as number[] | undefined;
                        const id = spec?.props.spellId as number | undefined ?? ids?.[0];
                        if (texture === undefined && id !== undefined) texture = C_Spell?.GetSpellTexture?.(id);
                        props.textureSource = undefined;
                        props.texture = issecretvalue(texture) ? "Interface\\Icons\\INV_Misc_QuestionMark" : texture ?? props.texture ?? "Interface\\Icons\\INV_Misc_QuestionMark";
                    }
                    if (view.kind === "progress" && instance?.progress instanceof TimerSource && !instance.progress.IsActive) {
                        view.source = undefined; props.source = undefined;
                        props.min = 0; props.max = 100; props.current = 65;
                    }
                }
                return [view];
            };
            const result = build(document.root);
            for (const cell of views.values()) {
                const props = cell.props as Record<string, unknown>;
                if (typeof props.relativeTo === "string") props.relativeTo = views.get(props.relativeTo);
            }
            return result;
        };
        try {
            const previewScope: UnitScope | undefined = preview && referencesMember(data) ? { unit: UseSource(UnitSource, "player"), pet: UseSource(UnitSource, "pet") } : undefined;
            const view = buildDocument(data, "", previewScope)[0];
            if (preview && view !== undefined) {
                disableInput(view);
            }
            let disposed = false;
            const handle: PresetInstance = { Nodes: nodes, View: view, Dispose: () => {
                if (disposed) return; disposed = true; host.activators.delete(handle);
                afterCombat(() => {
                    if (host.active.get(data.id) === handle) { host.active.delete(data.id); host.liveDocuments.delete(data.id); host.activationSignatures.delete(data.id); host.paused.add(data.id); }
                    const observing = host.observerCleanups.get(handle); if (observing !== undefined) disposeAll(observing); host.observerCleanups.delete(handle);
                    if (handle.Frame !== undefined) wuira.Unmount(handle.Frame); disposeAll(cleanups);
                });
            } };
            if (!preview) host.activators.set(handle, () => {
                for (const doc of activatedDocuments)
                    if (doc.owner !== undefined && C_AddOns?.IsAddOnLoaded?.(doc.owner) !== true) fail("component owner is unavailable: " + doc.owner);
                for (const activate of effects) cleanups.push(activate());
            });
            return handle;
        } catch (failure) { disposeAll(cleanups); throw failure; }

}
