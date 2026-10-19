import type { Properties } from "../../core/builder";
import { startOverlayGlow } from "wuira/ui";

function number(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function colorOf(value: unknown): { r: number; g: number; b: number; a?: number } | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const color = value as { r?: unknown; g?: unknown; b?: unknown; a?: unknown };
    if (typeof color.r !== "number" || typeof color.g !== "number" || typeof color.b !== "number") return undefined;
    return { r: color.r, g: color.g, b: color.b, ...(typeof color.a === "number" ? { a: color.a } : {}) };
}

/** Draws the icon glow with wuira's overlay. `active` starts and stops it; omitted means always on. */
export function mountGlow(frame: wuiraNativeFrame, props: Properties, active?: () => boolean): () => void {
    const type = props.glowType;
    if (type !== "Pixel" && type !== "buttonOverlay" && type !== "ACShine" && type !== "Proc") return () => {};
    const options = {
        kind: type as "Pixel" | "buttonOverlay" | "ACShine" | "Proc",
        color: colorOf(props.color),
        lines: number(props.lines),
        frequency: number(props.frequency),
        length: number(props.length),
        thickness: number(props.thickness),
        scale: number(props.scale),
        border: props.glowBorder === true,
        x: number(props.glowX),
        y: number(props.glowY),
        duration: number(props.duration),
    };
    let stop = () => {};
    let shown = false;
    const show = () => {
        if (shown) return;
        try { stop = startOverlayGlow(frame, options); shown = true; }
        catch { shown = false; }
    };
    const hide = () => {
        if (!shown) return;
        shown = false;
        const dispose = stop;
        stop = () => {};
        dispose();
    };
    if (active === undefined) { show(); return hide; }
    const ticker = CreateFrame("Frame", undefined, UIParent);
    const apply = () => { let on = false; try { on = active(); } catch { on = false; } if (on) show(); else hide(); };
    ticker.SetScript("OnUpdate", apply);
    apply();
    return () => { ticker.SetScript("OnUpdate", undefined); ticker.Hide(); hide(); };
}
