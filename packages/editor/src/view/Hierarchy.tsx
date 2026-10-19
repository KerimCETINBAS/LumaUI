import { UI } from "wuira/ui";
import { FlowLayout, Cell, Button, Label, Icon, Background, Tooltip } from "wuira/ui";
import type { EditorDraft } from "../draft/Draft";
import { ScrollForm, Action, colors } from "../fields/InspectorControls";
import { describeNode } from "../chrome/NodePresentation";
import { SingleLine } from "../chrome/SingleLine";
import { Glyph, elementIcon } from "../chrome/Glyph";
import { IconButton } from "../chrome/IconButton";
type RenameRow = wuiraNativeFrame & { SetScript(script: "OnDoubleClick", handler: ((this: void, frame: wuiraNativeFrame, mouse?: string) => void) | undefined): void };
type Placement = "before" | "inside" | "after";
interface DropZone { id: string; position: Placement; frame: wuiraNativeFrame; mark: wuiraNativeTexture; }
/** Stable-width rows keep nesting clear without squeezing text into narrow boxes. */
export function Hierarchy({ draft, width, height }: { draft: EditorDraft; width: number; height: number }) {
    const zones: DropZone[] = [];
    let dragging: string | undefined, hover: DropZone | undefined;
    let status: wuiraNativeFontString | undefined, viewport: wuiraNativeFrame | undefined;
    const stop = () => { dragging = undefined; hover = undefined; for (const zone of zones) zone.mark.Hide(); status?.SetText("Drag to move · drop in the middle to nest"); };
    const inspect = () => {
        for (const zone of zones) zone.mark.Hide(); hover = undefined;
        if (dragging === undefined || !viewport?.IsMouseOver()) return;
        for (const zone of zones) if (zone.frame.IsMouseOver()) { hover = zone; break; }
        if (hover === undefined) return;
        const error = draft.DropError(dragging, hover.id, hover.position);
        if (error === undefined) { hover.mark.Show(); status?.SetText((hover.position === "inside" ? "Inside " : hover.position === "before" ? "Before " : "After ") + describeNode(draft, draft.nodes.find(node => node.id === hover!.id)!).title); }
        else status?.SetText(error);
    };
    const entries = draft.VisibleTree();
    const rows = entries.map(item => {
        const indent = Math.min(item.depth, 6) * 12, rowWidth = width - 28;
        const presentation = describeNode(draft, item.node), children = draft.Children(item.node.id);
        return <Button width={rowWidth} height={34} onClick={() => draft.Select(item.node.id)}
            decorations={{ background: new Background({ color: draft.selected === item.node.id ? colors.border : colors.surface }),
                tooltip: new Tooltip({ text: presentation.title, lines: [{ text: presentation.detail }, { text: "ID: " + item.node.id }, ...(item.node.source === undefined ? [] : [{ text: "Source: " + item.node.source }])] }) }}
            onMount={frame => {
                frame.SetClipsChildren(true); frame.RegisterForDrag("LeftButton");
                (frame as RenameRow).SetScript("OnDoubleClick", (_frame,mouse) => { if (mouse === undefined || mouse === "LeftButton") draft.StartNodeRename(item.node.id,presentation.title); });
                frame.SetScript("OnDragStart", () => { if (item.node.id !== draft.nodes[0].id) { dragging = item.node.id; status?.SetText("Drag rows to move or nest"); } });
                frame.SetScript("OnDragStop", () => { inspect(); const target = hover, id = dragging; stop(); if (target !== undefined && id !== undefined) draft.MoveNode(id, target.id, target.position); });
                const own: DropZone[] = [];
                for (const position of ["before", "inside", "after"] as Placement[]) {
                    const zone = CreateFrame("Frame", undefined, frame); zone.EnableMouse(false);
                    const anchor = position === "before" ? "TOPLEFT" : position === "after" ? "BOTTOMLEFT" : "LEFT";
                    zone.SetSize(rowWidth, position === "inside" ? 18 : 6); zone.SetPoint(anchor, frame, anchor, 0, 0);
                    const mark = zone.CreateTexture(undefined, "OVERLAY"); mark.SetAllPoints(zone); mark.SetColorTexture(colors.accent.r, colors.accent.g, colors.accent.b, .45); mark.Hide(); zone.Show();
                    const placement = position === "inside" && !draft.CanContain(item.node) ? "after" : position;
                    const target: DropZone = { id: item.node.id, position: placement, frame: zone, mark }; zones.push(target); own.push(target);
                }
                return () => { (frame as RenameRow).SetScript("OnDoubleClick",undefined); frame.RegisterForDrag(); frame.SetScript("OnDragStart", undefined); frame.SetScript("OnDragStop", undefined); for (const target of own) { target.frame.Hide(); const i = zones.indexOf(target); if (i >= 0) zones.splice(i, 1); } };
            }}>
            <FlowLayout width={rowWidth} height={34} direction="horizontal" gap={4} padding={{ left: 4 }}>
                <Cell width={indent} />
                {children.length > 0 ? <Button width={16} height={34} onClick={() => draft.ToggleExpanded(item.node.id)}><Label text={draft.collapsed.has(item.node.id) ? ">" : "v"} align="CENTER" fontSize={10} color={colors.accent} /></Button> : <Cell width={16} />}
                {presentation.texture === undefined ? <Cell width={20} height={34} padding={{ top: 9 }}><Glyph name={elementIcon(item.node.kind)} color={colors.muted} size={16} /></Cell> : <Icon width={20} height={20} margin={{ top: 7 }} texture={presentation.texture} />}
                <FlowLayout width={Math.max(40, rowWidth - indent - 60)} height={34} gap={0}>
                    <SingleLine width={Math.max(40, rowWidth - indent - 60)} height={19} text={presentation.title} size={11} color={colors.text} />
                    <SingleLine width={Math.max(40, rowWidth - indent - 60)} height={13} text={presentation.detail} size={8} color={colors.muted} />
                </FlowLayout>
            </FlowLayout>
        </Button>;
    });
    return <FlowLayout width={width} height={height} padding={8} gap={6} decorations={{ background: new Background({ color: colors.surface }) }}>
        <SingleLine width={width - 16} height={20} text={"HIERARCHY · " + entries.length + " / " + draft.nodes.length} color={colors.muted} />
        <FlowLayout height={24} direction="horizontal" gap={6}>
            <IconButton width={(width - 22) / 2} height={24} icon="expand" text="Expand all" onClick={() => draft.ExpandAll(true)} />
            <IconButton width={(width - 22) / 2} height={24} icon="collapse" text="Collapse all" onClick={() => draft.ExpandAll(false)} />
        </FlowLayout>
        <Cell height={16} onMount={frame => { const text = frame.CreateFontString(undefined, "OVERLAY"); text.SetAllPoints(frame); text.SetFont("Fonts\\FRIZQT__.TTF", 9, ""); text.SetTextColor(colors.muted.r, colors.muted.g, colors.muted.b, 1); text.SetText("Drag to move · drop in the middle to nest"); status = text; return () => { status = undefined; }; }} />
        <ScrollForm width={width - 16} height={Math.max(80, height - 128)} rows={rows} gap={2} offset={draft.treeScroll} remember={offset => { draft.treeScroll = offset; }}
            onViewport={scroll => { viewport = scroll.Frame; draft.treeViewportHeight = viewport.GetHeight(); scroll.Frame.SetScript("OnUpdate", inspect); return () => { stop(); scroll.Frame.SetScript("OnUpdate", undefined); viewport = undefined; }; }} />
        <FlowLayout height={28} direction="horizontal" gap={6}>
            <Action width={(width - 22) / 2} text="Move up" onClick={() => draft.ShiftSelected(-1)} />
            <Action width={(width - 22) / 2} text="Move down" onClick={() => draft.ShiftSelected(1)} />
        </FlowLayout>
    </FlowLayout>;
}
