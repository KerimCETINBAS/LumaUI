import { UI } from "wuira";
import { FlowLayout, Cell, Background, Border, Tooltip } from "wuira/ui";
import type { CustomizationContext } from "lumaui/core";
import { Core } from "./core";
import type { EditorDraft } from "./Draft";
import { ComponentTitle } from "./ComponentTitle";
import { IconButton } from "./IconButton";
import { Hierarchy } from "./Hierarchy";
import { PropertyInspector } from "./PropertyInspector";
import { SourceInspector } from "./SourceInspector";
import { CollectionInspector } from "./CollectionInspector";
import { mountPreview } from "./Preview";
import { Toolbox } from "./Toolbox";
import { describeNode } from "./NodePresentation";
import { SingleLine } from "./SingleLine";
const colors = Core.Theme.colors;
function Tab({ text, active, width, onClick }: { text: string; active: boolean; width: number; onClick(): void }) {
    const icons: Record<string, string> = { Properties: "inspector", Component: "component", Sources: "sources" };
    return <IconButton width={width} text={text} icon={icons[text] ?? text.toLowerCase()} active={active} quiet onClick={onClick} />;
}
export function EditorView({ draft, width, height }: CustomizationContext & { draft: EditorDraft }) {
    const design = draft.workspaceView === "design";
    const treeWidth = Math.min(260, Math.max(170, width * .24));
    const inspectorWidth = Math.min(340, Math.max(240, width * .31));
    const canvasWidth = Math.max(100, width - treeWidth - inspectorWidth - 24);
    const workspaceHeight = Math.max(180, height - 144);
    const path = draft.Path().map(node => describeNode(draft, node).title).join(" / ");
    const preview = (w: number) => <FlowLayout width={w} height={workspaceHeight} gap={4}>
        <SingleLine width={w} height={20} text="PREVIEW · 1:1 · Click an element to select it" size={10} color={colors.muted} />
        <Cell width={w} height={workspaceHeight - 44} padding={12} onMount={frame => {
            frame.SetClipsChildren(true);
            return mountPreview(frame, draft.Document(), draft.selected, id => draft.Select(id), draft.nodes);
        }} decorations={{ background: new Background({ color: { r: .012, g: .018, b: .028, a: 1 } }), border: new Border({ thickness: 1, color: colors.border }) }} />
        <Cell width={w} height={16} decorations={{ tooltip: new Tooltip({ text: path }) }}>
            <SingleLine width={w} height={16} text={path} size={9} color={colors.accent} />
        </Cell>
    </FlowLayout>;
    const inspector = (w: number) => <FlowLayout width={w} height={workspaceHeight} padding={8} gap={8} decorations={{ background: new Background({ color: colors.surface }) }}>
        <FlowLayout height={28} direction="horizontal" gap={4}>
            <Tab width={(w - 24) / 3} text="Properties" active={draft.inspector === "properties"} onClick={() => draft.SetInspector("properties")} />
            <Tab width={(w - 24) / 3} text="Component" active={draft.inspector === "collection"} onClick={() => draft.SetInspector("collection")} />
            <Tab width={(w - 24) / 3} text="Sources" active={draft.inspector === "sources"} onClick={() => draft.SetInspector("sources")} />
        </FlowLayout>
        {draft.inspector === "collection" ? <CollectionInspector draft={draft} width={w - 16} height={workspaceHeight - 52} />
            : draft.inspector === "sources" ? <SourceInspector draft={draft} width={w - 16} height={workspaceHeight - 52} />
            : <PropertyInspector draft={draft} width={w - 16} height={workspaceHeight - 52} />}
    </FlowLayout>;
    return <FlowLayout width={width} height={height} gap={8}>
        <FlowLayout height={28} direction="horizontal" gap={8}>
            <SingleLine width={150} height={28} text="Visual Editor" size={20} color={colors.text} />
            <ComponentTitle draft={draft} width={Math.max(160, width - 250)} />
            <IconButton width={84} text="Save" icon="save" active hint="Save changes and update the component in the game" onClick={() => draft.Commit()} />
        </FlowLayout>
        <Toolbox draft={draft} width={width} />
        <FlowLayout height={28} direction="horizontal" gap={6}>
            <Tab width={92} text="Design" active={design} onClick={() => draft.SetWorkspace("design")} />
            <Tab width={92} text="Preview" active={draft.workspaceView === "preview"} onClick={() => draft.SetWorkspace("preview")} />
            <Tab width={92} text="Hierarchy" active={draft.workspaceView === "hierarchy"} onClick={() => draft.SetWorkspace("hierarchy")} />
            <Tab width={92} text="Inspector" active={draft.workspaceView === "inspector"} onClick={() => draft.SetWorkspace("inspector")} />
            <Cell width={Math.max(100, width - 392)} height={28} decorations={{ tooltip: new Tooltip({ text: draft.message }) }}>
                <SingleLine width={Math.max(100, width - 392)} height={28} text={(draft.dirty ? "Unsaved · " : "Saved · ") + draft.message} size={10} color={colors.accent} />
            </Cell>
        </FlowLayout>
        <FlowLayout height={workspaceHeight} direction="horizontal" gap={12}>
            {design ? <Hierarchy draft={draft} width={treeWidth} height={workspaceHeight} /> : []}
            {design ? preview(canvasWidth) : draft.workspaceView === "preview" ? preview(width) : []}
            {design ? inspector(inspectorWidth) : draft.workspaceView === "inspector" ? inspector(width) : draft.workspaceView === "hierarchy" ? <Hierarchy draft={draft} width={width} height={workspaceHeight} /> : []}
        </FlowLayout>
    </FlowLayout>;
}
