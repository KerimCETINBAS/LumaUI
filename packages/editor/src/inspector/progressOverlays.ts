import type { ElementSection } from "lumaui/core";
import { Core } from "../core";

export const overlayKeys = ["progress", "healPrediction", "absorb", "regen"] as const;

export function isOverlayKey(key: string): boolean { return (overlayKeys as readonly string[]).includes(key); }
export function isOverlay(section: ElementSection): boolean { return isOverlayKey(section.key); }

export const overlayColors: Record<string, { r: number; g: number; b: number; a: number }> = {
    absorb: { r: 0.8, g: 0.9, b: 1, a: 0.55 },
    healPrediction: { r: 0.4, g: 1, b: 0.5, a: 0.5 },
    regen: { r: 0.3, g: 0.7, b: 1, a: 0.45 },
    progress: { r: 1, g: 1, b: 1, a: 0.45 },
};

export function canOverlay(type: string): boolean {
    return Core.Presets.SourcesCompatible(type, "hp") || Core.Presets.SourceChannels(type).some(channel => channel.key === "progress");
}

/** Progress-valued keys a source can draw as its own layer. */
export function overlayChannels(type: string): { label: string; value: string }[] {
    const listed = Core.Presets.SourceChannels(type)
        .filter(channel => isOverlayKey(channel.key))
        .map(channel => ({ label: channel.label, value: channel.key }));
    if (!listed.some(channel => channel.value === "progress")) listed.unshift({ label: "Amount", value: "progress" });
    return listed;
}
