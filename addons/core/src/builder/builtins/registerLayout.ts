import { UI } from "wuira/ui";
import type { IconProps, SecureAction, SecureButtonProps } from "wuira/ui";
import type { Presets } from "../presets/Presets";
import { configureUnitButton } from "../units/UnitButton";
import { actionTooltip } from "../clickcast/ActionTooltip";
import { common, visual } from "./builtinRules";
import { mountGlow } from "../glow/GlowFrame";

export function registerLayoutComponents(presets: Presets): void {
    presets.RegisterComponent("foreach", { children: "multiple", source: "items", properties: { ...common,
        key: { type: "string", values: ["key"] }, groupBy: { type: "string", values: ["group"] },
        direction: { type: "string", values: ["horizontal", "vertical"] }, wrapAfter: { type: "number", min: 1, max: 40 },
        gap: { type: "number", min: 0, max: 64 }, lineGap: { type: "number", min: 0, max: 64 } },
        Create: props => UI.createElement("cell", visual(props)) });
    presets.RegisterComponent("cell", { children: "single", properties: common,
        Create: (props, children) => UI.createElement("cell", visual(props), children) });
    presets.RegisterComponent("flow", { children: "multiple", properties: { ...common,
        sizing: { type: "string", values: ["fixed", "content"] }, direction: { type: "string", values: ["ltr", "rtl", "ttb", "btt", "horizontal", "vertical"] }, gap: { type: "number", min: 0, max: 4096 },
        lineGap: { type: "number", min: 0, max: 4096 }, grow: { type: "boolean" }, justify: { type: "string", values: ["start", "center", "end"] },
        alignX: { type: "string", values: ["left", "center", "right"] }, alignY: { type: "string", values: ["top", "center", "bottom"] } },
        Create: (props, children) => UI.createElement("flow", visual(props), children) });
    presets.RegisterComponent("grid", { children: "multiple", properties: { ...common,
        sizing: { type: "string", values: ["fixed", "content"] }, direction: { type: "string", values: ["ltr", "rtl", "ttb", "btt", "horizontal", "vertical"] },
        alignX: { type: "string", values: ["left", "center", "right"] }, alignY: { type: "string", values: ["top", "center", "bottom"] },
        cellWidth: { type: "number", min: 0, max: 8192 }, cellHeight: { type: "number", min: 0, max: 8192 }, columns: { type: "number", min: 1, max: 128 }, gap: { type: "number", min: 0, max: 4096 },
        rowGap: { type: "number", min: 0, max: 4096 }, columnGap: { type: "number", min: 0, max: 4096 } },
        Create: (props, children) => UI.createElement("grid", visual(props), children) });
    presets.RegisterComponent("progress", { children: "single", source: "progress", properties: { ...common,
        foreground: { type: "textureOptions" }, background: { type: "background" }, backdrop: { type: "border" },
        value: { type: "number" }, min: { type: "number" }, max: { type: "number" }, current: { type: "number" }, color: { type: "color" }, texture: { type: "string" },
        orientation: { type: "string", values: ["horizontal", "vertical"] }, reverse: { type: "boolean" } },
        Create: (props, children, context) => UI.createElement("progress", { ...visual(props), source: context.Source()?.progress }, children) });
    presets.RegisterComponent("label", { children: "none", properties: { ...common,
        text: { type: "string", required: true }, font: { type: "string" }, fontSize: { type: "number", min: 1, max: 128 }, color: { type: "color" },
        align: { type: "string", values: ["LEFT", "CENTER", "RIGHT"] } },
        Create: props => UI.createElement("label", visual(props)) });
    presets.RegisterComponent("icon", { children: "none", source: "texture", properties: { ...common, texture: { type: "texture", editor: "icon" }, texCoords: { type: "texCoords" },
        glowType: { type: "string", values: ["Pixel", "buttonOverlay", "ACShine", "Proc"] }, color: { type: "color" },
        lines: { type: "number", min: 1, max: 30 }, frequency: { type: "number", min: -2, max: 2 }, length: { type: "number", min: 1, max: 64 },
        thickness: { type: "number", min: 1, max: 32 }, scale: { type: "number", min: 0.05, max: 10 }, glowBorder: { type: "boolean" },
        glowX: { type: "number", min: -100, max: 100 }, glowY: { type: "number", min: -100, max: 100 }, duration: { type: "number", min: 0.01, max: 3 }, startAnim: { type: "boolean" } },
        Create: (props, _children, context) => {
            const type = props.glowType;
            const glow = type === "Pixel" || type === "buttonOverlay" || type === "ACShine" || type === "Proc";
            return UI.createElement("icon", { ...visual(props), textureSource: context.Source()?.texture,
                onMount: glow ? (frame: wuiraNativeFrame) => mountGlow(frame, props) : undefined } as Partial<IconProps>);
        } });
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
}
