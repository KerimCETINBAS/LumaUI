import { UI } from "wuira/ui";
import type { Cell } from "wuira/ui";
import type { EditorDraft } from "../draft/Draft";
import { Core } from "../core";
import { Dropdown } from "../fields/Dropdown";
import { Action, Heading, Note } from "../fields/InspectorControls";

const content: Record<string, { title: string; keys: { label: string; value: string }[] }> = {
    unitText: { title: "Text", keys: [{ label: "Name", value: "name" }, { label: "Health", value: "health" }, { label: "Health percent", value: "percent" }] },
    unitIndicator: { title: "Indicator", keys: [{ label: "Role", value: "role" }, { label: "Leader", value: "leader" }] },
    unitAuras: { title: "Auras", keys: [{ label: "Buffs", value: "buffs" }, { label: "Dispellable", value: "dispellable" }, { label: "Movement", value: "movement" }, { label: "Other", value: "other" }] },
    unitAuraIndicator: { title: "Aura indicator", keys: [{ label: "Dispellable", value: "dispellable" }, { label: "Movement", value: "movement" }] },
};

/** Every element binds extra channels the same way: pick a source, then one of its keys. */
export function Sections({ draft, width }: { draft: EditorDraft; width: number }): Cell[] {
    const node = draft.Selected;
    const rows: Cell[] = [<Heading width={width} text="Sections" />, <Note width={width} text="A section reads one key from a source. Health absorbs, regen, power color, names, and aura groups are sections, not widget settings." />];
    const kind = content[node.kind];
    if (kind !== undefined) {
        const current = String(node.props?.[kind.title === "Text" || kind.title === "Indicator" ? "field" : "category"] ?? kind.keys[0].value);
        rows.push(<Dropdown width={width} text={kind.keys.find(item => item.value === current)?.label ?? current} options={kind.keys} onSelect={value => draft.SetContentKey(value)} />);
    }
    for (const [index, section] of (node.sections ?? []).entries()) {
        const label = Core.Presets.SourceChannels(draft.sources.find(source => source.name === section.source)?.type ?? "").find(item => item.key === section.key)?.label ?? section.key;
        rows.push(<Note width={width} text={section.source + " · " + label} />);
        rows.push(<Action width={width} text={"Remove " + label} onClick={() => draft.RemoveSection(index)} />);
    }
    const sources = draft.sources.filter(source => Core.Presets.SourceChannels(source.type).length > 0);
    if (sources.length === 0) {
        rows.push(<Note width={width} text="Add a source, then attach one of its keys here." />);
        return rows;
    }
    if (draft.sectionSource === "" || !sources.some(source => source.name === draft.sectionSource)) draft.sectionSource = sources[0].name;
    const channels = Core.Presets.SourceChannels(sources.find(source => source.name === draft.sectionSource)?.type ?? "");
    if (draft.sectionKey === "" || !channels.some(channel => channel.key === draft.sectionKey)) draft.sectionKey = channels[0]?.key ?? "";
    rows.push(<Dropdown width={width} text={draft.sectionSource} options={sources.map(source => ({ label: source.name, value: source.name }))} onSelect={value => { draft.sectionSource = value; draft.sectionKey = ""; Core.RefreshCustomization(); }} />);
    rows.push(<Dropdown width={width} text={channels.find(channel => channel.key === draft.sectionKey)?.label ?? "Key"} options={channels.map(channel => ({ label: channel.label, value: channel.key }))} onSelect={value => { draft.sectionKey = value; Core.RefreshCustomization(); }} />);
    rows.push(<Action width={width} text="Add section" onClick={() => draft.AddSection()} />);
    return rows;
}
