import { UI } from "wuira/ui";
import type { Cell as View } from "wuira/ui";
import { Label } from "wuira/ui";
import type { EditorDraft } from "../draft/Draft";
import { IconButton } from "../chrome/IconButton";
import { Dropdown } from "../fields/Dropdown";
import { PropertySourceField, VisualSourceField } from "../fields/PropertySourceFields";
import { Action, ColorFields, Heading, Note } from "../fields/InspectorControls";
import { TextureField } from "../fields/TextureField";
import { canOverlay, isOverlay, overlayChannels } from "./progressOverlays";


/** One bar, one main progress, and optional overlay progresses that share the same frame. */
export function ProgressLayers({ draft, width }: { draft: EditorDraft; width: number }): View[] {
    const state = draft.propertyEditor;
    const sources = draft.sources.filter(source => canOverlay(source.type));
    const options = sources.map(source => ({ label: source.name, value: source.name }));
    const rows: View[] = [
        <Heading width={width} text="Progress" />,
        <VisualSourceField draft={draft} field="source" title="Source" width={width} path />,
        <TextureField state={state} name="foreground.texture" title="Texture" width={width} kind="progress" />,
        <PropertySourceField draft={draft} target="color" width={width}>
            <ColorFields state={state} name="color" title="Color" width={width} />
        </PropertySourceField>,
        <Note width={width} text="This progress fills the bar. Add a section to draw another amount on top of it." />,
    ];
    for (const [index, section] of (draft.Selected.sections ?? []).entries()) {
        if (!isOverlay(section)) continue;
        const type = sources.find(source => source.name === section.source)?.type ?? "";
        const channels = overlayChannels(type);
        rows.push(<Heading width={width} text="Section" />);
        rows.push(<Label width={width} height={17} text="Source" fontSize={10} />);
        rows.push(<Dropdown width={width} text={section.source} options={options.length > 0 ? options : [{ label: section.source, value: section.source }]}
            onSelect={value => draft.SetOverlay(index, { source: value, key: overlayChannels(sources.find(source => source.name === value)?.type ?? "")[0]?.value ?? "progress" })} />);
        if (channels.length > 1) {
            rows.push(<Label width={width} height={17} text="Value" fontSize={10} />);
            rows.push(<Dropdown width={width} text={channels.find(channel => channel.value === section.key)?.label ?? section.key} options={channels}
                onSelect={value => draft.SetOverlay(index, { key: value })} />);
        }
        rows.push(<TextureField state={state} name={"$overlay." + index + ".texture"} title="Texture" width={width} kind="progress" />);
        rows.push(<ColorFields state={state} name={"$overlay." + index + ".color"} title="Color" width={width} />);
        rows.push(<Action width={width} text="Remove section" onClick={() => draft.RemoveOverlay(index)} />);
    }
    rows.push(<IconButton width={width} text="Add section" icon="plus" onClick={() => draft.AddOverlay()} />);
    if (sources.length === 0) rows.push(<Note width={width} text="Add a progress source, such as health, before attaching an overlay." />);
    return rows;
}
