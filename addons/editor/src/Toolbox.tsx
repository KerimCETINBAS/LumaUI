import { UI } from "wuira";
import { FlowLayout } from "wuira/ui";
import type { EditorDraft } from "./Draft";
import { elementChoices } from "./ElementCatalog";
import { IconButton } from "./IconButton";
import { elementIcon } from "./Glyph";
import { ComponentRibbon } from "./ComponentRibbon";
const groups = [
    { id: "layout", name: "Layout", icon: "layout", kinds: ["cell", "flow", "grid", "foreach", "fragment"] },
    { id: "display", name: "Visuals", icon: "visuals", kinds: ["progress", "action", "label", "icon"] },
    { id: "unit", name: "Units", icon: "units", kinds: ["unitPortrait", "unitText", "unitIndicator", "unitAuras", "unitAuraIndicator"] },
    { id: "effects", name: "Effects", icon: "effects", kinds: ["hideUnitFrame", "hideActionBars"] },
    { id: "components", name: "Components", icon: "component", kinds: [] as string[] },
];
const short: Record<string, string> = { cell: "Cell", flow: "Flow", grid: "Grid", foreach: "Repeat", fragment: "Group", progress: "Bar", action: "Button", label: "Text", icon: "Icon", unitPortrait: "Portrait", unitText: "Unit text", unitIndicator: "Role / leader", unitAuras: "Auras", unitAuraIndicator: "Aura indicator", hideUnitFrame: "Hide unit", hideActionBars: "Hide bars" };
export function Toolbox({ draft, width }: { draft: EditorDraft; width: number }) {
    const choices = elementChoices(), sections = [...groups];
    const extras = choices.filter(choice => !groups.some(group => group.kinds.includes(choice.value)));
    if (extras.length > 0) sections.push({ id: "other", name: "Other", icon: "component", kinds: extras.map(choice => choice.value) });
    const selected = sections.find(group => group.id === draft.toolbox) ?? sections[0];
    const tools = choices.filter(choice => selected.kinds.includes(choice.value));
    const tabWidth = (id: string) => Math.min(id === "components" ? 116 : 92, (width - (sections.length - 1) * 4) / sections.length);
    const toolWidth = Math.min(160, (width - Math.max(0, tools.length - 1) * 4) / Math.max(1, tools.length));
    return <FlowLayout width={width} height={64} gap={6}>
        <FlowLayout height={28} direction="horizontal" gap={4}>
            {sections.map(group => <IconButton width={tabWidth(group.id)} text={group.name} icon={group.icon} active={group.id === selected.id} quiet onClick={() => draft.SetToolbox(group.id)} />)}
        </FlowLayout>
        {selected.id === "components" ? <ComponentRibbon draft={draft} width={width} /> : <FlowLayout width={width} height={28} direction="horizontal" gap={4}>
            {tools.map(tool => <IconButton width={toolWidth} text={short[tool.value] ?? tool.label} icon={elementIcon(tool.value)}
                hint={"Add " + tool.label + " inside the selected container"} onClick={() => draft.Add(tool.value)} />)}
        </FlowLayout>}
    </FlowLayout>;
}
