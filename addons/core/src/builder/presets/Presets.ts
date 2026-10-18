import { migrateRepeats } from "./RepeatMigration";
declare const C_AddOns: { IsAddOnLoaded?: (this: void, name: string) => boolean } | undefined;
import { EditModeLayouts, TimerSource, UnitSource } from "wuira/datasources";
import type { UnitInput } from "wuira/datasources";
import { ForEach } from "wuira/ui";
import { wuira, Encoding } from "wuira";
import { UI } from "wuira/ui";
import type { Cell } from "wuira/ui";
import type { StoreRegistry } from "wuira/store";
import type { CollectionKeybinding, ComponentDefinition, PresetAPI, ActivationMode, PresetDocument, PresetInstance, PresetNode, Properties, PropertyRules, SourceDefinition, SourceInstance, SourceSpec, ListHelperDefinition } from "../../core/builder";
import { Library, BuilderSettings, afterCombat, disposeAll } from "../library/Library";
import { array, copy, fail, identifier, keys, properties, record, text } from "../validate";
import { applyLayoutPosition } from "./LayoutPosition";
import { ActivationContext, validateActivation } from "./Activation";
import { CollectionBindings, CollectionBindingSettings, stripBindings } from "./CollectionBindings";
import type { ClickCastLibrary } from "../clickcast/ClickCastLibrary";
import { validateAssignments } from "../transfer/BindingTransfer";
import { petUnit } from "../units/GroupRoster";
import { preparePropertyBindings, propertyBindingTargets } from "../converters/PropertyBindings";
import { migrateClassColors } from "./ClassColorMigration";
import { migrateNativeVisibility } from "./NativeVisibilityMigration";
import { validateValuePath } from "../converters/ConverterSources";
import { ListHelpers } from "./ListHelpers";
import { ObservableItems } from "./ObservableItems";

/** Existing compiled constructors build a document; only referenced sources are instantiated. */
import { validateDocument } from "./validateDocument";
import { checkDependencies, renameSource, applySourceRenames, identifyPreset, renamePreset, savePreset, migrateSavedComponents } from "./identity";
import { getBinding, setBinding, listBindings, setBindings, clickCastPresetInUse, resolveClickCast, refreshClickCastPreset, refreshBindings } from "./bindings";
import { buildPreset } from "./buildDocument";
import { initialDefaults, initialProperties } from "./previewFixtures";
import { mountPreset, releaseActive, unmountPreset, setActivation, applyPreset, missingReference, activationStatus, activationSignature, restorePresets } from "./lifecycle";
export class Presets extends Library<PresetDocument> implements PresetAPI {
    readonly bindings: CollectionBindings;
    readonly helpers = new ListHelpers();
    readonly clickCast: ClickCastLibrary;
    readonly components = new Map<string, ComponentDefinition>();
    readonly sources = new Map<string, SourceDefinition>();
    readonly paused = new Set<string>();
    readonly observers = new Set<(document: PresetDocument, instance: PresetInstance) => void | (() => void)>();
    readonly observerCleanups = new Map<PresetInstance, (() => void)[]>();
    readonly liveDocuments = new Map<string, PresetDocument>();
    readonly activators = new Map<PresetInstance, () => void>();
    readonly active = new Map<string, PresetInstance>();
    public readonly Layouts = new EditModeLayouts();
    started = false;
    evaluating = false;
    readonly activationSignatures = new Map<string, string>();
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
    public SourceReferences(type: string): readonly string[] { return this.sources.get(type)?.references ?? []; }
    public SourceChannels(type: string): readonly import("../../core/builder").SourceChannel[] { return this.sources.get(type)?.channels ?? []; }
    public SourcesCompatible(supplied: string, expected: string): boolean {
        if (!this.sources.has(supplied) || !this.sources.has(expected)) return false;
        if (supplied === expected) return true;
        const provided = this.sources.get(supplied)?.capabilities, required = this.sources.get(expected)?.capabilities;
        return provided !== undefined && required !== undefined && required.length > 0 && required.every(capability => provided.includes(capability));
    }
    public RepeatSourceCompatible(collection: string | undefined, field: "$item" | "$unit" | "$pet", expected: string): boolean {
        if (field === "$item" && expected === "repeatItem") return collection === undefined || this.SourcesCompatible(collection, "list");
        return collection !== undefined && this.sources.get(collection)?.capabilities?.includes("ItemsUnit") === true && this.SourcesCompatible("unit", expected);
    }
    public SourceTypes(): string[] { return Array.from(this.sources.keys()); }
    public SourceProperties(type: string): PropertyRules {
        const definition = this.sources.get(type);
        if (definition === undefined) fail("unknown source type: " + type);
        return copy(definition.properties) as unknown as PropertyRules;
    }
    /** Resting values an exposed input may store for its own preview. */
    public InputProperties(type: string): PropertyRules { return initialProperties(type); }
    public InitialText(type: string, key: string): string | undefined { return initialDefaults(type)[key]; }
    /** Dependencies travel in the envelope, but are stored as independent library entries. */
    public Validate(input: unknown, allowMissing = false, libraryOverride?: PresetDocument[]): PresetDocument  { return validateDocument(this, input, allowMissing, libraryOverride); }
    public IsHeadless(document: PresetDocument): boolean {
        const data = this.Validate(document, true); const docs = new Map((data.dependencies ?? []).map(doc => [doc.id, doc]));
        const visual = (node: PresetNode): boolean => node.type === "preset" ? (docs.has(node.preset!) ? visual(docs.get(node.preset!)!.root) : false)
            : node.type === "fragment" ? (node.children ?? []).some(visual) : this.components.get(node.type)?.headless !== true;
        return !visual(data.root);
    }
    public UsedBy(id: string): PresetDocument[] {
        const uses = (node: PresetNode): boolean => node.preset === id || (node.children ?? []).some(uses);
        return this.List().filter(doc => uses(doc.root));
    }
    public CheckDependencies(data: PresetDocument): void  { return checkDependencies(this, data); }
    public RenameSource(input: PresetDocument, oldName: string, newName: string, updateReferences: boolean): PresetDocument  { return renameSource(this, input, oldName, newName, updateReferences); }
    /** Save the edited contract and its consenting callers in one library transaction. */
    public ApplySourceRenames(input: PresetDocument, renames: readonly { oldName: string; newName: string; updateReferences: boolean; input?: boolean }[]): void  { return applySourceRenames(this, input, renames); }
    public Identity(input: string, excludeID?: string) { return identifyPreset(this, input, excludeID); }
    public Rename(input: PresetDocument, oldID: string, updateReferences: boolean): void  { return renamePreset(this, input, oldID, updateReferences); }
    public Save(document: PresetDocument, enabled = false): void  { return savePreset(this, document, enabled); }
    public Delete(id: string): void {
        const users = this.UsedBy(id); if (users.length > 0) fail("component is used by: " + users.map(doc => doc.name).join(", "));
        super.Delete(id);
    }
    public MigrateSavedComponents(): void  { return migrateSavedComponents(this); }
    public GetBinding(collection: string, node: string): string | undefined  { return getBinding(this, collection, node); }
    public SetBinding(collection: string, node: string, key?: string): void  { return setBinding(this, collection, node, key); }
    public ListBindings(): CollectionKeybinding[]  { return listBindings(this); }
    public SetBindings(document: PresetDocument, bindings: readonly CollectionKeybinding[]): void  { return setBindings(this, document, bindings); }
    public ClickCastPresetInUse(bindingId: string): boolean  { return clickCastPresetInUse(this, bindingId); }
    public ResolveClickCast(id: string) { return resolveClickCast(this, id); }
    public RefreshClickCastPreset(bindingId: string): void  { return refreshClickCastPreset(this, bindingId); }
    public RefreshBindings(changed: ReadonlySet<string>): void  { return refreshBindings(this, changed); }
    public Export(document: PresetDocument): string {
        const data = this.Validate(document, true); stripBindings(data); return "!LUMA:1!" + Encoding.Encode(data);
    }
    public Import(value: string): PresetDocument {
        const input = text(value, "share string", 6000000).trim();
        if (!input.startsWith("!LUMA:1!")) fail("unsupported import format");
        return this.Validate(Encoding.Decode(input.slice(8)), true);
    }
    public Create(document: PresetDocument): PresetInstance { return this.Build(document, false); }
    public Preview(document: PresetDocument): PresetInstance { return this.Build(document, true); }
    public Build(document: PresetDocument, preview: boolean): PresetInstance  { return buildPreset(this, document, preview); }
    public Mount(document: PresetDocument, parent?: wuiraNativeFrame): PresetInstance  { return mountPreset(this, document, parent); }
    public ReleaseActive(id: string): void  { return releaseActive(this, id); }
    public Unmount(id: string): void  { return unmountPreset(this, id); }
    protected Stop(id: string): void { this.Unmount(id); }

    public SetActivation(id: string, mode: ActivationMode): void  { return setActivation(this, id, mode); }
    public Apply(document: PresetDocument): void  { return applyPreset(this, document); }
    public MissingReference(document: PresetDocument): string | undefined  { return missingReference(this, document); }
    public ActivationStatus(id: string): string  { return activationStatus(this, id); }

    public ActivationSignature(document: PresetDocument, context: ActivationContext, documents: ReadonlyMap<string, PresetDocument>): string  { return activationSignature(this, document, context, documents); }

    /** Only collection events and explicit edits reconcile ownership; no update loop is used. */
    public Restore(): void  { return restorePresets(this); }
}
