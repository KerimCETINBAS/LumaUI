import type { Cell } from "wuira";
import type { ProgressSource, TimerSource, TextureSource } from "wuira/datasources";
import type { SecureAction } from "wuira/ui";
export type DataValue = string | number | boolean | DataValue[] | { [key: string]: DataValue };
export type Properties = Record<string, DataValue>;
export interface SourceSpec { name: string; type: string; props: Properties; }
export interface PresetNode { id: string; type: string; props: Properties; source?: string; sourcePath?: string; visibleSource?: string; textSource?: string; alphaSource?: string; children?: PresetNode[]; preset?: string; }
export interface PresetDocument { version: 1; kind: "preset"; id: string; name: string; owner?: string; sources: SourceSpec[]; root: PresetNode; dependencies?: PresetDocument[]; }
export interface SkinDocument { version: 1; kind: "skin"; id: string; name: string; targets: { target: string; props: Properties }[]; }
export type BuilderDocument = PresetDocument | SkinDocument;
export interface PropertyRule {
    type: "string" | "number" | "boolean" | "color" | "spacing" | "offset" | "size" | "action" | "numbers" | "texCoords" | "textureOptions" | "background" | "border";
    required?: boolean; min?: number; max?: number; values?: readonly (string | number)[];
}
export type PropertyRules = Readonly<Record<string, PropertyRule>>;
export interface SourceInstance {
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
export interface SourceContext { Source(name: string): SourceInstance; }
export interface SourceDefinition { properties: PropertyRules; references?: readonly string[]; Create(props: Properties, context: SourceContext): SourceInstance; }
export interface ComponentContext { Source(): SourceInstance | undefined; }
export interface VisualComponentDefinition {
    headless?: false;
    children: "none" | "single" | "multiple";
    properties: PropertyRules;
    source?: "progress" | "texture" | "action";
    Create(props: Properties, children: Cell[], context: ComponentContext): Cell;
}
export interface HeadlessComponentDefinition {
    headless: true;
    children: "none";
    properties: PropertyRules;
    source?: "progress" | "texture" | "action";
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
export interface PresetAPI extends DocumentLibrary<PresetDocument> {
    RegisterComponent(name: string, definition: ComponentDefinition): () => void;
    RegisterSource(name: string, definition: SourceDefinition): () => void;
    ObserveMount(listener: (document: PresetDocument, instance: PresetInstance) => void | (() => void)): () => void;
    ComponentTypes(): string[];
    ComponentProperties(type: string): PropertyRules;
    IsHeadless(document: PresetDocument): boolean;
    UsedBy(id: string): PresetDocument[];
    SourceTypes(): string[];
    SourceProperties(type: string): PropertyRules;
    Create(document: PresetDocument): PresetInstance;
    /** Uses the same factories and sources with secure actions and mouse input disabled. */
    Preview(document: PresetDocument): PresetInstance;
    Mount(document: PresetDocument, parent?: wuiraNativeFrame): PresetInstance;
    Unmount(id: string): void;
}
export interface SkinAPI extends DocumentLibrary<SkinDocument> {
    RegisterTarget(name: string, definition: SkinTargetDefinition): () => void;
    TargetTypes(): string[];
    Apply(document: SkinDocument): SkinInstance;
    Remove(id: string): void;
}
