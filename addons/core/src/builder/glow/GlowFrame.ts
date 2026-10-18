import type { Properties } from "../../core/builder";

interface GlowColor { 1: number; 2: number; 3: number; 4: number }
interface GlowLibrary {
    ButtonGlow_Start(frame: wuiraNativeFrame, color: GlowColor | undefined, frequency: number | undefined, frameLevel: number): void;
    ButtonGlow_Stop(frame: wuiraNativeFrame): void;
    PixelGlow_Start(frame: wuiraNativeFrame, color: GlowColor | undefined, lines: number | undefined, frequency: number | undefined, length: number | undefined, thickness: number | undefined, xOffset: number | undefined, yOffset: number | undefined, border: boolean | undefined, key: string, frameLevel: number): void;
    PixelGlow_Stop(frame: wuiraNativeFrame, key: string): void;
    AutoCastGlow_Start(frame: wuiraNativeFrame, color: GlowColor | undefined, lines: number | undefined, frequency: number | undefined, scale: number | undefined, xOffset: number | undefined, yOffset: number | undefined, key: string, frameLevel: number): void;
    AutoCastGlow_Stop(frame: wuiraNativeFrame, key: string): void;
    ProcGlow_Start(frame: wuiraNativeFrame, options: { color?: GlowColor; startAnim?: boolean; duration?: number; xOffset?: number; yOffset?: number; key?: string; frameLevel?: number }): void;
    ProcGlow_Stop(frame: wuiraNativeFrame, key: string): void;
}
declare function LibStub(this: void, major: string, silent?: boolean): GlowLibrary | undefined;

function library(): GlowLibrary | undefined {
    if (typeof LibStub !== "function") return undefined;
    return LibStub("LibCustomGlow-1.0-foreverauras", true) ?? LibStub("LibCustomGlow-1.0", true);
}

function number(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function colorOf(value: unknown): GlowColor | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const color = value as { r?: unknown; g?: unknown; b?: unknown; a?: unknown };
    if (typeof color.r !== "number" || typeof color.g !== "number" || typeof color.b !== "number") return undefined;
    return { 1: color.r, 2: color.g, 3: color.b, 4: typeof color.a === "number" ? color.a : 1 };
}

/** ForeverAuras' LibCustomGlow drawn on the host frame, usually an icon. */
export function mountGlow(frame: wuiraNativeFrame, props: Properties): () => void {
    const glow = library();
    const type = props.glowType;
    if (glow === undefined || (type !== "Pixel" && type !== "buttonOverlay" && type !== "ACShine" && type !== "Proc")) return () => {};
    const color = colorOf(props.color);
    const x = number(props.glowX);
    const y = number(props.glowY);
    if (type === "buttonOverlay") glow.ButtonGlow_Start(frame, color, number(props.frequency), 8);
    else if (type === "ACShine") glow.AutoCastGlow_Start(frame, color, number(props.lines), number(props.frequency), number(props.scale), x, y, "", 0);
    else if (type === "Proc") glow.ProcGlow_Start(frame, { color, startAnim: props.startAnim === true, duration: number(props.duration) ?? 1, xOffset: x ?? 0, yOffset: y ?? 0, key: "", frameLevel: 0 });
    else glow.PixelGlow_Start(frame, color, number(props.lines), number(props.frequency), number(props.length), number(props.thickness), x, y, props.glowBorder === true, "", 0);
    return () => { glow.ButtonGlow_Stop(frame); glow.PixelGlow_Stop(frame, ""); glow.AutoCastGlow_Stop(frame, ""); glow.ProcGlow_Stop(frame, ""); };
}
