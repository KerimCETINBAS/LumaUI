import { UI } from "wuira/ui";
import type { EditorDraft } from "../draft/Draft";
import { Dropdown } from "./Dropdown";
import type { Choice } from "./Dropdown";

export function unitChoices(draft: EditorDraft): Choice[] {
    const named = draft.sources.filter(source => source.type === "unit").map(source => ({
        label: source.name + (source.isProp ? " · input" : " · UnitSource"),
        value: source.name,
    }));
    return [
        { label: "Current member", value: "$unit" },
        { label: "Member pet", value: "$pet" },
        { label: "Player", value: "player" },
        { label: "Target", value: "target" },
        { label: "Focus", value: "focus" },
        ...named,
    ];
}

export function UnitChoice({ draft, value, onSelect, width }: { draft: EditorDraft; value: string; onSelect(value: string): void; width: number }) {
    const options = unitChoices(draft);
    const current = options.find(option => option.value === value);
    return <Dropdown width={width} text={current?.label ?? (value === "" ? "Choose unit" : value)} options={options} onSelect={onSelect} />;
}
