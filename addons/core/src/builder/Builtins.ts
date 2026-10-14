import { UI } from "wuira";
import { Background, Border } from "wuira/ui";
import type { CellProps, SecureAction, SecureButtonProps, IconProps } from "wuira/ui";
import { HP, Mana, GlobalCooldown, SpellCooldown, CastTimer, AuraTimer, SwingTimer, SpellSource, TotemTimer } from "wuira/datasources";
import { MicroBar } from "wuira/skins";
import type { MicroMenuSkinOptions } from "wuira";
import type { Properties, PropertyRules } from "../core/builder";
import type { Presets } from "./Presets";
import { hideUnitFrames } from "./NativeVisibility";
import { createMicroMenu } from "../MicroMenu";
import type { Skins } from "./Skins";
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
    presets.RegisterComponent("hideUnitFrame", { headless: true, children: "none", properties: {
        unit: { type: "string", required: true, values: ["player", "target", "focus"] },
    }, Apply: props => hideUnitFrames({ [props.unit as string]: true }) });
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
        orientation: { type: "string", values: ["horizontal", "vertical"] }, reverse: { type: "boolean" } },
        Create: (props, children, context) => UI.createElement("progress", { ...visual(props), source: context.Source()?.progress }, children) });
    presets.RegisterComponent("label", { children: "none", properties: { ...common,
        text: { type: "string", required: true }, font: { type: "string" }, fontSize: { type: "number", min: 1, max: 128 }, color: { type: "color" },
        align: { type: "string", values: ["LEFT", "CENTER", "RIGHT"] } },
        Create: props => UI.createElement("label", visual(props)) });
    presets.RegisterComponent("icon", { children: "none", source: "texture", properties: { ...common, texture: { type: "string" }, texCoords: { type: "texCoords" } },
        Create: (props, _children, context) => UI.createElement("icon", { ...visual(props), textureSource: context.Source()?.texture } as Partial<IconProps>) });
    presets.RegisterComponent("secureButton", { children: "single", source: "action", properties: { ...common,
        action: { type: "action" }, binding: { type: "string" }, showHotkey: { type: "boolean" }, finishGlow: { type: "boolean" },
        button: { type: "string", values: ["LeftButton", "RightButton", "MiddleButton", "Button4", "Button5"] } },
        Create: (props, children, context) => {
            const source = context.Source();
            return UI.createElement("secureButton", { ...visual(props), action: props.action as unknown as SecureAction | undefined ?? source?.action,
                cooldown: source?.cooldown, clickThrough: false } as Partial<SecureButtonProps>, children);
        } });
    presets.RegisterSource("hp", { properties: { ...unit, healPrediction: { type: "boolean" }, absorbPrediction: { type: "boolean" } }, Create: props => {
        const hp = new HP(props.unit as string | undefined ?? "player");
        if (props.healPrediction === true) hp.UseHealPrediction();
        if (props.absorbPrediction === true) hp.UseAbsorbPrediction();
        return { progress: hp };
    } });
    presets.RegisterSource("mana", { properties: { ...unit, regenTimer: { type: "boolean" } }, Create: props => {
        const mana = new Mana(props.unit as string | undefined ?? "player"); if (props.regenTimer === true) mana.UseRegenTimer();
        return { progress: mana, channels: mana.RegenTimer === undefined ? undefined : { regen: { progress: mana.RegenTimer } }, Dispose: () => mana.RegenTimer?.Dispose() };
    } });
    presets.RegisterSource("channel", { properties: { source: { type: "string", required: true }, channel: { type: "string", required: true } }, references: ["source"],
        Create: (props, context) => { const channel = context.Source(props.source as string).channels?.[props.channel as string]; if (channel === undefined) throw "Missing source channel"; return channel; } });
    presets.RegisterSource("totem", { properties: { spellId: { ...positive, required: true } }, Create: props => { const timer = new TotemTimer(props.spellId as number); return { progress: timer, IsActive: () => timer.IsActive }; } });
    presets.RegisterSource("gcd", { properties: {}, Create: () => { const timer = new GlobalCooldown(); return { progress: timer, IsActive: () => timer.IsActive }; } });
    presets.RegisterSource("cooldown", { properties: { spellId: { ...positive, required: true } },
        Create: props => ({ progress: new SpellCooldown(props.spellId as number) }) });
    presets.RegisterSource("cast", { properties: unit, Create: props => { const timer = new CastTimer(props.unit as string | undefined ?? "player"); return { progress: timer, IsActive: () => timer.IsActive, Text: () => timer.SpellName }; } });
    presets.RegisterSource("swing", { properties: {}, Create: () => { const swing = new SwingTimer(); return { progress: swing, IsActive: () => swing.IsActive, Dispose: () => swing.Dispose() }; } });
    presets.RegisterSource("aura", { properties: { ...unit, spellId: positive, spellIds: { type: "numbers" }, activeAlpha: { type: "number", min: 0, max: 1 }, inactiveAlpha: { type: "number", min: 0, max: 1 },
        filter: { type: "string", values: ["HELPFUL", "HARMFUL", "HELPFUL|PLAYER", "HARMFUL|PLAYER"] } }, Create: props => {
            const aura = new AuraTimer(props.unit as string | undefined ?? "player", { spellIds: props.spellIds as number[] | undefined ?? [props.spellId as number], filter: props.filter as "HELPFUL" | "HARMFUL" | "HELPFUL|PLAYER" | "HARMFUL|PLAYER" | undefined });
            return { progress: aura, texture: aura.Texture, IsActive: () => aura.IsActive, Alpha: () => aura.Status === "active" ? props.activeAlpha as number | undefined ?? 1 : props.inactiveAlpha as number | undefined ?? 1 };
        } });
    presets.RegisterSource("spell", { properties: { spellId: { ...positive, required: true } }, Create: props => {
        const spell = new SpellSource(props.spellId as number);
        return { progress: spell.Cooldown, action: spell.Action, texture: spell.Texture, cooldown: spell.Cooldown };
    } });
    skins.RegisterTarget("unitFrames", { properties: { player: { type: "boolean" }, target: { type: "boolean" }, focus: { type: "boolean" } }, Apply: props => hideUnitFrames(props) });
    skins.RegisterTarget("compactMicroMenu", { properties: {}, Apply: () => createMicroMenu() });
    skins.RegisterTarget("microBar", { properties: {
        background: { type: "color" }, border: { type: "color" }, buttonBackground: { type: "color" },
        icon: { type: "color" }, accent: { type: "color" }, disabledIcon: { type: "color" },
        padding: { type: "number", min: 0, max: 64 }, panel: { type: "boolean" },
    }, Apply: props => { const bar = new MicroBar().Style(props as unknown as MicroMenuSkinOptions); return () => bar.Dispose(); } });
}
