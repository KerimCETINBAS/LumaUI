import { UI } from "wuira";
import { FlowLayout, Cell, Background, Tooltip, Label, Button } from "wuira/ui";
import type { CustomizationContext } from "lumaui/core";
import { Core } from "./core";
import type { EditorDraft } from "./Draft";
import { ComponentTitle } from "./ComponentTitle";
import { IconButton } from "./IconButton";
import { Hierarchy } from "./Hierarchy";
import { PropertyInspector } from "./PropertyInspector";
import { SourceInspector } from "./SourceInspector";
import { CollectionInspector } from "./CollectionInspector";
import { Toolbox } from "./Toolbox";
import { describeNode } from "./NodePresentation";
import { SingleLine } from "./SingleLine";
const colors = Core.Theme.colors;
export function EditorView({ draft, width, height }: CustomizationContext & { draft: EditorDraft }) {
    draft.Suspend();
    const prompt = draft.identityPrompt;
    if (prompt !== undefined) return <FlowLayout width={width} height={height} padding={20} gap={12}>
        <Label height={30} text="Save component identity" fontSize={18} />
        <Label height={60} text={(prompt.duplicate ? "That name already exists. The new name will be: " : "New component identity: ") + prompt.name} />
        <Label height={60} text={prompt.rename ? "Update saved component references to this new name? No leaves missing references for you to repair manually." : "Save this as a separate component? Existing components will be kept."} />
        <Button height={32} onClick={() => draft.ConfirmIdentity(true)}><Label text={prompt.rename ? "Yes · update references" : "Save separate component"} /></Button>
        {prompt.rename ? <Button height={32} onClick={() => draft.ConfirmIdentity(false)}><Label text="No · keep old references" /></Button> : []}
        <Button height={32} onClick={() => draft.CancelIdentity()}><Label text="Cancel" /></Button>
    </FlowLayout>;
    const design = draft.workspaceView === "design";
    const treeWidth = Math.min(260, Math.max(170, width * .24));
    const inspectorWidth = Math.min(340, Math.max(240, width * .31));
    const canvasWidth = Math.max(100, width - treeWidth - inspectorWidth - 24);
    const workspaceHeight = Math.max(180, height - 132);
    const path = draft.Path().map(node => describeNode(draft, node).title).join(" / ");
    const expand = (view: "preview" | "hierarchy" | "inspector") => <IconButton width={84} height={24}
        text={design ? "Expand" : "Restore"} icon={design ? "expand" : "back"}
        hint={design ? "Expand this panel" : "Return to the three-panel workspace"}
        onClick={() => draft.SetWorkspace(design ? view : "design")} />;
    const tree = (w: number) => <FlowLayout width={w} height={workspaceHeight} gap={6}>
        <FlowLayout height={24} direction="horizontal" gap={6}>{expand("hierarchy")}<SingleLine width={w - 90} height={24} text="Hierarchy" /></FlowLayout>
        <Hierarchy draft={draft} width={w} height={workspaceHeight - 30} />
    </FlowLayout>;
    const center = (w: number) => <FlowLayout width={w} height={workspaceHeight} gap={6}>
        <FlowLayout width={w} height={24} direction="horizontal" gap={4}>
            {expand("preview")}
            {(["properties", "collection", "sources"] as const).map(tab => <IconButton width={(w - 96) / 3} height={24}
                text={tab === "properties" ? "Preview" : tab === "collection" ? "Component" : "Sources"}
                icon={tab === "properties" ? "preview" : tab === "collection" ? "component" : "sources"}
                quiet active={draft.inspector === tab} onClick={() => draft.SetInspector(tab)} />)}
        </FlowLayout>
        {draft.inspector === "collection" ? <CollectionInspector draft={draft} width={w} height={workspaceHeight - 30} />
            : draft.inspector === "sources" ? <SourceInspector draft={draft} width={w} height={workspaceHeight - 30} />
            : <FlowLayout width={w} height={workspaceHeight - 30} gap={6}>
                {Core.Preview({ width: w, height: workspaceHeight - 52, document: draft.Document(), selected: draft.selected,
                    onSelect: id => draft.Select(id), zoom: draft.previewZoom, onZoomChange: zoom => { draft.previewZoom = zoom; } })}
                <Cell width={w} height={16} decorations={{ tooltip: new Tooltip({ text: path }) }}><SingleLine width={w} height={16} text={path} size={9} color={colors.accent} /></Cell>
            </FlowLayout>}
    </FlowLayout>;
    const inspector = (w: number) => <FlowLayout width={w} height={workspaceHeight} gap={6} decorations={{ background: new Background({ color: colors.surface }) }}>
        <FlowLayout height={24} direction="horizontal" gap={6}>{expand("inspector")}<SingleLine width={w - 90} height={24} text="Properties" /></FlowLayout>
        <PropertyInspector draft={draft} width={w} height={workspaceHeight - 30} />
    </FlowLayout>;
    return <FlowLayout width={width} height={height} gap={8}>
        <FlowLayout height={28} direction="horizontal" gap={8}>
            <SingleLine width={150} height={28} text="Visual Editor" size={20} color={colors.text} />
            <ComponentTitle draft={draft} width={Math.max(100, width - 450)} />
            <IconButton width={84} text="Undo" icon="back" quiet={!draft.CanUndo} hint="Undo the last change, including deleted elements" onClick={() => draft.Undo()} />
            <IconButton width={84} text="Redo" icon="move-up" quiet={!draft.CanRedo} hint="Restore an undone change" onClick={() => draft.Redo()} />
            <IconButton width={84} text="Save" icon="save" active hint="Save changes and update the component in the game" onClick={() => draft.Commit()} />
        </FlowLayout>
        <Toolbox draft={draft} width={width} />
        <FlowLayout height={workspaceHeight} direction="horizontal" gap={12}>
            {design ? tree(treeWidth) : draft.workspaceView === "hierarchy" ? tree(width) : []}
            {design ? center(canvasWidth) : draft.workspaceView === "preview" ? center(width) : []}
            {design ? inspector(inspectorWidth) : draft.workspaceView === "inspector" ? inspector(width) : []}
        </FlowLayout>
        <Cell width={width} height={16} onMount={frame => {
            const text = frame.CreateFontString(undefined, "OVERLAY"); text.SetAllPoints(frame); text.SetFont("Fonts\\FRIZQT__.TTF", 10, "");
            text.SetTextColor(colors.accent.r, colors.accent.g, colors.accent.b, 1); text.SetJustifyH("LEFT");
            const update = () => text.SetText((draft.HasUnsavedChanges ? "Unsaved · " : "Saved · ") + draft.message);
            let elapsed = 0; update(); frame.SetScript("OnUpdate", (_frame, delta) => { elapsed += delta as number; if (elapsed >= .2) { elapsed = 0; update(); } });
            return () => frame.SetScript("OnUpdate", undefined);
        }} />
    </FlowLayout>;
}
