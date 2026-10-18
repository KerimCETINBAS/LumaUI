import { UI } from "wuira/ui";
import { Cell, FlowLayout } from "wuira/ui";
import type { LabelProps } from "wuira/ui";
import { darkTheme } from "./dark";

/** Shared native texture glyphs, generated from the editable SVG sources at build time. */
export function Glyph({ icon, size = 14, color = darkTheme.colors.text }: { icon: string; size?: number; color?: LabelProps["color"] }) {
    const textures: Readonly<Record<string, string>> = darkTheme.icons;
    return <Cell width={size} height={size} onMount={frame => {
        const texture = frame.CreateTexture(undefined, "OVERLAY");
        texture.SetAllPoints(frame); texture.SetTexture(textures[icon] ?? textures.component);
        texture.SetVertexColor(color.r, color.g, color.b, color.a ?? 1);
    }} />;
}
export function ControlContent({ text, icon, width, height = 24, size = 10, color = darkTheme.colors.text }: {
    text: string; icon: string; width: number; height?: number; size?: number; color?: LabelProps["color"];
}) {
    return <FlowLayout width={width} height={height} direction="horizontal" gap={6} padding={{ left: 6, right: 6, top: (height - 14) / 2 }}>
        <Glyph icon={icon} color={color} />
        <Cell width={Math.max(0, width - 32)} height={14} onMount={frame => {
            frame.SetClipsChildren(true);
            const label = frame.CreateFontString(undefined, "OVERLAY");
            label.SetAllPoints(frame); label.SetFont("Fonts\\FRIZQT__.TTF", size, "");
            label.SetJustifyH("LEFT"); label.SetJustifyV("MIDDLE");
            (label as wuiraNativeFontString & { SetWordWrap?(wrap: boolean): void }).SetWordWrap?.(false);
            label.SetTextColor(color.r, color.g, color.b, color.a ?? 1); label.SetText(text);
        }} />
    </FlowLayout>;
}
export function controlIcon(text: string): string {
    const icons: Record<string, string> = { Enable: "enabled", Disable: "disabled", Edit: "edit", Export: "export", Delete: "trash",
        "Built-in presets": "import", "Add binding": "plus", "Save preset": "save", New: "plus", "Choose action...": "button" };
    return icons[text] ?? "button";
}
