import type { PresetAPI, SkinAPI, BuilderDocument, PresetDocument, ClickCastLibraryAPI, StandardClickPreset, LumaHelpers } from "./builder";
export type * from "./builder";
import type { Cell } from "wuira/ui";
import type { StoreRegistry } from "wuira/store";
export type EditMode = "locked" | "unlock" | "keys";
interface Color { readonly r: number; readonly g: number; readonly b: number; readonly a: number; }
export interface LumaTheme {
    readonly icons: Readonly<Record<string, string>>;
    readonly colors: { readonly background: Color; readonly surface: Color; readonly border: Color;
        readonly text: Color; readonly muted: Color; readonly accent: Color };
    readonly spacing: { readonly panelPadding: number };
}
export interface LumaModule { SetMode(mode: EditMode): void; Reset(): void; }
export interface CustomizationContext { readonly width: number; readonly height: number; }
export type PreviewZoom = number | "fit";
export interface ComponentPreviewProps { readonly document: PresetDocument; readonly width: number; readonly height: number;
    readonly selected?: string; readonly onSelect?: (id: string) => void; readonly zoom?: PreviewZoom; readonly onZoomChange?: (zoom: PreviewZoom) => void; }
export interface CustomizationPage { readonly id: string; readonly title: string; readonly summary?: string; readonly workspace?: boolean; readonly sidebar?: boolean; Suspend?(): void; Render(context: CustomizationContext): Cell | void; }
export interface LumaCoreAPI {
    Preview(props: ComponentPreviewProps): Cell;
    readonly Helpers: LumaHelpers;
    readonly ClickCastPresets: ClickCastLibraryAPI;
    readonly StandardClickPreset: StandardClickPreset;
    RegisterPresetEditor(editor: (document: PresetDocument) => void): () => void;
    RegisterPresetCreator(creator: () => void): () => void;
    CreatePreset(): void;
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
