import { UI } from "wuira";
import { Cell } from "wuira/ui";
import type { LabelProps } from "wuira/ui";

/** Keep editor labels on one line; their parent clips long titles. */
export function SingleLine({ text, width, height = 18, size = 11, color }: { text: string; width: number; height?: number; size?: number; color?: LabelProps["color"] }) {
    return <Cell width={width} height={height} onMount={frame => {
        frame.SetClipsChildren(true);
        const label = frame.CreateFontString(undefined, "OVERLAY");
        label.SetAllPoints(frame); label.SetFont("Fonts\\FRIZQT__.TTF", size, "");
        label.SetJustifyH("LEFT"); label.SetJustifyV("MIDDLE");
        (label as wuiraNativeFontString & { SetWordWrap?(wrap: boolean): void }).SetWordWrap?.(false);
        label.SetTextColor(color?.r ?? 1, color?.g ?? 1, color?.b ?? 1, color?.a ?? 1);
        label.SetText(text);
    }} />;
}
