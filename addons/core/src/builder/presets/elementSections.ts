import { HP } from "wuira/datasources";
import type { ProgressSource } from "wuira/datasources";
import type { Cell } from "wuira/ui";
import type { ElementSection, PresetNode, Properties, SourceInstance } from "../../core/builder";
import type { UnitInput } from "wuira/datasources";
import { tintPrimaryPower } from "../units/UnitWidgets";

const contentKeys = ["name", "health", "percent", "role", "leader", "buffs", "dispellable", "movement", "other"];
const healColor = { r: 0.4, g: 1, b: 0.5, a: 0.5 };
const absorbColor = { r: 0.8, g: 0.9, b: 1, a: 0.55 };

function fileId(value: string): number | undefined {
    if (value.length === 0) return undefined;
    let index = 0;
    while (index < value.length) {
        const code = value.charCodeAt(index);
        if (code < 48 || code > 57) return undefined;
        index++;
    }
    return Number(value);
}

declare const C_Texture: { GetAtlasInfo?(this: void, atlas: string): unknown } | undefined;

function isAtlas(name: string): boolean {
    if (typeof GetAtlasInfo === "function" && GetAtlasInfo(name) !== undefined) return true;
    const textures = C_Texture;
    return textures !== undefined && textures.GetAtlasInfo !== undefined && textures.GetAtlasInfo(name) !== undefined;
}

function overlay(frame: wuiraNativeFrame, progress: ProgressSource, color: { r: number; g: number; b: number; a?: number }, texture?: string): (() => void) | undefined {
    const bar = frame as wuiraNativeStatusBar;
    bar.SetClipsChildren(true);
    const layer = CreateFrame("StatusBar", undefined, bar);
    layer.EnableMouse(false);
    layer.SetAllPoints(bar);
    const fill = texture !== undefined && texture !== "" ? texture : "Interface\\Buttons\\WHITE8X8";
    const id = fileId(fill);
    if (id !== undefined) layer.SetStatusBarTexture(id);
    else if (isAtlas(fill)) {
        layer.SetStatusBarTexture("Interface\\Buttons\\WHITE8X8");
        const painted = layer.GetStatusBarTexture() as wuiraNativeTexture & { SetAtlas?(atlas: string): void };
        if (painted !== undefined && painted.SetAtlas !== undefined) painted.SetAtlas(fill);
    } else layer.SetStatusBarTexture(fill);
    layer.SetStatusBarColor(color.r, color.g, color.b, color.a ?? 0.5);
    const stop = progress.BindTo(layer);
    return typeof stop === "function" ? stop : undefined;
}

/** Copies section keys onto the widget props the factories already understand. */
export function applySectionProps(node: PresetNode, props: Properties, source: (name: string) => SourceInstance): void {
    const sections = node.sections ?? [];
    if (node.type === "progress") {
        props.healPrediction = false; props.absorbPrediction = false;
        for (const section of sections) {
            const bound = source(section.source);
            const color = section.color ?? (section.key === "absorb" ? absorbColor : healColor);
            const style = { color } as Properties;
            if (section.texture !== undefined && section.texture !== "") style.texture = section.texture;
            if (section.key === "healPrediction" && bound.progress instanceof HP) props.healPrediction = style;
            if (section.key === "absorb" && bound.progress instanceof HP) props.absorbPrediction = style;
        }
    }
    const content = sections.find(section => contentKeys.includes(section.key));
    if (content !== undefined && (node.type === "unitText" || node.type === "unitIndicator")) props.field = content.key;
    if (content !== undefined && (node.type === "unitAuras" || node.type === "unitAuraIndicator")) props.category = content.key;
}

/** Extra channels on any element: progress overlays, text, alpha, texture, and power color. */
export function mountSections(view: Cell, node: PresetNode, preview: boolean, source: (name: string) => SourceInstance, unit: (token: string) => UnitInput, unitOf: (name: string) => string | undefined): void {
    const sections = node.sections ?? [];
    if (sections.length === 0) return;
    const props = view.props as Record<string, unknown>;
    const overlays: { progress: ProgressSource; color: { r: number; g: number; b: number; a?: number }; texture?: string }[] = [];
    for (const section of sections) {
        const bound = source(section.source);
        const channel: SourceInstance | undefined = section.key === "progress" ? bound : bound.channels?.[section.key];
        if (channel?.Text !== undefined && node.type === "label") props.text = () => channel.Text!();
        if (channel?.Alpha !== undefined) props.alpha = () => channel.Alpha!();
        if (channel?.texture !== undefined && node.type === "icon") props.textureSource = channel.texture;
        const progress = channel?.progress;
        const widgetHeal = (section.key === "healPrediction" || section.key === "absorb") && bound.progress instanceof HP;
        if (node.type === "progress" && progress !== undefined && !widgetHeal) overlays.push({ progress: progress as ProgressSource, color: section.color ?? (section.key === "absorb" ? absorbColor : healColor), texture: section.texture });
    }
    const colorSections = sections.filter(section => node.type === "progress" && section.key === "color");
    if (overlays.length === 0 && colorSections.length === 0) return;
    const previous = props.onMount as ((frame: wuiraNativeFrame) => void | (() => void)) | undefined;
    props.onMount = (frame: wuiraNativeFrame) => {
        const stopPrevious = previous?.(frame);
        const stops: (() => void)[] = [];
        for (const section of colorSections) {
            if (preview) (frame as wuiraNativeStatusBar).SetStatusBarColor(0.2, 0.45, 0.95, 1);
            else stops.push(tintPrimaryPower(frame, unit(unitOf(section.source) ?? "player")));
        }
        for (const item of overlays) { const stop = overlay(frame, item.progress, item.color, item.texture); if (stop !== undefined) stops.push(stop); }
        return () => { if (typeof stopPrevious === "function") stopPrevious(); for (const stop of stops) stop(); };
    };
}

