import type { Presets } from "../presets/Presets";
import type { Skins } from "../skins/Skins";
import type { BlizzardElementProps, UnitFilter } from "../../core/builder";
import { hideNativeFrames } from "../skins/NativeVisibility";
import { blizzardElementProperties, validateBlizzardElement } from "../skins/BlizzardElement";
import { unitText, unitIndicator } from "../units/UnitWidgets";
import { unitAuraIndicator } from "../units/UnitAuraIndicator";
import { unitAuraIcons } from "../units/UnitAuraIcons";
import { unitPortrait } from "wuira/ui";
import { UnitToBool, unitFilterProperties } from "../../helpers/UnitToBool";
import { common, positive, visual } from "./builtinRules";

export function registerUnitComponents(presets: Presets, skins: Skins): void {
    presets.RegisterSource("unitToBool", { capabilities: ["MatchUnit"], properties: unitFilterProperties,
        Validate: props => { UnitToBool(props as unknown as UnitFilter); },
        Create: props => ({ MatchUnit: UnitToBool(props as unknown as UnitFilter) }) });
    presets.RegisterComponent("blizzardElement", { headless: true, deferred: true, children: "single",
        properties: blizzardElementProperties, Validate: validateBlizzardElement,
        Apply: (props, context) => {
            const filter = context.ResolveSource(props.filter as string).MatchUnit;
            if (filter === undefined) throw "BlizzardElement filter must provide unit-to-boolean conversion";
            const render: import("wuira/skins").NameplateRender | undefined = props.replace === true ? plate => {
                const template = context.Template!(plate.Unit);
                plate.OnDispose(() => template.Dispose());
                return template.View;
            } : undefined;
            const handle = skins.RegisterElement({ ...props, filter, child: render } as unknown as BlizzardElementProps);
            return () => handle.Dispose();
        } });
    presets.RegisterComponent("unitText", { children: "none", properties: { ...common, unit: { type: "string", required: true },
        field: { type: "string", values: ["name", "health", "percent"] }, fontSize: { type: "number", min: 6, max: 48 }, align: { type: "string", values: ["LEFT", "CENTER", "RIGHT"] } },
        Create: (props, _children, context) => unitText(visual(props), context.Unit(props.unit as string), props.field as string ?? "name", context.Preview === true, props.fontSize as number | undefined, props.align as string | undefined) });
    presets.RegisterComponent("unitIndicator", { children: "none", properties: { ...common, unit: { type: "string", required: true }, field: { type: "string", values: ["role", "leader"] } },
        Create: (props, _children, context) => unitIndicator(visual(props), context.Unit(props.unit as string), props.field as string ?? "role", context.Preview === true) });
    presets.RegisterComponent("unitAuras", { children: "none", properties: { ...common, unit: { type: "string", required: true },
        category: { type: "string", required: true, values: ["buffs", "dispellable", "movement", "other"] }, movementSpellIds: { type: "numbers", editor: "spell" },
        maxIcons: { type: "number", min: 1, max: 16 }, iconSize: { type: "number", min: 8, max: 64 }, compartmentBorder: { type: "color" }, hoverBackground: { type: "color" } },
        Create: (props, _children, context) => unitAuraIcons(visual(props), context.Unit(props.unit as string), props.category as string, props.movementSpellIds as number[] | undefined ?? [], context.Preview === true, props.maxIcons as number | undefined, props.iconSize as number | undefined,
            props.compartmentBorder === undefined ? undefined : { border: props.compartmentBorder as unknown as { r: number; g: number; b: number; a?: number }, hover: props.hoverBackground as unknown as { r: number; g: number; b: number; a?: number } | undefined }) });
    presets.RegisterComponent("unitAuraIndicator", { children: "none", properties: { ...common, unit: { type: "string", required: true },
        category: { type: "string", required: true, values: ["dispellable", "movement"] }, spellId: { ...positive, editor: "spell", required: true },
        movementSpellIds: { type: "numbers", editor: "spell" }, iconSize: { type: "number", min: 8, max: 64 }, idleBorder: { type: "color" }, activeBorder: { type: "color" }, hoverBackground: { type: "color" } },
        Create: (props, _children, context) => { const { idleBorder, activeBorder, hoverBackground, ...rest } = props;
            return unitAuraIndicator(visual(rest), context.Unit(props.unit as string), props.category as string, props.spellId as number, props.movementSpellIds as number[] | undefined ?? [], context.Preview === true,
                props.iconSize as number | undefined, idleBorder as unknown as { r: number; g: number; b: number } | undefined, activeBorder as unknown as { r: number; g: number; b: number } | undefined, hoverBackground as unknown as { r: number; g: number; b: number } | undefined); } });
    presets.RegisterComponent("hideUnitFrame", { headless: true, children: "none", properties: {
        unit: { type: "string", required: true, values: ["player", "target", "focus", "actionBars"] },
    }, Apply: props => hideNativeFrames({ [props.unit as string]: true }) });
    presets.RegisterComponent("unitPortrait", { children: "none", properties: { ...common,
        unit: { type: "string", required: true }, texCoords: { type: "texCoords" } },
        Create: (props, _children, context) => unitPortrait(visual(props), context.Unit(props.unit as string), props.texCoords as number[] | undefined, context.Preview === true) });
}
