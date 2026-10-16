import type { PresetAPI, SkinAPI, BuilderDocument, PresetDocument, ClickCastLibraryAPI, StandardClickPreset, LumaHelpers } from "./builder";
export type * from "./builder";
import type { Cell } from "wuira";
import type { StoreRegistry } from "wuira/store";
export type EditMode = "locked" | "unlock" | "keys";
export type PresetDraftKind = "visual" | "headless" | "party" | "raid" | "spells";
interface Color { readonly r: number; readonly g: number; readonly b: number; readonly a: number; }
export interface LumaTheme {
    readonly icons: Readonly<Record<string, string>>;
    readonly colors: { readonly background: Color; readonly surface: Color; readonly border: Color;
        readonly text: Color; readonly muted: Color; readonly accent: Color };
    readonly spacing: { readonly panelPadding: number };
}
export interface LumaModule { SetMode(mode: EditMode): void; Reset(): void; }
export interface CustomizationContext { readonly width: number; readonly height: number; }
export interface CustomizationPage { readonly id: string; readonly title: string; readonly summary?: string; readonly workspace?: boolean; Render(context: CustomizationContext): Cell | void; }
export interface LumaCoreAPI {
    readonly Helpers: LumaHelpers;
    readonly ClickCastPresets: ClickCastLibraryAPI;
    readonly StandardClickPreset: StandardClickPreset;
    RegisterPresetEditor(editor: (document: PresetDocument) => void): () => void;
    RegisterPresetCreator(creator: (kind: PresetDraftKind) => void): () => void;
    CreatePreset(kind: PresetDraftKind): void;
    EditPreset(document: PresetDocument): void;
    OpenImport(kind: "preset" | "skin", onImported?: (document: BuilderDocument) => void, importString?: string): void;
    OpenExport(document: BuilderDocument, clickCastPresets?: readonly import("./builder").ClickCastPresetDocument[]): void;
    readonly BuiltinPresets: import("./builder").BuiltinPresetStrings;
    RegisterBuiltinPreset(preset: import("./builder").BuiltinPresetDefinition): () => void;
    readonly Presets: PresetAPI;
    readonly Skins: SkinAPI;
    RegisterPage(page: CustomizationPage): () => void;
    OpenCustomization(id?: string): void;
    CloseCustomization(): void;
    RefreshCustomization(): void;
    readonly Theme: LumaTheme;
    readonly Store: StoreRegistry;
    RegisterModule(id: string, module: LumaModule): () => void;
    SetMode(mode: EditMode): void;
}
