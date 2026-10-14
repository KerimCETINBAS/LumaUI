import type { PresetAPI, SkinAPI, BuilderDocument, PresetDocument } from "./builder";
export type * from "./builder";
import type { Cell } from "wuira";
import type { StoreRegistry } from "wuira/store";
export type EditMode = "locked" | "unlock" | "keys";
interface Color { readonly r: number; readonly g: number; readonly b: number; readonly a: number; }
export interface LumaTheme {
    readonly colors: { readonly background: Color; readonly surface: Color; readonly border: Color;
        readonly text: Color; readonly muted: Color; readonly accent: Color };
    readonly spacing: { readonly panelPadding: number };
}
export interface LumaModule { SetMode(mode: EditMode): void; Reset(): void; }
export interface LegacyActionSettings {
    readonly bindings?: Readonly<Record<string, string>>;
    readonly position?: { readonly x: number; readonly y: number; readonly followPlayer?: boolean };
    readonly playerPosition: { readonly x: number; readonly y: number };
    readonly playerHeight: number;
}
export interface CustomizationContext { readonly width: number; readonly height: number; }
export interface CustomizationPage { readonly id: string; readonly title: string; readonly summary?: string; Render(context: CustomizationContext): Cell | void; }
export interface LumaCoreAPI {
    RegisterPresetEditor(editor: (document: PresetDocument) => void): () => void;
    EditPreset(document: PresetDocument): void;
    OpenImport(kind: "preset" | "skin", onImported?: (document: BuilderDocument) => void): void;
    OpenExport(document: BuilderDocument): void;
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
    GetLegacyActionSettings(): LegacyActionSettings;
}
