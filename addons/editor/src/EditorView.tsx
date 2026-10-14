import { UI } from "wuira";
import { FlowLayout, Cell, Button, Label, Background, Border } from "wuira/ui";
import type { CustomizationContext } from "lumaui/core";
import { Core } from "./core";
import type { EditorDraft, NodeKind } from "./Draft";

import { Dropdown } from "./Dropdown";
import { Hierarchy } from "./Hierarchy";
import { PropertyInspector } from "./PropertyInspector";
import { SourceInspector } from "./SourceInspector";
import { mountPreview } from "./Preview";

const colors = Core.Theme.colors;
function Control({ text, onClick, width = 82 }: { text: string; onClick: () => void; width?: number }) {
    return <Button width={width} height={28} onClick={onClick}
        decorations={{ background: new Background({ color: colors.border }) }}>
        <Label text={text} align="CENTER" fontSize={11} color={colors.text} />
    </Button>;
}
export function EditorView({ draft, width, height }: CustomizationContext & { draft: EditorDraft }) {
    const treeWidth = 170;
    const inspectorWidth = Math.min(340, Math.max(280, width * .38));
    const canvasWidth = Math.max(100, width - treeWidth - inspectorWidth - 24);
    const workspaceHeight = Math.max(180, height - 128);
    return <FlowLayout width={width} height={height} gap={8}>
        <Label height={28} text="Visual Editor" fontSize={22} />
        <Label height={20} text="Create a preset, bind sources, then Apply or share. Inactive sources use sample visuals." fontSize={11} color={colors.muted} />
        <FlowLayout height={28} direction="horizontal" gap={6}>
            <Dropdown text="Add element" width={130} options={[{label:"Cell",value:"cell"},{label:"Flow layout",value:"flow"},{label:"Progress",value:"progress"},{label:"Action",value:"action"},{label:"Headless group",value:"fragment"},{label:"Hide native unit frame",value:"hideUnitFrame"}]} onSelect={kind => draft.Add(kind)} />
            <Dropdown text="Add preset" width={140} options={Core.Presets.List().filter(doc => doc.id !== draft.documentId).map(doc => ({label:doc.name,value:doc.id}))} onSelect={id => draft.Embed(id)} />
            <Dropdown text="New" width={80} options={[{label:"Visual preset",value:"visual"},{label:"Headless preset",value:"headless"}]} onSelect={value => draft.New(value === "headless")} />
            <Control text="Save" width={60} onClick={() => draft.Save()} />
            <Control text="Apply" width={60} onClick={() => draft.Apply()} />
            <Control text="Import" width={60} onClick={() => draft.Import()} />
            <Control text="Export" width={60} onClick={() => draft.Export()} />
        </FlowLayout>
        <Label height={20} text={(draft.dirty ? "Unsaved  |  " : "Saved  |  ") + draft.message} fontSize={10} color={colors.accent} />
        <FlowLayout height={workspaceHeight} direction="horizontal" gap={12}>
            <Hierarchy draft={draft} width={treeWidth} height={workspaceHeight} />
            <Cell width={canvasWidth} padding={12} onMount={frame => {
                    frame.SetClipsChildren(true);
                    return mountPreview(frame, draft.Document(), draft.selected);
                }}
                decorations={{ background: new Background({ color: { r: 0.012, g: 0.018, b: 0.028, a: 1 } }),
                    border: new Border({ thickness: 1, color: colors.border }) }}
            />
            <FlowLayout width={inspectorWidth} padding={8} gap={8}
                decorations={{ background: new Background({ color: colors.surface }) }}>
                <FlowLayout height={24} direction="horizontal" gap={4}>
                    <Button width={(inspectorWidth - 20) / 2} onClick={() => draft.SetInspector("properties")}><Label text="Properties" fontSize={10} color={draft.inspector === "properties" ? colors.accent : colors.muted} /></Button>
                    <Button width={(inspectorWidth - 20) / 2} onClick={() => draft.SetInspector("sources")}><Label text="Sources" fontSize={10} color={draft.inspector === "sources" ? colors.accent : colors.muted} /></Button>
                </FlowLayout>
                {draft.inspector === "sources" ? <SourceInspector draft={draft} width={inspectorWidth - 16} height={workspaceHeight - 48} />
                    : <PropertyInspector draft={draft} width={inspectorWidth - 16} height={workspaceHeight - 48} />}
            </FlowLayout>
        </FlowLayout>
    </FlowLayout>;
}
