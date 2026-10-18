import { UI } from "wuira/ui";
import { wuira } from "wuira";
import { Cell, FlowLayout, Background, Border, Tooltip, TextInput } from "wuira/ui";
import type { EditorDraft } from "../draft/Draft";
import { Core } from "../core";
import { Glyph } from "../chrome/Glyph";
import { SingleLine } from "../chrome/SingleLine";
import { IconButton } from "../chrome/IconButton";
type SearchInput = TextInput["Frame"] & { SetScript(script: "OnTextChanged", handler: ((this: void, frame: wuiraNativeFrame) => void) | undefined): void };
/** Filtering remounts only result buttons, retaining the textbox and its native focus. */
export function ComponentRibbon({ draft, width }: { draft: EditorDraft; width: number }) {
    const documents = Core.Presets.List().filter(document => document.id !== draft.documentId);
    const searchWidth = Math.min(176, Math.max(84, width * .3));
    const resultWidth = Math.max(0, width - searchWidth - 12);
    let host: wuiraNativeFrame | undefined, content: wuiraNativeFrame | undefined;
    const render = () => {
        if (host === undefined) return;
        const filter = draft.componentFilter.trim().toLowerCase();
        const matches = documents.filter(document => document.name.toLowerCase().includes(filter) || document.id.toLowerCase().includes(filter));
        const available = Math.max(0, resultWidth - 42);
        const count = Math.min(matches.length, Math.max(0, Math.floor((available + 4) / 116)));
        const shown = matches.slice(0, count);
        const itemWidth = count === 0 ? 0 : Math.min(156, (available - (count - 1) * 4) / count);
        const view = <FlowLayout width={resultWidth} height={28} direction="horizontal" gap={4}>
            {shown.map(document => <IconButton width={itemWidth} text={document.name} icon="component" hint={"Add " + document.name + " inside the selected container"} onClick={() => draft.Embed(document.id)} />)}
            {count === 0 ? <SingleLine width={available} height={28} text={matches.length === 0 ? "No matching components" : "Filter to narrow the list"} color={Core.Theme.colors.muted} size={10} /> : []}
            <Cell width={38} height={28} decorations={{ tooltip: new Tooltip({ text: count + " shown / " + matches.length + " matching components. Refine the filter to find another component." }) }}>
                <SingleLine width={38} height={28} text={count + "/" + matches.length} size={9} color={Core.Theme.colors.muted} />
            </Cell>
        </FlowLayout>;
        const next = wuira.Mount(view, undefined, host), previous = content; content = next;
        if (previous !== undefined) wuira.Unmount(previous);
    };
    return <FlowLayout width={width} height={28} direction="horizontal" gap={12}>
        <FlowLayout width={searchWidth} height={28} direction="horizontal" gap={6}>
            <Cell width={14} height={28} padding={{ top: 7 }}><Glyph name="search" color={Core.Theme.colors.muted} /></Cell>
            <Cell width={searchWidth - 20} height={28} clickThrough={false}
                decorations={{ background: new Background({ color: Core.Theme.colors.background }), border: new Border({ color: Core.Theme.colors.border, thickness: 1 }),
                    tooltip: new Tooltip({ text: "Filter components by name" }) }}
                onMount={frame => {
                    const input = new TextInput(frame, { text: draft.componentFilter, maxBytes: 128, onEscape: () => { input.Frame.SetText(""); } });
                    const native = input.Frame as SearchInput;
                    native.SetScript("OnTextChanged", () => { draft.componentFilter = input.Value; render(); });
                    return () => { native.SetScript("OnTextChanged", undefined); input.Dispose(); };
                }} />
        </FlowLayout>
        <Cell width={resultWidth} height={28} onMount={frame => { host = frame; render(); return () => { if (content !== undefined) wuira.Unmount(content); content = undefined; host = undefined; }; }} />
    </FlowLayout>;
}
