import type { Presets } from "../presets/Presets";
import type { Skins } from "../skins/Skins";
import { registerLayoutComponents } from "./registerLayout";
import { registerUnitComponents } from "./registerUnits";
import { registerDataSources } from "./registerSources";

export function registerBuiltins(presets: Presets, skins: Skins): void {
    registerUnitComponents(presets, skins);
    registerLayoutComponents(presets);
    registerDataSources(presets, skins);
}
