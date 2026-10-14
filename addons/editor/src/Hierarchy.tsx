import { UI } from "wuira";
import { FlowLayout, Cell, Button, Label, Background } from "wuira/ui";
import type { EditorDraft } from "./Draft";
import { ScrollForm, Action, colors } from "./InspectorControls";
type Placement = "before" | "inside" | "after";
interface DropZone { id: string; position: Placement; frame: wuiraNativeFrame; mark: wuiraNativeTexture; }
/** A complete, scrollable tree. The top/bottom edge reorders; the middle nests. */
export function Hierarchy({ draft, width, height }: { draft: EditorDraft; width: number; height: number }) {
    const zones: DropZone[] = [];
    let dragging: string | undefined;
    let hover: DropZone | undefined;
    let status: wuiraNativeFontString | undefined;
    let viewport: wuiraNativeFrame | undefined;
    const stop = () => { dragging = undefined; hover = undefined; for (const zone of zones) zone.mark.Hide(); status?.SetText("Drag rows to move or nest"); };
    const inspect = () => {
        for (const zone of zones) zone.mark.Hide(); hover = undefined;
        if (dragging === undefined || !viewport?.IsMouseOver()) return;
        for (const zone of zones) if (zone.frame.IsMouseOver()) { hover = zone; break; }
        if (hover === undefined) return;
        const error = draft.DropError(dragging,hover.id,hover.position);
        if (error === undefined) { hover.mark.Show(); status?.SetText((hover.position === "inside" ? "Inside " : hover.position === "before" ? "Before " : "After ") + hover.id); }
        else status?.SetText(error);
    };
    const rows = draft.Tree().map(item => {
        const indent = Math.min(item.depth,6) * 10; const rowWidth = width - 32 - indent;
        return <Button width={rowWidth} height={30} margin={{left:indent}} onClick={() => draft.Select(item.node.id)}
            decorations={{background:new Background({color:draft.selected === item.node.id ? colors.border : colors.surface})}}
            onMount={frame => {
                frame.RegisterForDrag("LeftButton");
                frame.SetScript("OnDragStart", () => { if (item.node.id !== draft.nodes[0].id) { dragging = item.node.id; status?.SetText("Drag rows to move or nest"); } });
                frame.SetScript("OnDragStop", () => { inspect(); const target = hover, id = dragging; stop(); if (target !== undefined && id !== undefined) draft.MoveNode(id,target.id,target.position); });
                const own: DropZone[] = [];
                for (const position of ["before","inside","after"] as Placement[]) {
                    const zone = CreateFrame("Frame",undefined,frame); zone.EnableMouse(false);
                    const anchor = position === "before" ? "TOPLEFT" : position === "after" ? "BOTTOMLEFT" : "LEFT";
                    zone.SetSize(rowWidth,position === "inside" ? 18 : 6); zone.SetPoint(anchor,frame,anchor,0,0);
                    const mark = zone.CreateTexture(undefined,"OVERLAY"); mark.SetAllPoints(zone); mark.SetColorTexture(colors.accent.r,colors.accent.g,colors.accent.b,.45); mark.Hide(); zone.Show();
                    const placement = position === "inside" && !["cell","flow","grid","action","progress","fragment"].includes(item.node.kind) ? "after" : position;
                    const target: DropZone = {id:item.node.id,position:placement,frame:zone,mark}; zones.push(target); own.push(target);
                }
                return () => { frame.RegisterForDrag(); frame.SetScript("OnDragStart",undefined); frame.SetScript("OnDragStop",undefined); for (const target of own) { target.frame.Hide(); const i = zones.indexOf(target); if(i >= 0) zones.splice(i,1); } };
            }}>
            <FlowLayout direction="horizontal" gap={4} padding={{left:4}}>
                <Label width={12} text={item.depth === 0 ? ">" : ":"} color={colors.muted} fontSize={10} />
                <Label text={item.node.name} fontSize={10} />
            </FlowLayout>
        </Button>;
    });
    return <FlowLayout width={width} height={height} padding={8} gap={6} decorations={{background:new Background({color:colors.surface})}}>
        <Label height={24} text="ELEMENTS" color={colors.muted} fontSize={11} />
        <Cell height={20} onMount={frame => { const text = frame.CreateFontString(undefined,"OVERLAY"); text.SetAllPoints(frame); text.SetFont("Fonts\\FRIZQT__.TTF",10,""); text.SetTextColor(colors.muted.r,colors.muted.g,colors.muted.b,1); text.SetText("Drag rows to move or nest"); status = text; return () => { status = undefined; }; }} />
        <ScrollForm width={width-16} height={height-112} rows={rows} hint="Scroll for more elements" offset={draft.treeScroll} remember={offset => { draft.treeScroll = offset; }}
            onViewport={scroll => { viewport = scroll.Frame; scroll.Frame.SetScript("OnUpdate",inspect); return () => { stop(); scroll.Frame.SetScript("OnUpdate",undefined); viewport = undefined; }; }} />
        <FlowLayout height={28} direction="horizontal" gap={6}>
            <Action width={(width-22)/2} text="Move up" onClick={() => draft.ShiftSelected(-1)} />
            <Action width={(width-22)/2} text="Move down" onClick={() => draft.ShiftSelected(1)} />
        </FlowLayout>
    </FlowLayout>;
}
