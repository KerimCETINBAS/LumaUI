import { UI } from "wuira";
import { Label } from "wuira/ui";
import type { ActivationMode, CollectionClass, CollectionCondition } from "lumaui/core";
import type { EditorDraft } from "./Draft";
import { Dropdown } from "./Dropdown";
import { ScrollForm } from "./InspectorControls";
import { Core } from "./core";

const classes = ["WARRIOR", "PALADIN", "HUNTER", "ROGUE", "PRIEST", "SHAMAN", "MAGE", "WARLOCK", "DRUID"] as const;
const conditions = [
    { label: "Any time", value: "" }, { label: "In a party", value: "inParty" },
    { label: "In a raid", value: "inRaid" }, { label: "In any group", value: "inGroup" },
    { label: "Solo", value: "solo" },
];
const modes = [{ label: "Condition met", value: "condMet" }, { label: "Always", value: "always" }, { label: "Never", value: "never" }];

export function CollectionInspector({ draft, width, height }: { draft: EditorDraft; width: number; height: number }) {
    const fieldWidth = width - 8;
    const native = Core.Presets.Layouts;
    const layouts = native.Status === "ready" ? native.Layouts : [];
    const selected = layouts.find(layout => layout.key === draft.nativeLayout);
    const header = "<!Component id=\"" + draft.documentId + '"'
        + (draft.collectionClass === "" ? "" : ' class="' + draft.collectionClass + '"')
        + (draft.collectionCondition === "" ? "" : ' condition="' + draft.collectionCondition + '"')
        + (draft.nativeLayout === "" ? "" : ' layout="' + draft.nativeLayout + '"')
        + ' enabled="' + draft.activationMode + '" />';
    return <ScrollForm onViewport={() => native.onChange(() => Core.RefreshCustomization())} width={width} height={height} offset={draft.collectionScroll} remember={value => { draft.collectionScroll = value; }} rows={[
        <Label height={24} text="Component activation" fontSize={13} color={Core.Theme.colors.accent} />,
        <Label height={76} text={header} fontSize={10} color={Core.Theme.colors.muted} />,
        <Label height={18} text="Activation mode" fontSize={11} />,
        <Dropdown width={fieldWidth} text={modes.find(item => item.value === draft.activationMode)?.label ?? "Condition met"} options={modes}
            onSelect={mode => draft.UpdateActivation({ enabled: mode as ActivationMode })} />,
        <Label height={18} text="Player class" fontSize={11} />,
        <Dropdown width={fieldWidth} text={draft.collectionClass || "Any class"} options={[{ label: "Any class", value: "" }, ...classes.map(value => ({ label: value, value }))]}
            onSelect={value => draft.UpdateActivation({ class: value as CollectionClass | "" })} />,
        <Label height={18} text="Load condition" fontSize={11} />,
        <Dropdown width={fieldWidth} text={conditions.find(item => item.value === draft.collectionCondition)?.label ?? "Any time"} options={conditions}
            onSelect={value => draft.UpdateActivation({ condition: value as CollectionCondition | "" })} />,
        <Label height={18} text="Native Edit Mode layout" fontSize={11} />,
        <Dropdown width={fieldWidth} text={draft.nativeLayout === "" ? "Any layout" : selected?.name ?? "Missing layout (choose again)"}
            options={[{ label: "Any layout", value: "" }, ...layouts.map(layout => ({ label: layout.name + " [" + layout.type + "]", value: layout.key }))]}
            onSelect={layout => draft.UpdateActivation({ layout })} />,
        <Label height={42} text={"Active game layout: " + (native.Status === "ready" ? native.Active?.name ?? "None" : native.Status)} fontSize={10} color={Core.Theme.colors.muted} />,
        <Label height={70} text="Never disables the component. Always bypasses class, group and layout rules. Condition met requires all selected rules. A manually shown roster includes your own unit while solo." fontSize={10} color={Core.Theme.colors.muted} />,
        <Label height={60} text="Unlock positions are saved per active game layout. Renamed or missing layouts must be selected again. Save updates component rules; combat changes wait." fontSize={10} color={Core.Theme.colors.muted} />,
        <Label height={44} text={"Saved component: " + Core.Presets.ActivationStatus(draft.documentId)} fontSize={11} color={Core.Theme.colors.accent} />,
    ]} />;
}
