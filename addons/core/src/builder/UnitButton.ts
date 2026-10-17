import type { ClickCastPresetDocument, ClickCastBinding, ClickCastTraits } from "../core/builder";
import { resolveUnit } from "wuira/datasources";
import type { UnitInput } from "wuira/datasources";
import { clickCastTraits, clickCastTargeting } from "./ClickCastTraits";

declare function RegisterStateDriver(this: void, frame: wuiraNativeFrame, state: string, condition: string): void;
declare function UnregisterStateDriver(this: void, frame: wuiraNativeFrame, state: string): void;
declare const GetSpellInfo: ((this: void, id: number) => string | undefined) | undefined;
declare const GetSpellSubtext: ((this: void, id: number) => string | undefined) | undefined;

/** Mouse combinations use native modified attributes, never global keyboard overrides. */
export function clickCombination(key: string): { prefix: string; button: string } {
    const parts = key.trim().toUpperCase().split("-");
    const button = parts.pop()!;
    if (!["BUTTON1", "BUTTON2", "BUTTON3", "BUTTON4", "BUTTON5"].includes(button)
        || parts.some(part => !["ALT", "CTRL", "SHIFT"].includes(part)) || new Set(parts).size !== parts.length)
        throw "Use a mouse combination such as BUTTON1 or CTRL-SHIFT-BUTTON1";
    return { prefix: ["ALT", "CTRL", "SHIFT"].filter(part => parts.includes(part)).map(part => part.toLowerCase() + "-").join(""), button: button.slice(6) };
}

/** The macro has one explicit unit clause and no fallback target clause. */
function targetedAction(binding: ClickCastBinding): { command: string; action: string } {
    if (binding.macro !== undefined) throw "Only clicked unit is unavailable for named macros";
    if (binding.itemId !== undefined) return { command: "/use ", action: "item:" + binding.itemId };
    const api = C_Spell as typeof C_Spell & { GetSpellSubtext?: (this: void, id: number) => string | undefined };
    const name = api.GetSpellName?.(binding.spellId!) ?? GetSpellInfo?.(binding.spellId!);
    const rank = api.GetSpellSubtext?.(binding.spellId!) ?? GetSpellSubtext?.(binding.spellId!);
    if (name === undefined || issecretvalue(name) || name === "" || [name, rank ?? ""].some(text => text.includes("\n") || text.includes("\r") || text.includes(";") || text.includes("[") || text.includes("]")))
        throw "Spell information is unavailable for Click Cast: " + binding.spellId;
    return { command: "/cast ", action: name + (rank === undefined || rank === "" ? "" : "(" + rank + ")") };
}
function targetClause(traits: ClickCastTraits): string {
    return "[@mouseover,exists" + (traits.nodead ? ",nodead" : "") + (!traits.enemy ? ",help" : !traits.friendly ? ",harm" : "") + "] ";
}

/** One preset applies to every attached button; secure help/harm remapping is evaluated at click time. */
export function configureUnitButton(frame: wuiraNativeFrame, input: UnitInput, preset?: ClickCastPresetDocument, watch = false): () => void {
    const target = resolveUnit(input);
    const combinations = (preset?.bindings ?? []).map(binding => {
        const traits = clickCastTraits(binding.traits ?? preset?.traits);
        return { ...clickCombination(binding.key), binding, traits,
            targeted: clickCastTargeting(binding.targeting, traits) === "mouseover" ? targetedAction(binding) : undefined };
    });
    const button = frame as wuiraNativeSecureButton;
    const attributes = new Set<string>();
    const set = (key: string, value: string | number | boolean | undefined) => { attributes.add(key); button.SetAttribute(key, value); };
    const updateUnit = () => {
        const unit = target.Token;
        if (unit.length === 0 || unit.length > 40 || unit.split("").some(character => !"abcdefghijklmnopqrstuvwxyz0123456789".includes(character))) throw "Unit button requires a static unit token";
        set("unit", unit);
        for (let index = 1; index <= 5; index++) set("unit" + index, unit);
        for (const combination of combinations) {
            const { prefix, binding, targeted, traits } = combination;
            const restricted = !traits.friendly || !traits.enemy;
            const virtual = "luma" + combination.button;
            const suffix = restricted ? "-" + virtual : combination.button;
            // Empty values stop modifier lookup from inheriting another binding's remap.
            set(prefix + "helpbutton" + combination.button, restricted && traits.friendly ? virtual : "");
            set(prefix + "harmbutton" + combination.button, restricted && traits.enemy ? virtual : "");
            if (restricted) {
                set(prefix + "type" + combination.button, "");
                set(prefix + "unit" + suffix, unit);
            }
            // Native macro attributes take precedence over macrotext. Clear any static action
            // supplied by the component before applying the binding's chosen transport.
            for (const name of ["spell", "item", "macro", "macrotext", "action"]) set(prefix + name + suffix, undefined);
            if (targeted !== undefined) {
                const clause = targetClause(traits);
                set(prefix + "type" + suffix, "macro");
                set(prefix + "macrotext" + suffix, (traits.clearTargeting ? "/stopspelltarget " + clause + "\n" : "") + targeted.command + clause + targeted.action);
            } else {
                const type = binding.spellId !== undefined ? "spell" : binding.itemId !== undefined ? "item" : "macro";
                const value = binding.spellId ?? (binding.itemId === undefined ? binding.macro : "item:" + binding.itemId);
                set(prefix + "type" + suffix, type);
                set(prefix + type + suffix, value);
            }
        }
        if (watch) RegisterStateDriver(button, "visibility", "[@" + unit + ",exists] show; hide");
    };
    button.RegisterForClicks("LeftButtonUp", "RightButtonUp", "MiddleButtonUp", "Button4Up", "Button5Up");
    set("useOnKeyDown", false);
    set("type1", "target"); set("type2", "togglemenu");
    updateUnit();
    const stopUnit = target.onTokenChange(updateUnit);
    return () => {
        stopUnit();
        if (watch) UnregisterStateDriver(button, "visibility");
        for (const key of attributes) button.SetAttribute(key, undefined);
    };
}
