import { UI } from "wuira";
import { Background, Border } from "wuira/ui";
import type { CellProps, SecureAction, SecureButtonProps, IconProps } from "wuira/ui";
import { HP, Mana, GlobalCooldown, SpellCooldown, CastTimer, AuraTimer, SwingTimer, SpellSource, TotemTimer } from "wuira/datasources";
import { MicroBar } from "wuira/skins";
import type { MicroMenuSkinOptions } from "wuira";
import type { Properties, PropertyRules } from "../core/builder";
import type { Presets } from "./Presets";
import { hideNativeFrames } from "./NativeVisibility";
import { createMicroMenu } from "../MicroMenu";
import { unitPortrait } from "../UnitPortrait";
import type { Skins } from "./Skins";
import { PrimaryPower, unitText, unitIndicator, tintPrimaryPower } from "./UnitWidgets";
import { unitAuraIndicator } from "./UnitAuraIndicator";
import { unitAuraIcons } from "./UnitAuraIcons";
import { configureUnitButton } from "./UnitButton";
import { actionTooltip } from "./ActionTooltip";
import { registerConverterSources } from "./ConverterSources";
import { UnitToBool, unitFilterProperties } from "../helpers/UnitToBool";
import { blizzardElementProperties, validateBlizzardElement } from "./BlizzardElement";
import type { BlizzardElementProps, UnitFilter } from "../core/builder";
import { GroupRoster } from "./GroupRoster";
import { listRecords } from "./ListRecords";
import type { GroupRosterMember, KnownSpell } from "wuira/datasources";
import { KnownSpellCollection } from "../helpers/KnownSpells";
import { parseSpellSelectors } from "../helpers/NameSelectors";
import type { GroupScope } from "wuira/datasources";
const anchors = ["TOPLEFT", "TOP", "TOPRIGHT", "LEFT", "CENTER", "RIGHT", "BOTTOMLEFT", "BOTTOM", "BOTTOMRIGHT"];
const common: PropertyRules = {
    width: { type: "size" }, height: { type: "size" }, margin: { type: "spacing" }, padding: { type: "spacing" },
    mode: { type: "string", values: ["absolute", "relative"] }, anchor: { type: "string", values: anchors },
    relativeAnchor: { type: "string", values: anchors }, relativeTo: { type: "string" }, x: { type: "number" }, y: { type: "number" }, offset: { type: "offset" },
    alpha: { type: "number", min: 0, max: 1 }, condition: { type: "boolean" }, clickThrough: { type: "boolean" },
    backgroundColor: { type: "color" }, borderColor: { type: "color" }, borderWidth: { type: "number", min: 0, max: 64 },
};
const positive = { type: "number", min: 1, max: 10000000 } as const;
const unit: PropertyRules = { unit: { type: "string" } };
function visual(input: Properties): Partial<CellProps> {
    const { backgroundColor, borderColor, borderWidth, ...rest } = input;
    const props = rest as Partial<CellProps>;
    if (backgroundColor !== undefined || borderColor !== undefined) props.decorations = {
        background: backgroundColor === undefined ? undefined : new Background({ color: backgroundColor as unknown as { r: number; g: number; b: number; a?: number } }),
        border: borderColor === undefined ? undefined : new Border({ color: borderColor as unknown as { r: number; g: number; b: number; a?: number }, thickness: borderWidth as number | undefined ?? 1 }),
    };
    return props;
}
export function registerBuiltins(presets: Presets, skins: Skins): void {
    presets.RegisterSource("unitToBool", { properties: unitFilterProperties,
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
    presets.RegisterComponent("foreach", { children: "multiple", source: "items", properties: { ...common,
        key: { type: "string", values: ["key"] }, groupBy: { type: "string", values: ["group"] },
        direction: { type: "string", values: ["horizontal", "vertical"] }, wrapAfter: { type: "number", min: 1, max: 40 },
        gap: { type: "number", min: 0, max: 64 }, lineGap: { type: "number", min: 0, max: 64 } },
        Create: props => UI.createElement("cell", visual(props)) });
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
        Create: (props, _children, context) => unitPortrait(visual(props), props.unit as string, props.texCoords as number[] | undefined, context.Preview === true) });
    presets.RegisterComponent("cell", { children: "single", properties: common,
        Create: (props, children) => UI.createElement("cell", visual(props), children) });
    presets.RegisterComponent("flow", { children: "multiple", properties: { ...common,
        sizing: { type: "string", values: ["fixed", "content"] }, direction: { type: "string", values: ["horizontal", "vertical"] }, gap: { type: "number", min: 0, max: 4096 },
        lineGap: { type: "number", min: 0, max: 4096 }, grow: { type: "boolean" }, justify: { type: "string", values: ["start", "center", "end"] } },
        Create: (props, children) => UI.createElement("flow", visual(props), children) });
    presets.RegisterComponent("grid", { children: "multiple", properties: { ...common,
        sizing: { type: "string", values: ["fixed", "content"] }, cellWidth: { type: "number", min: 0, max: 8192 }, cellHeight: { type: "number", min: 0, max: 8192 }, columns: { type: "number", min: 1, max: 128 }, gap: { type: "number", min: 0, max: 4096 },
        rowGap: { type: "number", min: 0, max: 4096 }, columnGap: { type: "number", min: 0, max: 4096 } },
        Create: (props, children) => UI.createElement("grid", visual(props), children) });
    presets.RegisterComponent("progress", { children: "single", source: "progress", properties: { ...common,
        foreground: { type: "textureOptions" }, healPrediction: { type: "background" }, absorbPrediction: { type: "background" }, background: { type: "background" }, backdrop: { type: "border" },
        value: { type: "number" }, min: { type: "number" }, max: { type: "number" }, current: { type: "number" }, color: { type: "color" }, texture: { type: "string" },
        orientation: { type: "string", values: ["horizontal", "vertical"] }, reverse: { type: "boolean" }, powerColorUnit: { type: "string" } },
        Create: (props, children, context) => UI.createElement("progress", { ...visual(props), source: context.Source()?.progress,
            onMount: props.powerColorUnit === undefined ? undefined : (frame: wuiraNativeFrame) => tintPrimaryPower(frame, context.Unit(props.powerColorUnit as string)) }, children) });
    presets.RegisterComponent("label", { children: "none", properties: { ...common,
        text: { type: "string", required: true }, font: { type: "string" }, fontSize: { type: "number", min: 1, max: 128 }, color: { type: "color" },
        align: { type: "string", values: ["LEFT", "CENTER", "RIGHT"] } },
        Create: props => UI.createElement("label", visual(props)) });
    presets.RegisterComponent("icon", { children: "none", source: "texture", properties: { ...common, texture: { type: "texture", editor: "icon" }, texCoords: { type: "texCoords" } },
        Create: (props, _children, context) => UI.createElement("icon", { ...visual(props), textureSource: context.Source()?.texture } as Partial<IconProps>) });
    presets.RegisterComponent("secureButton", { children: "single", source: "action", properties: { ...common,
        action: { type: "action" }, binding: { type: "string" }, clickCastPreset: { type: "string" }, showHotkey: { type: "boolean" }, showTooltip: { type: "boolean" }, finishGlow: { type: "boolean" },
        button: { type: "string", values: ["LeftButton", "RightButton", "MiddleButton", "Button4", "Button5"] },
        unit: { type: "string" }, unitWatch: { type: "boolean" }, visibilityGroup: { type: "string", values: ["party", "raid"] } },
        Create: (props, children, context) => {
            const source = context.Source();
            const token = props.unit as string | undefined ?? (props.clickCastPreset === undefined ? undefined : "target");
            const unit = token === undefined ? undefined : context.Unit(token);
            const preset = context.Preview || props.clickCastPreset === undefined || props.clickCastPreset === "standard" ? undefined : presets.ResolveClickCast(props.clickCastPreset as string);
            if (!context.Preview && props.clickCastPreset !== undefined && props.clickCastPreset !== "standard" && preset === undefined) throw "Missing Click Cast preset";
            const appearance = visual(props);
            if (!context.Preview && props.showTooltip !== false) appearance.decorations = { ...appearance.decorations,
                tooltip: actionTooltip(() => context.Source()?.action ?? props.action as unknown as SecureAction | undefined) };
            return UI.createElement("secureButton", { ...appearance, action: source?.action ?? props.action as unknown as SecureAction | undefined,
                onMount: unit === undefined ? undefined : (frame: wuiraNativeFrame) => {
                    const stopAction = context.Preview ? undefined : configureUnitButton(frame, unit, preset, props.unitWatch === true);
                    return () => { stopAction?.(); };
                },
                cooldown: source?.cooldown, clickThrough: false } as Partial<SecureButtonProps>, children);
        } });
    presets.RegisterSource("hp", { properties: { ...unit, healPrediction: { type: "boolean" }, absorbPrediction: { type: "boolean" } }, Create: (props, context) => {
        const hp = new HP(context.Unit(props.unit as string | undefined ?? "player"));
        if (props.healPrediction === true) hp.UseHealPrediction();
        if (props.absorbPrediction === true) hp.UseAbsorbPrediction();
        return { value: hp, progress: hp };
    } });
    presets.RegisterSource("mana", { properties: { ...unit, regenTimer: { type: "boolean" } }, Create: (props, context) => {
        const mana = new Mana(context.Unit(props.unit as string | undefined ?? "player")); if (props.regenTimer === true) mana.UseRegenTimer();
        return { value: mana, progress: mana, channels: mana.RegenTimer === undefined ? undefined : { regen: { progress: mana.RegenTimer } }, Dispose: () => mana.RegenTimer?.Dispose() };
    } });
    presets.RegisterSource("power", { properties: unit, Create: (props, context) => { const power = new PrimaryPower(context.Unit(props.unit as string | undefined ?? "player")); return { value: power, progress: power }; } });
    presets.RegisterSource("list", { properties: { items: { type: "value" } }, Validate: props => { listRecords(props); },
        Create: props => { const values = listRecords(props); return { items: { Value: values, onChange: () => () => {} }, ItemsKey: item => (item as { key: string | number }).key }; } });
    presets.RegisterSource("groupMembers", { properties: { scope: { type: "string", values: ["auto", "party", "raid"] }, pets: { type: "boolean" } },
        Create: (props, context) => {
            const list = new GroupRoster(props.scope as GroupScope | undefined ?? "auto", props.pets === true, context.Manual === true, context.Preview === true);
            return { items: list, ItemsKey: item => (item as GroupRosterMember).key,
                ItemsGroup: item => (item as GroupRosterMember).group, ItemsUnit: item => (item as GroupRosterMember).unit,
                ItemsTemplate: item => (item as GroupRosterMember).pet ? 1 : 0, Dispose: () => list.Dispose() };
        } });
    presets.RegisterSource("knownSpells", { properties: { selectors: { type: "string" }, includePassive: { type: "boolean" } },
        Validate: props => { parseSpellSelectors(props.selectors as string | undefined ?? ""); },
        Create: props => {
            const list = new KnownSpellCollection(parseSpellSelectors(props.selectors as string | undefined ?? ""), props.includePassive === true);
            return { items: list, ItemsKey: item => (item as KnownSpell).id, BindItem: read => {
                const spell = new SpellSource((read() as KnownSpell).id);
                return { progress: spell.Cooldown, action: spell.Action, texture: spell.Texture, cooldown: spell.Cooldown,
                    Text: () => (read() as KnownSpell).name ?? "", IsActive: () => (read() as KnownSpell).isPassive === false };
            }, Dispose: () => list.Dispose() };
        } });
    presets.RegisterListHelper("KnownSpells", { source: "knownSpells", Parse: argumentsText => {
        parseSpellSelectors(argumentsText); return { selectors: argumentsText };
    } });
    presets.RegisterSource("channel", { properties: { source: { type: "string", required: true }, channel: { type: "string", required: true } }, references: ["source"],
        Create: (props, context) => { const channel = context.Source(props.source as string).channels?.[props.channel as string]; if (channel === undefined) throw "Missing source channel"; return channel; } });
    presets.RegisterSource("totem", { properties: { spellId: { ...positive, editor: "spell", required: true } }, Create: props => { const timer = new TotemTimer(props.spellId as number); return { progress: timer, IsActive: () => timer.IsActive }; } });
    presets.RegisterSource("gcd", { properties: {}, Create: () => { const timer = new GlobalCooldown(); return { progress: timer, IsActive: () => timer.IsActive }; } });
    presets.RegisterSource("cooldown", { properties: { spellId: { ...positive, editor: "spell", required: true } },
        Create: props => ({ progress: new SpellCooldown(props.spellId as number) }) });
    presets.RegisterSource("cast", { properties: unit, Create: props => { const timer = new CastTimer(props.unit as string | undefined ?? "player"); return { progress: timer, IsActive: () => timer.IsActive, Text: () => timer.SpellName }; } });
    presets.RegisterSource("swing", { properties: {}, Create: () => { const swing = new SwingTimer(); return { progress: swing, IsActive: () => swing.IsActive, Dispose: () => swing.Dispose() }; } });
    presets.RegisterSource("aura", { properties: { ...unit, spellId: { ...positive, editor: "spell" }, spellIds: { type: "numbers", editor: "spell" }, activeAlpha: { type: "number", min: 0, max: 1 }, inactiveAlpha: { type: "number", min: 0, max: 1 },
        filter: { type: "string", values: ["HELPFUL", "HARMFUL", "HELPFUL|PLAYER", "HARMFUL|PLAYER"] } }, Create: props => {
            const aura = new AuraTimer(props.unit as string | undefined ?? "player", { spellIds: props.spellIds as number[] | undefined ?? [props.spellId as number], filter: props.filter as "HELPFUL" | "HARMFUL" | "HELPFUL|PLAYER" | "HARMFUL|PLAYER" | undefined });
            return { progress: aura, texture: aura.Texture, IsActive: () => aura.IsActive, Alpha: () => aura.Status === "active" ? props.activeAlpha as number | undefined ?? 1 : props.inactiveAlpha as number | undefined ?? 1 };
        } });
    presets.RegisterSource("spell", { properties: { spellId: { ...positive, editor: "spell", required: true } }, Create: props => {
        const spell = new SpellSource(props.spellId as number);
        return { progress: spell.Cooldown, action: spell.Action, texture: spell.Texture, cooldown: spell.Cooldown };
    } });
    skins.RegisterTarget("unitFrames", { properties: { player: { type: "boolean" }, target: { type: "boolean" }, focus: { type: "boolean" } }, Apply: props => hideNativeFrames(props) });
    skins.RegisterTarget("compactMicroMenu", { properties: {}, Apply: () => createMicroMenu() });
    skins.RegisterTarget("microBar", { properties: {
        background: { type: "color" }, border: { type: "color" }, buttonBackground: { type: "color" },
        icon: { type: "color" }, accent: { type: "color" }, disabledIcon: { type: "color" },
        padding: { type: "number", min: 0, max: 64 }, panel: { type: "boolean" },
    }, Apply: props => { const bar = new MicroBar().Style(props as unknown as MicroMenuSkinOptions); return () => bar.Dispose(); } });
    registerConverterSources(presets);
}
