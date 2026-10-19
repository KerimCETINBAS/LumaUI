import type { Cell } from "wuira/ui";
import type { ValueSource, ProgressSource, TimerSource, TextureSource, UnitInput, KnownSpell, KnownSpellsStatus } from "wuira/datasources";
import type { ForEachSource } from "wuira/ui";
import type { SecureAction } from "wuira/ui";
export type DataValue = string | number | boolean | DataValue[] | { [key: string]: DataValue };
export type Properties = Record<string, DataValue>;
export interface SourceSpec { isProp?: boolean; optional?: boolean; name: string; type: string; props: Properties; }
export interface PropertySourceBinding { source: string; path?: string; }
export interface ComponentActivationOverride { enabled?: ActivationMode; class?: CollectionClass | ""; condition?: CollectionCondition | ""; layout?: string; }
export interface PresetNode { name?: string; activation?: ComponentActivationOverride; sourceProps?: Record<string, string>; bindings?: Record<string, PropertySourceBinding>; sections?: readonly ElementSection[]; id: string; type: string; props: Properties; source?: string; sourcePath?: string; visibleSource?: string; visiblePath?: string; visibleWhen?: "true" | "false"; glowSource?: string; glowPath?: string; glowWhen?: "true" | "false"; textSource?: string; alphaSource?: string; children?: PresetNode[]; preset?: string; items?: string; }
export type ClickCastAction =
    | { readonly spellId: number; readonly itemId?: never; readonly macro?: never }
    | { readonly itemId: number; readonly spellId?: never; readonly macro?: never }
    | { readonly macro: string; readonly spellId?: never; readonly itemId?: never };
export type ClickCastTargeting = "direct" | "mouseover";
export type ClickCastBinding = ClickCastAction & { readonly key: string; readonly targeting?: ClickCastTargeting; readonly traits?: ClickCastTraits };
export type BuiltinPresetStrings = Readonly<Record<keyof typeof import("../BuiltinPresets").BuiltinPresets, string> & Record<string, string>>;
export interface BuiltinPresetDefinition { readonly key: string; readonly name: string; readonly kind: "preset" | "skin"; readonly importString: string; }
export interface ClickCastTraits { /** Legacy alias for mouseover targeting. */ readonly onlyTarget?: boolean; readonly friendly: boolean; readonly enemy: boolean; readonly nodead?: boolean; readonly clearTargeting?: boolean; }
export interface ClickCastPresetDocument { /** Legacy import/API defaults; normalized records store traits on bindings. */ readonly traits?: ClickCastTraits; readonly version: 2; readonly kind: "clickCast"; readonly id: string; readonly name: string; readonly bindings: readonly ClickCastBinding[]; }
export interface StandardClickPreset { readonly id: "standard"; readonly name: "Standard"; readonly immutable: true; readonly actions: readonly [{ readonly combination: "Left click"; readonly action: "target" }, { readonly combination: "Right click"; readonly action: "togglemenu" }]; }
export interface ClickCastLibraryAPI {
    Validate(value: unknown): ClickCastPresetDocument;
    List(): ClickCastPresetDocument[];
    Get(id: string): ClickCastPresetDocument | undefined;
    Create(name: string, bindings: readonly ClickCastBinding[], traits?: ClickCastTraits): ClickCastPresetDocument;
    Create(name: string, key: string, spellId: number): ClickCastPresetDocument;
    Update(id: string, name: string, bindings: readonly ClickCastBinding[], traits?: ClickCastTraits): void;
    Update(id: string, name: string, key: string, spellId: number): void;
    Delete(id: string): void;
}
export type ActivationMode = "condMet" | "always" | "never";
export type CollectionCondition = "inParty" | "inRaid" | "inGroup" | "solo";
export type CollectionClass = "WARRIOR" | "PALADIN" | "HUNTER" | "ROGUE" | "PRIEST" | "SHAMAN" | "MAGE" | "WARLOCK" | "DRUID";
export interface PresetDocument { layout?: string; layoutPositions?: Record<string, { x: number; y: number }>; enabled?: ActivationMode; class?: CollectionClass; condition?: CollectionCondition; version: 1; kind: "preset"; id: string; name: string; owner?: string; sources: SourceSpec[]; root: PresetNode; dependencies?: PresetDocument[]; }
export interface SkinDocument { version: 1; kind: "skin"; id: string; name: string; targets: { target: string; props: Properties }[]; }
export type BuilderDocument = PresetDocument | SkinDocument;
export interface PropertyRule {
    type: "string" | "number" | "boolean" | "color" | "spacing" | "offset" | "size" | "action" | "numbers" | "texCoords" | "textureOptions" | "background" | "border" | "texture" | "cases" | "value";
    editor?: "spell" | "icon";
    required?: boolean; min?: number; max?: number; values?: readonly (string | number)[];
}
export type PropertyRules = Readonly<Record<string, PropertyRule>>;
export type SpellNameSelector = string | { readonly regex: string; readonly flags?: "" | "i" };
export interface KnownSpellList extends ForEachSource<KnownSpell>, Iterable<KnownSpell> { readonly Status: KnownSpellsStatus; Dispose(): void; }
export type PlayerActionCategory = "spell" | "item" | "consumable" | "macro";
export interface PlayerAction { readonly key: string; readonly category: PlayerActionCategory; readonly name: string; readonly detail?: string; readonly equipped?: boolean; readonly icon?: number; readonly action: ClickCastAction; }
export interface PlayerActionList extends ForEachSource<PlayerAction>, Iterable<PlayerAction> { readonly Status: KnownSpellsStatus; Dispose(): void; }
export interface UnitFilter { readonly npcIds?: readonly number[]; readonly name?: string; readonly classes?: string; readonly player?: boolean; readonly friendly?: boolean; readonly attackable?: boolean; }
export type UnitPredicate = (unit: UnitInput) => boolean;
export interface NativePlateStyle { readonly width?: number; readonly height?: number; readonly scale?: number; readonly alpha?: number; readonly healthColor?: { readonly r: number; readonly g: number; readonly b: number; readonly a?: number }; readonly castColor?: { readonly r: number; readonly g: number; readonly b: number; readonly a?: number }; }
export type BlizzardElementProps = { readonly type: "dynamic"; readonly target: "nameplate"; readonly filter: UnitPredicate } & (
    | { readonly replace: true; readonly apply?: false; readonly child: import("wuira/skins").NameplateRender }
    | ({ readonly apply: true; readonly replace?: false; readonly child?: never } & NativePlateStyle)
);
export interface LumaHelpers { KnownSpells(...selectors: SpellNameSelector[]): KnownSpellList; PlayerActions(): PlayerActionList; UnitToBool(options?: UnitFilter): UnitPredicate; }
export interface ListHelperDefinition { readonly source: string; Parse(argumentsText: string): Properties; }
export interface ElementSection { readonly source: string; readonly key: string; readonly color?: { readonly r: number; readonly g: number; readonly b: number; readonly a?: number }; readonly texture?: string; }
export interface SourceChannel { readonly key: string; readonly label: string; }
export interface SourceInstance {
    unit?: import("wuira/datasources").UnitSource;
    MatchUnit?: UnitPredicate;
    value?: ValueSource<unknown>;
    items?: ForEachSource<object>;
    ItemsKey?(item: object): string | number;
    ItemsGroup?(item: object): string | number;
    ItemsUnit?(item: object): string;
    ItemsTemplate?(item: object): number;
    BindItem?(read: () => object): SourceInstance;
    progress?: ProgressSource | TimerSource;
    texture?: TextureSource;
    action?: SecureAction;
    cooldown?: TimerSource;
    IsActive?(): boolean;
    Text?(): string;
    Alpha?(): number;
    channels?: Readonly<Record<string, SourceInstance>>;
    Dispose?(): void;
}
export interface SourceContext { readonly Preview?: boolean; readonly Manual?: boolean; Item(): object | undefined; Unit(unit: string): UnitInput; Source(name: string): SourceInstance; }
export type SourceCapability = "ItemsUnit" | "ItemsTemplate" | "BindItem" | "unit" | "value" | "items" | "progress" | "texture" | "action" | "cooldown" | "Text" | "Alpha" | "IsActive" | "MatchUnit";
export interface SourceDefinition { capabilities?: readonly SourceCapability[]; properties: PropertyRules; channels?: readonly SourceChannel[]; Validate?(props: Properties): void; references?: readonly string[]; Create(props: Properties, context: SourceContext): SourceInstance; }
export interface ComponentContext { readonly Preview?: boolean; Item(): object | undefined; Unit(unit: string): UnitInput; Source(): SourceInstance | undefined; ResolveSource(name: string): SourceInstance; Template?(unit: string): { View: Cell; Dispose(): void }; }
export interface VisualComponentDefinition {
    Validate?(props: Properties): void;
    headless?: false;
    children: "none" | "single" | "multiple";
    properties: PropertyRules;
    source?: "progress" | "texture" | "action" | "items";
    Create(props: Properties, children: Cell[], context: ComponentContext): Cell;
}
export interface HeadlessComponentDefinition {
    headless: true;
    children: "none" | "single";
    /** Build children lazily in isolated unit scopes rather than during collection creation. */
    deferred?: true;
    Validate?(props: Properties): void;
    properties: PropertyRules;
    source?: "progress" | "texture" | "action" | "items";
    Apply(props: Properties, context: ComponentContext): () => void;
}
export type ComponentDefinition = VisualComponentDefinition | HeadlessComponentDefinition;
/** Adapters own native target resolution and application; imported strings never name arbitrary globals. */
export interface SkinTargetDefinition { properties: PropertyRules; Apply(props: Properties): () => void; }
export interface PresetInstance { readonly Nodes: ReadonlyMap<string, wuiraNativeFrame>; readonly View?: Cell; readonly Frame?: wuiraNativeFrame; Dispose(): void; }
export interface SkinInstance { Dispose(): void; }
export interface DocumentLibrary<T> {
    Validate(document: unknown): T;
    Import(text: string): T;
    Export(document: T): string;
    Save(document: T, enabled?: boolean): void;
    Get(id: string): T | undefined;
    List(): T[];
    Delete(id: string): void;
}
export interface CollectionKeybinding { collection: string; node: string; key: string; }
export interface PresetAPI extends DocumentLibrary<PresetDocument> {
    Validate(document: unknown, allowMissing?: boolean): PresetDocument;
    SourcesCompatible(supplied: string, expected: string): boolean;
    RepeatSourceCompatible(collection: string | undefined, field: "$item" | "$unit" | "$pet", expected: string): boolean;
    SourceReferences(type: string): readonly string[];
    SourceChannels(type: string): readonly SourceChannel[];
    RenameSource(document: PresetDocument, oldName: string, newName: string, updateReferences: boolean): PresetDocument;
    ApplySourceRenames(document: PresetDocument, renames: readonly { oldName: string; newName: string; updateReferences: boolean; input?: boolean }[]): void;
    Identity(name: string, excludeID?: string): { id: string; name: string; duplicate: boolean };
    Rename(document: PresetDocument, oldID: string, updateReferences: boolean): void;
    readonly Layouts: import("wuira/datasources").EditModeLayouts;
    /** Character bindings are independent of preset props and import strings. */
    GetBinding(collection: string, node: string): string | undefined;
    SetBinding(collection: string, node: string, key?: string): void;
    ListBindings(): CollectionKeybinding[];
    /** Batch import into the independent character registry; includes referenced presets. */
    SetBindings(document: PresetDocument, bindings: readonly CollectionKeybinding[]): void;
    Apply(document: PresetDocument): void;
    SetActivation(id: string, mode: ActivationMode): void;
    ActivationStatus(id: string): string;
    RegisterComponent(name: string, definition: ComponentDefinition): () => void;
    RegisterSource(name: string, definition: SourceDefinition): () => void;
    ObserveMount(listener: (document: PresetDocument, instance: PresetInstance) => void | (() => void)): () => void;
    ComponentTypes(): string[];
    ComponentChildren(type: string): "none" | "single" | "multiple";
    ComponentProperties(type: string): PropertyRules;
    IsHeadless(document: PresetDocument): boolean;
    UsedBy(id: string): PresetDocument[];
    RegisterListHelper(name: string, definition: ListHelperDefinition): () => void;
    ListHelpers(): string[];
    ParseItems(expression: string): SourceSpec;
    SourceTypes(): string[];
    SourceProperties(type: string): PropertyRules;
    InputProperties(type: string): PropertyRules;
    InitialText(type: string, key: string): string | undefined;
    Create(document: PresetDocument): PresetInstance;
    /** Uses the same factories and sources with secure actions and mouse input disabled. */
    Preview(document: PresetDocument): PresetInstance;
    Mount(document: PresetDocument, parent?: wuiraNativeFrame): PresetInstance;
    Unmount(id: string): void;
}
export interface SkinAPI extends DocumentLibrary<SkinDocument> {
    readonly BlizzardElement: (props: BlizzardElementProps, child?: import("wuira/skins").NameplateRender) => Cell;
    RegisterElement(props: BlizzardElementProps): SkinInstance;
    RegisterTarget(name: string, definition: SkinTargetDefinition): () => void;
    TargetTypes(): string[];
    Apply(document: SkinDocument): SkinInstance;
    Remove(id: string): void;
}
