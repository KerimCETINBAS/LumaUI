import { ComponentPreview } from "./builder/library/ComponentPreview";
import { LumaOptions } from "./shell/Options";
import { NativeFrameControls } from "./shell/NativeFrameControls";
import { installActionSlotCommands } from "./shell/NativeActionSlots";
import { PlayerActions } from "./helpers/PlayerActions";
import { KnownSpells } from "./helpers/KnownSpells";
import { UnitToBool } from "./helpers/UnitToBool";

import { darkTheme } from "./theme/dark";
import type { LumaCoreAPI, PresetDocument } from "./core/contract";

import { CollectionControls } from "./builder/collections/CollectionControls";
import { BuiltinPresets } from "./BuiltinPresets";
import { BuiltinPresetLibrary } from "./builder/library/BuiltinPresetLibrary";
import { Presets } from "./builder/presets/Presets";
import { ClickCastLibrary, STANDARD_CLICK_PRESET } from "./builder/clickcast/ClickCastLibrary";
import { Skins } from "./builder/skins/Skins";
import { registerBuiltins } from "./builder/builtins/Builtins";
import { TransferDialog } from "./builder/transfer/TransferDialog";
import { installLibrary } from "./builder/library/LibraryView";
import { installClickCastLibrary } from "./builder/clickcast/ClickCastLibraryView";

function initialize(): void {
    const options = new LumaOptions();
    let presets: Presets;
    const clickCast = new ClickCastLibrary(options.store, id => presets?.RefreshClickCastPreset(id), id => presets?.ClickCastPresetInUse(id) ?? false);
    presets = new Presets(options.store, clickCast);
    const skins = new Skins(options.store);
    registerBuiltins(presets, skins);
    let editor: ((document: PresetDocument) => void) | undefined;
    let creator: (() => void) | undefined;
    const builtinStrings = { ...BuiltinPresets };
    const core: LumaCoreAPI = {
        Preview: props => ComponentPreview(props, presets, darkTheme),
        Helpers: { KnownSpells, PlayerActions, UnitToBool },
        BuiltinPresets: builtinStrings,
        RegisterBuiltinPreset: preset => builtinLibrary.Register(preset),
        RegisterPresetEditor: callback => { editor = callback; return () => { if (editor === callback) editor = undefined; }; },
        RegisterPresetCreator: callback => { creator = callback; return () => { if (creator === callback) creator = undefined; }; },
        CreatePreset: () => { if (InCombatLockdown()) { console.log("Create components after combat."); return; } if (creator === undefined) { console.log("Enable LumaUI.Editor to create components."); return; } creator(); options.OpenCustomization("editor"); },
        EditPreset: document => { if (InCombatLockdown()) throw "Edit components after combat."; if (editor === undefined) throw "Enable LumaUI.Editor to edit components."; editor(presets.Validate(document, true)); options.OpenCustomization("editor"); },
        OpenImport: (kind, callback, importString) => transfer.Import(kind, callback, importString),
        OpenExport: (document, clickCastPresets) => transfer.Export(document, clickCastPresets),
        Presets: presets,
        Skins: skins,
        ClickCastPresets: clickCast,
        StandardClickPreset: STANDARD_CLICK_PRESET,
        RegisterPage: page => options.RegisterPage(page),
        OpenCustomization: id => options.OpenCustomization(id),
        CloseCustomization: () => options.CloseCustomization(),
        RefreshCustomization: () => options.RefreshCustomization(),
        Theme: darkTheme,
        Store: options.store,
        RegisterModule: (id, module) => options.RegisterModule(id, module),
        SetMode: mode => options.SetMode(mode),
    };
    const transfer = new TransferDialog(core);
    const builtinLibrary = new BuiltinPresetLibrary(core, builtinStrings);
    _G.LumaUI = core;
    options.store.onReady(() => {
        installActionSlotCommands();
        core.RegisterModule("collections", new CollectionControls(core, presets));
        core.RegisterModule("native-frames", new NativeFrameControls(core, presets.Layouts));
        options.Install();
        installLibrary(core);
        installClickCastLibrary(core);
        presets.Restore();
        skins.Restore();
    });
    console.log("LumaUI loaded");

}

declare const C_AddOns: { IsAddOnLoaded?: (this: void, name: string) => wuiraNativeReturns<[boolean, boolean]> } | undefined;
let loaded = false;
if (C_AddOns?.IsAddOnLoaded !== undefined) { const [, finished] = C_AddOns.IsAddOnLoaded("LumaUI"); loaded = finished; }
if (loaded) initialize();
else {
    const ready = CreateFrame("Frame", undefined, UIParent);
    ready.RegisterEvent("ADDON_LOADED");
    ready.SetScript("OnEvent", (_frame, _event, addon) => {
        if (addon !== "LumaUI") return;
        ready.UnregisterAllEvents(); ready.SetScript("OnEvent", undefined); ready.Hide();
        initialize();
    });
}
