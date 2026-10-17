declare const C_AddOns: { IsAddOnLoaded?: (this: void, name: string) => boolean } | undefined;
import { EditModeLayouts, TimerSource, UnitSource } from "wuira/datasources";
import type { UnitInput } from "wuira/datasources";
import { ForEach } from "wuira/ui";
import { wuira } from "wuira";
import type { Cell } from "wuira";
import type { StoreRegistry } from "wuira/store";
import type { CollectionKeybinding, ComponentDefinition, PresetAPI, ActivationMode, PresetDocument, PresetInstance, PresetNode, Properties, PropertyRules, SourceDefinition, SourceInstance, SourceSpec, ListHelperDefinition } from "../core/builder";
import { Library, BuilderSettings, afterCombat, disposeAll } from "./Library";
import { array, copy, fail, identifier, keys, properties, record, text } from "./validate";
import { applyLayoutPosition } from "./LayoutPosition";
import { ActivationContext, validateActivation } from "./Activation";
import { CollectionBindings, CollectionBindingSettings, stripBindings } from "./CollectionBindings";
import type { ClickCastLibrary } from "./ClickCastLibrary";
import { validateAssignments } from "./BindingTransfer";
import { petUnit } from "./GroupRoster";
function typeNotPreset(node: Record<string, unknown>): boolean { return node.type !== "preset"; }
function referenceDocument(document: PresetDocument, node: PresetNode): PresetDocument {
    const result = { ...document, ...node.activation } as PresetDocument;
    for (const field of ["class", "condition", "layout"] as const) if ((result as unknown as Record<string, unknown>)[field] === "") delete result[field];
    return result;
}
/** Old saved action components now use the core factories and need no addon owner. */
function releaseRetiredOwner(document: { owner?: unknown }): boolean {
    if (document.owner !== "LumaUI_ActionBars") return false;
    delete document.owner;
    return true;
}
interface UnitScope { unit: UnitSource; pet?: UnitSource; }
interface ItemScope { value: object; bind?: () => SourceInstance; }
import { preparePropertyBindings, propertyBindingTargets } from "./PropertyBindings";
import { migrateClassColors } from "./ClassColorMigration";
import { migrateNativeVisibility } from "./NativeVisibilityMigration";
import { validateValuePath } from "./ConverterSources";
import { ListHelpers } from "./ListHelpers";
import { ObservableItems } from "./ObservableItems";

/** Existing compiled constructors build a document; only referenced sources are instantiated. */
export class Presets extends Library<PresetDocument> implements PresetAPI {
    private readonly bindings: CollectionBindings;
    private readonly helpers = new ListHelpers();
    private readonly clickCast: ClickCastLibrary;
    private readonly components = new Map<string, ComponentDefinition>();
    private readonly sources = new Map<string, SourceDefinition>();
    private readonly paused = new Set<string>();
    private readonly observers = new Set<(document: PresetDocument, instance: PresetInstance) => void | (() => void)>();
    private readonly observerCleanups = new Map<PresetInstance, (() => void)[]>();
    private readonly liveDocuments = new Map<string, PresetDocument>();
    private readonly activators = new Map<PresetInstance, () => void>();
    private readonly active = new Map<string, PresetInstance>();
    public readonly Layouts = new EditModeLayouts();
    private started = false;
    private evaluating = false;
    private readonly activationSignatures = new Map<string, string>();
    public constructor(store: StoreRegistry, clickCast: ClickCastLibrary) {
        super(store, "preset");
        this.bindings = new CollectionBindings(store);
        this.clickCast = clickCast;
        const listener = CreateFrame("Frame", undefined, UIParent); for (const event of ["ADDON_LOADED", "PLAYER_REGEN_ENABLED", "PLAYER_ENTERING_WORLD", "GROUP_ROSTER_UPDATE", "UNIT_PET"]) listener.RegisterEvent(event);
        this.Layouts.onChange(() => { if (this.started && this.store.IsReady && !InCombatLockdown()) this.Restore(); });
        listener.SetScript("OnEvent", () => { if (this.started && this.store.IsReady && !InCombatLockdown()) this.Restore(); });
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
    public ComponentChildren(type: string): "none" | "single" | "multiple" {
        if (type === "fragment") return "multiple";
        if (type === "preset") return "none";
        const definition = this.components.get(type);
        if (definition === undefined) fail("unknown component type: " + type);
        return definition.children;
    }
    public ComponentProperties(type: string): PropertyRules {
        if (type === "fragment") return {};
        const definition = this.components.get(type === "preset" ? "cell" : type);
        if (definition === undefined) fail("unknown component type: " + type);
        const rules = copy(definition.properties) as unknown as PropertyRules;
        if (type === "secureButton") { const { binding, ...editable } = rules; return editable; }
        return rules;
    }
    public RegisterListHelper(name: string, definition: ListHelperDefinition): () => void { return this.helpers.Register(name, definition); }
    public ListHelpers(): string[] { return this.helpers.Names(); }
    public ParseItems(expression: string): SourceSpec {
        const spec = this.helpers.Parse(expression), definition = this.sources.get(spec.type);
        if (definition === undefined) fail("source addon is unavailable: " + spec.type);
        properties(spec.props, definition.properties); definition.Validate?.(spec.props); return spec;
    }
    public SourceTypes(): string[] { return Array.from(this.sources.keys()); }
    public SourceProperties(type: string): PropertyRules {
        const definition = this.sources.get(type);
        if (definition === undefined) fail("unknown source type: " + type);
        return copy(definition.properties) as unknown as PropertyRules;
    }
    /** Dependencies travel in the envelope, but are stored as independent library entries. */
    public Validate(input: unknown, allowMissing = false, libraryOverride?: PresetDocument[]): PresetDocument {
        const data = record(copy(input));
        const available = new Map<string, PresetDocument>();
        const collect = (value: unknown, depth: number) => {
            if (depth > 16 || available.size >= 64) fail("too many component dependencies");
            const doc = record(value);
            keys(doc, ["version", "kind", "id", "name", "owner", "sources", "root", "dependencies", "enabled", "class", "condition", "layout", "layoutPositions"]);
            validateActivation(doc);
            if (doc.kind !== "preset" || doc.version !== 1) fail("unsupported component version or kind");
            const id = identifier(doc.id); text(doc.name, "component name"); if (doc.owner !== undefined) identifier(doc.owner);
            releaseRetiredOwner(doc);
            array(doc.sources, 128); migrateClassColors(doc as unknown as PresetDocument); migrateNativeVisibility(doc as unknown as PresetDocument);
            if (available.has(id)) fail("duplicate component dependency: " + id);
            available.set(id, doc as unknown as PresetDocument);
            for (const dependency of doc.dependencies === undefined ? [] : array(doc.dependencies, 64)) collect(dependency, depth + 1);
            delete doc.dependencies;
        };
        collect(data, 0);
        const local = new Map((libraryOverride ?? this.List()).map(doc => [doc.id, doc]));
        const stack = new Set<string>(); const dependencies = new Map<string, PresetDocument>();
        let nodeCount = 0, sourceCount = 0;
        const validate = (doc: PresetDocument, depth: number, dynamic = false): number => {
            if (depth > 16 || stack.has(doc.id)) fail("cyclic component dependency: " + doc.id);
            stack.add(doc.id);
            const names = new Set<string>();
            for (const entry of array(doc.sources, 128)) {
                if (++sourceCount > 512) fail("too many composed sources");
                const spec = record(entry); keys(spec, ["name", "type", "props", "isProp", "optional"]);
                for (const field of ["isProp", "optional"]) if (spec[field] !== undefined && typeof spec[field] !== "boolean") fail("invalid source input flag");
                if (spec.optional === true && spec.isProp !== true) fail("only exposed source inputs can be optional");
                const name = identifier(spec.name), type = identifier(spec.type);
                if (name === "item") fail("item is reserved for the current ForEach item");
                if (names.has(name)) fail("duplicate source: " + name); names.add(name);
                const source = this.sources.get(type); if (source === undefined) fail("source addon is unavailable: " + type);
                if (spec.isProp === true) { properties(spec.props, {}); } else { properties(spec.props, source.properties); source.Validate?.(spec.props as Properties); }
            }
            for (const entry of doc.sources.filter(spec => !spec.isProp)) for (const field of this.sources.get(entry.type)!.references ?? [])
                if (!names.has(identifier(entry.props[field]))) fail("missing source dependency");
            const specsByName = new Map(doc.sources.map(spec => [spec.name, spec]));
            const visitingSources = new Set<string>(), visitedSources = new Set<string>();
            const visitSource = (name: string) => {
                if (visitingSources.has(name)) fail("cyclic source dependency: " + name);
                if (visitedSources.has(name)) return;
                visitingSources.add(name); const spec = specsByName.get(name)!;
                if (!spec.isProp) for (const key of this.sources.get(spec.type)!.references ?? []) visitSource(spec.props[key] as string);
                visitingSources.delete(name); visitedSources.add(name);
            };
            for (const name of names) visitSource(name);
            const ids = new Set<string>(); const drawable = new Set<string>();
            const visit = (inputNode: unknown, level: number, insideGroup = false, insideDynamic = dynamic): number => {
                if (level > 32 || ++nodeCount > 256) fail("component tree is too large");
                const node = record(inputNode);
                keys(node, ["id", "name", "type", "props", "source", "sourcePath", "visibleSource", "textSource", "alphaSource", "children", "preset", "items", "bindings", "activation", "sourceProps"]);
                if (typeNotPreset(node) && (node.activation !== undefined || node.sourceProps !== undefined)) fail("only component references accept activation and source inputs");
                if (node.name !== undefined) text(node.name, "element name", 96);
                const id = identifier(node.id); if (ids.has(id)) fail("duplicate node ID: " + id); ids.add(id);
                const type = identifier(node.type);
                if (insideGroup && type === "preset") fail("edit component references outside the repeated unit template");
                const children = node.children === undefined ? [] : array(node.children);
                if (node.items !== undefined) { if (type !== "foreach") fail("only ForEach accepts an items expression"); this.ParseItems(text(node.items, "items expression", 4096)); }
                if (type === "preset" || type === "fragment") {
                    properties(node.props, type === "preset" ? this.ComponentProperties("cell") : {});
                    if (node.bindings !== undefined) fail("bind properties inside the referenced component");
                    for (const field of ["source", "sourcePath", "visibleSource", "textSource", "alphaSource"])
                        if (node[field] !== undefined) fail("bind sources inside the referenced component");
                    if (type === "fragment") {
                        if (node.preset !== undefined) fail("only component nodes accept a component reference");
                        let total = 0; for (const child of children) total += visit(child, level + 1, insideGroup, insideDynamic); return total;
                    }
                    if (children.length > 0) fail("edit children in the referenced component");
                    const dependencyId = identifier(node.preset);
                    const dependency = available.get(dependencyId) ?? local.get(dependencyId);
                    if (dependency === undefined) { if (allowMissing) { drawable.add(id); return 1; } fail("missing component dependency: " + dependencyId); }
                    if (node.activation !== undefined) { const override = record(node.activation); keys(override, ["enabled", "class", "condition", "layout"]); validateActivation(referenceDocument(dependency, node as unknown as PresetNode) as unknown as Record<string, unknown>); }
                    if (node.sourceProps !== undefined) for (const [input, parentSource] of Object.entries(record(node.sourceProps))) {
                        const target = dependency.sources.find(spec => spec.name === input && spec.isProp);
                        if (target === undefined) fail("component does not expose source: " + input);
                        const supplied = specsByName.get(identifier(parentSource));
                        if (supplied === undefined || supplied.type !== target.type) fail("source input type mismatch: " + input);
                    }
                    dependencies.set(dependencyId, dependency);
                    const count = validate(dependency, depth + 1, insideDynamic); if (count > 0) drawable.add(id); return count;
                }
                if (node.preset !== undefined) fail("only component nodes accept a component reference");
                const component = this.components.get(type);
                if (component === undefined) fail("component addon is unavailable: " + type);
                properties(node.props, component.properties);
                component.Validate?.(node.props as Properties);
                if (insideDynamic && (type === "secureButton" || component.headless === true)) fail("dynamic nameplate templates cannot contain secure controls or headless effects");
                const deferred = component.headless === true && component.deferred === true;
                if (deferred) {
                    if (insideGroup) fail("register dynamic nameplate rules outside repeated item templates");
                    const filter = (node.props as Properties).filter;
                    if (typeof filter !== "string" || !names.has(filter)) fail("BlizzardElement filter requires a named unit converter source");
                    if ((node.props as Properties).replace === true ? children.length !== 1 : children.length !== 0) fail("Replace needs one visual template; Apply has no replacement children");
                }
                if (type === "unitAuras") for (const key of ["maxIcons", "iconSize"]) if (node.props !== undefined && (node.props as Properties)[key] !== undefined && !Number.isInteger((node.props as Properties)[key])) fail("aura slot sizes and counts must be integers");
                if (type === "foreach" && (children.length < 1 || children.length > 2 || (node.source === undefined) === (node.items === undefined))) fail("ForEach requires one list source or helper expression and one item template (an optional second template is for pets)");
                if (type === "foreach" && (node.props as Properties).wrapAfter !== undefined && !Number.isInteger((node.props as Properties).wrapAfter)) fail("ForEach wrapAfter must be an integer");
                if (node.source !== undefined) {
                    const name = identifier(node.source); if (name === "item" ? !insideGroup : !names.has(name)) fail("missing source or ForEach item scope: " + name);
                    if (component.source === undefined) fail("component does not accept a source: " + type);
                }
                if (node.sourcePath !== undefined) {
                    if (node.source === undefined) fail("sourcePath requires a source");
                    for (const part of text(node.sourcePath, "source path", 128).split(".")) {
                        identifier(part); if (["__proto__", "prototype", "constructor"].includes(part)) fail("invalid source path");
                    }
                }
                for (const field of ["visibleSource", "textSource", "alphaSource"])
                    if (node[field] !== undefined && (node[field] === "item" ? !insideGroup : !names.has(identifier(node[field])))) fail("missing binding source or ForEach item scope");
                if (component.headless === true && ["visibleSource", "textSource", "alphaSource"].some(field => node[field] !== undefined))
                    fail("headless effects do not have visual bindings");
                if (node.bindings !== undefined) {
                    if (component.headless === true) fail("headless effects cannot have property bindings");
                    const bindings = record(node.bindings);
                    for (const [target, input] of Object.entries(bindings)) {
                        if (!propertyBindingTargets.includes(target as never) || component.properties[target] === undefined || target === "color" && type !== "progress") fail("unsupported property binding: " + target);
                        const binding = record(input); keys(binding, ["source", "path"]);
                        if (!names.has(identifier(binding.source))) fail("missing property binding source");
                        if (binding.path !== undefined) validateValuePath(text(binding.path, "binding path", 128));
                    }
                }

                let total = 0; for (const child of children) total += visit(child, level + 1, insideGroup || type === "foreach", insideDynamic || deferred);
                if (deferred && (node.props as Properties).replace === true && total !== 1) fail("Replace needs one visual template");
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
        for (const id of available.keys()) if (id !== data.id && !dependencies.has(id)) fail("unused component dependency: " + id);
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
    public Identity(input: string, excludeID?: string): { id: string; name: string; duplicate: boolean } {
        const original = text(input.trim(), "component name", 96);
        const slug = (value: string): string => {
            let result = "";
            for (let i = 0; i < value.length; i++) { const char = value[i].toLowerCase(); result += "abcdefghijklmnopqrstuvwxyz0123456789".includes(char) ? char : char === " " || char === "-" || char === "_" || char === "(" || char === ")" ? "-" : "u" + value.charCodeAt(i).toString(16); }
            const valueID = result.split("-").filter(part => part !== "").join("-").slice(0, 80); return valueID === "" ? "component" : valueID;
        };
        const documents = this.List().filter(doc => doc.id !== excludeID);
        let name = original, id = slug(name), index = 0;
        while (documents.some(doc => doc.id === id || doc.name.toLowerCase() === name.toLowerCase())) {
            index++; name = original.slice(0, 80) + " (" + index + ")"; id = slug(original) + "-" + index;
        }
        return { id, name, duplicate: index > 0 };
    }
    public Rename(input: PresetDocument, oldID: string, updateReferences: boolean): void {
        if (InCombatLockdown()) fail("rename after combat");
        const existing = this.Get(oldID); if (existing === undefined) fail("component to rename was not found");
        const identity = this.Identity(input.name, oldID);
        if (identity.name !== input.name || input.id !== oldID && this.Get(input.id) !== undefined) fail("component name changed or already exists; confirm its new name again");
        const data = this.Validate(input);
        this.CheckDependencies(data); stripBindings(data);
        const documents = this.List().filter(doc => doc.id !== oldID);
        for (const dependency of data.dependencies ?? []) if (!documents.some(doc => doc.id === dependency.id)) documents.push(dependency);
        const affected = this.UsedBy(oldID).map(doc => doc.id);
        const rewrite = (node: PresetNode): void => { if (node.preset === oldID) node.preset = data.id; for (const child of node.children ?? []) rewrite(child); };
        if (updateReferences) for (const doc of documents) rewrite(doc.root);
        documents.push(data);
        // Retire affected mounted trees before replacing the library in one store update.
        const queue = [...affected]; const stopped = new Set<string>();
        for (let i = 0; i < queue.length; i++) { const id = queue[i]; if (stopped.has(id)) continue; stopped.add(id); queue.push(...this.UsedBy(id).map(doc => doc.id)); }
        for (const doc of documents) if (doc.id === data.id || stopped.has(doc.id) || (data.dependencies ?? []).some(dependency => dependency.id === doc.id)) this.Validate(doc, true, documents);
        for (const id of stopped) this.ReleaseActive(id);
        this.ReleaseActive(oldID); this.paused.delete(oldID);
        this.store.set(BuilderSettings, settings => {
            settings.documents = [...settings.documents.filter(doc => doc.kind !== "preset"), ...documents.map(doc => { const { dependencies, ...stored } = doc; return stored; })];
            settings.enabled = settings.enabled.map(key => key === "preset:" + oldID ? "preset:" + data.id : key);
            return settings;
        });
        this.store.set(CollectionBindingSettings, settings => {
            if (oldID !== data.id && settings.collections[oldID] !== undefined) { settings.collections[data.id] = settings.collections[oldID]; delete settings.collections[oldID]; }
            return settings;
        });
        if (this.started) this.Restore();
    }
    public Save(document: PresetDocument, enabled = false): void {
        this.MigrateSavedComponents();
        const data = this.Validate(document);
        this.CheckDependencies(data); stripBindings(data);
        // A shared edit must remain structurally valid in every consumer before committing it.
        const override = new Map([...[...this.List(), ...data.dependencies ?? []].map(doc => [doc.id, doc] as [string, PresetDocument]), [data.id, data] as [string, PresetDocument]]);
        for (const consumer of this.List()) {
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
            if (this.active.has(parent.id)) {
                if (new ActivationContext(this.Layouts).Matches(parent)) this.Mount(parent); else this.ReleaseActive(parent.id);
            }
            queue.push(...this.UsedBy(parent.id));
        }
        if (this.started) this.Restore();
    }
    public Delete(id: string): void {
        const users = this.UsedBy(id); if (users.length > 0) fail("component is used by: " + users.map(doc => doc.name).join(", "));
        super.Delete(id);
    }
    private MigrateSavedComponents(): void {
        const documents = this.List();
        this.bindings.Migrate(documents);
        if (!documents.map(document => { const released = releaseRetiredOwner(document); const colors = migrateClassColors(document), native = migrateNativeVisibility(document), bindings = stripBindings(document); return colors || native || bindings || released; }).some(changed => changed)) return;
        this.store.set(BuilderSettings, settings => {
            for (const document of settings.documents) if (document.kind === "preset") { releaseRetiredOwner(document); migrateClassColors(document); migrateNativeVisibility(document); stripBindings(document); }
            return settings;
        });
    }
    public GetBinding(collection: string, node: string): string | undefined { return this.bindings.Get(collection, node); }
    public SetBinding(collection: string, node: string, key?: string): void {
        if (InCombatLockdown()) fail("change keybindings after combat");
        if (key !== undefined && (issecretvalue(key) || typeof key !== "string" || key.trim().length === 0)) fail("invalid keybinding");
        this.MigrateSavedComponents();
        const document = this.Get(collection); if (document === undefined) fail("component not found: " + collection);
        const contains = (item: PresetNode): boolean => (item.id === node && item.type === "secureButton") || (item.children ?? []).some(contains);
        if (!contains(document.root)) fail("secure button not found: " + node);
        this.RefreshBindings(this.bindings.Set(collection, node, key));
    }
    public ListBindings(): CollectionKeybinding[] {
        return Object.entries(this.bindings.Snapshot()).flatMap(([collection, nodes]) =>
            Object.entries(nodes).map(([node, key]) => ({ collection, node, key })));
    }
    public SetBindings(document: PresetDocument, bindings: readonly CollectionKeybinding[]): void {
        if (InCombatLockdown()) fail("import keybindings after combat");
        const validated = validateAssignments(this.Validate(document), bindings);
        this.MigrateSavedComponents();
        this.RefreshBindings(this.bindings.SetMany(validated));
    }
    public ClickCastPresetInUse(bindingId: string): boolean {
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
        return this.List().some(uses);
    }
    public ResolveClickCast(id: string) { return this.clickCast.Get(id); }
    public RefreshClickCastPreset(bindingId: string): void {
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
        for (const [id, document] of Array.from(this.liveDocuments)) if (uses(document)) {
            const saved = this.Get(id); if (saved !== undefined) this.Mount(saved);
        }
    }
    private RefreshBindings(changed: ReadonlySet<string>): void {
        for (const [id, live] of Array.from(this.liveDocuments)) {
            if (changed.has(id) || (live.dependencies ?? []).some(dependency => changed.has(dependency.id)))
                this.Mount(this.Get(id)!);
        }
    }
    public Export(document: PresetDocument): string {
        const data = this.Validate(document); stripBindings(data); return super.Export(data);
    }
    public Create(document: PresetDocument): PresetInstance { return this.Build(document, false); }
    public Preview(document: PresetDocument): PresetInstance { return this.Build(document, true); }
    private Build(document: PresetDocument, preview: boolean): PresetInstance {
        if (InCombatLockdown()) fail("create a component after combat");
        const data = this.Validate(document);
        const activation = new ActivationContext(this.Layouts);
        const keybindings = this.bindings.Snapshot();
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
        const buildDocument = (document: PresetDocument, prefix: string, units?: UnitScope, ownedCleanups = cleanups, itemScope?: ItemScope, borrowed?: (name: string) => SourceInstance | undefined): Cell[] => {
            if (!preview && !activation.Matches(document)) return [];
            if (!preview && document.sources.some(spec => spec.isProp && !spec.optional && borrowed?.(spec.name) === undefined)) return [];
            activatedDocuments.add(document);
            if (!preview && prefix === "") applyLayoutPosition(document, activation.LayoutKey);
            const instances = new Map<string, SourceInstance>();
            const specs = new Map<string, SourceSpec>(document.sources.map(spec => [spec.name, spec]));
            const creating = new Set<string>(); const views = new Map<string, Cell>();
            const unit = (token: string): UnitInput => {
                if (token === "$unit") { if (units === undefined) fail("$unit requires a repeated unit or nameplate scope"); return units.unit; }
                if (token === "$pet") { if (units?.pet === undefined) fail("$pet requires a ForEach pet scope"); return units.pet; }
                return token;
            };
            const source = (name: string): SourceInstance => {
                const existing = instances.get(name); if (existing !== undefined) return existing;
                if (name === "item") {
                    if (itemScope?.bind === undefined) fail("this ForEach item does not provide a default source");
                    const bound = itemScope.bind(); instances.set(name, bound); if (bound.Dispose !== undefined) ownedCleanups.push(() => bound.Dispose!()); return bound;
                }
                const spec = specs.get(name); if (spec === undefined) fail("missing source: " + name);
                if (spec.isProp) { const supplied = borrowed?.(name); if (supplied !== undefined) { instances.set(name, supplied); return supplied; } if (!preview) fail("unbound source input: " + name); }
                if (creating.has(name)) fail("cyclic source dependency"); creating.add(name);
                let created: SourceInstance;
                try { created = this.sources.get(spec.type)!.Create(spec.props, { Preview: preview, Manual: document.enabled === "always", Item: () => itemScope?.value, Unit: unit, Source: source }); } finally { creating.delete(name); }
                instances.set(name, created);
                if (created.Dispose !== undefined) ownedCleanups.push(() => created.Dispose!());
                return created;
            };
            const unavailable = (name: string): boolean => {
                const spec = specs.get(name); if (spec === undefined) return false;
                if (spec.isProp) return borrowed?.(name) === undefined;
                return (this.sources.get(spec.type)!.references ?? []).some(key => unavailable(spec.props[key] as string));
            };
            const build = (node: PresetNode): Cell[] => {
                if ([node.source, node.visibleSource, node.textSource, node.alphaSource, ...Object.values(node.bindings ?? {}).map(binding => binding.source)].some(name => name !== undefined && unavailable(name))) return [];
                if (node.type === "fragment") {
                    const result: Cell[] = []; for (const child of node.children ?? []) result.push(...build(child)); return result;
                }
                if (node.type === "preset") {
                    const result = buildDocument(referenceDocument(documents.get(node.preset!)!, node), prefix + node.id + "/", units, ownedCleanups, itemScope, name => node.sourceProps?.[name] === undefined || unavailable(node.sourceProps[name]) ? undefined : source(node.sourceProps[name]));
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
                const context = { Preview: preview, Item: () => itemScope?.value, Unit: unit, ResolveSource: source, Source: (): SourceInstance | undefined => {
                    if (node.items !== undefined) {
                        const name = "inline:" + node.id;
                        if (!specs.has(name)) specs.set(name, this.ParseItems(node.items));
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
                                { unit: new UnitSource(token) }, disposers, undefined, borrowed)[0];
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
                    const collection = context.Source(), list = collection?.items;
                    if (collection === undefined || list === undefined) fail("ForEach source must provide an observable list");
                    const key = (item: object) => collection.ItemsKey?.(item) ?? (item as { key: string | number }).key;
                    const scopes = new Map<Cell, { units?: UnitScope; item: ItemScope; dispose(): void }>();
                    // An iterable collection may also have Lua array slots. Keep the
                    // observable boundary explicit so wuira never treats it as a snapshot.
                    const observed = new ObservableItems(list);
                    const view = ForEach({ ...node.props, items: observed, key,
                        groupBy: node.props.groupBy === "group" ? item => collection.ItemsGroup?.(item) ?? "1" : undefined,
                        direction: node.props.direction as "horizontal" | "vertical" | undefined,
                        gap: node.props.gap as number | undefined, lineGap: node.props.lineGap as number | undefined, wrapAfter: node.props.wrapAfter as number | undefined,
                        child: value => {
                            const token = collection.ItemsUnit?.(value);
                            const unitScope = token === undefined ? undefined : { unit: new UnitSource(token), pet: new UnitSource(petUnit(token)) };
                            const scope: ItemScope = { value };
                            if (collection.BindItem !== undefined) scope.bind = () => collection.BindItem!(() => scope.value);
                            const disposers: (() => void)[] = [];
                            try {
                                const templateIndex = Math.min(collection.ItemsTemplate?.(value) ?? 0, node.children!.length - 1);
                                const template = node.children![templateIndex];
                                const child = buildDocument({ ...document, root: template }, prefix + node.id + "/" + key(value) + "/", unitScope, disposers, scope, borrowed)[0];
                                if (child === undefined) fail("ForEach templates must return a Cell");
                                if (preview) disableInput(child);
                                scopes.set(child, { units: unitScope, item: scope, dispose: () => disposeAll(disposers) }); return child;
                            } catch (failure) { disposeAll(disposers); throw failure; }
                        },
                        onUpdate: (child, value) => {
                            const scope = scopes.get(child)!; scope.item.value = value;
                            const token = collection.ItemsUnit?.(value);
                            if (scope.units !== undefined && token !== undefined) { scope.units.unit.Retarget(token); scope.units.pet?.Retarget(petUnit(token)); }
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
                if (node.type === "secureButton") {
                    delete inputProps.binding;
                    const presetId = typeof node.props.clickCastPreset === "string" ? node.props.clickCastPreset : undefined;
                    if (!preview && presetId === undefined && inputProps.unit === undefined) {
                        const binding = keybindings[document.id]?.[node.id];
                        if (binding !== undefined) inputProps.binding = binding;
                    }
                }
                const bindProperties = preparePropertyBindings(node, inputProps, source, ownedCleanups);
                const view = definition.Create(inputProps, children, context);
                bindProperties(view);
                views.set(node.id, view);
                if (typeof relativeTo === "string") (view.props as Record<string, unknown>).relativeTo = relativeTo;
                const props = view.props as Record<string, unknown>;
                const previousMount = props.onMount as ((frame: wuiraNativeFrame) => void | (() => void)) | undefined;
                props.onMount = (frame: wuiraNativeFrame) => {
                    if (preview && !nodes.has(node.id)) nodes.set(node.id, frame);
                    nodes.set(prefix + node.id, frame); const cleanup = previousMount?.(frame);
                    return () => { nodes.delete(prefix + node.id); if (nodes.get(node.id) === frame) nodes.delete(node.id); cleanup?.(); };
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
                    const spec = node.source === undefined ? undefined : specs.get(node.source);
                    if (view.kind === "progress" && ["hp", "power"].includes(spec?.type ?? "") && prefix.includes("/")) {
                        view.source = undefined; props.source = undefined; props.min = 0; props.max = 100; props.current = 75;
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
                disableInput(view);
            }
            let disposed = false;
            const handle: PresetInstance = { Nodes: nodes, View: view, Dispose: () => {
                if (disposed) return; disposed = true; this.activators.delete(handle);
                afterCombat(() => {
                    if (this.active.get(data.id) === handle) { this.active.delete(data.id); this.liveDocuments.delete(data.id); this.activationSignatures.delete(data.id); this.paused.add(data.id); }
                    const observing = this.observerCleanups.get(handle); if (observing !== undefined) disposeAll(observing); this.observerCleanups.delete(handle);
                    if (handle.Frame !== undefined) wuira.Unmount(handle.Frame); disposeAll(cleanups);
                });
            } };
            if (!preview) this.activators.set(handle, () => {
                for (const doc of activatedDocuments)
                    if (doc.owner !== undefined && C_AddOns?.IsAddOnLoaded?.(doc.owner) !== true) fail("component owner is unavailable: " + doc.owner);
                for (const activate of effects) cleanups.push(activate());
            });
            return handle;
        } catch (failure) { disposeAll(cleanups); throw failure; }
    }
    public Mount(document: PresetDocument, parent?: wuiraNativeFrame): PresetInstance {
        if (InCombatLockdown()) fail("mount a component after combat");
        afterCombat(() => {});
        const validated = this.Validate(document);
        if (!new ActivationContext(this.Layouts).Matches(validated)) fail("component activation requirements are not met");
        this.CheckDependencies(validated);
        this.MigrateSavedComponents();
        const handle = this.Create(document);
        try {
            const frame = wuira.Mount(handle.View, undefined, parent);
            (handle as { Frame?: wuiraNativeFrame }).Frame = frame;
            this.activators.get(handle)?.(); this.activators.delete(handle);
            this.active.get(document.id)?.Dispose();
            this.paused.delete(document.id);
            this.active.set(document.id, handle);
            this.liveDocuments.set(document.id, this.Validate(document));
            this.activationSignatures.set(document.id, this.ActivationSignature(document, new ActivationContext(this.Layouts), new Map(this.List().map(doc => [doc.id, doc]))));
            const observing: (() => void)[] = []; this.observerCleanups.set(handle, observing);
            for (const listener of this.observers) { try { const cleanup = listener(this.liveDocuments.get(document.id)!, handle); if (cleanup !== undefined) observing.push(cleanup); } catch (failure) { console.log(String(failure)); } }
            return handle;
        } catch (failure) { handle.Dispose(); throw failure; }
    }
    private ReleaseActive(id: string): void {
        const handle = this.active.get(id);
        this.active.delete(id); this.liveDocuments.delete(id); this.activationSignatures.delete(id);
        handle?.Dispose();
    }
    public Unmount(id: string): void { this.paused.add(id); this.ReleaseActive(id); }
    protected Stop(id: string): void { this.Unmount(id); }

    public SetActivation(id: string, mode: ActivationMode): void {
        const document = this.Get(id); if (document === undefined) fail("component not found: " + id);
        this.Apply({ ...document, enabled: mode });
    }
    public Apply(document: PresetDocument): void {
        if (InCombatLockdown()) fail("apply component settings after combat");
        const active = this.active.get(document.id);
        this.paused.delete(document.id);
        this.Save(document, document.enabled !== "never");
        if (active !== undefined && this.active.get(document.id) === active && new ActivationContext(this.Layouts).Matches(document)) this.Mount(document);
        this.Restore();
    }
    private MissingReference(document: PresetDocument): string | undefined {
        const seen = new Set<string>();
        const visit = (node: PresetNode): string | undefined => {
            if (node.preset !== undefined && !seen.has(node.preset)) {
                seen.add(node.preset); const child = this.Get(node.preset);
                if (child === undefined) return node.preset;
                const missing = visit(child.root); if (missing !== undefined) return missing;
            }
            for (const child of node.children ?? []) { const missing = visit(child); if (missing !== undefined) return missing; }
            return undefined;
        };
        return visit(document.root);
    }
    public ActivationStatus(id: string): string {
        const document = this.Get(id); if (document === undefined) return "Unavailable";
        if (document.enabled === "never" || !this.store.get(BuilderSettings).enabled.includes("preset:" + id)) return "Disabled";
        if (this.active.has(id)) return "Active";
        const missing = this.MissingReference(document); if (missing !== undefined) return "Missing component: " + missing;
        if (document.sources.some(source => source.isProp && !source.optional)) return "Waiting for external source inputs";
        if (InCombatLockdown()) return "Waiting for combat to end";
        if (!new ActivationContext(this.Layouts).Matches(document)) return "Waiting for class, condition or native layout";
        if (document.owner !== undefined && C_AddOns?.IsAddOnLoaded?.(document.owner) !== true) return "Waiting for addon";
        return "Inactive";
    }

    private ActivationSignature(document: PresetDocument, context: ActivationContext, documents: ReadonlyMap<string, PresetDocument>): string {
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

    /** Only collection events and explicit edits reconcile ownership; no update loop is used. */
    public Restore(): void {
        this.started = true;
        if (!this.store.IsReady || InCombatLockdown() || this.evaluating) return;
        this.evaluating = true;
        try {
            this.MigrateSavedComponents();
            const documents = new Map(this.List().map(doc => [doc.id, doc]));
            const enabled = new Set(this.store.get(BuilderSettings).enabled);
            const context = new ActivationContext(this.Layouts);
            for (const [id, document] of documents) {
                // Manual disable short-circuits before reading any class/group data.
                const wanted = enabled.has("preset:" + id) && !this.paused.has(id)
                    && document.enabled !== "never"
                    && (document.owner === undefined || C_AddOns?.IsAddOnLoaded?.(document.owner) === true)
                    && context.Matches(document)
                    && this.MissingReference(document) === undefined
                    && !document.sources.some(source => source.isProp && !source.optional);
                if (!wanted) { if (this.active.has(id)) this.ReleaseActive(id); continue; }
                const signature = this.ActivationSignature(document, context, documents);
                if (this.active.has(id) && this.activationSignatures.get(id) === signature) continue;
                try { this.Mount(document); } catch (failure) { console.log(String(failure)); }
            }
        } finally { this.evaluating = false; }
    }
}
