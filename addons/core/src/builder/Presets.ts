declare const C_AddOns: { IsAddOnLoaded?: (this: void, name: string) => boolean } | undefined;
import { TimerSource } from "wuira/datasources";
import { wuira } from "wuira";
import type { Cell } from "wuira";
import type { StoreRegistry } from "wuira/store";
import type { ComponentDefinition, PresetAPI, PresetDocument, PresetInstance, PresetNode, PropertyRules, SourceDefinition, SourceInstance, SourceSpec } from "../core/builder";
import { Library, BuilderSettings, afterCombat, disposeAll } from "./Library";
import { array, copy, fail, identifier, keys, properties, record, text } from "./validate";

/** Existing compiled constructors build a document; only referenced sources are instantiated. */
export class Presets extends Library<PresetDocument> implements PresetAPI {
    private readonly components = new Map<string, ComponentDefinition>();
    private readonly sources = new Map<string, SourceDefinition>();
    private readonly paused = new Set<string>();
    private readonly observers = new Set<(document: PresetDocument, instance: PresetInstance) => void | (() => void)>();
    private readonly observerCleanups = new Map<PresetInstance, (() => void)[]>();
    private readonly liveDocuments = new Map<string, PresetDocument>();
    private readonly activators = new Map<PresetInstance, () => void>();
    private readonly active = new Map<string, PresetInstance>();
    public constructor(store: StoreRegistry) {
        super(store, "preset");
        const listener = CreateFrame("Frame", undefined, UIParent); listener.RegisterEvent("ADDON_LOADED"); listener.RegisterEvent("PLAYER_REGEN_ENABLED");
        listener.SetScript("OnEvent", () => { if (this.store.IsReady && !InCombatLockdown()) this.Restore(); });
    }
    public RegisterComponent(name: string, definition: ComponentDefinition): () => void {
        identifier(name); if (["fragment", "preset"].includes(name)) fail("reserved component type"); if (this.components.has(name)) fail("component already registered: " + name);
        this.components.set(name, definition);
        return () => { if (this.components.get(name) === definition) this.components.delete(name); };
    }
    public RegisterSource(name: string, definition: SourceDefinition): () => void {
        identifier(name); if (this.sources.has(name)) fail("source already registered: " + name);
        this.sources.set(name, definition);
        return () => { if (this.sources.get(name) === definition) this.sources.delete(name); };
    }
    public ObserveMount(listener: (document: PresetDocument, instance: PresetInstance) => void | (() => void)): () => void {
        this.observers.add(listener);
        const owned = new Set<() => void>();
        const attach = (document: PresetDocument, instance: PresetInstance) => {
            const cleanup = listener(document, instance);
            if (cleanup !== undefined) { owned.add(cleanup); this.observerCleanups.get(instance)?.push(() => { if (owned.delete(cleanup)) cleanup(); }); }
        };
        const wrapper = (document: PresetDocument, instance: PresetInstance) => attach(document, instance);
        this.observers.delete(listener); this.observers.add(wrapper);
        for (const [id, instance] of this.active) attach(this.liveDocuments.get(id)!, instance);
        return () => { this.observers.delete(wrapper); disposeAll(Array.from(owned)); owned.clear(); };
    }
    public ComponentTypes(): string[] { return ["fragment", "preset", ...Array.from(this.components.keys())]; }
    public ComponentProperties(type: string): PropertyRules {
        if (type === "fragment") return {};
        const definition = this.components.get(type === "preset" ? "cell" : type);
        if (definition === undefined) fail("unknown component type: " + type);
        return copy(definition.properties) as unknown as PropertyRules;
    }
    public SourceTypes(): string[] { return Array.from(this.sources.keys()); }
    public SourceProperties(type: string): PropertyRules {
        const definition = this.sources.get(type);
        if (definition === undefined) fail("unknown source type: " + type);
        return copy(definition.properties) as unknown as PropertyRules;
    }
    /** Dependencies travel in the envelope, but are stored as independent library entries. */
    public Validate(input: unknown): PresetDocument {
        const data = record(copy(input));
        const available = new Map<string, PresetDocument>();
        const collect = (value: unknown, depth: number) => {
            if (depth > 16 || available.size >= 64) fail("too many preset dependencies");
            const doc = record(value);
            keys(doc, ["version", "kind", "id", "name", "owner", "sources", "root", "dependencies"]);
            if (doc.kind !== "preset" || doc.version !== 1) fail("unsupported preset version or kind");
            const id = identifier(doc.id); text(doc.name, "preset name"); if (doc.owner !== undefined) identifier(doc.owner);
            if (available.has(id)) fail("duplicate preset dependency: " + id);
            available.set(id, doc as unknown as PresetDocument);
            for (const dependency of doc.dependencies === undefined ? [] : array(doc.dependencies, 64)) collect(dependency, depth + 1);
            delete doc.dependencies;
        };
        collect(data, 0);
        const local = new Map(this.List().map(doc => [doc.id, doc]));
        const stack = new Set<string>(); const dependencies = new Map<string, PresetDocument>();
        let nodeCount = 0, sourceCount = 0;
        const validate = (doc: PresetDocument, depth: number): number => {
            if (depth > 16 || stack.has(doc.id)) fail("cyclic preset dependency: " + doc.id);
            stack.add(doc.id);
            const names = new Set<string>();
            for (const entry of array(doc.sources, 128)) {
                if (++sourceCount > 512) fail("too many composed sources");
                const spec = record(entry); keys(spec, ["name", "type", "props"]);
                const name = identifier(spec.name), type = identifier(spec.type);
                if (names.has(name)) fail("duplicate source: " + name); names.add(name);
                const source = this.sources.get(type); if (source === undefined) fail("source addon is unavailable: " + type);
                properties(spec.props, source.properties);
            }
            for (const entry of doc.sources) for (const field of this.sources.get(entry.type)!.references ?? [])
                if (!names.has(identifier(entry.props[field]))) fail("missing source dependency");
            const ids = new Set<string>(); const drawable = new Set<string>();
            const visit = (inputNode: unknown, level: number): number => {
                if (level > 32 || ++nodeCount > 256) fail("preset tree is too large");
                const node = record(inputNode);
                keys(node, ["id", "type", "props", "source", "sourcePath", "visibleSource", "textSource", "alphaSource", "children", "preset"]);
                const id = identifier(node.id); if (ids.has(id)) fail("duplicate node ID: " + id); ids.add(id);
                const type = identifier(node.type);
                const children = node.children === undefined ? [] : array(node.children);
                if (type === "preset" || type === "fragment") {
                    properties(node.props, type === "preset" ? this.ComponentProperties("cell") : {});
                    for (const field of ["source", "sourcePath", "visibleSource", "textSource", "alphaSource"])
                        if (node[field] !== undefined) fail("bind sources inside the referenced preset");
                    if (type === "fragment") {
                        if (node.preset !== undefined) fail("only preset nodes accept a preset reference");
                        let total = 0; for (const child of children) total += visit(child, level + 1); return total;
                    }
                    if (children.length > 0) fail("edit children in the referenced preset");
                    const dependencyId = identifier(node.preset);
                    const dependency = available.get(dependencyId) ?? local.get(dependencyId);
                    if (dependency === undefined) fail("missing preset dependency: " + dependencyId);
                    dependencies.set(dependencyId, dependency);
                    const count = validate(dependency, depth + 1); if (count > 0) drawable.add(id); return count;
                }
                if (node.preset !== undefined) fail("only preset nodes accept a preset reference");
                const component = this.components.get(type);
                if (component === undefined) fail("component addon is unavailable: " + type);
                properties(node.props, component.properties);
                if (node.source !== undefined) {
                    const name = identifier(node.source); if (!names.has(name)) fail("missing source: " + name);
                    if (component.source === undefined) fail("component does not accept a source: " + type);
                }
                if (node.sourcePath !== undefined) {
                    if (node.source === undefined) fail("sourcePath requires a source");
                    for (const part of text(node.sourcePath, "source path", 128).split(".")) {
                        identifier(part); if (["__proto__", "prototype", "constructor"].includes(part)) fail("invalid source path");
                    }
                }
                for (const field of ["visibleSource", "textSource", "alphaSource"])
                    if (node[field] !== undefined && !names.has(identifier(node[field]))) fail("missing binding source");
                if (component.headless === true && ["visibleSource", "textSource", "alphaSource"].some(field => node[field] !== undefined))
                    fail("headless effects do not have visual bindings");
                let total = 0; for (const child of children) total += visit(child, level + 1);
                if ((component.children === "none" && children.length > 0) || (component.children === "single" && total > 1)) fail("invalid child count for " + type);
                if (component.headless === true) return 0;
                drawable.add(id); return 1;
            };
            const count = visit(doc.root, 0); if (count > 1) fail("wrap visual roots in a layout");
            const references = (node: PresetNode) => {
                if (node.props.relativeTo !== undefined && !drawable.has(identifier(node.props.relativeTo))) fail("missing relativeTo node");
                for (const child of node.children ?? []) references(child);
            };
            references(doc.root); stack.delete(doc.id); return count;
        };
        validate(data as unknown as PresetDocument, 0);
        for (const id of available.keys()) if (id !== data.id && !dependencies.has(id)) fail("unused preset dependency: " + id);
        const result = data as unknown as PresetDocument;
        if (dependencies.size > 0) result.dependencies = Array.from(dependencies.values());
        return result;
    }
    public IsHeadless(document: PresetDocument): boolean {
        const data = this.Validate(document); const docs = new Map((data.dependencies ?? []).map(doc => [doc.id, doc]));
        const visual = (node: PresetNode): boolean => node.type === "preset" ? visual(docs.get(node.preset!)!.root)
            : node.type === "fragment" ? (node.children ?? []).some(visual) : this.components.get(node.type)?.headless !== true;
        return !visual(data.root);
    }
    public UsedBy(id: string): PresetDocument[] {
        const uses = (node: PresetNode): boolean => node.preset === id || (node.children ?? []).some(uses);
        return this.List().filter(doc => uses(doc.root));
    }
    private CheckDependencies(data: PresetDocument): void {
        const equal = (a: unknown, b: unknown): boolean => {
            if (a === b) return true;
            if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
            const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
            return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => equal(left[key], right[key]));
        };
        for (const dependency of data.dependencies ?? []) {
            const existing = this.Get(dependency.id);
            if (existing !== undefined && !equal(existing, dependency)) fail("dependency already exists with different settings: " + dependency.name + ". Edit it in the library first.");
        }
    }
    public Save(document: PresetDocument, enabled = false): void {
        const data = this.Validate(document);
        this.CheckDependencies(data);
        // A shared edit must remain structurally valid in every consumer before committing it.
        const override = new Map([...[...this.List(), ...data.dependencies ?? []].map(doc => [doc.id, doc] as [string, PresetDocument]), [data.id, data] as [string, PresetDocument]]);
        for (const consumer of this.List()) {
            if (consumer.id === data.id) continue;
            const graph = new Map<string, PresetDocument>();
            const visit = (node: PresetNode) => {
                if (node.preset !== undefined && !graph.has(node.preset)) {
                    const doc = override.get(node.preset); if (doc === undefined) fail("missing preset dependency: " + node.preset);
                    graph.set(doc.id, doc); visit(doc.root);
                }
                for (const child of node.children ?? []) visit(child);
            };
            visit(consumer.root);
            if (graph.has(data.id)) {
                const dependencies = Array.from(graph.values()).map(doc => { const { dependencies, ...item } = doc; return item; });
                this.Validate({ ...consumer, dependencies });
            }
        }
        this.store.set(BuilderSettings, settings => {
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
        const queue = this.UsedBy(data.id); const refreshed = new Set<string>();
        for (let i = 0; i < queue.length; i++) {
            const parent = queue[i]; if (refreshed.has(parent.id)) continue; refreshed.add(parent.id);
            if (this.active.has(parent.id)) this.Mount(parent);
            queue.push(...this.UsedBy(parent.id));
        }
    }
    public Delete(id: string): void {
        const users = this.UsedBy(id); if (users.length > 0) fail("preset is used by: " + users.map(doc => doc.name).join(", "));
        super.Delete(id);
    }
    public Create(document: PresetDocument): PresetInstance { return this.Build(document, false); }
    public Preview(document: PresetDocument): PresetInstance { return this.Build(document, true); }
    private Build(document: PresetDocument, preview: boolean): PresetInstance {
        if (InCombatLockdown()) fail("create a preset after combat");
        const data = this.Validate(document);
        const cleanups: (() => void)[] = [];
        const nodes = new Map<string, wuiraNativeFrame>();
        const effects: (() => () => void)[] = [];
        const documents = new Map((data.dependencies ?? []).map(doc => [doc.id, doc]));
        const buildDocument = (document: PresetDocument, prefix: string): Cell[] => {
            const instances = new Map<string, SourceInstance>();
            const specs = new Map<string, SourceSpec>(document.sources.map(spec => [spec.name, spec]));
            const creating = new Set<string>(); const views = new Map<string, Cell>();
            const source = (name: string): SourceInstance => {
                const existing = instances.get(name); if (existing !== undefined) return existing;
                const spec = specs.get(name); if (spec === undefined) fail("missing source: " + name);
                if (creating.has(name)) fail("cyclic source dependency"); creating.add(name);
                let created: SourceInstance;
                try { created = this.sources.get(spec.type)!.Create(spec.props, { Source: source }); } finally { creating.delete(name); }
                instances.set(name, created);
                if (created.Dispose !== undefined) cleanups.push(() => created.Dispose!());
                return created;
            };
            const build = (node: PresetNode): Cell[] => {
                if (node.type === "fragment") {
                    const result: Cell[] = []; for (const child of node.children ?? []) result.push(...build(child)); return result;
                }
                if (node.type === "preset") {
                    const result = buildDocument(documents.get(node.preset!)!, prefix + node.id + "/");
                    const view = result[0];
                    if (view !== undefined) {
                        const props = view.props as Record<string, unknown>;
                        // A reused preset is placed by its containing tree, not its old screen anchor.
                        props.mode = "relative"; props.anchor = "CENTER"; props.relativeAnchor = "CENTER";
                        props.offset = { x: 0, y: 0 }; delete props.relativeTo; delete props.x; delete props.y;
                        for (const [key, value] of Object.entries(node.props)) props[key] = value;
                        views.set(node.id, view);
                        const mount = props.onMount as ((frame: wuiraNativeFrame) => void | (() => void)) | undefined;
                        props.onMount = (frame: wuiraNativeFrame) => { nodes.set(prefix + node.id, frame); const stop = mount?.(frame); return () => { nodes.delete(prefix + node.id); stop?.(); }; };
                    }
                    return result;
                }
                const definition = this.components.get(node.type)!;
                const context = { Source: (): SourceInstance | undefined => {
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
                const children: Cell[] = []; for (const child of node.children ?? []) children.push(...build(child));
                const instance = context.Source();
                if (instance !== undefined && definition.source !== undefined && instance[definition.source] === undefined) fail("incompatible source for " + node.type);
                if (definition.headless === true) { if (!preview) effects.push(() => definition.Apply(node.props, context)); return []; }
                const { relativeTo, ...inputProps } = node.props;
                const view = definition.Create(inputProps, children, context);
                views.set(node.id, view);
                if (typeof relativeTo === "string") (view.props as Record<string, unknown>).relativeTo = relativeTo;
                const props = view.props as Record<string, unknown>;
                const previousMount = props.onMount as ((frame: wuiraNativeFrame) => void | (() => void)) | undefined;
                props.onMount = (frame: wuiraNativeFrame) => {
                    nodes.set(prefix + node.id, frame); const cleanup = previousMount?.(frame);
                    return () => { nodes.delete(prefix + node.id); cleanup?.(); };
                };
                if (node.visibleSource !== undefined) { const bound = source(node.visibleSource); if (bound.IsActive === undefined) fail("source has no activity binding"); props.visible = () => bound.IsActive!(); }
                if (node.textSource !== undefined) { const bound = source(node.textSource); if (bound.Text === undefined || node.type !== "label") fail("invalid text binding"); props.text = () => bound.Text!(); }
                if (node.alphaSource !== undefined) { const bound = source(node.alphaSource); if (bound.Alpha === undefined) fail("source has no alpha binding"); props.alpha = () => bound.Alpha!(); }
                if (preview) {
                    // Authoring must remain possible when a condition or a live unit is absent.
                    props.visible = undefined; props.condition = true; props.alpha = 1;
                    if (node.textSource !== undefined) {
                        const value = source(node.textSource).Text!();
                        props.text = issecretvalue(value) || value === "" ? "Sample text" : value;
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
            const view = buildDocument(data, "")[0];
            if (preview && view !== undefined) {
                const disableInput = (cell: Cell) => {
                    if (cell.kind === "secureButton" || cell.kind === "button") cell.kind = "cell";
                    (cell.props as Record<string, unknown>).clickThrough = true;
                    if (cell.child !== undefined) disableInput(cell.child);
                    for (const child of cell.children ?? []) disableInput(child);
                };
                disableInput(view);
            }
            let disposed = false;
            const handle: PresetInstance = { Nodes: nodes, View: view, Dispose: () => {
                if (disposed) return; disposed = true; this.activators.delete(handle);
                afterCombat(() => {
                    if (this.active.get(data.id) === handle) { this.active.delete(data.id); this.liveDocuments.delete(data.id); this.paused.add(data.id); }
                    const observing = this.observerCleanups.get(handle); if (observing !== undefined) disposeAll(observing); this.observerCleanups.delete(handle);
                    if (handle.Frame !== undefined) wuira.Unmount(handle.Frame); disposeAll(cleanups);
                });
            } };
            if (!preview) this.activators.set(handle, () => {
                for (const doc of [data, ...data.dependencies ?? []])
                    if (doc.owner !== undefined && C_AddOns?.IsAddOnLoaded?.(doc.owner) !== true) fail("preset owner is unavailable: " + doc.owner);
                for (const activate of effects) cleanups.push(activate());
            });
            return handle;
        } catch (failure) { disposeAll(cleanups); throw failure; }
    }
    public Mount(document: PresetDocument, parent?: wuiraNativeFrame): PresetInstance {
        if (InCombatLockdown()) fail("mount a preset after combat");
        afterCombat(() => {});
        this.CheckDependencies(this.Validate(document));
        const handle = this.Create(document);
        try {
            const frame = wuira.Mount(handle.View, undefined, parent);
            (handle as { Frame?: wuiraNativeFrame }).Frame = frame;
            this.activators.get(handle)?.(); this.activators.delete(handle);
            this.active.get(document.id)?.Dispose();
            this.paused.delete(document.id);
            this.active.set(document.id, handle);
            this.liveDocuments.set(document.id, this.Validate(document));
            const observing: (() => void)[] = []; this.observerCleanups.set(handle, observing);
            for (const listener of this.observers) { try { const cleanup = listener(this.liveDocuments.get(document.id)!, handle); if (cleanup !== undefined) observing.push(cleanup); } catch (failure) { console.log(String(failure)); } }
            return handle;
        } catch (failure) { handle.Dispose(); throw failure; }
    }
    public Unmount(id: string): void { this.paused.add(id); const handle = this.active.get(id); this.active.delete(id); this.liveDocuments.delete(id); handle?.Dispose(); }
    protected Stop(id: string): void { this.Unmount(id); }
    public Restore(): void {
        for (const document of this.Enabled()) {
            if (this.paused.has(document.id) || this.active.has(document.id) || (document.owner !== undefined && C_AddOns?.IsAddOnLoaded?.(document.owner) !== true)) continue;
            try { this.Mount(document); } catch (failure) { console.log(String(failure)); }
        }
    }
}
