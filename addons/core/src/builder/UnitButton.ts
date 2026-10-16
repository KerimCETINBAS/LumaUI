import type { ClickCastPresetDocument } from "../core/builder";
import { resolveUnit } from "wuira/datasources";
import type { UnitInput } from "wuira/datasources";

declare function RegisterStateDriver(this: void, frame: wuiraNativeFrame, state: string, condition: string): void;
declare function UnregisterStateDriver(this: void, frame: wuiraNativeFrame, state: string): void;

/** Mouse combinations use native modified attributes, never global keyboard overrides. */
export function clickCombination(key: string): { prefix: string; button: string } {
    const parts = key.trim().toUpperCase().split("-");
    const button = parts.pop()!;
    if (!["BUTTON1", "BUTTON2", "BUTTON3", "BUTTON4", "BUTTON5"].includes(button)
        || parts.some(part => !["ALT", "CTRL", "SHIFT"].includes(part)) || new Set(parts).size !== parts.length)
        throw "Use a mouse combination such as BUTTON1 or CTRL-SHIFT-BUTTON1";
    return { prefix: ["ALT", "CTRL", "SHIFT"].filter(part => parts.includes(part)).map(part => part.toLowerCase() + "-").join(""), button: button.slice(6) };
}

/** One button uses one preset; the same preset applies independently to every unit button. */
export function configureUnitButton(frame: wuiraNativeFrame, input: UnitInput, preset?: ClickCastPresetDocument, watch = false): () => void {
    const target = resolveUnit(input);
    let unit = target.Token;
    if (unit.length === 0 || unit.length > 40 || unit.split("").some(character => !"abcdefghijklmnopqrstuvwxyz0123456789".includes(character))) throw "Unit button requires a static unit token";
    const button = frame as wuiraNativeSecureButton;
    button.RegisterForClicks("LeftButtonUp", "RightButtonUp", "MiddleButtonUp", "Button4Up", "Button5Up");
    const updateUnit = () => {
        unit = target.Token;
        button.SetAttribute("unit", unit);
        for (let index = 1; index <= 5; index++) button.SetAttribute("unit" + index, unit);
        if (watch) RegisterStateDriver(button, "visibility", "[@" + unit + ",exists] show; hide");
    };
    updateUnit();
    button.SetAttribute("type1", "target"); button.SetAttribute("type2", "togglemenu");
    const combinations = (preset?.bindings ?? []).map(binding => ({ ...clickCombination(binding.key), binding }));
    for (const combination of combinations) {
        const binding = combination.binding;
        const type = binding.spellId !== undefined ? "spell" : binding.itemId !== undefined ? "item" : "macro";
        const value = binding.spellId ?? (binding.itemId === undefined ? binding.macro : "item:" + binding.itemId);
        button.SetAttribute(combination.prefix + "type" + combination.button, type);
        button.SetAttribute(combination.prefix + type + combination.button, value);
    }
    const stopUnit = target.onChange(updateUnit);
    return () => {
        stopUnit();
        if (watch) UnregisterStateDriver(button, "visibility");
        button.SetAttribute("type1", undefined); button.SetAttribute("type2", undefined);
        button.SetAttribute("unit", undefined);
        for (let index = 1; index <= 5; index++) button.SetAttribute("unit" + index, undefined);
        for (const combination of combinations) {
            button.SetAttribute(combination.prefix + "type" + combination.button, undefined);
            for (const attribute of ["spell", "item", "macro"]) button.SetAttribute(combination.prefix + attribute + combination.button, undefined);
        }
    };
}
