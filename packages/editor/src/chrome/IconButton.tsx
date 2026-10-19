import { UI } from "wuira/ui";
import { Button, FlowLayout, Background, Tooltip } from "wuira/ui";
import type { ButtonProps } from "wuira/ui";
import { Core } from "../core";
import { Glyph } from "./Glyph";
import { SingleLine } from "./SingleLine";
export function IconButton({ text, icon, width, height = 28, onClick, active, quiet, hint, onMount, decorations }: {
    text: string; icon: string; width: number; height?: number; onClick(): void; active?: boolean; quiet?: boolean;
    hint?: string; onMount?: ButtonProps["onMount"]; decorations?: ButtonProps["decorations"];
}) {
    const color = active ? Core.Theme.colors.accent : quiet ? Core.Theme.colors.muted : Core.Theme.colors.text;
    return <Button width={width} height={height} onClick={onClick} onMount={onMount}
        decorations={{ background: new Background({ color: quiet && !active ? Core.Theme.colors.surface : Core.Theme.colors.border }),
            ...decorations, ...(hint === undefined ? {} : { tooltip: new Tooltip({ text: hint }) }) }}>
        <FlowLayout width={width} height={height} direction="horizontal" gap={6} padding={{ left: 6, right: 6, top: (height - 14) / 2 }}>
            <Glyph name={icon} color={color} />
            <SingleLine width={Math.max(0, width - 38)} height={14} text={text} size={10} color={color} />
        </FlowLayout>
    </Button>;
}
export function actionIcon(text: string): string {
    const icons: Record<string, string> = { "Delete reference": "trash", "Update preview": "preview", "Delete element": "trash", "Update source": "check", "New source": "plus", Delete: "trash",
        "Edit / create sources": "sources", "Move up": "move-up", "Move down": "move-down", "Use helper expression": "repeat", "Apply binding": "link",
        "Add binding": "plus", "Remove binding": "trash", "Save preset": "save", "Create preset": "plus", Close: "close", Reset: "back" };
    return icons[text] ?? "check";
}
