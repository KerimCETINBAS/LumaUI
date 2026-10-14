import { LumaOptions } from "./Options";

import { darkTheme } from "./theme/dark";
import type { LumaCoreAPI, PresetDocument } from "./core/contract";

import { CollectionControls } from "./builder/CollectionControls";
import { seedPlayerCollection } from "./builder/PlayerCollection";
import { Presets } from "./builder/Presets";
import { Skins } from "./builder/Skins";
import { registerBuiltins } from "./builder/Builtins";
import { TransferDialog } from "./builder/TransferDialog";
import { installLibrary } from "./builder/LibraryView";

const options = new LumaOptions();
const presets = new Presets(options.store);
const skins = new Skins(options.store);
registerBuiltins(presets, skins);
let editor: ((document: PresetDocument) => void) | undefined;
const core: LumaCoreAPI = {
    RegisterPresetEditor: callback => { editor = callback; return () => { if (editor === callback) editor = undefined; }; },
    EditPreset: document => { if (InCombatLockdown()) { console.log("Edit collections after combat."); return; } if (editor === undefined) { console.log("Enable LumaUI.Editor to edit collections."); return; } editor(presets.Validate(document)); options.OpenCustomization("editor"); },
    OpenImport: (kind, callback) => transfer.Import(kind, callback),
    OpenExport: document => transfer.Export(document),
    Presets: presets,
    Skins: skins,
    RegisterPage: page => options.RegisterPage(page),
    OpenCustomization: id => options.OpenCustomization(id),
    CloseCustomization: () => options.CloseCustomization(),
    RefreshCustomization: () => options.RefreshCustomization(),
    Theme: darkTheme,
    Store: options.store,
    RegisterModule: (id, module) => options.RegisterModule(id, module),
    SetMode: mode => options.SetMode(mode),
    GetLegacyActionSettings: () => options.GetLegacyActionSettings(),
};
const transfer = new TransferDialog(core);
_G.LumaUI = core;
options.store.onReady(() => {
    core.RegisterModule("collections", new CollectionControls(core, presets));
    seedPlayerCollection(core);
    options.Install();
    installLibrary(core);
    presets.Restore();
    skins.Restore();
});
console.log("LumaUI loaded");
