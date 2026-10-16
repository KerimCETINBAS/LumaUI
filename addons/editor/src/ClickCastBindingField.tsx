import { UI, FlowLayout } from "wuira/ui";
import type { EditorDraft } from "./Draft";
import { Core } from "./core";
import { Dropdown } from "./Dropdown";
import { Heading, Note } from "./InspectorControls";

/** A visual component stores only a reference; Click Cast owns the named preset. */
export function ClickCastBindingField({ draft, width }: { draft: EditorDraft; width: number }) {
    const currentId = typeof draft.Selected.props?.clickCastPreset === "string" ? draft.Selected.props.clickCastPreset : undefined;
    const current = currentId === undefined ? undefined : Core.ClickCastPresets.Get(currentId);
    const select = (id: string) => {
        try {
            draft.propertyEditor.Flush();
            const props = { ...draft.Selected.props };
            if (id === "") delete props.clickCastPreset; else props.clickCastPreset = id;
            draft.UpdateProperties(props); draft.propertyEditor.Open();
        } catch (failure) { draft.Report(String(failure)); }
    };
    return <FlowLayout width={width} gap={6}>
        <Heading width={width} text="Standard click actions" />
        <Note width={width} text="Built in and fixed: left click selects the unit; right click opens its context menu." />
        <Heading width={width} text="Click Cast preset" />
        <Dropdown width={width} text={currentId === "standard" ? "Standard" : current?.name ?? "None"} options={[
            { label: "None", value: "" },
            { label: "Standard · select / context menu", value: "standard" },
            ...Core.ClickCastPresets.List().map(preset => ({ label: preset.name + "  ·  " + preset.bindings.length + " bindings", value: preset.id })),
        ]} onSelect={select} />
        <Note width={width} text={current === undefined
            ? "Choose a named preset from the Click Cast library. A SecureButton uses one preset, and the same preset can be shared by multiple buttons."
            : "Attached: " + current.bindings.length + " bindings. " + current.bindings.slice(0, 2).map(binding => binding.key + " → " + (binding.spellId !== undefined ? "Spell #" + binding.spellId : binding.itemId !== undefined ? "Item #" + binding.itemId : binding.macro)).join("; ") + ". Edit all bindings in the Click Cast library."} />
    </FlowLayout>;
}
