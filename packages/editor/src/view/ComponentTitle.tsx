import { UI } from "wuira/ui";
import { Button, Cell, FlowLayout, TextInput, Tooltip } from "wuira/ui";
import type { EditorDraft } from "../draft/Draft";
import { Glyph } from "../chrome/Glyph";
import { SingleLine } from "../chrome/SingleLine";
import { Core } from "../core";
type RenameButton = wuiraNativeFrame & { SetScript(script: "OnDoubleClick", handler: ((this: void, frame: wuiraNativeFrame, button?: string) => void) | undefined): void };
type RenameInput = TextInput["Frame"] & { SetScript(script: "OnEnterPressed", handler: ((this: void, frame: wuiraNativeFrame) => void) | undefined): void };
export function ComponentTitle({ draft, width }: { draft: EditorDraft; width: number }) {
    if (draft.renaming) return <Cell width={width} height={28} clickThrough={false} onMount={frame => {
        const input = new TextInput(frame, { text: draft.renameValue, maxBytes: 256, onEscape: () => draft.CancelRename() });
        const detach = draft.CaptureRename(() => input.Value), native = input.Frame as RenameInput;
        native.SetScript("OnEnterPressed", () => draft.Rename());
        input.Focus(true);
        return () => { detach(); native.SetScript("OnEnterPressed", undefined); input.Dispose(); };
    }} />;
    return <Button width={width} height={28}
        decorations={{ tooltip: new Tooltip({ text: draft.documentName, lines: [{ text: "Double-click to rename. Enter confirms; Escape cancels." }] }) }}
        onMount={frame => {
            const button = frame as RenameButton;
            button.SetScript("OnDoubleClick", (_frame, mouse) => { if (mouse === undefined || mouse === "LeftButton") draft.StartRename(); });
            return () => button.SetScript("OnDoubleClick", undefined);
        }}>
        <FlowLayout width={width} height={28} direction="horizontal" gap={8} padding={{ top: 6 }}>
            <Glyph name="component" color={Core.Theme.colors.accent} size={16} />
            <SingleLine width={Math.max(0, width - 24)} height={16} text={draft.documentName} size={13} color={Core.Theme.colors.text} />
        </FlowLayout>
    </Button>;
}
