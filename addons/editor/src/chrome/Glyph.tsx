import { UI } from "wuira/ui";
import { Cell } from "wuira/ui";
import type { LabelProps } from "wuira/ui";
import { Core } from "../core";
export function Glyph({ name, size = 14, color = Core.Theme.colors.text }: { name: string; size?: number; color?: LabelProps["color"] }) {
    return <Cell width={size} height={size} onMount={frame => {
        const texture = frame.CreateTexture(undefined, "OVERLAY");
        texture.SetAllPoints(frame); texture.SetTexture(Core.Theme.icons[name] ?? Core.Theme.icons.component);
        texture.SetVertexColor(color.r, color.g, color.b, color.a ?? 1);
    }} />;
}
export function elementIcon(kind: string): string {
    const icons: Record<string, string> = { cell: "cell", flow: "flow", grid: "grid", foreach: "repeat", fragment: "group", progress: "bar", action: "button", label: "text", icon: "image",
        unitPortrait: "portrait", unitText: "unit-text", unitIndicator: "role", unitAuras: "auras", unitAuraIndicator: "aura-alert", hideUnitFrame: "hide-unit", hideActionBars: "hide-bars", preset: "component" };
    return icons[kind] ?? "component";
}
